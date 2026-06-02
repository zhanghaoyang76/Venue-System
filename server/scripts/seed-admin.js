/**
 * 将指定 openid 的用户设为 admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  const openid = process.env.ADMIN_OPENID || process.argv[2];
  if (!openid) {
    console.error('请设置环境变量 ADMIN_OPENID，或执行: node scripts/seed-admin.js <openid>');
    process.exit(1);
  }

  const p = await mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  const [rows] = await p.query('SELECT id, openid, role FROM users WHERE openid = ? LIMIT 1', [openid]);
  const list = rows;
  if (!list || list.length === 0) {
    console.error('未找到该 openid 的用户，请先用该身份调用一次 POST /api/auth/login');
    process.exit(1);
  }

  await p.query('UPDATE users SET role = ? WHERE openid = ?', ['admin', openid]);
  console.log(`已将 openid=${openid} 的用户设为 admin（id=${list[0].id}）`);
  await p.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
