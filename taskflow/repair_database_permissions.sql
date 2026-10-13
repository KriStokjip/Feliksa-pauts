-- TASKFLOW: repair MySQL error 1044 (database permission denied).
-- Run as root or another MySQL administrator using phpMyAdmin's SQL tab.
-- IMPORTANT: this DOES NOT change the database user's password or any data.
-- The user 'taskflow_app'@'127.0.0.1' must already exist.
-- If using a different database name, username, or host in config.local.php,
-- adjust the GRANT statement to match exactly.

GRANT SELECT, INSERT, UPDATE, DELETE
ON `taskflow_db`.*
TO 'taskflow_app'@'127.0.0.1';

SHOW GRANTS FOR 'taskflow_app'@'127.0.0.1';
