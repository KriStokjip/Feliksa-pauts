<?php

declare(strict_types=1);

require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (!is_string($action)) {
    respond(['error' => 'Invalid API action.'], 400);
}

/** Limit username/IP login failures to reduce password guessing. */
function login_fingerprints(string $username): array
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return [
        ['id' => hash('sha256', 'ip:' . $ip), 'limit' => 30],
        ['id' => hash('sha256', 'user:' . strtolower($username)), 'limit' => 10],
    ];
}

function assert_login_allowed(PDO $pdo, string $username): void
{
    $statement = $pdo->prepare(
        'SELECT attempt_count
         FROM login_attempts
         WHERE fingerprint = ? AND window_started >= NOW() - INTERVAL 15 MINUTE'
    );

    foreach (login_fingerprints($username) as $fingerprint) {
        $statement->execute([$fingerprint['id']]);
        $attempts = (int) ($statement->fetchColumn() ?: 0);
        if ($attempts >= $fingerprint['limit']) {
            respond(['error' => 'Too many login attempts. Try again in 15 minutes.'], 429);
        }
    }
}

function record_login_failure(PDO $pdo, string $username): void
{
    $statement = $pdo->prepare(
        'INSERT INTO login_attempts (fingerprint, attempt_count, window_started)
         VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           attempt_count = IF(
             window_started < NOW() - INTERVAL 15 MINUTE,
             1,
             attempt_count + 1
           ),
           window_started = IF(
             window_started < NOW() - INTERVAL 15 MINUTE,
             NOW(),
             window_started
           )'
    );

    foreach (login_fingerprints($username) as $fingerprint) {
        $statement->execute([$fingerprint['id']]);
    }

    // Avoid retaining old login fingerprints indefinitely.
    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM login_attempts WHERE window_started < NOW() - INTERVAL 1 DAY');
    }
}

/** Unassign project tasks before removing a teammate. */
function remove_project_membership(PDO $pdo, int $projectId, int $memberId): void
{
    $statement = $pdo->prepare(
        'UPDATE tasks SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ?'
    );
    $statement->execute([$projectId, $memberId]);

    $statement = $pdo->prepare(
        "DELETE FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'member'"
    );
    $statement->execute([$projectId, $memberId]);
}

