-- ============================================================
-- 实训任务3：系统数据初始化
-- 执行方法：MySQL Workbench 中按 Ctrl+Shift+Enter 运行全部
-- ============================================================

DROP DATABASE IF EXISTS scsmis;

CREATE DATABASE IF NOT EXISTS  `scsmis`;

USE `scsmis`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 表结构定义
-- ============================================================

-- 学院表
CREATE TABLE t_college(
    f_college_id VARCHAR(2) PRIMARY KEY,      -- 学院编号，2位编码
    f_name VARCHAR(50) NOT NULL UNIQUE,       -- 学院名称，非空+唯一
    f_memo VARCHAR(200)                       -- 备注，可为空
);

-- 管理员表
CREATE TABLE t_admin (
    f_user_id VARCHAR(6) NOT NULL PRIMARY KEY,            -- 账号，管理员登录账号
    f_password VARCHAR(50) NOT NULL DEFAULT '123456',     -- 密码，初始123456
    f_name VARCHAR(50) NOT NULL,                          -- 姓名
    f_sex VARCHAR(1) NOT NULL CHECK (f_sex IN ('男', '女')), -- 性别，只允许男/女
    f_birth DATE,                                          -- 出生日期
    f_dept VARCHAR(50),                                    -- 部门
    f_tel VARCHAR(20),                                     -- 电话
    f_memo VARCHAR(200)                                    -- 备注信息
);

-- 学生表
CREATE TABLE t_student (
    f_stu_id VARCHAR(20) NOT NULL PRIMARY KEY,             -- 学号，学生登录账号
    f_password VARCHAR(50) NOT NULL DEFAULT '123456',      -- 密码，初始123456
    f_name VARCHAR(50) NOT NULL,                           -- 姓名
    f_sex VARCHAR(1) NOT NULL CHECK (f_sex IN ('男', '女')), -- 性别
    f_birth DATE,                               -- 出生日期
    f_enroll_year SMALLINT,                     -- 入学年份
    f_college_id VARCHAR(2) NOT NULL,           -- 学院编号（外键）
    f_speciality VARCHAR(50),                   -- 专业
    f_tel VARCHAR(20),                          -- 电话
    f_memo VARCHAR(200),                        -- 备注信息
    FOREIGN KEY (f_college_id) REFERENCES t_college(f_college_id)
);

-- 教师表
CREATE TABLE t_teacher (
    f_teach_id VARCHAR(6) NOT NULL PRIMARY KEY,            -- 教师工号，教师登录账号
    f_password VARCHAR(50) NOT NULL DEFAULT '123456',      -- 密码，初始123456
    f_name VARCHAR(50) NOT NULL,                           -- 姓名
    f_sex VARCHAR(1) NOT NULL CHECK (f_sex IN ('男', '女')), -- 性别
    f_title VARCHAR(50) NOT NULL CHECK (f_title IN ('教授', '副教授', '讲师', '助教', '高工')), -- 职称
    f_college_id VARCHAR(2) NOT NULL,           -- 学院编号（外键）
    f_tel VARCHAR(20),                          -- 电话
    f_memo VARCHAR(200),                        -- 备注信息
    FOREIGN KEY (f_college_id) REFERENCES t_college(f_college_id)
);

-- 课程表
CREATE TABLE t_course (
    f_course_id INT PRIMARY KEY,                  -- 课程编号，整数自增
    f_name VARCHAR(50) NOT NULL UNIQUE,           -- 课程名称，非空+唯一
    f_pre_course INT,                             -- 先修课程编号（自引用外键）
    f_credit NUMERIC(2,1) NOT NULL CHECK (f_credit >= 0 AND f_credit <= 10), -- 学分0~10
    f_memo VARCHAR(200),                          -- 备注信息
    FOREIGN KEY (f_pre_course) REFERENCES t_course(f_course_id)
);

-- 教师授课表（多对多：课程-教师）
CREATE TABLE t_teach_course (
    f_course_id INT NOT NULL,                -- 课程编号
    f_teach_id VARCHAR(6) NOT NULL,          -- 教师工号
    f_time VARCHAR(50),                      -- 授课时间
    f_place VARCHAR(50),                     -- 授课地点
    f_memo VARCHAR(200),                     -- 备注信息
    PRIMARY KEY (f_course_id, f_teach_id),
    FOREIGN KEY (f_course_id) REFERENCES t_course(f_course_id),
    FOREIGN KEY (f_teach_id) REFERENCES t_teacher(f_teach_id)
);

