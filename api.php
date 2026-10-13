<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$input = json_input();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($action === 'register' && $method === 'POST') {
        $username = trim((string)($input['username'] ?? ''));
        $email = trim((string)($input['email'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $username)) respond(['error' => 'Username must be 3–20 characters: letters, numbers, underscores.'], 422);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(['error' => 'Enter a valid email address.'], 422);
        if (strlen($password) < 8 || !preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
            respond(['error' => 'Password needs 8+ characters, uppercase and lowercase letters, a number, and a special character.'], 422);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?)');
        $stmt->execute([$username, $email]);
        if ($stmt->fetch()) respond(['error' => 'That username or email is already registered.'], 409);

        $stmt = $pdo->prepare('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)');
        $stmt->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT)]);
        respond(['ok' => true, 'message' => 'Account created. You can now log in.'], 201);
    }

    if ($action === 'login' && $method === 'POST') {
        $username = trim((string)($input['username'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE LOWER(username)=LOWER(?)');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) respond(['error' => 'Username or password is incorrect.'], 401);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['username'] = $user['username'];
        respond(['ok' => true, 'user' => ['id' => (int)$user['id'], 'username' => $user['username']]]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(['ok' => true]);
    }

    if ($action === 'me' && $method === 'GET') {
        if (empty($_SESSION['user_id'])) respond(['user' => null]);
        respond(['user' => ['id' => (int)$_SESSION['user_id'], 'username' => $_SESSION['username'] ?? '']]);
    }

    $userId = require_user();

    if ($action === 'projects' && $method === 'GET') {
        $stmt = $pdo->prepare(
            "SELECT p.*, pm.role,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) AS task_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='done') AS done_count,
              (SELECT COUNT(*) FROM project_members x WHERE x.project_id=p.id) AS member_count
             FROM projects p JOIN project_members pm ON pm.project_id=p.id
             WHERE pm.user_id=? ORDER BY p.created_at DESC"
        );
        $stmt->execute([$userId]);
        $projects = $stmt->fetchAll();
        foreach ($projects as &$p) {
            $p['id'] = (int)$p['id'];
            $p['owner_id'] = (int)$p['owner_id'];
            $p['task_count'] = (int)$p['task_count'];
            $p['done_count'] = (int)$p['done_count'];
            $p['member_count'] = (int)$p['member_count'];
            $p['progress'] = $p['task_count'] ? (int)round($p['done_count'] / $p['task_count'] * 100) : 0;
        }
        respond(['projects' => $projects]);
    }

    if ($action === 'project' && $method === 'GET') {
        $projectId = (int)($_GET['id'] ?? 0);
        $project = project_access($pdo, $projectId, $userId);
        $project['id'] = (int)$project['id'];
        $project['owner_id'] = (int)$project['owner_id'];

        $stmt = $pdo->prepare("SELECT u.id, u.username, pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? ORDER BY pm.role DESC, u.username");
        $stmt->execute([$projectId]);
        $project['members'] = $stmt->fetchAll();

        $stmt = $pdo->prepare("SELECT t.id,t.title,t.deadline,t.priority,t.status,t.assignee_id,u.username AS assignee FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.project_id=? ORDER BY t.created_at DESC");
        $stmt->execute([$projectId]);
        $project['tasks'] = $stmt->fetchAll();
        foreach ($project['tasks'] as &$task) {
            $task['id'] = (int)$task['id'];
            $task['assignee_id'] = $task['assignee_id'] === null ? null : (int)$task['assignee_id'];
        }
        $project['progress'] = count($project['tasks']) ? (int)round(count(array_filter($project['tasks'], fn($t) => $t['status'] === 'done')) / count($project['tasks']) * 100) : 0;
        respond(['project' => $project]);
    }

    if ($action === 'project' && $method === 'POST') {
        $id = (int)($input['id'] ?? 0);
        $name = trim((string)($input['name'] ?? ''));
        $description = trim((string)($input['description'] ?? ''));
        $priority = $input['priority'] ?? 'medium';
        $deadline = trim((string)($input['deadline'] ?? ''));
        if ($name === '' || mb_strlen($name) > 120) respond(['error' => 'Project name is required (max 120 characters).'], 422);
        if (!in_array($priority, ['high','medium','low'], true)) $priority = 'medium';
        $deadline = $deadline !== '' ? $deadline : null;

        if ($id) {
            $project = project_access($pdo, $id, $userId);
            if ((int)$project['owner_id'] !== $userId) respond(['error' => 'Only the project owner can change settings.'], 403);
            $stmt = $pdo->prepare('UPDATE projects SET name=?, description=?, priority=?, deadline=? WHERE id=?');
            $stmt->execute([$name, $description, $priority, $deadline, $id]);
        } else {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('INSERT INTO projects (owner_id,name,description,priority,deadline) VALUES (?,?,?,?,?)');
            $stmt->execute([$userId, $name, $description, $priority, $deadline]);
            $id = (int)$pdo->lastInsertId();
            $stmt = $pdo->prepare("INSERT INTO project_members (project_id,user_id,role) VALUES (?,?,'owner')");
            $stmt->execute([$id, $userId]);
            $pdo->commit();
        }
        respond(['ok' => true, 'id' => $id]);
    }

    if ($action === 'delete-project' && $method === 'POST') {
        $id = (int)($input['id'] ?? 0);
        $project = project_access($pdo, $id, $userId);
        if ((int)$project['owner_id'] !== $userId) respond(['error' => 'Only the project owner can delete this project.'], 403);
        $stmt = $pdo->prepare('DELETE FROM projects WHERE id=?');
        $stmt->execute([$id]);
        respond(['ok' => true]);
    }

    if ($action === 'members' && $method === 'POST') {
        $projectId = (int)($input['project_id'] ?? 0);
        $username = trim((string)($input['username'] ?? ''));
        $project = project_access($pdo, $projectId, $userId);
        if ((int)$project['owner_id'] !== $userId) respond(['error' => 'Only the owner can manage team members.'], 403);
        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(username)=LOWER(?)');
        $stmt->execute([$username]);
        $member = $stmt->fetch();
        if (!$member) respond(['error' => 'No registered account found for that username.'], 404);
        $stmt = $pdo->prepare("INSERT IGNORE INTO project_members (project_id,user_id,role) VALUES (?,?,'member')");
        $stmt->execute([$projectId, (int)$member['id']]);
        respond(['ok' => true]);
    }

    if ($action === 'remove-member' && $method === 'POST') {
        $projectId = (int)($input['project_id'] ?? 0);
        $memberId = (int)($input['user_id'] ?? 0);
        $project = project_access($pdo, $projectId, $userId);
        if ((int)$project['owner_id'] !== $userId) respond(['error' => 'Only the owner can manage team members.'], 403);
        if ($memberId === $userId) respond(['error' => 'The owner cannot remove themselves.'], 422);
        $stmt = $pdo->prepare("DELETE FROM project_members WHERE project_id=? AND user_id=? AND role='member'");
        $stmt->execute([$projectId, $memberId]);
        respond(['ok' => true]);
    }

    if ($action === 'task' && $method === 'POST') {
        $projectId = (int)($input['project_id'] ?? 0);
        project_access($pdo, $projectId, $userId);
        $taskId = (int)($input['id'] ?? 0);
        $title = trim((string)($input['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 120) respond(['error' => 'Task title is required (max 120 characters).'], 422);
        $priority = in_array(($input['priority'] ?? ''), ['high','medium','low'], true) ? $input['priority'] : 'medium';
        $status = in_array(($input['status'] ?? ''), ['todo','doing','done'], true) ? $input['status'] : 'todo';
        $deadline = trim((string)($input['deadline'] ?? ''));
        $deadline = $deadline !== '' ? $deadline : null;
        $assigneeId = isset($input['assignee_id']) && $input['assignee_id'] !== '' ? (int)$input['assignee_id'] : null;
        if ($assigneeId !== null) {
            $stmt = $pdo->prepare('SELECT 1 FROM project_members WHERE project_id=? AND user_id=?');
            $stmt->execute([$projectId, $assigneeId]);
            if (!$stmt->fetchColumn()) respond(['error' => 'Assignee must be a member of this project.'], 422);
        }
        if ($taskId) {
            $stmt = $pdo->prepare('UPDATE tasks SET title=?,assignee_id=?,deadline=?,priority=?,status=? WHERE id=? AND project_id=?');
            $stmt->execute([$title,$assigneeId,$deadline,$priority,$status,$taskId,$projectId]);
            if (!$stmt->rowCount()) {
                $stmt = $pdo->prepare('SELECT id FROM tasks WHERE id=? AND project_id=?');
                $stmt->execute([$taskId,$projectId]);
                if (!$stmt->fetch()) respond(['error' => 'Task not found.'], 404);
            }
        } else {
            $stmt = $pdo->prepare('INSERT INTO tasks (project_id,title,assignee_id,deadline,priority,status) VALUES (?,?,?,?,?,?)');
            $stmt->execute([$projectId,$title,$assigneeId,$deadline,$priority,$status]);
            $taskId = (int)$pdo->lastInsertId();
        }
        respond(['ok' => true, 'id' => $taskId]);
    }

    if ($action === 'delete-task' && $method === 'POST') {
        $taskId = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT project_id FROM tasks WHERE id=?');
        $stmt->execute([$taskId]);
        $task = $stmt->fetch();
        if (!$task) respond(['error' => 'Task not found.'], 404);
        project_access($pdo, (int)$task['project_id'], $userId);
        $stmt = $pdo->prepare('DELETE FROM tasks WHERE id=?');
        $stmt->execute([$taskId]);
        respond(['ok' => true]);
    }

    if ($action === 'dashboard' && $method === 'GET') {
        $stmt = $pdo->prepare(
            "SELECT COUNT(DISTINCT p.id) AS projects,
              SUM(CASE WHEN t.id IS NOT NULL AND t.status <> 'done' THEN 1 ELSE 0 END) AS open_tasks,
              SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
              SUM(CASE WHEN t.id IS NOT NULL AND t.status <> 'done' AND t.deadline < CURDATE() THEN 1 ELSE 0 END) AS overdue_tasks
             FROM projects p JOIN project_members pm ON pm.project_id=p.id
             LEFT JOIN tasks t ON t.project_id=p.id WHERE pm.user_id=?"
        );
        $stmt->execute([$userId]);
        $stats = $stmt->fetch() ?: [];
        foreach (['projects','open_tasks','done_tasks','overdue_tasks'] as $key) $stats[$key] = (int)($stats[$key] ?? 0);

        $stmt = $pdo->prepare(
            "SELECT t.id,t.title,t.deadline,t.priority,t.status,p.id AS project_id,p.name AS project_name,u.username AS assignee
             FROM tasks t JOIN projects p ON p.id=t.project_id
             JOIN project_members pm ON pm.project_id=p.id
             LEFT JOIN users u ON u.id=t.assignee_id
             WHERE pm.user_id=? AND t.status <> 'done'
             ORDER BY (t.deadline IS NULL),t.deadline LIMIT 8"
        );
        $stmt->execute([$userId]);
        respond(['stats' => $stats, 'tasks' => $stmt->fetchAll()]);
    }

    respond(['error' => 'Unknown API action.'], 404);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log((string)$e);
    respond(['error' => 'Something went wrong while processing the request. Check the PHP error log for details.'], 500);
}
