const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-change-me',
  wxAppId: process.env.WX_APPID || '',
  wxSecret: process.env.WX_SECRET || '',
  mockAuth: process.env.MOCK_AUTH === '1' || process.env.MOCK_AUTH === 'true',
  adminOpenId: process.env.ADMIN_OPENID || '',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    /** 要在其中建表的数据库名（与 Windows 服务名 MySQL80 不是同一个概念） */
    database: process.env.MYSQL_DATABASE || 'venue_booking',
  },
};

if (!config.jwtSecret || config.jwtSecret.length < 16) {
  console.warn('[config] JWT_SECRET 过短或未设置，生产环境请务必修改 .env');
}

module.exports = config;
