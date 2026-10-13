TASKFLOW — PERSONAL TASKS + PROFILE EDITION
======================================

This package is the entire TaskFlow application. The outer folder is named
"taskflow" so it can be placed directly at C:\xampp\htdocs\taskflow\.

REQUIREMENTS
------------
- XAMPP with Apache, MySQL/MariaDB, PHP 8.1+ and PDO MySQL enabled.
- A modern browser.
- A database called taskflow_db and a non-root MySQL user with a password.
- The PHP app does not create MySQL users or grant database permissions.

UPDATING AN EXISTING INSTALLATION (KEEP YOUR DATA)
--------------------------------------------------
1. Back up your taskflow_db database in phpMyAdmin (Export) and your current
   C:\xampp\htdocs\taskflow\ folder.
2. Preserve the existing file C:\xampp\htdocs\taskflow\config.local.php.
   THIS FILE CONTAINS YOUR PRIVATE DATABASE PASSWORD. It is not in the ZIP.
3. Extract this ZIP and copy the new taskflow folder contents into your
   existing C:\xampp\htdocs\taskflow\ folder, replacing the app files.
   Do not erase or overwrite your preserved config.local.php.
4. Start Apache and MySQL in XAMPP. In phpMyAdmin, sign in as administrator.
   If you have an old installation before invitations existed, first import
   upgrade_invitations.sql (creates invitations and login_attempts).
   IMPORTANT: Import upgrade_personal_profile.sql into taskflow_db to add
   users.first_name, tasks.description and the personal_tasks table.
   This upgrade is designed to preserve existing accounts, projects and invites.
   Existing users will have a blank first name until they edit Profile.
   You can re-run the upgrade if necessary: it skips existing columns/tables.
5. IMPORTANT IF YOU SEE MYSQL ERROR 1044 / ACCESS DENIED TO taskflow_db:
   Sign into phpMyAdmin as a database administrator, open the SQL tab and run:

   GRANT SELECT, INSERT, UPDATE, DELETE
   ON `taskflow_db`.*
   TO 'taskflow_app'@'127.0.0.1';

   Then verify with:

   SHOW GRANTS FOR 'taskflow_app'@'127.0.0.1';

   You should see SELECT, INSERT, UPDATE, DELETE on taskflow_db.* in addition
   to the basic USAGE grant. You can also import repair_database_permissions.sql
   in the SQL tab while signed in as an administrator. It does not change
   passwords or touch project data.
6. Visit http://localhost/taskflow/ and test login, project access, invites,
   accept/decline, leaving and task assignment.

FIRST-TIME INSTALLATION
-----------------------
1. Copy the extracted taskflow folder into C:\xampp\htdocs\.
2. Start Apache and MySQL via XAMPP.
3. In http://localhost/phpmyadmin, using a MySQL administrator account,
   import database.sql. This creates taskflow_db and all seven tables,
   including personal_tasks. For a NEW install DO NOT import the upgrade SQL.
4. In phpMyAdmin's SQL tab (AS ADMINISTRATOR), run these statements, replacing
   YOUR_OWN_NEW_STRONG_PASSWORD with your own unique password:

   CREATE USER IF NOT EXISTS 'taskflow_app'@'127.0.0.1'
       IDENTIFIED BY 'YOUR_OWN_NEW_STRONG_PASSWORD';

   ALTER USER 'taskflow_app'@'127.0.0.1'
       IDENTIFIED BY 'YOUR_OWN_NEW_STRONG_PASSWORD';

   GRANT SELECT, INSERT, UPDATE, DELETE
   ON `taskflow_db`.*
   TO 'taskflow_app'@'127.0.0.1';

   SHOW GRANTS FOR 'taskflow_app'@'127.0.0.1';

   Do not use your TaskFlow website password as a MySQL password. Never paste
   your private password into messages, screenshots, or a public repository.
5. Copy config.local.example.php to config.local.php in the SAME folder as
   config.php. Edit config.local.php to match your MySQL credentials, e.g.:

   <?php
   return [
       'host' => '127.0.0.1',
       'port' => 3306,
       'database' => 'taskflow_db',
       'username' => 'taskflow_app',
       'password' => 'YOUR_OWN_NEW_STRONG_PASSWORD',
   ];

   Use your actual password in this LOCAL file only. Do not send it to anyone.
   config.local.php is ignored by Git and blocked from direct Apache access.
   If MySQL is running on port 3307 (or another port), change 'port' here.
