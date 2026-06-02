const mysql = require('mysql2/promise');
const crypto = require('crypto');
const config = require('./config');
const { buildTimeRange, parseTimeRangeLabel, rangesOverlap } = require('./utils/time');

/** @type {import('mysql2/promise').Pool | null} */
let pool = null;

async function ensureDatabase() {
  const c = config.mysql;
  const conn = await mysql.createConnection({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${c.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function runMigrations() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openid VARCHAR(64) NOT NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      name VARCHAR(128) NOT NULL DEFAULT '',
      student_id VARCHAR(64) NOT NULL DEFAULT '',
      phone VARCHAR(32) NOT NULL DEFAULT '',
      college VARCHAR(128) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_users_openid (openid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      venue_id VARCHAR(32) NOT NULL,
      venue_name VARCHAR(64) NOT NULL,
      \`date\` DATE NOT NULL,
      time_slot VARCHAR(64) NOT NULL,
      remark VARCHAR(512) NOT NULL DEFAULT '',
      court_type ENUM('full','half') NOT NULL DEFAULT 'full',
      duration_hours DECIMAL(3,1) NOT NULL DEFAULT 1.0,
      status ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_bookings_user (user_id),
      KEY idx_bookings_venue_date (venue_id, \`date\`),
      KEY idx_bookings_status (status),
      CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('booking_created', 'booking_confirmed', 'booking_rejected', 'reminder') NOT NULL,
      title VARCHAR(128) NOT NULL,
      content TEXT NOT NULL,
      related_booking_id CHAR(36) DEFAULT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_notifications_user (user_id),
      KEY idx_notifications_read (is_read),
      KEY idx_notifications_created (created_at),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_notifications_booking FOREIGN KEY (related_booking_id) REFERENCES bookings(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn(
    p,
    'bookings',
    'court_type',
    "ALTER TABLE bookings ADD COLUMN court_type ENUM('full','half') NOT NULL DEFAULT 'full' AFTER remark"
  );
  await ensureColumn(
    p,
    'bookings',
    'duration_hours',
    "ALTER TABLE bookings ADD COLUMN duration_hours DECIMAL(3,1) NOT NULL DEFAULT 1.0 AFTER court_type"
  );
  await ensureIndex(p, 'bookings', 'idx_bookings_user', 'ALTER TABLE bookings ADD KEY idx_bookings_user (user_id)');
  await ensureIndex(p, 'bookings', 'idx_bookings_venue_date', 'ALTER TABLE bookings ADD KEY idx_bookings_venue_date (venue_id, `date`)');
  await ensureIndex(p, 'bookings', 'idx_bookings_status', 'ALTER TABLE bookings ADD KEY idx_bookings_status (status)');

  await ensureColumn(
    p,
    'notifications',
    'related_booking_id',
    'ALTER TABLE notifications ADD COLUMN related_booking_id CHAR(36) DEFAULT NULL AFTER content'
  );
  await ensureColumn(
    p,
    'notifications',
    'is_read',
    'ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER related_booking_id'
  );
  await ensureIndex(p, 'notifications', 'idx_notifications_user', 'ALTER TABLE notifications ADD KEY idx_notifications_user (user_id)');
  await ensureIndex(p, 'notifications', 'idx_notifications_read', 'ALTER TABLE notifications ADD KEY idx_notifications_read (is_read)');
  await ensureIndex(p, 'notifications', 'idx_notifications_created', 'ALTER TABLE notifications ADD KEY idx_notifications_created (created_at)');
}

async function ensureColumn(p, tableName, columnName, alterSql) {
  const [rows] = await p.query(
    `SELECT COUNT(*) AS n
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  const n = rows[0].n;
  if (Number(n) === 0) {
    await p.query(alterSql);
  }
}

async function ensureIndex(p, tableName, indexName, alterSql) {
  const [rows] = await p.query(
    `SELECT COUNT(*) AS n
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  const n = /** @type {any[]} */ (rows)[0].n;
  if (Number(n) === 0) {
    await p.query(alterSql);
  }
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    openid: row.openid,
    role: row.role,
    name: row.name,
    studentId: row.student_id,
    phone: row.phone,
    college: row.college,
    createdAt: row.created_at,
  };
}

function rowToBooking(row) {
  if (!row) return null;
  const d = row.date;
  const dateStr = formatDateOnly(d);
  const out = {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    venueName: row.venue_name,
    date: dateStr,
    timeSlot: row.time_slot,
    remark: row.remark,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 19).replace('T', ' ') : String(row.created_at),
  };
  if (row.user_name != null) {
    out.userName = row.user_name;
    out.userStudentId = row.user_student_id;
    out.userPhone = row.user_phone;
  }
  return out;
}

function formatDateOnly(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

async function upsertUserByOpenId(openid, cfg) {
  const p = getPool();
  const [existing] = await p.query('SELECT * FROM users WHERE openid = ? LIMIT 1', [openid]);
  const rows = /** @type {any[]} */ (existing);
  if (rows.length > 0) {
    return rowToUser(rows[0]);
  }

  let role = 'user';
  const authConfig = cfg || config;
  if (authConfig.adminOpenId && openid === authConfig.adminOpenId) {
    role = 'admin';
  }

  await p.query(
    `INSERT INTO users (openid, role, name, student_id, phone, college) VALUES (?, ?, '', '', '', '')`,
    [openid, role]
  );

  const [again] = await p.query('SELECT * FROM users WHERE openid = ? LIMIT 1', [openid]);
  return rowToUser((/** @type {any[]} */ (again))[0]);
}

async function getUserById(id) {
  const p = getPool();
  const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  const r = /** @type {any[]} */ (rows);
  return rowToUser(r[0]);
}

async function updateUserProfile(id, fields) {
  const p = getPool();
  await p.query(
    `UPDATE users SET name = ?, student_id = ?, phone = ?, college = ? WHERE id = ?`,
    [fields.name ?? '', fields.studentId ?? '', fields.phone ?? '', fields.college ?? '', id]
  );
  return getUserById(id);
}

/*
async function hasSlotConflictLegacy(venueId, date, startTime, durationHours = 1.0) {
  const p = getPool();
  
  // 解析起始时间
  const [startHour, startMinute] = startTime.split(':').map(Number);
  
  // 计算结束时间
  const totalMinutes = startHour * 60 + startMinute + Math.floor(durationHours * 60);
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  
  // 查询是否有时间冲突的预约
  const [rows] = await p.query(
    `SELECT COUNT(*) AS n FROM bookings
     WHERE venue_id = ? AND \`date\` = ? AND status != 'rejected'
     AND (
       (time_slot LIKE ? AND time_slot NOT LIKE ?) OR
       (time_slot LIKE ? AND time_slot NOT LIKE ?)
     )`,
    [venueId, date, 
     `${startTime}%`, 
     `%${endTime}%`,
     `%${endTime}%`,
     `${startTime}%`
    ]
  );
  const n = rows[0].n;
  return Number(n) > 0;
}
*/

async function hasSlotConflict(venueId, date, startTime, durationHours = 1.0) {
  const p = getPool();
  const requestedRange = buildTimeRange(startTime, durationHours);
  if (!requestedRange) {
    return false;
  }

  const [rows] = await p.query(
    `SELECT time_slot FROM bookings
     WHERE venue_id = ? AND \`date\` = ? AND status != 'rejected'`,
    [venueId, date]
  );

  return /** @type {any[]} */ (rows).some((row) => {
    const existingRange = parseTimeRangeLabel(row.time_slot);
    return existingRange ? rangesOverlap(requestedRange, existingRange) : false;
  });
}

async function createBooking(userId, venueId, date, startTime, remark, courtType = 'full', durationHours = 1.0) {
  const p = getPool();
  const id = crypto.randomUUID();
  
  // 获取场地名称
  const venueNames = {
    'football': '足球场',
    'basketball': '篮球场', 
    'pingpong': '乒乓球',
    'badminton': '羽毛球'
  };
  const venueName = venueNames[venueId] || venueId;
  
  // 根据起始时间和时长生成完整的时间段
  const timeRange = buildTimeRange(startTime, durationHours);
  const timeSlot = timeRange ? timeRange.label : startTime;
  
  await p.query(
    'INSERT INTO bookings (id, user_id, venue_id, venue_name, date, time_slot, remark, status, court_type, duration_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, userId, venueId, venueName, date, timeSlot, remark, 'pending', courtType, durationHours]
  );
  const [rows] = await p.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id]);
  return /** @type {any[]} */ (rows)[0];
}

async function listMyBookings(userId) {
  const p = getPool();
  const [rows] = await p.query(
    'SELECT * FROM bookings WHERE user_id = ? ORDER BY `date` DESC, created_at DESC',
    [userId]
  );
  return /** @type {any[]} */ (rows).map(rowToBooking);
}

async function listBookingsAdmin({ venueId, status }) {
  const p = getPool();
  const v = venueId || '';
  const s = status || '';
  const [rows] = await p.query(
    `SELECT b.*, u.name AS user_name, u.student_id AS user_student_id, u.phone AS user_phone
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE (? = '' OR b.venue_id = ?) AND (? = '' OR b.status = ?)
     ORDER BY b.\`date\` DESC, b.created_at DESC`,
    [v, v, s, s]
  );
  return /** @type {any[]} */ (rows).map(rowToBooking);
}

async function setBookingStatus(id, status) {
  const p = getPool();
  await p.query(
    'UPDATE bookings SET status = ? WHERE id = ?',
    [status, id]
  );
  const [rows] = await p.query(
    `SELECT b.*, u.name AS user_name, u.student_id AS user_student_id, u.phone AS user_phone
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE b.id = ? LIMIT 1`,
    [id]
  );
  const row = /** @type {any[]} */ (rows)[0];
  return rowToBooking(row);
}

async function getBookingById(id) {
  const p = getPool();
  const [rows] = await p.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id]);
  return /** @type {any[]} */ (rows)[0] || null;
}

