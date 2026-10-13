-- Run ONCE after upgrading an existing TaskFlow installation.
-- Do not import database.sql again as a replacement for this upgrade.
-- Back up taskflow_db first. Existing users, memberships and projects remain.
USE taskflow_db;

-- Guard ALTER TABLE statements so re-running this file is safe on MySQL/MariaDB.
SET @has_first_name = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'first_name'
);
SET @sql = IF(@has_first_name = 0,
  "ALTER TABLE users ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT '' AFTER username",
  'SELECT 1');
PREPARE taskflow_upgrade FROM @sql;
EXECUTE taskflow_upgrade;
DEALLOCATE PREPARE taskflow_upgrade;

SET @has_description = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'description'
);
SET @sql = IF(@has_description = 0,
  'ALTER TABLE tasks ADD COLUMN description TEXT NULL AFTER title',
  'SELECT 1');
PREPARE taskflow_upgrade FROM @sql;
EXECUTE taskflow_upgrade;
DEALLOCATE PREPARE taskflow_upgrade;

CREATE TABLE IF NOT EXISTS personal_tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NULL,
  deadline DATE NULL,
  priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  status ENUM('todo','doing','done') NOT NULL DEFAULT 'todo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_personal_owner (owner_id, status, deadline),
  CONSTRAINT fk_personal_task_owner FOREIGN KEY (owner_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
