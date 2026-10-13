TASKFLOW — XAMPP + MYSQL EDITION

REQUIREMENTS
- XAMPP with Apache and MySQL (MariaDB)
- A modern browser

INSTALLATION
1. Extract the TaskFlow_XAMPP_MySQL.zip file.
2. Copy the entire TaskFlow_XAMPP_MySQL folder into:
   C:\xampp\htdocs\
   It should become C:\xampp\htdocs\TaskFlow_XAMPP_MySQL\
3. Open the XAMPP Control Panel and start Apache and MySQL.
4. Open phpMyAdmin at http://localhost/phpmyadmin
5. Select the Import tab, choose database.sql from the project folder, and click Import.
   This creates the taskflow_db database and its tables.
6. If your MySQL root user has a password, update DB_PASS in config.php.
7. Visit http://localhost/TaskFlow_XAMPP_MySQL/

HOW TO USE
- Register an account, then log in.
- Create a project.
- To add a teammate, the teammate must register their own TaskFlow account first.
- Open a project to add/edit/delete tasks, assign tasks to project members, manage members, and edit/delete project settings.
- Data is stored in MySQL, not browser localStorage.

IMPORTANT NOTES
- This is a school-project prototype, not a production-ready collaboration platform.
- Passwords are hashed with PHP password_hash().
- Database queries use PDO prepared statements.
- Sessions are used for login state.
- For public deployment, add CSRF protection, rate limiting, HTTPS, stricter validation, and production server configuration.
- Existing localStorage accounts/projects from the previous prototype are not automatically migrated to MySQL.
