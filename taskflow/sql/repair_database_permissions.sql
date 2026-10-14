
GRANT SELECT, INSERT, UPDATE, DELETE
ON `taskflow_db`.*
TO 'taskflow_app'@'127.0.0.1';

SHOW GRANTS FOR 'taskflow_app'@'127.0.0.1';
