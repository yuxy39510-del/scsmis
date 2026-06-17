// 临时脚本：加长 f_stu_id 列，适配真实学号
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'scsmis',
        waitForConnections: true,
    });

    try {
        const conn = await pool.getConnection();
        console.log('已连接数据库');

        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('已关闭外键检查');

        await conn.query('ALTER TABLE t_student MODIFY f_stu_id VARCHAR(20) NOT NULL');
        console.log('OK: t_student.f_stu_id → VARCHAR(20)');

        await conn.query('ALTER TABLE t_stu_course MODIFY f_stu_id VARCHAR(20) NOT NULL');
        console.log('OK: t_stu_course.f_stu_id → VARCHAR(20)');

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('已恢复外键检查');

        conn.release();
        console.log('全部完成！现在可以用真实学号添加学生了。');
    } catch (err) {
        console.error('失败:', err.message);
    }

    await pool.end();
    process.exit(0);
})();
