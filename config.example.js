// 数据库配置模板
// 复制此文件为 config.js 或创建 .env 文件填入真实密码
// ⚠️ config.js / .env 已被 .gitignore 排除，不会提交到 Git

require('dotenv').config();

module.exports = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '你的数据库密码',
    database: 'scsmis',
    waitForConnections: true,
    connectionLimit: 30
};
