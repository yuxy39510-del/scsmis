-- 操作日志审计表
CREATE TABLE IF NOT EXISTS t_operation_log (
    f_id INT AUTO_INCREMENT PRIMARY KEY,
    f_user_id VARCHAR(50) NOT NULL COMMENT '操作用户ID',
    f_user_name VARCHAR(100) NOT NULL COMMENT '操作用户姓名',
    f_role_type VARCHAR(20) NOT NULL COMMENT '角色类型',
    f_action VARCHAR(50) NOT NULL COMMENT '操作类型',
    f_target VARCHAR(100) COMMENT '操作目标',
    f_detail VARCHAR(500) COMMENT '操作详情',
    f_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    INDEX idx_user (f_user_id),
    INDEX idx_action (f_action),
    INDEX idx_time (f_created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作日志表';
