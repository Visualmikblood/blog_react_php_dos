<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=modern_blog", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Conexión exitosa a la base de datos.\n";

    // Verificar tablas
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Tablas encontradas: " . implode(", ", $tables) . "\n";

    // Verificar posts
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM posts");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Posts totales: " . $result['total'] . "\n";

    // Verificar usuarios
    $stmt = $pdo->query("SELECT id, name, email, role, password FROM users");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Usuarios encontrados:\n";
    foreach ($users as $user) {
        echo "- ID: {$user['id']}, Name: {$user['name']}, Email: {$user['email']}, Role: {$user['role']}\n";
        // Verificar si password 'password' coincide
        if (password_verify('password', $user['password'])) {
            echo "  -> Contraseña 'password' es correcta para este usuario\n";
        } else {
            echo "  -> Contraseña 'password' NO coincide\n";
        }
    }

} catch (PDOException $e) {
    echo "Error de conexión: " . $e->getMessage() . "\n";
}
?>