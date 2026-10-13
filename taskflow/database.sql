CREATE DATABASE IF NOT EXISTS taskflow_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE taskflow_db;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  deadline DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_members (
  project_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('owner','member') NOT NULL DEFAULT 'member',
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT fk_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  assignee_id INT UNSIGNED NULL,
  deadline DATE NULL,
  priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  status ENUM('todo','doing','done') NOT NULL DEFAULT 'todo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Shared across sessions: throttles repeated login attempts per IP and username.
-- Re-importing this file creates the table without touching existing project data.
CREATE TABLE IF NOT EXISTS login_attempts (
  fingerprint CHAR(64) NOT NULL PRIMARY KEY,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  window_started DATETIME NOT NULL,
  INDEX idx_login_attempts_window (window_started)
) ENGINE=InnoDB;

-- Pending invitations DO NOT grant project access. A user joins only after accepting.
-- Each project/user pair may have one pending invitation at a time.
CREATE TABLE IF NOT EXISTS project_invitations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  invitee_id INT UNSIGNED NOT NULL,
  invited_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_invitee (project_id, invitee_id),
  INDEX idx_invitations_recipient (invitee_id, created_at),
  CONSTRAINT fk_invitations_project FOREIGN KEY (project_id)
    REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitations_invitee FOREIGN KEY (invitee_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitations_sender FOREIGN KEY (invited_by)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
