<?php
require_once 'api/config/database.php';

try {
    $database = new Database();
    $pdo = $database->connect();

    if (!$pdo) {
        echo "Error: No se pudo conectar a la base de datos\n";
        exit;
    }

    $stmt = $pdo->query('SELECT id, title, status FROM posts ORDER BY id DESC LIMIT 10');
    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Posts en la base de datos:\n";
    foreach ($posts as $post) {
        echo "ID: {$post['id']} - Título: {$post['title']} - Estado: {$post['status']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>