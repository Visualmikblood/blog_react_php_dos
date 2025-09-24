<?php
require_once 'api/config/database.php';

try {
    $database = new Database();
    $pdo = $database->connect();

    if (!$pdo) {
        echo "Error: No se pudo conectar a la base de datos\n";
        exit;
    }

    $stmt = $pdo->prepare('SELECT id, title, content, featured_image, author_id FROM posts WHERE id = 7');
    $stmt->execute();
    $post = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($post) {
        echo "Post ID: " . $post['id'] . "\n";
        echo "Title: " . $post['title'] . "\n";
        echo "Featured Image: " . ($post['featured_image'] ?: 'NULL') . "\n";
        echo "Author ID: " . $post['author_id'] . "\n";
        echo "Content preview: " . substr($post['content'], 0, 200) . "...\n";

        // Verificar si el autor tiene avatar
        $stmt2 = $pdo->prepare('SELECT avatar FROM users WHERE id = ?');
        $stmt2->execute([$post['author_id']]);
        $user = $stmt2->fetch(PDO::FETCH_ASSOC);
        echo "Author Avatar: " . ($user['avatar'] ?: 'NULL') . "\n";

    } else {
        echo "Post with ID 7 not found\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>