// 将学生从 6 人扩展到 25 人（新增 19 人）
// 用法：node add_students.js

const mysql = require('mysql2/promise');
const dbConfig = require('./config');

// ── 19 个新学生数据 ──
// 学号规则：2022 + 学院编号(2位) + 序号(3位)
// 学院 01=计算机  02=信通  03=数学
const newStudents = [
  // ===== 学院 01：计算机科学与技术学院（再+7，共10人）=====
  { id: '20220101004', name: '刘洋',   sex: '男', birth: '2003-09-12', year: 2022, college: '01', major: '计算机科学与技术', tel: '15000000007' },
  { id: '20220101005', name: '陈芳',   sex: '女', birth: '2004-02-28', year: 2022, college: '01', major: '软件工程',           tel: '15000000008' },
  { id: '20220101006', name: '杨帆',   sex: '男', birth: '2003-07-03', year: 2022, college: '01', major: '计算机科学与技术', tel: '15000000009' },
  { id: '20220101007', name: '吴雨',   sex: '女', birth: '2004-11-08', year: 2022, college: '01', major: '软件工程',           tel: '15000000010' },
  { id: '20220101008', name: '黄磊',   sex: '男', birth: '2003-04-22', year: 2022, college: '01', major: '计算机科学与技术', tel: '15000000011' },
  { id: '20220101009', name: '许慧',   sex: '女', birth: '2004-06-15', year: 2022, college: '01', major: '软件工程',           tel: '15000000012' },
  { id: '20220101010', name: '何伟',   sex: '男', birth: '2003-12-30', year: 2022, college: '01', major: '计算机科学与技术', tel: '15000000013' },

  // ===== 学院 02：信息与通信工程学院（再+7，共9人）=====
  { id: '20220201003', name: '马丽',   sex: '女', birth: '2003-08-05', year: 2022, college: '02', major: '通信工程',           tel: '15000000014' },
  { id: '20220201004', name: '郑强',   sex: '男', birth: '2004-01-18', year: 2022, college: '02', major: '电子信息工程',       tel: '15000000015' },
  { id: '20220201005', name: '谢婷',   sex: '女', birth: '2003-10-25', year: 2022, college: '02', major: '通信工程',           tel: '15000000016' },
  { id: '20220201006', name: '韩浩',   sex: '男', birth: '2004-03-07', year: 2022, college: '02', major: '电子信息工程',       tel: '15000000017' },
  { id: '20220201007', name: '曹雪',   sex: '女', birth: '2003-05-29', year: 2022, college: '02', major: '通信工程',           tel: '15000000018' },
  { id: '20220201008', name: '邓超',   sex: '男', birth: '2004-09-14', year: 2022, college: '02', major: '电子信息工程',       tel: '15000000019' },
  { id: '20220201009', name: '冯敏',   sex: '女', birth: '2003-11-02', year: 2022, college: '02', major: '通信工程',           tel: '15000000020' },

  // ===== 学院 03：数学与统计学院（再+5，共6人）=====
  { id: '20220301002', name: '朱杰',   sex: '男', birth: '2003-06-19', year: 2022, college: '03', major: '数学与应用数学',    tel: '15000000021' },
  { id: '20220301003', name: '林静',   sex: '女', birth: '2004-02-14', year: 2022, college: '03', major: '统计学',             tel: '15000000022' },
  { id: '20220301004', name: '沈鹏',   sex: '男', birth: '2003-09-27', year: 2022, college: '03', major: '数学与应用数学',    tel: '15000000023' },
  { id: '20220301005', name: '宋瑶',   sex: '女', birth: '2004-07-08', year: 2022, college: '03', major: '统计学',             tel: '15000000024' },
  { id: '20220301006', name: '唐力',   sex: '男', birth: '2003-04-11', year: 2022, college: '03', major: '数学与应用数学',    tel: '15000000025' },
];

(async () => {
  const pool = mysql.createPool(dbConfig);

  // 1. 先查出当前已有学生数
  const [existing] = await pool.query('SELECT COUNT(*) AS cnt FROM t_student');
  const oldCount = existing[0].cnt;
  console.log(`当前学生数: ${oldCount}`);

  // 2. 逐个插入（用参数化查询防注入）
  let added = 0;
  for (const s of newStudents) {
    try {
      await pool.query(
        `INSERT INTO t_student
           (f_stu_id, f_password, f_name, f_sex, f_birth, f_enroll_year, f_college_id, f_speciality, f_tel, f_memo)
         VALUES (?, '123456', ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [s.id, s.name, s.sex, s.birth, s.year, s.college, s.major, s.tel]
      );
      added++;
      console.log(`  ✅ ${s.id} ${s.name} (${s.college} ${s.major})`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log(`  ⚠️ ${s.id} ${s.name} — 已存在，跳过`);
      } else {
        console.log(`  ❌ ${s.id} ${s.name} — ${err.message}`);
      }
    }
  }

  // 3. 最终统计
  const [final] = await pool.query('SELECT COUNT(*) AS cnt FROM t_student');
  const newCount = final[0].cnt;
  console.log(`\n📊 完成：${oldCount} → ${newCount} 人（新增 ${added} 人）`);

  // 4. 按学院统计
  console.log('\n各学院人数：');
  const [stats] = await pool.query(`
    SELECT c.f_name AS college, COUNT(s.f_stu_id) AS cnt
    FROM t_college c
    LEFT JOIN t_student s ON c.f_college_id = s.f_college_id
    GROUP BY c.f_college_id, c.f_name
    ORDER BY c.f_college_id
  `);
  stats.forEach(r => console.log(`  ${r.college}: ${r.cnt} 人`));

  await pool.end();
})();