-- 学生选课表（多对多：学生-课程-教师）
CREATE TABLE t_stu_course (
    f_course_id  INT          NOT NULL,     -- 课程编号
    f_teach_id   VARCHAR(6)   NOT NULL,     -- 教师工号
    f_stu_id     VARCHAR(20)  NOT NULL,     -- 学生学号
    f_score      NUMERIC(3,1),              -- 成绩，3位数字1位小数，可为空
    f_memo       VARCHAR(200),              -- 备注信息
    PRIMARY KEY (f_course_id, f_teach_id, f_stu_id),
    FOREIGN KEY (f_course_id) REFERENCES t_course(f_course_id),
    FOREIGN KEY (f_teach_id)  REFERENCES t_teacher(f_teach_id),
    FOREIGN KEY (f_stu_id)    REFERENCES t_student(f_stu_id)
);

-- 外键索引（提升连接查询性能）
CREATE INDEX idx_stu_course_course_id ON t_stu_course(f_course_id);
CREATE INDEX idx_stu_course_teach_id ON t_stu_course(f_teach_id);
CREATE INDEX idx_stu_course_stu_id ON t_stu_course(f_stu_id);

-- ============================================================
-- 实训任务3：系统数据初始化
-- ============================================================

-- ----------------------------
-- 1. 初始化学院数据
-- ----------------------------
INSERT INTO t_college (f_college_id, f_name, f_memo) VALUES
('01', '计算机科学与技术学院', '计算机、软件工程相关专业'),
('02', '信息与通信工程学院', '通信、电子、网络相关专业'),
('03', '数学与统计学院', '数学、统计学相关专业'),
('04', '外国语学院', '英语、日语、翻译相关专业'),
('05', '经济管理学院', '经济学、管理学相关专业');

-- ----------------------------
-- 2. 初始化管理员信息
-- ----------------------------
INSERT INTO t_admin (f_user_id, f_password, f_name, f_sex, f_birth, f_dept, f_tel, f_memo) VALUES
('admin1', '123456', '张管理', '男', '1985-03-15', '教务处', '13800001111', '系统管理员'),
('admin2', '123456', '李教务', '女', '1990-07-22', '教务处', '13800002222', '教务管理员'),
('admin3', '123456', '王主任', '男', '1978-11-08', '学院办公室', '13800003333', '办公室主任');

-- ----------------------------
-- 3. 初始化教师数据
-- ----------------------------
INSERT INTO t_teacher (f_teach_id, f_password, f_name, f_sex, f_title, f_college_id, f_tel, f_memo) VALUES
('T0001', '123456', '赵教授', '男', '教授', '01', '13900001111', '计算机科学方向'),
('T0002', '123456', '钱副教授', '女', '副教授', '01', '13900002222', '软件工程方向'),
('T0003', '123456', '孙讲师', '男', '讲师', '02', '13900003333', '通信工程方向'),
('T0004', '123456', '周教授', '女', '教授', '02', '13900004444', '电子工程方向'),
('T0005', '123456', '吴助教', '男', '助教', '03', '13900005555', '数学方向');

-- ----------------------------
-- 4. 初始化学生数据
-- ----------------------------
INSERT INTO t_student (f_stu_id, f_password, f_name, f_sex, f_birth, f_enroll_year, f_college_id, f_speciality, f_tel, f_memo) VALUES
('20220101001', '123456', '张三', '男', '2003-05-10', 2022, '01', '计算机科学与技术', '15000000001', NULL),
('20220101002', '123456', '李四', '女', '2003-08-20', 2022, '01', '软件工程', '15000000002', NULL),
('20220101003', '123456', '王五', '男', '2004-01-15', 2022, '01', '计算机科学与技术', '15000000003', NULL),
('20220201001', '123456', '赵六', '女', '2003-11-30', 2022, '02', '通信工程', '15000000004', NULL),
('20220201002', '123456', '孙七', '男', '2003-06-18', 2022, '02', '电子信息工程', '15000000005', NULL),
('20220301001', '123456', '周八', '女', '2004-03-25', 2022, '03', '数学与应用数学', '15000000006', NULL);