try {
    $input = json_input();

    // Fetching a CSRF token does not change data and works before login.
    if ($action === 'csrf' && $method === 'GET') {
        respond(['csrf_token' => csrf_token()]);
    }

    // Validate every state-changing request, including login and registration.
    if ($method === 'POST') {
        require_csrf();
    }

    // Public actions.
    if ($action === 'register' && $method === 'POST') {
        $username = request_string($input, 'username', 20, true);
        $firstName = request_string($input, 'first_name', 80, true);
        $email = request_string($input, 'email', 254, true);
        $password = $input['password'] ?? '';

        if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $username)) {
            respond(['error' => 'Username must contain 3–20 letters, numbers, or underscores.'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['error' => 'Enter a valid email address.'], 422);
        }
        if (!is_string($password) || strlen($password) < 8 || strlen($password) > 4096
            || !preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password)
            || !preg_match('/\d/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
            respond(['error' => 'Password must have 8+ characters, upper/lowercase letters, a number, and a symbol.'], 422);
        }

        $statement = $pdo->prepare(
            'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)'
        );
        $statement->execute([$username, $email]);
        if ($statement->fetch()) {
            respond(['error' => 'That username or email is already registered.'], 409);
        }

        try {
            $statement = $pdo->prepare(
                'INSERT INTO users (username, first_name, email, password_hash) VALUES (?, ?, ?, ?)'
            );
            $statement->execute([$username, $firstName, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            // Concurrent registrations may race after the initial duplicate check.
            if ($error->getCode() === '23000') {
                respond(['error' => 'That username or email is already registered.'], 409);
            }
            throw $error;
        }

        respond(['ok' => true, 'message' => 'Account created. You can now log in.'], 201);
    }

    if ($action === 'login' && $method === 'POST') {
        $username = request_string($input, 'username', 20);
        $password = $input['password'] ?? '';

        if (!is_string($password) || strlen($password) > 4096) {
            respond(['error' => 'Username or password is incorrect.'], 401);
        }

        assert_login_allowed($pdo, $username);

        $statement = $pdo->prepare(
            'SELECT id, username, first_name, password_hash FROM users WHERE LOWER(username) = LOWER(?)'
        );
        $statement->execute([$username]);
        $user = $statement->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            record_login_failure($pdo, $username);
            respond(['error' => 'Username or password is incorrect.'], 401);
        }

        $statement = $pdo->prepare('DELETE FROM login_attempts WHERE fingerprint = ?');
        $statement->execute([login_fingerprints($username)[1]['id']]);

        // Rotate session and CSRF secrets upon authentication.
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['last_activity'] = time();
        csrf_token();

        respond([
            'ok' => true,
            'user' => ['id' => (int) $user['id'], 'username' => $user['username'], 'first_name' => $user['first_name']],
        ]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
        respond(['ok' => true]);
    }

    if ($action === 'me' && $method === 'GET') {
        $user = empty($_SESSION['user_id'])
            ? null
            : ['id' => (int) $_SESSION['user_id'], 'username' => $_SESSION['username'] ?? ''];
        respond(['user' => $user, 'csrf_token' => csrf_token()]);
    }

    // Everything below requires an authenticated user.
    $userId = require_user();


    // Profile: username and email are immutable through this API.
    if ($action === 'profile' && $method === 'GET') {
        $statement = $pdo->prepare('SELECT username, first_name, email FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $profile = $statement->fetch();
        if (!$profile) {
            respond(['error' => 'Account not found.'], 404);
        }
        respond(['profile' => $profile]);
    }

    if ($action === 'profile' && $method === 'POST') {
        $firstName = request_string($input, 'first_name', 80, true);
        $statement = $pdo->prepare('UPDATE users SET first_name = ? WHERE id = ?');
        $statement->execute([$firstName, $userId]);
        respond(['ok' => true, 'message' => 'First name updated.']);
    }

    // Irreversible: removes personal tasks and owned projects via FK cascades.
    // In projects owned by someone else, assigned tasks become unassigned.
    if ($action === 'delete-account' && $method === 'POST') {
        $password = $input['password'] ?? null;
        $confirmation = $input['confirmation'] ?? null;
        if (!is_string($password) || $password === '' || strlen($password) > 4096
            || $confirmation !== 'DELETE') {
            respond(['error' => 'Enter your current password and type DELETE to confirm.'], 422);
        }

        $statement = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $hash = $statement->fetchColumn();
        if (!$hash || !password_verify($password, (string) $hash)) {
            respond(['error' => 'Current password is incorrect.'], 403);
        }

        $pdo->beginTransaction();
        $statement = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $pdo->commit();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
        respond(['ok' => true, 'message' => 'Account permanently deleted.']);
    }

    // Personal tasks are strictly scoped to the authenticated owner.
    if ($action === 'my-tasks' && $method === 'GET') {
        $statement = $pdo->prepare(
            'SELECT id, title, description, deadline, priority, status
             FROM personal_tasks WHERE owner_id = ?
             ORDER BY created_at DESC, id DESC'
        );
        $statement->execute([$userId]);
        $tasks = $statement->fetchAll();
        foreach ($tasks as &$task) {
            $task['id'] = (int) $task['id'];
        }
        unset($task);
        respond(['tasks' => $tasks]);
    }

    if ($action === 'personal-task' && $method === 'POST') {
        $taskId = request_id($input, 'id', true);
        $title = request_string($input, 'title', 120, true);
        $description = request_string($input, 'description', 10000);
        $deadline = request_date($input, 'deadline');
        $priority = request_choice($input, 'priority', ['high', 'medium', 'low'], 'medium');
        $status = request_choice($input, 'status', ['todo', 'doing', 'done'], 'todo');

        if ($taskId > 0) {
            $statement = $pdo->prepare(
                'SELECT id FROM personal_tasks WHERE id = ? AND owner_id = ?'
            );
            $statement->execute([$taskId, $userId]);
            if (!$statement->fetch()) {
                respond(['error' => 'Task not found.'], 404);
            }
            $statement = $pdo->prepare(
                'UPDATE personal_tasks
                 SET title = ?, description = ?, deadline = ?, priority = ?, status = ?
                 WHERE id = ? AND owner_id = ?'
            );
            $statement->execute([$title, $description, $deadline, $priority, $status, $taskId, $userId]);
        } else {
            $statement = $pdo->prepare(
                'INSERT INTO personal_tasks (owner_id, title, description, deadline, priority, status)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([$userId, $title, $description, $deadline, $priority, $status]);
            $taskId = (int) $pdo->lastInsertId();
        }
        respond(['ok' => true, 'id' => $taskId]);
    }

    if ($action === 'delete-personal-task' && $method === 'POST') {
        $taskId = request_id($input, 'id');
        $statement = $pdo->prepare('DELETE FROM personal_tasks WHERE id = ? AND owner_id = ?');
        $statement->execute([$taskId, $userId]);
        if (!$statement->rowCount()) {
            respond(['error' => 'Task not found.'], 404);
        }
        respond(['ok' => true]);
    }

    if ($action === 'projects' && $method === 'GET') {
        $statement = $pdo->prepare(
            "SELECT p.*, pm.role,
                    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
                    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count,
                    (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count
             FROM projects p
             JOIN project_members pm ON pm.project_id = p.id
             WHERE pm.user_id = ?
             ORDER BY p.created_at DESC, p.id DESC"
        );
        $statement->execute([$userId]);
        $projects = $statement->fetchAll();

        foreach ($projects as &$project) {
            $project['id'] = (int) $project['id'];
            $project['owner_id'] = (int) $project['owner_id'];
            $project['task_count'] = (int) $project['task_count'];
            $project['done_count'] = (int) $project['done_count'];
            $project['member_count'] = (int) $project['member_count'];
            $project['progress'] = $project['task_count']
                ? (int) round($project['done_count'] / $project['task_count'] * 100)
                : 0;
        }
        unset($project);

        respond(['projects' => $projects]);
    }

    // Invitations are private to the invited account until they accept.
    if ($action === 'invitations' && $method === 'GET') {
        $statement = $pdo->prepare(
            'SELECT i.id, i.project_id, i.created_at, p.name AS project_name,
                    p.description AS project_description, u.username AS invited_by
             FROM project_invitations i
             JOIN projects p ON p.id = i.project_id
             JOIN users u ON u.id = i.invited_by
             WHERE i.invitee_id = ?
             ORDER BY i.created_at DESC, i.id DESC'
        );
        $statement->execute([$userId]);
        $invitations = $statement->fetchAll();
        foreach ($invitations as &$invitation) {
            $invitation['id'] = (int) $invitation['id'];
            $invitation['project_id'] = (int) $invitation['project_id'];
        }
        unset($invitation);

        respond(['invitations' => $invitations]);
    }

    // Only the intended recipient can accept; a pending invite is not membership.
    if ($action === 'accept-invitation' && $method === 'POST') {
        $invitationId = request_id($input, 'invitation_id');
        $pdo->beginTransaction();

        $statement = $pdo->prepare(
            'SELECT id, project_id FROM project_invitations
             WHERE id = ? AND invitee_id = ? FOR UPDATE'
        );
        $statement->execute([$invitationId, $userId]);
        $invitation = $statement->fetch();
        if (!$invitation) {
            $pdo->rollBack();
            respond(['error' => 'Invitation not found or no longer pending.'], 404);
        }

        $projectId = (int) $invitation['project_id'];
        $statement = $pdo->prepare(
            'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
        );
        $statement->execute([$projectId, $userId]);
        if ($statement->fetchColumn()) {
            $pdo->rollBack();
            respond(['error' => 'You are already a member of this project.'], 409);
        }

        $statement = $pdo->prepare(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')"
        );
        $statement->execute([$projectId, $userId]);
        $statement = $pdo->prepare('DELETE FROM project_invitations WHERE id = ?');
        $statement->execute([$invitationId]);
        $pdo->commit();

        respond(['ok' => true, 'project_id' => $projectId, 'message' => 'Invitation accepted.']);
    }

    if ($action === 'decline-invitation' && $method === 'POST') {
        $invitationId = request_id($input, 'invitation_id');
        $statement = $pdo->prepare(
            'DELETE FROM project_invitations WHERE id = ? AND invitee_id = ?'
        );
        $statement->execute([$invitationId, $userId]);
        if (!$statement->rowCount()) {
            respond(['error' => 'Invitation not found or no longer pending.'], 404);
        }

        respond(['ok' => true, 'message' => 'Invitation declined.']);
    }

    if ($action === 'project' && $method === 'GET') {
        $projectId = request_id($_GET, 'id');
        $project = project_access($pdo, $projectId, $userId);
        $project['id'] = (int) $project['id'];
        $project['owner_id'] = (int) $project['owner_id'];

        $statement = $pdo->prepare(
            'SELECT u.id, u.username, pm.role
             FROM project_members pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = ?
             ORDER BY pm.role DESC, u.username'
        );
        $statement->execute([$projectId]);
        $project['members'] = $statement->fetchAll();
        foreach ($project['members'] as &$member) {
            $member['id'] = (int) $member['id'];
        }
        unset($member);

        $statement = $pdo->prepare(
            'SELECT t.id, t.title, t.description, t.deadline, t.priority, t.status, t.assignee_id,
                    u.username AS assignee
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.project_id = ?
             ORDER BY t.created_at DESC, t.id DESC'
        );
        $statement->execute([$projectId]);
        $project['tasks'] = $statement->fetchAll();

        $doneCount = 0;
        foreach ($project['tasks'] as &$task) {
            $task['id'] = (int) $task['id'];
            $task['assignee_id'] = $task['assignee_id'] === null
                ? null
                : (int) $task['assignee_id'];
            if ($task['status'] === 'done') {
                $doneCount++;
            }
        }
        unset($task);

        $total = count($project['tasks']);
        $project['progress'] = $total ? (int) round($doneCount / $total * 100) : 0;

        // Only owners see the usernames of people who haven't joined yet.
        $project['pending_invitations'] = [];
        if ((int) $project['owner_id'] === $userId) {
            $statement = $pdo->prepare(
                'SELECT i.id, i.created_at, u.username
                 FROM project_invitations i
                 JOIN users u ON u.id = i.invitee_id
                 WHERE i.project_id = ?
                 ORDER BY i.created_at DESC, i.id DESC'
            );
            $statement->execute([$projectId]);
            $project['pending_invitations'] = $statement->fetchAll();
            foreach ($project['pending_invitations'] as &$invitation) {
                $invitation['id'] = (int) $invitation['id'];
            }
            unset($invitation);
        }

        respond(['project' => $project]);
    }

    if ($action === 'project' && $method === 'POST') {
        $id = request_id($input, 'id', true);
        $name = request_string($input, 'name', 120, true);
        $description = request_string($input, 'description', 10000);
        $priority = request_choice($input, 'priority', ['high', 'medium', 'low'], 'medium');
        $deadline = request_date($input, 'deadline');

        if ($id > 0) {
            $project = project_access($pdo, $id, $userId);
            if ((int) $project['owner_id'] !== $userId) {
                respond(['error' => 'Only the project owner can change settings.'], 403);
            }

            $statement = $pdo->prepare(
                'UPDATE projects SET name = ?, description = ?, priority = ?, deadline = ? WHERE id = ?'
            );
            $statement->execute([$name, $description, $priority, $deadline, $id]);
        } else {
            $pdo->beginTransaction();
            $statement = $pdo->prepare(
                'INSERT INTO projects (owner_id, name, description, priority, deadline)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $statement->execute([$userId, $name, $description, $priority, $deadline]);
            $id = (int) $pdo->lastInsertId();

            $statement = $pdo->prepare(
                "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')"
            );
            $statement->execute([$id, $userId]);
            $pdo->commit();
        }

        respond(['ok' => true, 'id' => $id]);
    }

    if ($action === 'delete-project' && $method === 'POST') {
        $id = request_id($input, 'id');
        $project = project_access($pdo, $id, $userId);
        if ((int) $project['owner_id'] !== $userId) {
            respond(['error' => 'Only the project owner can delete this project.'], 403);
        }

        $statement = $pdo->prepare('DELETE FROM projects WHERE id = ?');
        $statement->execute([$id]);
        respond(['ok' => true]);
    }

    // Keep the old action name as an alias, but NEVER grant membership here.
    if (($action === 'invite-member' || $action === 'members') && $method === 'POST') {
        $projectId = request_id($input, 'project_id');
        $username = request_string($input, 'username', 20, true);
        $project = project_access($pdo, $projectId, $userId);
        if ((int) $project['owner_id'] !== $userId) {
            respond(['error' => 'Only the owner can invite team members.'], 403);
        }

        $statement = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
        $statement->execute([$username]);
        $invitee = $statement->fetch();
        if (!$invitee) {
            respond(['error' => 'No registered account found for that username.'], 404);
        }
        $inviteeId = (int) $invitee['id'];
        if ($inviteeId === $userId) {
            respond(['error' => 'You already own this project.'], 409);
        }

        $statement = $pdo->prepare(
            'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
        );
        $statement->execute([$projectId, $inviteeId]);
        if ($statement->fetchColumn()) {
            respond(['error' => 'This user is already a team member.'], 409);
        }

        try {
            $statement = $pdo->prepare(
                'INSERT INTO project_invitations (project_id, invitee_id, invited_by)
                 VALUES (?, ?, ?)'
            );
            $statement->execute([$projectId, $inviteeId, $userId]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                respond(['error' => 'An invitation is already pending for this user.'], 409);
            }
            throw $error;
        }

        respond(['ok' => true, 'message' => 'Invitation sent. Membership starts after acceptance.'], 201);
    }

    // Owners may revoke a pending invitation before it is accepted.
    if ($action === 'cancel-invitation' && $method === 'POST') {
        $projectId = request_id($input, 'project_id');
        $invitationId = request_id($input, 'invitation_id');
        $project = project_access($pdo, $projectId, $userId);
        if ((int) $project['owner_id'] !== $userId) {
            respond(['error' => 'Only the owner can cancel invitations.'], 403);
        }

        $statement = $pdo->prepare(
            'DELETE FROM project_invitations WHERE id = ? AND project_id = ?'
        );
        $statement->execute([$invitationId, $projectId]);
        if (!$statement->rowCount()) {
            respond(['error' => 'Invitation not found or no longer pending.'], 404);
        }

        respond(['ok' => true, 'message' => 'Invitation cancelled.']);
    }

    if ($action === 'remove-member' && $method === 'POST') {
        $projectId = request_id($input, 'project_id');
        $memberId = request_id($input, 'user_id');
        $project = project_access($pdo, $projectId, $userId);

        if ((int) $project['owner_id'] !== $userId) {
            respond(['error' => 'Only the owner can manage team members.'], 403);
        }
        if ($memberId === $userId) {
            respond(['error' => 'The owner cannot remove themselves.'], 422);
        }

        $pdo->beginTransaction();
        remove_project_membership($pdo, $projectId, $memberId);
        $pdo->commit();
        respond(['ok' => true]);
    }

    if ($action === 'leave-project' && $method === 'POST') {
        $projectId = request_id($input, 'project_id');
        $project = project_access($pdo, $projectId, $userId);
        if ((int) $project['owner_id'] === $userId || $project['role'] !== 'member') {
            respond(['error' => 'Project owners cannot leave their own project.'], 403);
        }

        $pdo->beginTransaction();
        remove_project_membership($pdo, $projectId, $userId);
        $pdo->commit();
        respond(['ok' => true, 'message' => 'You left the project.']);
    }

    if ($action === 'task' && $method === 'POST') {
        $projectId = request_id($input, 'project_id');
        project_access($pdo, $projectId, $userId);
        $taskId = request_id($input, 'id', true);
        $title = request_string($input, 'title', 120, true);
        $description = request_string($input, 'description', 10000);
        $priority = request_choice($input, 'priority', ['high', 'medium', 'low'], 'medium');
        $status = request_choice($input, 'status', ['todo', 'doing', 'done'], 'todo');
        $deadline = request_date($input, 'deadline');

        $rawAssignee = $input['assignee_id'] ?? '';
        $assigneeId = ($rawAssignee === '' || $rawAssignee === null)
            ? null
            : request_id($input, 'assignee_id');

        if ($assigneeId !== null) {
            $statement = $pdo->prepare(
                'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
            );
            $statement->execute([$projectId, $assigneeId]);
            if (!$statement->fetchColumn()) {
                respond(['error' => 'Assignee must be a member of this project.'], 422);
            }
        }

        if ($taskId > 0) {
            $statement = $pdo->prepare(
                'UPDATE tasks
                 SET title = ?, description = ?, assignee_id = ?, deadline = ?, priority = ?, status = ?
                 WHERE id = ? AND project_id = ?'
            );
            $statement->execute([$title, $description, $assigneeId, $deadline, $priority, $status, $taskId, $projectId]);

            // MySQL reports zero affected rows even for a valid, unchanged update.
            if (!$statement->rowCount()) {
                $check = $pdo->prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?');
                $check->execute([$taskId, $projectId]);
                if (!$check->fetch()) {
                    respond(['error' => 'Task not found.'], 404);
                }
            }
        } else {
            $statement = $pdo->prepare(
                'INSERT INTO tasks (project_id, title, description, assignee_id, deadline, priority, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([$projectId, $title, $description, $assigneeId, $deadline, $priority, $status]);
            $taskId = (int) $pdo->lastInsertId();
        }

        respond(['ok' => true, 'id' => $taskId]);
    }

    if ($action === 'delete-task' && $method === 'POST') {
        $taskId = request_id($input, 'id');
        $statement = $pdo->prepare('SELECT project_id FROM tasks WHERE id = ?');
        $statement->execute([$taskId]);
        $task = $statement->fetch();
        if (!$task) {
            respond(['error' => 'Task not found.'], 404);
        }

        project_access($pdo, (int) $task['project_id'], $userId);
        $statement = $pdo->prepare('DELETE FROM tasks WHERE id = ?');
        $statement->execute([$taskId]);
        respond(['ok' => true]);
    }

    // Dashboard combines private tasks and tasks from projects the user has joined.
    // It never exposes project tasks before an invitation is accepted.
    if ($action === 'dashboard' && $method === 'GET') {
        $statement = $pdo->prepare(
            'SELECT COUNT(*) FROM project_members WHERE user_id = ?'
        );
        $statement->execute([$userId]);
        $projectCount = (int) $statement->fetchColumn();

        $statement = $pdo->prepare(
            'SELECT id, title, description, deadline, priority, status
             FROM personal_tasks WHERE owner_id = ?'
        );
        $statement->execute([$userId]);
        $tasks = [];
        foreach ($statement->fetchAll() as $task) {
            $task['id'] = (int) $task['id'];
            $task['project_id'] = null;
            $task['project_name'] = null;
            $task['assignee'] = null;
            $task['assignee_id'] = $userId;
            $task['kind'] = 'personal';
            $tasks[] = $task;
        }

        $statement = $pdo->prepare(
            'SELECT t.id, t.title, t.description, t.deadline, t.priority, t.status,
                    t.project_id, p.name AS project_name,
                    t.assignee_id, u.username AS assignee
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN project_members pm ON pm.project_id = t.project_id
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE pm.user_id = ?'
        );
        $statement->execute([$userId]);
        foreach ($statement->fetchAll() as $task) {
            $task['id'] = (int) $task['id'];
            $task['project_id'] = (int) $task['project_id'];
            $task['assignee_id'] = $task['assignee_id'] === null ? null : (int) $task['assignee_id'];
            $task['kind'] = 'project';
            $tasks[] = $task;
        }

        $stats = ['projects' => $projectCount, 'open_tasks' => 0, 'done_tasks' => 0, 'overdue_tasks' => 0];
        $today = date('Y-m-d');
        foreach ($tasks as $task) {
            if ($task['status'] === 'done') {
                $stats['done_tasks']++;
            } else {
                $stats['open_tasks']++;
                if ($task['deadline'] !== null && $task['deadline'] < $today) {
                    $stats['overdue_tasks']++;
                }
            }
        }
        respond(['stats' => $stats, 'tasks' => $tasks]);
    }

    respond(['error' => 'Unknown API action.'], 404);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log((string) $error);
    respond(['error' => 'An unexpected server error occurred.'], 500);
}
