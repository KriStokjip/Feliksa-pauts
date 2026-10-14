<?php

declare(strict_types=1);


$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || getenv('TASKFLOW_FORCE_HTTPS') === '1';

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.cookie_secure', $isHttps ? '1' : '0');

session_start();


if (isset($_SESSION['last_activity']) && time() - (int) $_SESSION['last_activity'] > 3600) {
    $_SESSION = [];
    session_regenerate_id(true);
}
$_SESSION['last_activity'] = time();

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}


$localConfigPath = __DIR__ . '/config.local.php';
$localConfig = is_file($localConfigPath) ? require $localConfigPath : [];

if (!is_array($localConfig)) {
    error_log('TaskFlow local configuration must return an array.');
    respond(['error' => 'Server configuration is invalid.'], 500);
}

function db_setting(string $environmentName, string $localName, array $localConfig, string $default = ''): string
{
    $environmentValue = getenv($environmentName);
    if ($environmentValue !== false) {
        return $environmentValue;
    }
    return (string) ($localConfig[$localName] ?? $default);
}

$dbHost = db_setting('TASKFLOW_DB_HOST', 'host', $localConfig, '127.0.0.1');
$dbPort = db_setting('TASKFLOW_DB_PORT', 'port', $localConfig, '3306');
$dbName = db_setting('TASKFLOW_DB_NAME', 'database', $localConfig, 'taskflow_db');
$dbUser = db_setting('TASKFLOW_DB_USER', 'username', $localConfig, 'taskflow_app');
$dbPassword = db_setting('TASKFLOW_DB_PASSWORD', 'password', $localConfig);


$validatedPort = filter_var($dbPort, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 65535],
]);
if ($validatedPort === false) {
    error_log('TaskFlow database port must be between 1 and 65535.');
    respond(['error' => 'Database port is invalid. See README.txt.'], 500);
}

if ($dbUser === 'root' || $dbPassword === '') {
    error_log('TaskFlow refuses root or blank-password database connections. See README.txt.');
    respond(['error' => 'Database credentials are not configured safely. See README.txt.'], 500);
}

try {
    $pdo = new PDO(
        "mysql:host={$dbHost};port={$validatedPort};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPassword,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $error) {
    error_log('Database connection error: ' . $error->getMessage());
    respond(['error' => 'Database connection failed. Check server configuration.'], 500);
}

function json_input(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return [];
    }

    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') {
        respond(['error' => 'Send requests as application/json.'], 415);
    }

    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) {
        respond(['error' => 'Request body is too large.'], 413);
    }

    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw !== false && strlen($raw) > 65536) {
        respond(['error' => 'Request body is too large.'], 413);
    }
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        respond(['error' => 'Invalid JSON body.'], 400);
    }

    if (!is_array($data) || (array_is_list($data) && $data !== [])) {
        respond(['error' => 'JSON body must be an object.'], 400);
    }

    return $data;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($received) || !hash_equals(csrf_token(), $received)) {
        respond(['error' => 'Security token expired. Refresh the page and try again.'], 403);
    }
}

function require_user(): int
{
    if (empty($_SESSION['user_id'])) {
        respond(['error' => 'Please log in first.'], 401);
    }
    return (int) $_SESSION['user_id'];
}

function project_access(PDO $pdo, int $projectId, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT p.*, pm.role
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE p.id = ? AND pm.user_id = ?'
    );
    $statement->execute([$projectId, $userId]);
    $project = $statement->fetch();

    if (!$project) {
        respond(['error' => 'Project not found or access denied.'], 404);
    }
    return $project;
}

function request_string(array $input, string $key, int $maxLength, bool $required = false): string
{
    $value = $input[$key] ?? '';
    if (!is_string($value) || !preg_match('//u', $value)) {
        respond(['error' => "Invalid {$key}."], 422);
    }

    $value = trim($value);
    $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : preg_match_all('/./us', $value);

    if ($length === false || $length > $maxLength || ($required && $value === '')) {
        respond(['error' => ucfirst(str_replace('_', ' ', $key)) . " must be 1–{$maxLength} characters."], 422);
    }
    return $value;
}

function request_id(array $input, string $key, bool $allowZero = false): int
{
    $value = $input[$key] ?? ($allowZero ? 0 : null);
   
    if (!is_int($value) && (!is_string($value) || !preg_match('/^(0|[1-9][0-9]*)$/D', $value))) {
        respond(['error' => "Invalid {$key}."], 422);
    }

    $parsed = filter_var($value, FILTER_VALIDATE_INT);

    if ($parsed === false || ($allowZero ? $parsed < 0 : $parsed <= 0)) {
        respond(['error' => "Invalid {$key}."], 422);
    }
    return (int) $parsed;
}

function request_date(array $input, string $key): ?string
{
    $value = request_string($input, $key, 10);
    if ($value === '') {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value || (int) $date->format('Y') < 1000) {
        respond(['error' => 'Deadline must be a real date in YYYY-MM-DD format.'], 422);
    }
    return $value;
}

function request_choice(array $input, string $key, array $choices, string $default): string
{
    $value = $input[$key] ?? $default;
    if (!is_string($value) || !in_array($value, $choices, true)) {
        respond(['error' => "Invalid {$key}."], 422);
    }
    return $value;
}
