const { getPool, createNotification } = require('./db');

/**
 * 发送预约前提醒
 * 检查即将开始的预约（1小时内开始），发送提醒
 */
async function sendReminders() {
  try {
    const p = getPool();
    
    // 获取当前时间
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // 查询即将开始的预约（1小时内开始）
    const [rows] = await p.query(
      `SELECT b.*, u.id as user_id 
       FROM bookings b 
       JOIN users u ON b.user_id = u.id 
       WHERE b.status = 'confirmed' 
       AND b.date = CURDATE() 
       AND STR_TO_DATE(CONCAT(b.date, ' ', SUBSTRING_INDEX(b.time_slot, ' - ', 1)), '%Y-%m-%d %H:%i') BETWEEN ? AND ?`,
      [now, oneHourLater]
    );
    
    const bookings = /** @type {any[]} */ (rows);
    
    for (const booking of bookings) {
      // 检查是否已经发送过提醒
      const [existing] = await p.query(
        'SELECT COUNT(*) as count FROM notifications WHERE related_booking_id = ? AND type = "reminder"',
        [booking.id]
      );
      
      if (existing[0].count === 0) {
        // 发送提醒
        await createNotification(
          booking.user_id,
          'reminder',
          '预约即将开始',
          `您的预约即将开始：${booking.venue_name}，时间：${booking.time_slot}，请准时到场`,
          booking.id
        );
        
        console.log(`[提醒] 已发送预约提醒：${booking.venue_name} - ${booking.time_slot}`);
      }
    }
    
    console.log(`[提醒] 检查完成，发现 ${bookings.length} 个即将开始的预约`);
  } catch (error) {
    console.error('[提醒] 发送提醒失败：', error.message);
  }
}

/**
 * 启动定时提醒任务
 */
function startReminderTask() {
  // 每分钟检查一次
  setInterval(sendReminders, 60 * 1000);
  
  // 启动时立即检查一次
  sendReminders();
  
  console.log('[提醒] 定时提醒任务已启动');
}

module.exports = {
  sendReminders,
  startReminderTask,
};