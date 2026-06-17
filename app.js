const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');
const dbConfig = require('./config');

const app = express();
const PORT = 3000;
const PER_PAGE = 10;
const COURSE_CAPACITY = 60;   // 每门课选课人数上限

// ---- 分页工具 ----
function pages(req) {
    const p = Math.max(1, parseInt(req.query.page) || 1);
    return { page: p, offset: (p - 1) * PER_PAGE, limit: PER_PAGE };
}

// ---- 搜索工具 ----
function searchWhere(req, fields) {
    const q = (req.query.q || '').trim();
    if (!q) return { where: '', params: [], q: '' };
    const clauses = fields.map(f => `${f} LIKE ?`);
    const params = fields.map(() => `%${q}%`);
    return { where: ' WHERE ' + clauses.join(' OR '), params, q };
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/bootstrap-icons', express.static(path.join(__dirname, 'node_modules/bootstrap-icons')));
app.use('/chart.js', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'scsmis-dev-key', resave: false, saveUninitialized: false }));

const pool = mysql.createPool(dbConfig);

// ---- 启动时自动建表（审计日志） ----
(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS t_operation_log (
            f_id INT AUTO_INCREMENT PRIMARY KEY,
            f_user_id VARCHAR(50) NOT NULL,
            f_user_name VARCHAR(100) NOT NULL,
            f_role_type VARCHAR(20) NOT NULL,
            f_action VARCHAR(50) NOT NULL,
            f_target VARCHAR(100),
            f_detail VARCHAR(500),
            f_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        console.log('✅ 审计日志表已就绪');
    } catch (err) {
        console.error('⚠️ 审计日志表创建失败:', err.message);
    }
})();

// ---- 操作日志工具 ----
async function logOp(user, action, target, detail) {
    try {
        await pool.query(
            'INSERT INTO t_operation_log (f_user_id, f_user_name, f_role_type, f_action, f_target, f_detail) VALUES (?,?,?,?,?,?)',
            [user.id, user.name, user.role_type, action, target, detail || null]
        );
    } catch (err) {
        console.error('日志写入失败:', err.message);
    }
}

// ---- 中间件 ----
function requireAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

function adminOnly(req, res, next) {
    if (req.session.user && req.session.user.role_type === 'admin') return next();
    res.status(403).send('<h2>权限不足</h2><p>仅管理员可操作</p><a href="/">返回首页</a>');
}

// ---- 登录页 ----
app.get('/login', (req, res) => {
    res.render('login', { error: null, user: null });
});

app.post('/login', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        let user;
        if (role === 'admin')
            [user] = await pool.query('SELECT f_user_id AS id, f_name AS name, "管理员" AS role_name FROM t_admin WHERE f_user_id=? AND f_password=?', [username, password]);
        else if (role === 'teacher')
            [user] = await pool.query('SELECT f_teach_id AS id, f_name AS name, f_title AS role_name FROM t_teacher WHERE f_teach_id=? AND f_password=?', [username, password]);
        else if (role === 'student')
            [user] = await pool.query('SELECT f_stu_id AS id, f_name AS name, "学生" AS role_name FROM t_student WHERE f_stu_id=? AND f_password=?', [username, password]);
        if (user && user.length > 0) {
            req.session.user = { ...user[0], role_type: role };
            logOp(req.session.user, '登录', '系统', '登录成功');
            res.redirect('/');
        } else {
            res.render('login', { error: '用户名或密码错误', user: null });
        }
    } catch (err) {
        res.render('login', { error: '系统繁忙，请稍后再试', user: null });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ---- 修改密码 ----
app.get('/change-password', requireAuth, (req, res) => {
    res.render('change-password', { user: req.session.user, msg: null });
});

app.post('/change-password', requireAuth, async (req, res) => {
    const u = req.session.user;
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
        return res.render('change-password', { user: u, msg: { type: 'danger', text: '两次输入的新密码不一致' } });
    }
    if (newPassword.length < 4) {
        return res.render('change-password', { user: u, msg: { type: 'danger', text: '密码至少4位' } });
    }
    try {
        const tableMap = { admin: 't_admin', teacher: 't_teacher', student: 't_student' };
        const idMap = { admin: 'f_user_id', teacher: 'f_teach_id', student: 'f_stu_id' };
        const table = tableMap[u.role_type];
        const idCol = idMap[u.role_type];
        const [row] = await pool.query(`SELECT * FROM ?? WHERE ??=? AND f_password=?`, [table, idCol, u.id, oldPassword]);
        if (row.length === 0) {
            return res.render('change-password', { user: u, msg: { type: 'danger', text: '旧密码错误' } });
        }
        await pool.query(`UPDATE ?? SET f_password=? WHERE ??=?`, [table, newPassword, idCol, u.id]);
        logOp(u, '修改密码', '账户', '密码修改成功');
        res.render('change-password', { user: u, msg: { type: 'success', text: '密码修改成功！' } });
    } catch (err) {
        res.render('change-password', { user: u, msg: { type: 'danger', text: '修改失败，请稍后再试' } });
    }
});