-- ----------------------------
-- 5. 初始化课程数据
-- ----------------------------
INSERT INTO t_course (f_course_id, f_name, f_pre_course, f_credit, f_memo) VALUES
(1, 'C语言程序设计', NULL, 4.0, '编程基础必修课'),
(2, '数据结构', 1, 4.0, '先修：C语言程序设计'),
(3, '数据库原理', 2, 3.5, '先修：数据结构'),
(4, '操作系统', 2, 4.0, '先修：数据结构'),
(5, '计算机网络', NULL, 3.0, '无先修要求'),
(6, '高等数学', NULL, 5.0, '基础必修课'),
(7, '线性代数', 6, 3.0, '先修：高等数学');

-- ----------------------------
-- 6. 初始化教师授课数据
-- ----------------------------
INSERT INTO t_teach_course (f_course_id, f_teach_id, f_time, f_place, f_memo) VALUES
(1, 'T0001', '周一 第1-2节', '教一楼101', '2022级计算机专业'),
(2, 'T0001', '周一 第3-4节', '教一楼102', '2022级计算机专业'),
(3, 'T0002', '周二 第1-2节', '教二楼201', '2022级计算机专业'),
(4, 'T0003', '周三 第1-2节', '教三楼301', '2022级通信专业'),
(5, 'T0004', '周四 第1-2节', '教一楼103', '全校公选'),
(1, 'T0002', '周五 第5-6节', '教一楼101', '2023级软件工程专业'),
(2, 'T0005', '周二 第3-4节', '教二楼202', '2023级数学专业');

-- ----------------------------
-- 7. 初始化学生选课及成绩数据
-- ----------------------------
INSERT INTO t_stu_course (f_course_id, f_teach_id, f_stu_id, f_score, f_memo) VALUES
-- 张三（20220101001）：已修C语言(85.5)、数据库原理(78)、计算机网络(92)，正在修数据结构
(1, 'T0001', '20220101001', 85.5, NULL),
(2, 'T0001', '20220101001', NULL, '正在修读'),
(3, 'T0002', '20220101001', 78.0, NULL),
(5, 'T0004', '20220101001', 92.0, NULL),
-- 李四（20220101002）：已修C语言(90)、数据结构(88.5)，正在修操作系统、计算机网络
(1, 'T0001', '20220101002', 90.0, NULL),
(2, 'T0001', '20220101002', 88.5, NULL),
(4, 'T0003', '20220101002', NULL, '正在修读'),
(5, 'T0004', '20220101002', NULL, '正在修读'),
-- 王五（20220101003）：已修数据库原理(76)，正在修C语言
(1, 'T0002', '20220101003', NULL, '正在修读'),
(3, 'T0002', '20220101003', 76.0, NULL),
-- 赵六（20220201001）：已修C语言(82)、计算机网络(88)
(1, 'T0001', '20220201001', 82.0, NULL),
(5, 'T0004', '20220201001', 88.0, NULL),
-- 孙七（20220201002）：已修数据库原理(70.5)，正在修数据结构
(2, 'T0005', '20220201002', NULL, '正在修读'),
(3, 'T0002', '20220201002', 70.5, NULL),
-- 周八（20220301001）：已修C语言(95)、数据结构(91)
(1, 'T0001', '20220301001', 95.0, NULL),
(2, 'T0001', '20220301001', 91.0, NULL);

-- ============================================================
-- 实训任务3：视图、存储过程与触发器
-- ============================================================

-- ----------------------------
-- 8. 教师授课视图 v_teacher_course
-- 字段：课程编号、课程名称、教师工号、教师姓名、职称、授课时间、授课地点、选课人数
-- ----------------------------
DROP VIEW IF EXISTS v_teacher_course;
CREATE VIEW v_teacher_course AS
SELECT
    tc.f_course_id          AS 课程编号,
    c.f_name                AS 课程名称,
    tc.f_teach_id           AS 教师工号,
    t.f_name                AS 教师姓名,
    t.f_title               AS 职称,
    tc.f_time               AS 授课时间,
    tc.f_place              AS 授课地点,
    (SELECT COUNT(*)
     FROM t_stu_course sc
     WHERE sc.f_course_id = tc.f_course_id
       AND sc.f_teach_id  = tc.f_teach_id) AS 选课人数
FROM t_teach_course tc
JOIN t_course c  ON tc.f_course_id = c.f_course_id
JOIN t_teacher t ON tc.f_teach_id  = t.f_teach_id;

