<?php
declare(strict_types=1);

session_start();

$DB_HOST = '127.0.0.1';
$DB_NAME = 'taskflow_db';
$DB_USER = 'root';
$DB_PASS = ''; // Default XAMPP MySQL/MariaDB password is often blank. Set yours here if needed.

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    error_log('Database connection error: ' . $e->getMessage());

    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'error' => 'Database connection failed.',
        'details' => $e->getMessage()
    ]);

    exit;
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $_POST;
}

function respond(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function require_user(): int {
    if (empty($_SESSION['user_id'])) respond(['error' => 'Please log in first.'], 401);
    return (int)$_SESSION['user_id'];
}

function project_access(PDO $pdo, int $projectId, int $userId): array {
    $stmt = $pdo->prepare(
        "SELECT p.*, pm.role FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE p.id = ? AND pm.user_id = ?"
    );
    $stmt->execute([$projectId, $userId]);
    $project = $stmt->fetch();
    if (!$project) respond(['error' => 'Project not found or access denied.'], 404);
    return $project;
}