6. Open http://localhost/taskflow/ and register an account. Registration now
   asks for First name, Username (unchangeable), Email and Password.
   Check My Tasks, Dashboard filters, Profile and invitations.

WHY "DATABASE CONNECTION FAILED" CAN HAPPEN
--------------------------------------------
- SQLSTATE[HY000] [1044] Access denied to database taskflow_db:
  The MySQL user exists but lacks database-level grants. See step 5 in UPDATE.
  A screenshot that shows only "GRANT USAGE ON *.*" confirms this problem.
- SQLSTATE[HY000] [1045] Access denied for user:
  Username, password or exact MySQL host entry is incorrect.
- Unknown database 'taskflow_db': database.sql hasn't been imported, or you
  are connected to a different MySQL instance.
- Connection refused or timeout: MySQL isn't running or the host/port differs.
- "could not find driver": PHP PDO MySQL is not enabled.
- "Database credentials are not configured safely": config.local.php is
  missing, has a blank password, or uses the MySQL root account.
- The server logs the detailed failure in C:\xampp\apache\logs\error.log.
  Do not publish passwords or complete private configuration files.

If a MySQL account is called 'taskflow_app'@'localhost' rather than
'taskflow_app'@'127.0.0.1', these are distinct account/host combinations.
Keep the PHP host and SQL GRANT host aligned. The default configuration uses
127.0.0.1 and TCP port 3306. A previously set TASKFLOW_DB_* environment
variable takes precedence over values in config.local.php.

FEATURES
--------
- My Tasks: private, user-owned tasks independent of projects, with descriptions,
  priority, deadline, status, editing, completion, deletion and filters.
- Shared project tasks now also have optional descriptions.
- Dashboard: personal and shared tasks, active/completed list, priority/source
  filters, sort by deadline/priority/title and task/project progress statistics.
- Registration includes first_name in addition to immutable username.
- Profile shows username/email read-only and allows changing first name.
- DELETE ACCOUNT requires the current password, typing DELETE, and a final
  browser confirmation. It permanently deletes private tasks, owned projects,
  their tasks and invitations. Shared tasks assigned to the deleted account
  become unassigned, and membership in other projects is removed.

- Accounts use hashed passwords and secure PHP sessions.
- Projects have owners and member roles; only the owner can change settings.
- Tasks can be assigned only to current project members.
- Owners invite registered users. Invitations stay PENDING until accepted.
- Recipients accept or decline via the Invitations tab. Before accepting,
  they cannot view the project's tasks or appear in its member list.
- Owners can cancel pending invitations or remove project members.
- Members may leave projects voluntarily (owners cannot). When someone
  leaves or is removed, their project tasks become unassigned, not deleted.
- Existing memberships remain intact when upgrading; old memberships are not
  retroactively changed into invitations.
- Invitations are in-app only; no email notifications are sent.

SECURITY AND DEPLOYMENT
-----------------------
- Every POST request requires a CSRF token tied to the user's session.
- Login attempts are limited by IP and username via login_attempts table.
- SQL uses PDO prepared statements; user-generated HTML is escaped.
- Server errors are logged, not sent verbatim to the browser.
- config.local.php should never be committed or shared.
- .htaccess denies direct browser access to sensitive PHP/SQL files when
  Apache AllowOverride and required modules are enabled.
- The app does not allow MySQL root or a blank database password.
- If HTTPS is terminated by a TRUSTED reverse proxy, you may set the server
  environment variable TASKFLOW_FORCE_HTTPS=1. Do NOT set it for plain
  http://localhost, or login/session cookies may stop working.
- For public deployment, configure HTTPS, backups, appropriate web server
  permissions, secure phpMyAdmin access, monitoring, and request limits.
- This remains an educational prototype, not a production security audit.

DEVELOPER CHECKS
----------------
- php -l api.php
- php -l config.php
- node tests/smoke.js
- node tests/invitations-ui.js
- node tests/personal-profile.js

JavaScript tests use fake responses. They do not test a live PHP/MySQL server.
Always back up the MySQL database before running upgrade SQL or deleting accounts.
For a full check, run the app in XAMPP with two real accounts and perform an
invite -> accept -> leave workflow, plus an invite -> decline workflow.
