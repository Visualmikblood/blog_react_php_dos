<?php
// Script para resetear completamente la base de datos
include_once 'api/config/database.php';

$database = new Database();
$db = $database->connect();

if (!$db) {
    die("Error de conexión a la base de datos");
}

try {
    // Eliminar base de datos si existe
    $db->exec("DROP DATABASE IF EXISTS modern_blog");
    echo "✅ Base de datos anterior eliminada\n";

    // Crear base de datos nueva
    $db->exec("CREATE DATABASE modern_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $db->exec("USE modern_blog");
    echo "✅ Base de datos creada\n";

    // Crear tablas
    $sql = "
    CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'author', 'user') DEFAULT 'user',
        avatar VARCHAR(255) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT DEFAULT NULL,
        icon VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        excerpt TEXT DEFAULT NULL,
        category_id INT DEFAULT NULL,
        author_id INT NOT NULL,
        featured_image VARCHAR(255) DEFAULT NULL,
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        read_time VARCHAR(20) DEFAULT NULL,
        likes INT DEFAULT 0,
        views INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE post_tags (
        post_id INT NOT NULL,
        tag_id INT NOT NULL,
        PRIMARY KEY (post_id, tag_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE post_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        user_ip VARCHAR(45) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_post_user (post_id, user_id),
        UNIQUE KEY unique_post_ip (post_id, user_ip),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        author_name VARCHAR(100) DEFAULT NULL,
        author_email VARCHAR(150) DEFAULT NULL,
        content TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        parent_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE TABLE site_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT DEFAULT NULL,
        setting_type ENUM('string', 'integer', 'boolean', 'json') DEFAULT 'string',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
    ";

    $db->exec($sql);
    echo "✅ Tablas creadas\n";

    // Insertar datos básicos
    $insertSql = "
    INSERT INTO users (name, email, password, role, bio) VALUES
    ('Administrador', 'admin@blog.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Administrador del blog ModernBlog');

    INSERT INTO categories (name, slug, description, icon) VALUES
    ('Tecnología', 'tecnologia', 'Artículos sobre tecnología, programación y desarrollo', 'cpu'),
    ('Diseño', 'diseno', 'Contenido relacionado con diseño gráfico y UX/UI', 'palette'),
    ('Marketing', 'marketing', 'Estrategias de marketing digital y crecimiento', 'trending-up'),
    ('Tutoriales', 'tutoriales', 'Guías paso a paso y tutoriales prácticos', 'book-open');

    INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES
    ('site_name', 'ModernBlog', 'string'),
    ('site_description', 'Un blog moderno construido con React y PHP', 'string'),
    ('site_url', 'http://localhost:8000', 'string'),
    ('posts_per_page', '10', 'integer'),
    ('comments_enabled', 'true', 'boolean'),
    ('registration_enabled', 'false', 'boolean'),
    ('maintenance_mode', 'false', 'boolean');
    ";

    $db->exec($insertSql);
    echo "✅ Datos básicos insertados\n";

    echo "🎉 Base de datos reseteada completamente. Ahora tienes una base de datos limpia sin datos de ejemplo.\n";
    echo "Usuario administrador: admin@blog.com / password\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
?>