// ---- 仪表盘 ----
app.get('/', requireAuth, async (req, res) => {
    try {
        const u = req.session.user;
        const stats = {};
        let chartData = null;

        if (u.role_type === 'admin') {
            const tables = ['t_admin','t_college','t_teacher','t_student','t_course','t_teach_course','t_stu_course'];
            for (const t of tables) { const [r] = await pool.query('SELECT COUNT(*) AS cnt FROM ??',[t]); stats[t] = r[0].cnt; }
            // 各学院学生人数
            const [collegeStats] = await pool.query(
                'SELECT c.f_name AS label, COUNT(s.f_stu_id) AS cnt FROM t_college c LEFT JOIN t_student s ON c.f_college_id=s.f_college_id GROUP BY c.f_college_id, c.f_name ORDER BY cnt DESC'
            );
            // 课程选课人数排名（Top 10）
            const [courseRank] = await pool.query(
                'SELECT c.f_name AS label, COUNT(sc.f_stu_id) AS cnt FROM t_course c LEFT JOIN t_stu_course sc ON c.f_course_id=sc.f_course_id GROUP BY c.f_course_id, c.f_name ORDER BY cnt DESC LIMIT 10'
            );
            // 各角色人数分布
            const roleDist = {
                labels: ['管理员','教师','学生'],
                counts: [stats.t_admin, stats.t_teacher, stats.t_student]
            };
            chartData = { collegeStats, courseRank, roleDist };
        } else if (u.role_type === 'teacher') {
            const [r] = await pool.query('SELECT COUNT(*) AS cnt FROM t_teach_course WHERE f_teach_id=?',[u.id]); stats.t_teach_course = r[0].cnt;
            const [r2] = await pool.query('SELECT COUNT(DISTINCT f_stu_id) AS cnt FROM t_stu_course WHERE f_teach_id=?',[u.id]); stats.t_stu_course = r2[0].cnt;
            // 所授课程选课人数
            const [tStats] = await pool.query(
                'SELECT c.f_name AS label, COUNT(sc.f_stu_id) AS cnt FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id LEFT JOIN t_stu_course sc ON tc.f_course_id=sc.f_course_id AND tc.f_teach_id=sc.f_teach_id WHERE tc.f_teach_id=? GROUP BY tc.f_course_id, c.f_name ORDER BY cnt DESC', [u.id]
            );
            chartData = { tStats };
        } else if (u.role_type === 'student') {
            const [r] = await pool.query('SELECT COUNT(*) AS cnt FROM t_stu_course WHERE f_stu_id=?',[u.id]); stats.t_stu_course = r[0].cnt;
            const [r2] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS cnt FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?',[u.id]); stats.credit = r2[0].cnt;
            // 已选课程成绩分布
            const [scoreDist] = await pool.query(
                'SELECT CASE WHEN f_score IS NULL THEN \'未出分\' WHEN f_score>=90 THEN \'90-100\' WHEN f_score>=80 THEN \'80-89\' WHEN f_score>=70 THEN \'70-79\' WHEN f_score>=60 THEN \'60-69\' ELSE \'<60\' END AS label, COUNT(*) AS cnt FROM t_stu_course WHERE f_stu_id=? GROUP BY label ORDER BY FIELD(label,\'90-100\',\'80-89\',\'70-79\',\'60-69\',\'<60\',\'未出分\')', [u.id]
            );
            chartData = { scoreDist };
        }
        res.render('index', { user: u, stats, chartData });
    } catch (err) {
        res.render('index', { user: req.session.user, stats: {}, chartData: null, error: '加载失败，请刷新重试' });
    }
});

