<?php
// Script para probar el incremento de vistas
include_once 'api/config/database.php';

$database = new Database();
$db = $database->connect();

// Obtener un post de ejemplo
$query = "SELECT id, title, views FROM posts WHERE status = 'published' LIMIT 1";
$stmt = $db->prepare($query);
$stmt->execute();
$post = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$post) {
    echo "No hay posts publicados para probar.\n";
    exit;
}

echo "Post encontrado: {$post['title']} (ID: {$post['id']})\n";
echo "Vistas actuales: {$post['views']}\n\n";

// Simular llamada al endpoint de incrementar vistas
$query = "UPDATE posts SET views = views + 1 WHERE id = :id AND status = 'published'";
$stmt = $db->prepare($query);
$stmt->bindParam(':id', $post['id']);

if ($stmt->execute()) {
    // Obtener el nuevo contador de vistas
    $count_query = "SELECT views FROM posts WHERE id = :id";
    $count_stmt = $db->prepare($count_query);
    $count_stmt->bindParam(':id', $post['id']);
    $count_stmt->execute();
    $new_views = $count_stmt->fetch(PDO::FETCH_ASSOC)['views'];

    echo "✅ Vistas incrementadas exitosamente!\n";
    echo "Nuevas vistas: {$new_views}\n";
} else {
    echo "❌ Error al incrementar vistas.\n";
}
?>