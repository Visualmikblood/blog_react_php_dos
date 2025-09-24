<?php
include_once 'api/config/database.php';

$database = new Database();
$db = $database->connect();

try {
    // Crear categorías básicas si no existen
    $categories = [
        ['name' => 'Tecnología', 'slug' => 'tecnologia', 'description' => 'Artículos sobre tecnología y desarrollo'],
        ['name' => 'Diseño', 'slug' => 'diseno', 'description' => 'Artículos sobre diseño y creatividad'],
        ['name' => 'Marketing', 'slug' => 'marketing', 'description' => 'Estrategias de marketing digital'],
        ['name' => 'Tutoriales', 'slug' => 'tutoriales', 'description' => 'Guías paso a paso']
    ];

    foreach ($categories as $category) {
        $query = "SELECT id FROM categories WHERE slug = :slug";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':slug', $category['slug']);
        $stmt->execute();

        if ($stmt->rowCount() == 0) {
            $query = "INSERT INTO categories (name, slug, description) VALUES (:name, :slug, :description)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':name', $category['name']);
            $stmt->bindParam(':slug', $category['slug']);
            $stmt->bindParam(':description', $category['description']);
            $stmt->execute();
        }
    }

    // Crear usuario administrador si no existe
    $query = "SELECT id FROM users WHERE email = 'admin@blog.com'";
    $stmt = $db->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        $password_hash = password_hash('password', PASSWORD_DEFAULT);
        $name = 'Administrador';
        $email = 'admin@blog.com';
        $role = 'admin';
        $bio = 'Administrador del blog ModernBlog';
        $query = "INSERT INTO users (name, email, password, role, bio) VALUES (:name, :email, :password, :role, :bio)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':role', $role);
        $stmt->bindParam(':bio', $bio);
        $stmt->execute();
    }

    // Crear usuario autor si no existe
    $query = "SELECT id FROM users WHERE email = 'autor@blog.com'";
    $stmt = $db->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        $password_hash = password_hash('password', PASSWORD_DEFAULT);
        $name = 'Autor Demo';
        $email = 'autor@blog.com';
        $role = 'author';
        $bio = 'Autor de contenido para el blog';
        $query = "INSERT INTO users (name, email, password, role, bio) VALUES (:name, :email, :password, :role, :bio)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':role', $role);
        $stmt->bindParam(':bio', $bio);
        $stmt->execute();
    }

    echo "✅ Datos básicos creados exitosamente\n";
    echo "Categorías creadas: " . count($categories) . "\n";
    echo "Usuarios disponibles:\n";
    echo "- admin@blog.com / password (Administrador)\n";
    echo "- autor@blog.com / password (Autor)\n";

} catch (Exception $e) {
    echo "❌ Error creando datos básicos: " . $e->getMessage() . "\n";
}
?>