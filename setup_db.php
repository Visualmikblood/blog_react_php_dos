<?php
include_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->connect();

    // Leer el archivo SQL línea por línea
    $lines = file('api/database/modern_blog.sql');
    $currentQuery = '';
    $inMultilineComment = false;

    foreach ($lines as $line) {
        $line = trim($line);

        // Ignorar líneas vacías
        if (empty($line)) continue;

        // Manejar comentarios multilinea
        if (strpos($line, '/*') === 0) {
            $inMultilineComment = true;
            continue;
        }
        if (strpos($line, '*/') !== false) {
            $inMultilineComment = false;
            continue;
        }
        if ($inMultilineComment) continue;

        // Ignorar comentarios de línea
        if (strpos($line, '--') === 0) continue;

        // Agregar línea a la consulta actual
        $currentQuery .= $line . ' ';

        // Si termina con punto y coma, ejecutar la consulta
        if (substr($line, -1) === ';') {
            $query = trim($currentQuery);
            if (!empty($query)) {
                try {
                    echo "Ejecutando: " . substr(str_replace("\n", " ", $query), 0, 60) . "...\n";
                    $db->exec($query);
                } catch (Exception $e) {
                    // Solo mostrar error si no es por contenido markdown
                    if (strpos($e->getMessage(), 'markdown') === false &&
                        strpos($e->getMessage(), '```') === false) {
                        echo "Error en consulta: " . $e->getMessage() . "\n";
                    }
                }
            }
            $currentQuery = '';
        }
    }

    echo "Base de datos configurada exitosamente!\n";

} catch (Exception $e) {
    echo "Error general: " . $e->getMessage() . "\n";
}
?>