-- ----------------------------
-- 9. 学生选课视图 v_student_course
-- 字段：教师工号、课程编号、课程名称、学生学号、学生姓名、学院名称、专业、分数
-- ----------------------------
DROP VIEW IF EXISTS v_student_course;
CREATE VIEW v_student_course AS
SELECT
    sc.f_teach_id           AS 教师工号,
    sc.f_course_id          AS 课程编号,
    c.f_name                AS 课程名称,
    sc.f_stu_id             AS 学生学号,
    s.f_name                AS 学生姓名,
    col.f_name              AS 学院名称,
    s.f_speciality          AS 专业,
    sc.f_score              AS 分数
FROM t_stu_course sc
JOIN t_course  c   ON sc.f_course_id  = c.f_course_id
JOIN t_student s   ON sc.f_stu_id     = s.f_stu_id
JOIN t_college col ON s.f_college_id  = col.f_college_id;

-- ----------------------------
-- 10. 停开课程存储过程 sp_cancel_course
-- 功能：根据工号和课程编号进行"停开课程"操作
--   返回 1 — 该课程已考试，无法停开
--   返回 2 — 选课人数≥20人，无法停开
--   返回 0 — 停开成功（删除教师课程表和学生选课表中对应记录）
-- ----------------------------
DROP PROCEDURE IF EXISTS sp_cancel_course;

DELIMITER //

CREATE PROCEDURE sp_cancel_course(
    IN  p_teach_id   VARCHAR(6),
    IN  p_course_id  INT,
    OUT p_result     INT
)
BEGIN
    DECLARE v_enroll_count INT DEFAULT 0;
    DECLARE v_exam_count   INT DEFAULT 0;

    -- 检查该课程是否已有成绩（说明已进行考试）
    SELECT COUNT(*) INTO v_exam_count
    FROM t_stu_course
    WHERE f_course_id = p_course_id
      AND f_teach_id  = p_teach_id
      AND f_score IS NOT NULL;

    IF v_exam_count > 0 THEN
        -- 已考试，无法停开
        SET p_result = 1;
    ELSE
        -- 统计选课人数
        SELECT COUNT(*) INTO v_enroll_count
        FROM t_stu_course
        WHERE f_course_id = p_course_id
          AND f_teach_id  = p_teach_id;

        IF v_enroll_count >= 20 THEN
            -- 选课人数≥20，无法停开
            SET p_result = 2;
        ELSE
            -- 可停开：先删除学生选课记录，再删除教师授课记录
            DELETE FROM t_stu_course
            WHERE f_course_id = p_course_id
              AND f_teach_id  = p_teach_id;

            DELETE FROM t_teach_course
            WHERE f_course_id = p_course_id
              AND f_teach_id  = p_teach_id;

            SET p_result = 0;
        END IF;
    END IF;
END //

DELIMITER ;

-- ----------------------------
-- 11. 选修课程触发器 trg_check_credit
-- 功能：学生选课时检查已选课程总学分
--   总学分 < 100 → 允许选课
--   总学分 ≥ 100 → 拒绝选课，抛出错误
-- ----------------------------
DROP TRIGGER IF EXISTS trg_check_credit;

DELIMITER //

CREATE TRIGGER trg_check_credit
BEFORE INSERT ON t_stu_course
FOR EACH ROW
BEGIN
    DECLARE v_total_credit NUMERIC(4,1) DEFAULT 0;
    DECLARE v_new_credit   NUMERIC(2,1) DEFAULT 0;

    -- 计算该学生当前已选课程的总学分
    SELECT COALESCE(SUM(c.f_credit), 0) INTO v_total_credit
    FROM t_stu_course sc
    JOIN t_course c ON sc.f_course_id = c.f_course_id
    WHERE sc.f_stu_id = NEW.f_stu_id;

    -- 获取新选课程的学分
    SELECT f_credit INTO v_new_credit
    FROM t_course
    WHERE f_course_id = NEW.f_course_id;

    -- 计算选课后的总学分
    SET v_total_credit = v_total_credit + v_new_credit;

    -- 若总学分 ≥ 100，拒绝选课
    IF v_total_credit >= 100 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '选课失败：已选课程总学分已达到或超过100，无法继续选课！';
    END IF;
END //

DELIMITER ;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;