// ======== 学院管理（带搜索） ========
app.get('/college', adminOnly, async (req, res) => {
    const pg = pages(req);
    const { where, params, q } = searchWhere(req, ['f_name', 'f_college_id', 'f_memo']);
    const [rows] = await pool.query(`SELECT * FROM t_college ${where} ORDER BY f_college_id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
    const [[{cnt}]] = await pool.query(`SELECT COUNT(*) AS cnt FROM t_college ${where}`, params);
    const totalPages = Math.ceil(cnt / PER_PAGE);
    res.render('college', { user: req.session.user, colleges: rows, msg: null, page: pg.page, totalPages, q });
});
app.post('/college/add', adminOnly, async (req, res) => {
    try { await pool.query('INSERT INTO t_college VALUES (?,?,?)', [req.body.f_college_id,req.body.f_name,req.body.f_memo||null]); logOp(req.session.user, '添加学院', req.body.f_college_id, req.body.f_name); res.redirect('/college'); }
    catch (err) { const [rows] = await pool.query('SELECT * FROM t_college ORDER BY f_college_id LIMIT ? OFFSET ?', [PER_PAGE,0]); res.render('college',{user:req.session.user,colleges:rows,msg:'添加失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/college/edit/:id', adminOnly, async (req, res) => {
    try { await pool.query('UPDATE t_college SET f_name=?, f_memo=? WHERE f_college_id=?', [req.body.f_name, req.body.f_memo||null, req.params.id]); logOp(req.session.user, '编辑学院', req.params.id, req.body.f_name); res.redirect('/college'); }
    catch (err) { const [rows] = await pool.query('SELECT * FROM t_college ORDER BY f_college_id LIMIT ? OFFSET ?', [PER_PAGE,0]); res.render('college',{user:req.session.user,colleges:rows,msg:'编辑失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/college/delete/:id', adminOnly, async (req, res) => { await pool.query('DELETE FROM t_college WHERE f_college_id=?', [req.params.id]); logOp(req.session.user, '删除学院', req.params.id); res.redirect('/college'); });

// ======== 管理员管理（带搜索） ========
app.get('/admin', adminOnly, async (req, res) => {
    const pg = pages(req);
    const { where, params, q } = searchWhere(req, ['f_user_id', 'f_name', 'f_sex', 'f_dept', 'f_tel', 'f_memo']);
    const [rows] = await pool.query(`SELECT * FROM t_admin ${where} ORDER BY f_user_id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
    const [[{cnt}]] = await pool.query(`SELECT COUNT(*) AS cnt FROM t_admin ${where}`, params);
    const totalPages = Math.ceil(cnt / PER_PAGE);
    res.render('admin', { user: req.session.user, admins: rows, msg: null, page: pg.page, totalPages, q });
});
app.post('/admin/add', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('INSERT INTO t_admin (f_user_id,f_password,f_name,f_sex,f_birth,f_dept,f_tel,f_memo) VALUES (?,?,?,?,?,?,?,?)', [b.f_user_id,'123456',b.f_name,b.f_sex,b.birth||null,b.f_dept||null,b.f_tel||null,b.f_memo||null]); logOp(req.session.user, '添加管理员', b.f_user_id, b.f_name); logOp(req.session.user, '删除管理员', req.params.id); res.redirect('/admin'); }
    catch (err) { const [rows] = await pool.query('SELECT * FROM t_admin ORDER BY f_user_id LIMIT ? OFFSET ?', [PER_PAGE,0]); res.render('admin',{user:req.session.user,admins:rows,msg:'添加失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/admin/edit/:id', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('UPDATE t_admin SET f_name=?, f_sex=?, f_birth=?, f_dept=?, f_tel=?, f_memo=? WHERE f_user_id=?', [b.f_name,b.f_sex,b.f_birth||null,b.f_dept||null,b.f_tel||null,b.f_memo||null,req.params.id]); logOp(req.session.user, '删除管理员', req.params.id); res.redirect('/admin'); }
    catch (err) { const [rows] = await pool.query('SELECT * FROM t_admin ORDER BY f_user_id LIMIT ? OFFSET ?', [PER_PAGE,0]); res.render('admin',{user:req.session.user,admins:rows,msg:'编辑失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/admin/delete/:id', adminOnly, async (req, res) => { await pool.query('DELETE FROM t_admin WHERE f_user_id=?',[req.params.id]); logOp(req.session.user, '删除管理员', req.params.id); res.redirect('/admin'); });

// ======== 教师管理（带搜索） ========
app.get('/teacher', adminOnly, async (req, res) => {
    const pg = pages(req);
    const { where, params, q } = searchWhere(req, ['t.f_teach_id', 't.f_name', 't.f_sex', 't.f_title', 'c.f_name', 't.f_tel', 't.f_memo']);
    const [rows] = await pool.query(`SELECT t.*, c.f_name AS college_name FROM t_teacher t LEFT JOIN t_college c ON t.f_college_id=c.f_college_id ${where} ORDER BY t.f_teach_id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
    const [[{cnt}]] = await pool.query(`SELECT COUNT(*) AS cnt FROM t_teacher t LEFT JOIN t_college c ON t.f_college_id=c.f_college_id ${where}`, params);
    const totalPages = Math.ceil(cnt / PER_PAGE);
    const [colleges] = await pool.query('SELECT * FROM t_college');
    res.render('teacher', { user: req.session.user, teachers: rows, colleges, msg: null, page: pg.page, totalPages, q });
});
app.post('/teacher/add', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('INSERT INTO t_teacher (f_teach_id,f_password,f_name,f_sex,f_title,f_college_id,f_tel,f_memo) VALUES (?,?,?,?,?,?,?,?)', [b.f_teach_id,'123456',b.f_name,b.f_sex,b.f_title,b.f_college_id,b.f_tel||null,b.f_memo||null]); res.redirect('/teacher'); }
    catch (err) { const [rows] = await pool.query('SELECT t.*, c.f_name AS college_name FROM t_teacher t LEFT JOIN t_college c ON t.f_college_id=c.f_college_id ORDER BY t.f_teach_id LIMIT ? OFFSET ?', [PER_PAGE,0]); const [colleges] = await pool.query('SELECT * FROM t_college'); res.render('teacher',{user:req.session.user,teachers:rows,colleges,msg:'添加失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/teacher/edit/:id', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('UPDATE t_teacher SET f_name=?, f_sex=?, f_title=?, f_college_id=?, f_tel=?, f_memo=? WHERE f_teach_id=?', [b.f_name,b.f_sex,b.f_title,b.f_college_id,b.f_tel||null,b.f_memo||null,req.params.id]); res.redirect('/teacher'); }
    catch (err) { const [rows] = await pool.query('SELECT t.*, c.f_name AS college_name FROM t_teacher t LEFT JOIN t_college c ON t.f_college_id=c.f_college_id ORDER BY t.f_teach_id LIMIT ? OFFSET ?', [PER_PAGE,0]); const [colleges] = await pool.query('SELECT * FROM t_college'); res.render('teacher',{user:req.session.user,teachers:rows,colleges,msg:'编辑失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/teacher/delete/:id', adminOnly, async (req, res) => { await pool.query('DELETE FROM t_teacher WHERE f_teach_id=?',[req.params.id]); res.redirect('/teacher'); });

// ======== 学生管理（带搜索） ========
app.get('/student', adminOnly, async (req, res) => {
    const pg = pages(req);
    const { where, params, q } = searchWhere(req, ['s.f_stu_id', 's.f_name', 's.f_sex', 's.f_enroll_year', 'c.f_name', 's.f_speciality', 's.f_tel']);
    const [rows] = await pool.query(`SELECT s.*, c.f_name AS college_name FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id ${where} ORDER BY s.f_stu_id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
    const [[{cnt}]] = await pool.query(`SELECT COUNT(*) AS cnt FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id ${where}`, params);
    const totalPages = Math.ceil(cnt / PER_PAGE);
    const [colleges] = await pool.query('SELECT * FROM t_college');
    res.render('student', { user: req.session.user, students: rows, colleges, msg: null, page: pg.page, totalPages, q });
});
app.post('/student/add', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('INSERT INTO t_student (f_stu_id,f_password,f_name,f_sex,f_birth,f_enroll_year,f_college_id,f_speciality,f_tel,f_memo) VALUES (?,?,?,?,?,?,?,?,?,?)', [b.f_stu_id,'123456',b.f_name,b.f_sex,b.birth||null,b.f_enroll_year||null,b.f_college_id,b.f_speciality||null,b.f_tel||null,b.f_memo||null]); res.redirect('/student'); }
    catch (err) { const [rows] = await pool.query('SELECT s.*, c.f_name AS college_name FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id ORDER BY s.f_stu_id LIMIT ? OFFSET ?', [PER_PAGE,0]); const [colleges] = await pool.query('SELECT * FROM t_college'); res.render('student',{user:req.session.user,students:rows,colleges,msg:'添加失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/student/edit/:id', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('UPDATE t_student SET f_name=?, f_sex=?, f_birth=?, f_enroll_year=?, f_college_id=?, f_speciality=?, f_tel=?, f_memo=? WHERE f_stu_id=?', [b.f_name,b.f_sex,b.f_birth||null,b.f_enroll_year||null,b.f_college_id,b.f_speciality||null,b.f_tel||null,b.f_memo||null,req.params.id]); res.redirect('/student'); }
    catch (err) { const [rows] = await pool.query('SELECT s.*, c.f_name AS college_name FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id ORDER BY s.f_stu_id LIMIT ? OFFSET ?', [PER_PAGE,0]); const [colleges] = await pool.query('SELECT * FROM t_college'); res.render('student',{user:req.session.user,students:rows,colleges,msg:'编辑失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/student/delete/:id', adminOnly, async (req, res) => { await pool.query('DELETE FROM t_student WHERE f_stu_id=?',[req.params.id]); res.redirect('/student'); });

// ======== 课程管理（带搜索） ========
app.get('/course', adminOnly, async (req, res) => {
    const pg = pages(req);
    const { where, params, q } = searchWhere(req, ['c1.f_course_id', 'c1.f_name', 'c2.f_name', 'c1.f_memo']);
    const [rows] = await pool.query(`SELECT c1.*, c2.f_name AS pre_name FROM t_course c1 LEFT JOIN t_course c2 ON c1.f_pre_course=c2.f_course_id ${where} ORDER BY c1.f_course_id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
    const [[{cnt}]] = await pool.query(`SELECT COUNT(*) AS cnt FROM t_course c1 LEFT JOIN t_course c2 ON c1.f_pre_course=c2.f_course_id ${where}`, params);
    const totalPages = Math.ceil(cnt / PER_PAGE);
    const [allCourses] = await pool.query('SELECT * FROM t_course');
    res.render('course', { user: req.session.user, courses: rows, allCourses, msg: null, page: pg.page, totalPages, q });
});
app.post('/course/add', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('INSERT INTO t_course (f_course_id,f_name,f_pre_course,f_credit,f_memo) VALUES (?,?,?,?,?)', [b.f_course_id,b.f_name,b.f_pre_course||null,b.f_credit,b.f_memo||null]); res.redirect('/course'); }
    catch (err) { const [rows] = await pool.query('SELECT c1.*, c2.f_name AS pre_name FROM t_course c1 LEFT JOIN t_course c2 ON c1.f_pre_course=c2.f_course_id ORDER BY c1.f_course_id LIMIT ? OFFSET ?', [PER_PAGE,0]); const [allCourses] = await pool.query('SELECT * FROM t_course'); res.render('course',{user:req.session.user,courses:rows,allCourses,msg:'添加失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/course/edit/:id', adminOnly, async (req, res) => {
    const b = req.body;
    try { await pool.query('UPDATE t_course SET f_name=?, f_pre_course=?, f_credit=?, f_memo=? WHERE f_course_id=?', [b.f_name,b.f_pre_course||null,b.f_credit,b.f_memo||null,req.params.id]); res.redirect('/course'); }
    catch (err) { const [rows] = await pool.query('SELECT c1.*, c2.f_name AS pre_name FROM t_course c1 LEFT JOIN t_course c2 ON c1.f_pre_course=c2.f_course_id ORDER BY c1.f_course_id LIMIT ? OFFSET ?', [PER_PAGE,0]); const [allCourses] = await pool.query('SELECT * FROM t_course'); res.render('course',{user:req.session.user,courses:rows,allCourses,msg:'编辑失败: '+err.message,page:1,totalPages:1,q:''}); }
});
app.post('/course/delete/:id', adminOnly, async (req, res) => { await pool.query('DELETE FROM t_course WHERE f_course_id=?',[req.params.id]); res.redirect('/course'); });

// ---- 教师授课视图 ----
app.get('/teach-view', requireAuth, async (req, res) => {
    const u = req.session.user;
    let rows;
    if (u.role_type === 'teacher')
        [rows] = await pool.query('SELECT * FROM v_teacher_course WHERE 教师工号=?', [u.id]);
    else
        [rows] = await pool.query('SELECT * FROM v_teacher_course');
    res.render('teach-view', { user: u, courses: rows, cancelResult: null });
});

app.post('/cancel-course', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type === 'student') return res.status(403).send('<h2>权限不足</h2><p>仅教师和管理员可停开课程</p><a href="/">返回首页</a>');
    const { teach_id, course_id } = req.body;
    if (u.role_type === 'teacher' && teach_id !== u.id) {
        const [rows] = await pool.query('SELECT * FROM v_teacher_course WHERE 教师工号=?', [u.id]);
        return res.render('teach-view', { user: u, courses: rows, cancelResult: { code: -1, msg: '只能停开自己的课程' } });
    }
    try {
        await pool.query('CALL sp_cancel_course(?, ?, @p_result)', [teach_id, course_id]);
        const [r] = await pool.query('SELECT @p_result AS p_result');
        const code = r[0].p_result;
        const msgMap = { 0: '停开成功！', 1: '无法停开：该课程已考试。', 2: '无法停开：选课人数已≥20人。' };
        let rows;
        if (u.role_type === 'teacher')
            [rows] = await pool.query('SELECT * FROM v_teacher_course WHERE 教师工号=?', [u.id]);
        else
            [rows] = await pool.query('SELECT * FROM v_teacher_course');
        res.render('teach-view', { user: u, courses: rows, cancelResult: { code, msg: msgMap[code] } });
    } catch (err) {
        let rows;
        if (u.role_type === 'teacher')
            [rows] = await pool.query('SELECT * FROM v_teacher_course WHERE 教师工号=?', [u.id]);
        else
            [rows] = await pool.query('SELECT * FROM v_teacher_course');
        res.render('teach-view', { user: u, courses: rows, cancelResult: { code: -1, msg: '操作失败，请稍后再试' } });
    }
});

// ---- 开课操作 ----
app.get('/open-course', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type === 'student') return res.status(403).send('仅教师和管理员可访问');
    let teachers = [], courses = [];
    if (u.role_type === 'admin') {
        [teachers] = await pool.query('SELECT f_teach_id, f_name FROM t_teacher ORDER BY f_teach_id');
        [courses] = await pool.query('SELECT f_course_id, f_name, f_credit FROM t_course ORDER BY f_course_id');
    } else {
        [teachers] = await pool.query('SELECT f_teach_id, f_name FROM t_teacher WHERE f_teach_id=?', [u.id]);
        // 只显示该教师尚未开设的课程
        [courses] = await pool.query('SELECT c.f_course_id, c.f_name, c.f_credit FROM t_course c WHERE c.f_course_id NOT IN (SELECT f_course_id FROM t_teach_course WHERE f_teach_id=?) ORDER BY c.f_course_id', [u.id]);
    }
    res.render('open-course', { user: u, teachers, courses, msg: null });
});

app.post('/open-course', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type === 'student') return res.status(403).send('仅教师和管理员可访问');
    const { teach_id, course_id, f_time, f_place } = req.body;
    if (u.role_type === 'teacher' && teach_id !== u.id) {
        return res.redirect('/open-course');
    }
    try {
        // 检查是否已开设
        const [dup] = await pool.query('SELECT * FROM t_teach_course WHERE f_teach_id=? AND f_course_id=?', [teach_id, course_id]);
        if (dup.length > 0) {
            let teachers = [], courses = [];
            if (u.role_type === 'admin') {
                [teachers] = await pool.query('SELECT f_teach_id, f_name FROM t_teacher ORDER BY f_teach_id');
                [courses] = await pool.query('SELECT f_course_id, f_name, f_credit FROM t_course ORDER BY f_course_id');
            } else {
                [teachers] = [{ f_teach_id: u.id, f_name: u.name }];
                [courses] = await pool.query('SELECT c.f_course_id, c.f_name, c.f_credit FROM t_course c WHERE c.f_course_id NOT IN (SELECT f_course_id FROM t_teach_course WHERE f_teach_id=?) ORDER BY c.f_course_id', [u.id]);
            }
            return res.render('open-course', { user: u, teachers, courses, msg: { type: 'warning', text: '该教师已开设此课程，不可重复！' } });
        }
        await pool.query('INSERT INTO t_teach_course (f_teach_id, f_course_id, f_time, f_place) VALUES (?,?,?,?)', [teach_id, course_id, f_time || null, f_place || null]);
        res.redirect('/teach-view');
    } catch (err) {
        let teachers = [], courses = [];
        if (u.role_type === 'admin') {
            [teachers] = await pool.query('SELECT f_teach_id, f_name FROM t_teacher ORDER BY f_teach_id');
            [courses] = await pool.query('SELECT f_course_id, f_name, f_credit FROM t_course ORDER BY f_course_id');
        } else {
            [teachers] = [{ f_teach_id: u.id, f_name: u.name }];
            [courses] = await pool.query('SELECT c.f_course_id, c.f_name, c.f_credit FROM t_course c WHERE c.f_course_id NOT IN (SELECT f_course_id FROM t_teach_course WHERE f_teach_id=?) ORDER BY c.f_course_id', [u.id]);
        }
        res.render('open-course', { user: u, teachers, courses, msg: { type: 'danger', text: '开课失败，请检查数据是否有误' } });
    }
});

// ---- 教师录成绩 ----
app.get('/grade-entry', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type !== 'teacher' && u.role_type !== 'admin') {
        return res.status(403).send('仅教师和管理员可访问');
    }
    let teachCourses;
    if (u.role_type === 'teacher')
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id WHERE tc.f_teach_id=?', [u.id]);
    else
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id');

    // 如果 URL 带了 course_id 和 teach_id，自动加载学生列表
    const { course_id, teach_id, msg: qmsg } = req.query;
    let selectedCourse = null, students = [];
    if (course_id && teach_id) {
        selectedCourse = { course_id, teach_id };
        [students] = await pool.query('SELECT sc.*, s.f_name AS student_name FROM t_stu_course sc JOIN t_student s ON sc.f_stu_id=s.f_stu_id WHERE sc.f_course_id=? AND sc.f_teach_id=?', [course_id, teach_id]);
    }
    res.render('grade-entry', { user: u, teachCourses, selectedCourse, students, msg: qmsg || null });
});

app.post('/grade-entry/lookup', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type !== 'teacher' && u.role_type !== 'admin') return res.status(403).send('仅教师和管理员');
    const { course_id, teach_id } = req.body;
    if (u.role_type === 'teacher' && teach_id !== u.id) {
        return res.redirect('/grade-entry');
    }
    let teachCourses;
    if (u.role_type === 'teacher')
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id WHERE tc.f_teach_id=?', [u.id]);
    else
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id');
    const [students] = await pool.query('SELECT sc.*, s.f_name AS student_name FROM t_stu_course sc JOIN t_student s ON sc.f_stu_id=s.f_stu_id WHERE sc.f_course_id=? AND sc.f_teach_id=?', [course_id, teach_id]);
    res.render('grade-entry', { user: u, teachCourses, selectedCourse: { course_id, teach_id }, students, msg: null });
});

app.post('/grade-entry/save', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type !== 'teacher' && u.role_type !== 'admin') return res.status(403).send('仅教师和管理员');
    const { course_id, teach_id, stu_id, score } = req.body;
    if (u.role_type === 'teacher' && teach_id !== u.id) return res.redirect('/grade-entry');
    try {
        const scoreVal = score ? parseFloat(score) : null;
        if (scoreVal !== null && (scoreVal < 0 || scoreVal > 100)) {
            return res.redirect(`/grade-entry?course_id=${course_id}&teach_id=${teach_id}&msg=成绩范围0-100`);
        }
        await pool.query('UPDATE t_stu_course SET f_score=? WHERE f_course_id=? AND f_teach_id=? AND f_stu_id=?', [scoreVal, course_id, teach_id, stu_id]);
        res.redirect(`/grade-entry?course_id=${course_id}&teach_id=${teach_id}&msg=成绩保存成功`);
    } catch (err) {
        res.redirect(`/grade-entry?course_id=${course_id}&teach_id=${teach_id}&msg=保存失败`);
    }
});

// ---- 学生成绩单 ----
app.get('/my-grades', requireAuth, async (req, res) => {
    const u = req.session.user;
    if (u.role_type !== 'student') {
        return res.status(403).send('仅学生可查看个人成绩单');
    }
    const [rows] = await pool.query(
        'SELECT sc.*, c.f_name AS course_name, c.f_credit, t.f_name AS teacher_name ' +
        'FROM t_stu_course sc ' +
        'JOIN t_course c ON sc.f_course_id=c.f_course_id ' +
        'JOIN t_teacher t ON sc.f_teach_id=t.f_teach_id ' +
        'WHERE sc.f_stu_id=? ORDER BY sc.f_course_id', [u.id]
    );
    // 计算绩点
    let totalCredit = 0, totalPoints = 0;
    const graded = rows.filter(r => r.f_score !== null);
    graded.forEach(r => {
        const credit = parseFloat(r.f_credit) || 0;
        const score = parseFloat(r.f_score) || 0;
        let gp = 0;
        if (score >= 90) gp = 4.0;
        else if (score >= 85) gp = 3.7;
        else if (score >= 82) gp = 3.3;
        else if (score >= 78) gp = 3.0;
        else if (score >= 75) gp = 2.7;
        else if (score >= 72) gp = 2.3;
        else if (score >= 68) gp = 2.0;
        else if (score >= 64) gp = 1.5;
        else if (score >= 60) gp = 1.0;
        totalCredit += credit;
        totalPoints += credit * gp;
    });
    const gpa = totalCredit > 0 ? (totalPoints / totalCredit).toFixed(2) : null;
    res.render('my-grades', { user: u, grades: rows, totalCredit, gpa, gradedCount: graded.length, totalCount: rows.length });
});

// ---- 学生选课视图 ----
app.get('/enroll-view', requireAuth, async (req, res) => {
    const u = req.session.user;
    let rows;
    if (u.role_type === 'teacher')
        [rows] = await pool.query('SELECT * FROM v_student_course WHERE 教师工号=?', [u.id]);
    else if (u.role_type === 'student')
        [rows] = await pool.query('SELECT * FROM v_student_course WHERE 学生学号=?', [u.id]);
    else
        [rows] = await pool.query('SELECT * FROM v_student_course');
    res.render('enroll-view', { user: u, enrollments: rows });
});

// ---- 学生选课操作 ----
app.get('/enroll', requireAuth, async (req, res) => {
    const u = req.session.user;
    // 支持退课后等操作的消息提示
    let qmsg = null;
    if (req.query.msg) qmsg = { type: req.query.type || 'success', text: req.query.msg };
    const [students] = await pool.query('SELECT * FROM t_student ORDER BY f_stu_id');
    let teachCourses;
    if (u.role_type === 'teacher')
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id WHERE tc.f_teach_id=?', [u.id]);
    else
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id');

    // 学生端：直接加载自己的选课，跳过"选择学生"步骤
    if (u.role_type === 'student') {
        const [sel] = await pool.query('SELECT s.*, c.f_name AS college_name FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id WHERE f_stu_id=?', [u.id]);
        const [enrolledCourses] = await pool.query('SELECT sc.*, c.f_name AS course_name, c.f_credit FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [u.id]);
        const [total] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS total FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [u.id]);
        return res.render('enroll', { user: u, students: [], teachCourses, selectedStudent: sel[0], enrolledCourses, totalCredit: total[0].total, msg: qmsg });
    }

    res.render('enroll', { user: u, students, teachCourses, selectedStudent: null, enrolledCourses: [], totalCredit: 0, msg: qmsg });
});

app.post('/enroll/lookup', requireAuth, async (req, res) => {
    const u = req.session.user;
    const stu_id = req.body.stu_id;
    if (u.role_type === 'student' && stu_id !== u.id) return res.redirect('/enroll');
    const [students] = await pool.query('SELECT * FROM t_student ORDER BY f_stu_id');
    const [sel] = await pool.query('SELECT s.*, c.f_name AS college_name FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id WHERE f_stu_id=?', [stu_id]);
    const [enrolledCourses] = await pool.query('SELECT sc.*, c.f_name AS course_name, c.f_credit FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
    const [total] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS total FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
    let teachCourses;
    if (u.role_type === 'teacher')
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id WHERE tc.f_teach_id=?', [u.id]);
    else
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id');
    res.render('enroll', { user: u, students, teachCourses, selectedStudent: sel[0], enrolledCourses, totalCredit: total[0].total, msg: null });
});

app.post('/enroll/add', requireAuth, async (req, res) => {
    const u = req.session.user;
    const { stu_id, course_id, teach_id } = req.body;
    if (u.role_type === 'student' && stu_id !== u.id) return res.redirect('/enroll');
    const [students] = await pool.query('SELECT * FROM t_student ORDER BY f_stu_id');
    const [sel] = await pool.query('SELECT s.*, c.f_name AS college_name FROM t_student s LEFT JOIN t_college c ON s.f_college_id=c.f_college_id WHERE f_stu_id=?', [stu_id]);
    let teachCourses;
    if (u.role_type === 'teacher')
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id WHERE tc.f_teach_id=?', [u.id]);
    else
        [teachCourses] = await pool.query('SELECT tc.*, c.f_name AS course_name, t.f_name AS teacher_name FROM t_teach_course tc JOIN t_course c ON tc.f_course_id=c.f_course_id JOIN t_teacher t ON tc.f_teach_id=t.f_teach_id');
    try {
        // 检查重复选课
        const [dup] = await pool.query('SELECT * FROM t_stu_course WHERE f_course_id=? AND f_teach_id=? AND f_stu_id=?', [course_id, teach_id, stu_id]);
        if (dup.length > 0) {
            const [enrolledCourses] = await pool.query('SELECT sc.*, c.f_name AS course_name, c.f_credit FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
            const [total] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS total FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
            return res.render('enroll', { user: u, students, teachCourses, selectedStudent: sel[0], enrolledCourses, totalCredit: total[0].total, msg: { type: 'warning', text: '该学生已选此课程，不可重复选课！' } });
        }
        // 检查选课人数上限
        const [[{cnt}]] = await pool.query('SELECT COUNT(*) AS cnt FROM t_stu_course WHERE f_course_id=? AND f_teach_id=?', [course_id, teach_id]);
        if (cnt >= COURSE_CAPACITY) {
            const [enrolledCourses] = await pool.query('SELECT sc.*, c.f_name AS course_name, c.f_credit FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
            const [total] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS total FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
            return res.render('enroll', { user: u, students, teachCourses, selectedStudent: sel[0], enrolledCourses, totalCredit: total[0].total, msg: { type: 'warning', text: '该课程选课人数已满（上限' + COURSE_CAPACITY + '人），无法继续选课！' } });
        }
        await pool.query('INSERT INTO t_stu_course (f_course_id,f_teach_id,f_stu_id,f_score,f_memo) VALUES (?,?,?,NULL,"正在修读")', [course_id, teach_id, stu_id]);
        const [enrolledCourses] = await pool.query('SELECT sc.*, c.f_name AS course_name, c.f_credit FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
        const [total] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS total FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
        res.render('enroll', { user: u, students, teachCourses, selectedStudent: sel[0], enrolledCourses, totalCredit: total[0].total, msg: { type: 'success', text: '选课成功！' } });
    } catch (err) {
        const [enrolledCourses] = await pool.query('SELECT sc.*, c.f_name AS course_name, c.f_credit FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
        const [total] = await pool.query('SELECT COALESCE(SUM(c.f_credit),0) AS total FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_stu_id=?', [stu_id]);
        res.render('enroll', { user: u, students, teachCourses, selectedStudent: sel[0], enrolledCourses, totalCredit: total[0].total, msg: { type: 'danger', text: '选课失败，请稍后再试' } });
    }
});

// ---- 退课操作 ----
app.post('/enroll/drop', requireAuth, async (req, res) => {
    const u = req.session.user;
    const { stu_id, course_id, teach_id } = req.body;
    // 学生只能退自己的课
    if (u.role_type === 'student' && stu_id !== u.id) {
        return res.redirect('/enroll');
    }
    try {
        const [info] = await pool.query(
            'SELECT sc.*, c.f_name AS course_name FROM t_stu_course sc JOIN t_course c ON sc.f_course_id=c.f_course_id WHERE sc.f_course_id=? AND sc.f_teach_id=? AND sc.f_stu_id=?',
            [course_id, teach_id, stu_id]
        );
        await pool.query('DELETE FROM t_stu_course WHERE f_course_id=? AND f_teach_id=? AND f_stu_id=?', [course_id, teach_id, stu_id]);
        if (info.length > 0) {
            logOp(u, '退课', `学生${stu_id}`, `退选课程：${info[0].course_name}`);
        }
        // 退课后重定向到 enroll 页面，重新查询
        if (u.role_type === 'student') {
            res.redirect('/enroll?msg=退课成功&type=success');
        } else {
            res.redirect('/enroll?msg=退课成功&type=success');
        }
    } catch (err) {
        res.redirect('/enroll?msg=退课失败&type=danger');
    }
});

// ---- 操作日志审计（管理员） ----
app.get('/audit-log', adminOnly, async (req, res) => {
    const pg = pages(req);
    const u = req.session.user;
    try {
        const [rows] = await pool.query('SELECT * FROM t_operation_log ORDER BY f_created_at DESC LIMIT ? OFFSET ?', [pg.limit, pg.offset]);
        const [[{cnt}]] = await pool.query('SELECT COUNT(*) AS cnt FROM t_operation_log');
        const totalPages = Math.ceil(cnt / PER_PAGE);
        res.render('audit-log', { user: u, logs: rows, page: pg.page, totalPages });
    } catch (err) {
        res.render('audit-log', { user: u, logs: [], page: 1, totalPages: 0, error: '加载失败：' + err.message });
    }
});

// ---- 404 处理（必须放在所有路由之后） ----
app.use((req, res) => {
    res.status(404).render('404', { user: req.session.user, url: req.originalUrl });
});

// ---- 500 全局错误处理 ----
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).render('500', { user: req.session.user, error: err.message });
});

// ---- 启动 ----
app.listen(PORT, () => {
    console.log(`学生选课管理系统已启动：http://localhost:${PORT}`);
    console.log('按 Ctrl+C 停止服务');
});
