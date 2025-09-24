<?php
// Test para verificar que las vistas se incrementan correctamente en la vista pública
include_once 'api/config/database.php';

$database = new Database();
$db = $database->connect();

// Obtener un post de prueba
$query = "SELECT id, title, views FROM posts WHERE status = 'published' LIMIT 1";
$stmt = $db->prepare($query);
$stmt->execute();
$post = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$post) {
    echo "❌ No hay posts publicados para probar\n";
    exit;
}

echo "📝 Post de prueba: {$post['title']} (ID: {$post['id']})\n";
echo "👁️  Vistas iniciales: {$post['views']}\n\n";

// Simular una petición GET al post (como cuando se carga en la vista pública)
echo "🔄 Simulando carga del post...\n";
$url = "http://localhost:8000/public/posts/{$post['id']}";
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'Content-Type: application/json'
    ]
]);

$response = file_get_contents($url, false, $context);
if ($response === false) {
    echo "❌ Error al obtener el post\n";
    exit;
}

$data = json_decode($response, true);
if (!isset($data['post'])) {
    echo "❌ Respuesta inválida del servidor\n";
    exit;
}

echo "✅ Post cargado exitosamente\n";
echo "👁️  Vistas después de GET: {$data['post']['views']}\n\n";

// Ahora simular el incremento de vistas (como cuando se ve el artículo)
echo "🔄 Simulando incremento de vistas...\n";
$url = "http://localhost:8000/public/posts/{$post['id']}/views";
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json'
    ]
]);

$response = file_get_contents($url, false, $context);
if ($response === false) {
    echo "❌ Error al incrementar vistas\n";
    exit;
}

echo "🔍 Respuesta cruda del servidor:\n";
echo $response . "\n\n";

$data = json_decode($response, true);
if (!isset($data['views'])) {
    echo "❌ Respuesta no contiene campo 'views'\n";
    exit;
}

echo "✅ Vistas incrementadas exitosamente\n";
echo "👁️  Nuevas vistas: {$data['views']}\n\n";

// Verificar en la base de datos
$query = "SELECT views FROM posts WHERE id = :id";
$stmt = $db->prepare($query);
$stmt->bindParam(':id', $post['id']);
$stmt->execute();
$current_views = $stmt->fetch(PDO::FETCH_ASSOC)['views'];

echo "🔍 Verificación en base de datos:\n";
echo "👁️  Vistas actuales en BD: {$current_views}\n";

if ($current_views == $data['views']) {
    echo "✅ ¡Las vistas coinciden! El sistema funciona correctamente.\n";
} else {
    echo "❌ ¡ERROR! Las vistas no coinciden entre API y base de datos.\n";
}

echo "\n💡 Si las vistas se incrementan en la base de datos pero no se muestran en el frontend,\n";
echo "   el problema está en la actualización del estado de React.\n";
?>