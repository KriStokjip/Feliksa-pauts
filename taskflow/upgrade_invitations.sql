-- Existing TaskFlow upgrade: adds the missing support tables safely.
-- Run as a MySQL administrator in phpMyAdmin after making a backup.
-- Existing users, projects, memberships and tasks are unchanged.
USE taskflow_db;

-- Login attempt limits are required for authentication on the updated API.
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