async function deleteBooking(id) {
  const p = getPool();
  await p.query('DELETE FROM bookings WHERE id = ?', [id]);
}

async function bookingExists(id) {
  const p = getPool();
  const [rows] = await p.query('SELECT COUNT(*) AS n FROM bookings WHERE id = ?', [id]);
  const n = /** @type {any[]} */ (rows)[0].n;
  return Number(n) > 0;
}

// 提醒功能相关函数
async function createNotification(userId, type, title, content, bookingId = null) {
  const p = getPool();
  await p.query(
    'INSERT INTO notifications (user_id, type, title, content, related_booking_id) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, content, bookingId]
  );
}

async function getUserNotifications(userId, limit = 20) {
  const p = getPool();
  const [rows] = await p.query(
    `SELECT n.*, b.venue_name, b.date, b.time_slot 
     FROM notifications n 
     LEFT JOIN bookings b ON n.related_booking_id = b.id 
     WHERE n.user_id = ? 
     ORDER BY n.created_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
  return /** @type {any[]} */ (rows).map(rowToNotification);
}

async function markNotificationAsRead(userId, notificationId) {
  const p = getPool();
  await p.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?', [userId, notificationId]);
}

async function markAllNotificationsAsRead(userId) {
  const p = getPool();
  await p.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
}

async function getUnreadNotificationCount(userId) {
  const p = getPool();
  const [rows] = await p.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
  return /** @type {any[]} */ (rows)[0].count;
}

function rowToNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    relatedBookingId: row.related_booking_id,
    venueName: row.venue_name,
    date: row.date,
    timeSlot: row.time_slot,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 19).replace('T', ' ') : String(row.created_at),
  };
}

module.exports = {
  ensureDatabase,
  getPool,
  closePool,
  runMigrations,
  upsertUserByOpenId,
  getUserById,
  updateUserProfile,
  hasSlotConflict,
  createBooking,
  listMyBookings,
  listBookingsAdmin,
  setBookingStatus,
  getBookingById,
  deleteBooking,
  bookingExists,
  rowToBooking,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  rowToNotification,
};
