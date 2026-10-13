TASKFLOW — UPDATED XAMPP + MYSQL EDITION

REQUIREMENTS
- XAMPP with Apache, MySQL/MariaDB, PHP 8.1+ and PDO MySQL enabled.
- A modern browser (Chrome, Firefox, Edge, Safari).
- On a public server, HTTPS is mandatory; use a secured PHP/MySQL deployment.

INSTALLATION (NEW INSTALL OR EXISTING TASKFLOW DATABASE)
1. Copy the TaskFlow_Updated directory into C:\xampp\htdocs\.
2. Start Apache and MySQL from the XAMPP Control Panel.
3. Open http://localhost/phpmyadmin, select Import and import database.sql.
   It creates the taskflow_db database and tables if they do not exist.
   Existing users, projects, and tasks are retained when the CREATE TABLE IF
   NOT EXISTS statements are run. The new login_attempts table is REQUIRED.
4. In phpMyAdmin's SQL tab, create a separate, limited-permission database user.
   Replace the example password with a strong, unique password:

   CREATE USER IF NOT EXISTS 'taskflow_app'@'127.0.0.1'
       IDENTIFIED BY 'YOUR_LONG_RANDOM_PASSWORD';
   GRANT SELECT, INSERT, UPDATE, DELETE ON taskflow_db.*
       TO 'taskflow_app'@'127.0.0.1';

   If you previously created this user, set its password to match your config:
   ALTER USER 'taskflow_app'@'127.0.0.1'
       IDENTIFIED BY 'YOUR_LONG_RANDOM_PASSWORD';

5. Copy config.local.example.php to config.local.php (the latter is ignored
   by version control). In config.local.php, set the same database password.
   The app intentionally refuses root users and blank database passwords.
   Alternative: set TASKFLOW_DB_HOST, TASKFLOW_DB_NAME, TASKFLOW_DB_USER,
   and TASKFLOW_DB_PASSWORD as PHP process environment variables.
   For HTTPS behind a trusted TLS reverse proxy, set TASKFLOW_FORCE_HTTPS=1.
6. Open http://localhost/TaskFlow_Updated/ and register/login.

HOW TO USE
- Register an account and log in.
- Create projects and tasks; members can edit tasks and update their status.
- Owners add registered people to a project by username (immediate membership).
- Members can select Leave on the My projects page, or Leave project in the
  individual project's sidebar. Only members can leave; owners cannot.
- Leaving or removing a member unassigns their tasks, but keeps those tasks.
- Owners can edit/delete project settings and add/remove team members.
- The project settings Edit button now opens the correct prefilled edit form.

SECURITY CHANGES
- All POST endpoints require a session-linked X-CSRF-Token header.
- Login failures are throttled using the new login_attempts database table.
  The limits are 10 attempts per username or 30 attempts per IP per 15 minutes.
- PHP sessions use HttpOnly, SameSite=Lax, strict-mode cookies and an idle limit.
  Cookies require HTTPS when PHP detects an HTTPS request.
- Database errors are logged on the server, not sent to the browser.
- Dates, IDs, text, and JSON inputs are validated on the server.
- A restricted DB user is required; the Apache .htaccess file blocks access
  to sensitive configuration files (requires AllowOverride to be enabled).

IMPORTANT NOTES
- Existing users and projects are kept by the database.sql re-import, but
  BACK UP your MySQL database before upgrading any project.
- The existing owner-adds-member workflow is NOT a pending/accept invitation
  workflow. Membership begins immediately when the owner adds someone.
- The application uses PHP sessions and MySQL, not browser localStorage.
- For internet deployment, also configure HTTPS, trusted reverse proxy headers,
  server security headers, HTTP request size limits, backups, monitoring,
  and proper Apache/PHP directory permissions. Do not expose phpMyAdmin online.
- Rate limiting is a practical prototype defense, not full abuse/DDoS control.
- No automated email invites or password reset have been added.
- Optional developer smoke test: node tests/smoke.js (requires Node 18+).
