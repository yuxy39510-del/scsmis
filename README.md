学生选课管理系统 SCSMIS

> Student Course Selection Management Information System  
> 大学生实训项目 — Node.js + Express + MySQL + EJS

---

 功能特性

用户角色

管理员：学院/管理员/教师/学生/课程 CRUD、操作日志审计、数据统计  
教师：开设课程、停开课程、录入成绩  
学生：选课/退课、查看成绩单与 GPA、修改密码  

 业务特性
- **1. 仪表盘可视化** — Chart.js 柱状图/饼图/排行，按角色展示不同数据
- **2. 服务端搜索** — 跨页 SQL LIKE 搜索，不限于当前页
- **3. 分页** — 所有列表 10 条/页，带页码导航
- **4. 重复选课拦截** — 前端+后端双重校验
- **5. 选课人数上限** — 每门课最多 60 人
- **6. 操作日志审计** — 记录所有关键操作，支持追溯
- **7. GPA 计算** — 加权绩点 + 成绩等级（优秀/良好/中等/及格）
- **8. 密码修改** — 所有角色可修改密码
- **9. 触发器/存储过程** — 学分上限拦截、课程停开校验

---

 技术栈
后端：Node.js + Express.js  
前端：EJS 模板 + Bootstrap 5 + Chart.js  
数据库：MySQL（含视图、触发器、存储过程）  
部署：PM2 + iptables 端口转发  

---

快速开始

```bash
# 1. 克隆项目
git clone https://github.com/yuxy39510-del/scsmis.git
cd scsmis

# 2. 安装依赖
npm install

# 3. 配置数据库
cp .env.example .env
# 编辑 .env 填入数据库密码

# 4. 导入数据库（如有 SQL 导出文件）
mysql -u root -p < database.sql

# 5. 启动
node app.js
# 访问 http://localhost:3000
```

```
测试账号

管理员：admin1 | 123456  
教师：T0001 | 123456  
学生：20220101001 | 123456  
```

---

项目结构

```
scsmis/
├── app.js              # 主入口，路由与中间件
├── config.js           # 数据库配置（不上传 Git）
├── config.example.js   # 配置模板
├── .env                # 环境变量（不上传 Git）
├── .env.example        # 环境变量模板
├── package.json
├── views/              # EJS 模板
│   ├── header.ejs      # 公共头部（含侧边栏）
│   ├── footer.ejs      # 公共尾部（含 JS 工具）
│   ├── index.ejs       # 仪表盘（Chart.js 图表）
│   ├── login.ejs       # 登录页
│   ├── 404.ejs         # 404 错误页
│   ├── 500.ejs         # 500 错误页
│   └── ...
├── public/             # 静态资源（CSS/图片）
├── sql/                # 数据库脚本
└── node_modules/       # 依赖（不上传 Git）
```

---

安全说明

- `.env` 和 `config.js` 已在 `.gitignore` 中排除
- 生产环境请更换 `SESSION_SECRET` 和数据库密码
- 建议启用 bcrypt 加密存储密码（当前为明文，实训演示用）

---

License

MIT — 仅供学习交流使用
