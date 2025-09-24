<?php
// Router para el servidor PHP built-in
$request_uri = $_SERVER['REQUEST_URI'];
$request_method = $_SERVER['REQUEST_METHOD'];

// Manejar CORS para todas las peticiones
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Manejar preflight requests
if ($request_method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Debug: mostrar información de la petición
error_log("Router: URI=$request_uri, METHOD=$request_method");

// Verificar si la petición es para /uploads/
if (strpos($request_uri, '/uploads/') === 0) {
    // Los archivos se guardan en api/uploads/, pero se sirven desde /uploads/
    $file_path = __DIR__ . '/api' . $request_uri;

    // Verificar que el archivo existe
    if (file_exists($file_path)) {
        // Obtener el tipo MIME del archivo
        $mime_type = mime_content_type($file_path);

        // Solo permitir imágenes
        if (strpos($mime_type, 'image/') === 0) {
            // Establecer headers
            header('Content-Type: ' . $mime_type);
            header('Cache-Control: public, max-age=31536000');

            // Leer y enviar el archivo
            readfile($file_path);
            exit();
        }
    }

    // Si no es una imagen válida, devolver una imagen placeholder transparente de 1x1 pixel
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=31536000');
    // Imagen PNG de 1x1 pixel transparente en base64
    echo base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    exit();
}

// Verificar si la petición es para la API (/api/ o /admin/)
if (strpos($request_uri, '/api/') === 0 || strpos($request_uri, '/admin/') === 0) {
    // Remover parámetros de query string de la URI
    $path_only = parse_url($request_uri, PHP_URL_PATH);
    $file_path = __DIR__ . '/api' . $path_only;

    // Verificar que el archivo existe
    if (file_exists($file_path)) {
        // Incluir el archivo PHP
        include $file_path;
        exit();
    }

    // Si no existe el archivo, devolver 404
    http_response_code(404);
    echo "API endpoint no encontrado: $file_path";
    exit();
}

// Verificar si la petición es para la API pública (/public/)
if (strpos($request_uri, '/public/') === 0) {
    // Todas las rutas /public/ van a api/public.php
    include __DIR__ . '/api/public.php';
    exit();
}

// Para otras rutas, intentar servir archivos estáticos desde el directorio raíz
$file_path = __DIR__ . $request_uri;

// Verificar que el archivo existe y no es un directorio
if (file_exists($file_path) && !is_dir($file_path)) {
    // Obtener el tipo MIME del archivo
    $mime_type = mime_content_type($file_path);

    // Establecer el tipo de contenido
    header('Content-Type: ' . $mime_type);

    // Leer y enviar el archivo
    readfile($file_path);
    exit();
}

// Si no se encuentra nada, devolver 404
http_response_code(404);
echo "Archivo no encontrado";
?>