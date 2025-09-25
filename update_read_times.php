<?php
// Script para actualizar los tiempos de lectura de todos los posts existentes
include_once 'api/config/database.php';
include_once 'api/utils/helpers.php';

$database = new Database();
$db = $database->connect();

try {
    // Obtener todos los posts
    $query = "SELECT id, content FROM posts WHERE content IS NOT NULL AND content != ''";
    $stmt = $db->prepare($query);
    $stmt->execute();

    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $updated = 0;

    foreach ($posts as $post) {
        $read_time = Helpers::calculateReadTime($post['content']);

        // Actualizar el tiempo de lectura
        $update_query = "UPDATE posts SET read_time = :read_time WHERE id = :id";
        $update_stmt = $db->prepare($update_query);
        $update_stmt->bindParam(':read_time', $read_time);
        $update_stmt->bindParam(':id', $post['id']);

        if ($update_stmt->execute()) {
            $updated++;
            echo "Post ID {$post['id']}: {$read_time}\n";
        }
    }

    echo "\nActualización completada. Se actualizaron {$updated} posts.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>