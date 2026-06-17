// 数据库配置文件
// ⚠️ 不要在此修改密码 — 请复制 .env.example 为 .env 并填入真实值
require('dotenv').config();

module.exports = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'scsmis',
    waitForConnections: true,
    connectionLimit: 30
};
