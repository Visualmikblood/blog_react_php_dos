<?php
// Script para arreglar las comillas dobles en posts existentes
include_once 'api/config/database.php';

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
        // Verificar si el contenido tiene entidades HTML escapadas
        $originalContent = $post['content'];
        $fixedContent = $originalContent;

        // Convertir entidades HTML escapadas de vuelta a caracteres normales
        $fixedContent = htmlspecialchars_decode($fixedContent, ENT_QUOTES);

        // Solo actualizar si el contenido cambió
        if ($fixedContent !== $originalContent) {
            $update_query = "UPDATE posts SET content = :content WHERE id = :id";
            $update_stmt = $db->prepare($update_query);
            $update_stmt->bindParam(':content', $fixedContent);
            $update_stmt->bindParam(':id', $post['id']);

            if ($update_stmt->execute()) {
                $updated++;
                echo "Post ID {$post['id']}: contenido actualizado\n";
            }
        }
    }

    echo "\nActualización completada. Se actualizaron {$updated} posts.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>