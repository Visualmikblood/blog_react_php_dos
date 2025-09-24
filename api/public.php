<?php
// API pública para el frontend (sin autenticación requerida para algunas operaciones)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

include_once __DIR__ . '/config/database.php';
include_once __DIR__ . '/models/Post.php';
include_once __DIR__ . '/utils/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$request_uri = $_SERVER['REQUEST_URI'];

// Manejar preflight requests
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$database = new Database();
$db = $database->connect();

// Función para obtener la IP del usuario
function getUserIP() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}

// Verificar si la petición es para incrementar vistas (DEBE IR PRIMERO - más específico)
if (preg_match('/\/public\/posts\/(\d+)\/views/', $request_uri, $matches)) {
    $post_id = $matches[1];
    handleIncrementViews($db, $post_id);
    exit();
}

// Verificar si la petición es para likes
if (preg_match('/\/public\/posts\/(\d+)\/likes/', $request_uri, $matches)) {
    $post_id = $matches[1];

    if ($method === 'POST') {
        handleLikePost($db, $post_id);
    } elseif ($method === 'DELETE') {
        handleUnlikePost($db, $post_id);
    } elseif ($method === 'GET') {
        handleGetPostLikes($db, $post_id);
    } else {
        http_response_code(405);
        echo json_encode(array("message" => "Método no permitido."));
    }
    exit();
}

// Verificar si la petición es para comentarios
if (preg_match('/\/public\/posts\/(\d+)\/comments/', $request_uri, $matches)) {
    $post_id = $matches[1];
    if ($method === 'POST') {
        handleCreateComment($db, $post_id);
    } else {
        http_response_code(405);
        echo json_encode(array("message" => "Método no permitido."));
    }
    exit();
}

// Verificar si la petición es para posts individuales
if (preg_match('/\/public\/posts\/(\d+)/', $request_uri, $matches)) {
    $post_id = $matches[1];
    handleGetPostById($db, $post_id);
    exit();
}

// Verificar si la petición es para posts (lista)
if (preg_match('/\/public\/posts/', $request_uri)) {
    handleGetPosts($db);
    exit();
}

// Verificar si la petición es para categorías
if (preg_match('/\/public\/categories/', $request_uri)) {
    handleGetCategories($db);
    exit();
}

http_response_code(404);
echo json_encode(array("message" => "Endpoint no encontrado."));

function handleLikePost($db, $post_id) {
    // Verificar que el post existe y está publicado
    $query = "SELECT id FROM posts WHERE id = :id AND status = 'published'";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $post_id);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Post no encontrado."));
        return;
    }

    // Obtener token de autenticación si existe
    $user_id = null;
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        try {
            $tokenData = json_decode(base64_decode($token), true);
            if ($tokenData && isset($tokenData['exp']) && $tokenData['exp'] > time()) {
                $user_id = $tokenData['user_id'];
            }
        } catch (Exception $e) {
            // Token inválido, continuar sin usuario autenticado
        }
    }

    $user_ip = getUserIP();

    // Verificar si ya existe un like
    $check_query = "SELECT id FROM post_likes WHERE post_id = :post_id AND ((user_id = :user_id AND user_id IS NOT NULL) OR (user_ip = :user_ip AND user_id IS NULL))";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(':post_id', $post_id);
    $check_stmt->bindParam(':user_id', $user_id);
    $check_stmt->bindParam(':user_ip', $user_ip);
    $check_stmt->execute();

    if ($check_stmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(array("message" => "Ya has dado like a este post."));
        return;
    }

    // Insertar el like
    $insert_query = "INSERT INTO post_likes (post_id, user_id, user_ip) VALUES (:post_id, :user_id, :user_ip)";
    $insert_stmt = $db->prepare($insert_query);
    $insert_stmt->bindParam(':post_id', $post_id);
    $insert_stmt->bindParam(':user_id', $user_id);
    $insert_stmt->bindParam(':user_ip', $user_ip);

    if ($insert_stmt->execute()) {
        // Actualizar contador de likes en el post
        $update_query = "UPDATE posts SET likes = likes + 1 WHERE id = :id";
        $update_stmt = $db->prepare($update_query);
        $update_stmt->bindParam(':id', $post_id);
        $update_stmt->execute();

        // Obtener el nuevo contador de likes
        $count_query = "SELECT likes FROM posts WHERE id = :id";
        $count_stmt = $db->prepare($count_query);
        $count_stmt->bindParam(':id', $post_id);
        $count_stmt->execute();
        $likes = $count_stmt->fetch(PDO::FETCH_ASSOC)['likes'];

        http_response_code(201);
        echo json_encode(array(
            "message" => "Like agregado exitosamente.",
            "likes" => (int)$likes
        ));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Error al agregar el like."));
    }
}

function handleUnlikePost($db, $post_id) {
    // Obtener token de autenticación si existe
    $user_id = null;
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        try {
            $tokenData = json_decode(base64_decode($token), true);
            if ($tokenData && isset($tokenData['exp']) && $tokenData['exp'] > time()) {
                $user_id = $tokenData['user_id'];
            }
        } catch (Exception $e) {
            // Token inválido, continuar sin usuario autenticado
        }
    }

    $user_ip = getUserIP();

    // Eliminar el like
    $delete_query = "DELETE FROM post_likes WHERE post_id = :post_id AND ((user_id = :user_id AND user_id IS NOT NULL) OR (user_ip = :user_ip AND user_id IS NULL))";
    $delete_stmt = $db->prepare($delete_query);
    $delete_stmt->bindParam(':post_id', $post_id);
    $delete_stmt->bindParam(':user_id', $user_id);
    $delete_stmt->bindParam(':user_ip', $user_ip);

    if ($delete_stmt->execute() && $delete_stmt->rowCount() > 0) {
        // Actualizar contador de likes en el post
        $update_query = "UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = :id";
        $update_stmt = $db->prepare($update_query);
        $update_stmt->bindParam(':id', $post_id);
        $update_stmt->execute();

        // Obtener el nuevo contador de likes
        $count_query = "SELECT likes FROM posts WHERE id = :id";
        $count_stmt = $db->prepare($count_query);
        $count_stmt->bindParam(':id', $post_id);
        $count_stmt->execute();
        $likes = $count_stmt->fetch(PDO::FETCH_ASSOC)['likes'];

        http_response_code(200);
        echo json_encode(array(
            "message" => "Like removido exitosamente.",
            "likes" => (int)$likes
        ));
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "Like no encontrado."));
    }
}

function handleGetPostLikes($db, $post_id) {
    // Obtener token de autenticación si existe
    $user_id = null;
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        try {
            $tokenData = json_decode(base64_decode($token), true);
            if ($tokenData && isset($tokenData['exp']) && $tokenData['exp'] > time()) {
                $user_id = $tokenData['user_id'];
            }
        } catch (Exception $e) {
            // Token inválido, continuar sin usuario autenticado
        }
    }

    $user_ip = getUserIP();

    // Verificar si el usuario actual ya dio like
    $check_query = "SELECT id FROM post_likes WHERE post_id = :post_id AND ((user_id = :user_id AND user_id IS NOT NULL) OR (user_ip = :user_ip AND user_id IS NULL))";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(':post_id', $post_id);
    $check_stmt->bindParam(':user_id', $user_id);
    $check_stmt->bindParam(':user_ip', $user_ip);
    $check_stmt->execute();

    $user_liked = $check_stmt->rowCount() > 0;

    // Obtener el contador total de likes
    $count_query = "SELECT likes FROM posts WHERE id = :id";
    $count_stmt = $db->prepare($count_query);
    $count_stmt->bindParam(':id', $post_id);
    $count_stmt->execute();
    $likes = $count_stmt->fetch(PDO::FETCH_ASSOC)['likes'];

    http_response_code(200);
    echo json_encode(array(
        "likes" => (int)$likes,
        "user_liked" => $user_liked
    ));
}

function handleGetPosts($db) {
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 6;
    $category = isset($_GET['category']) ? $_GET['category'] : null;
    $search = isset($_GET['search']) ? $_GET['search'] : null;

    $offset = ($page - 1) * $limit;

    $where_conditions = ["p.status = 'published'"];
    $params = [];

    if ($category) {
        $where_conditions[] = "c.slug = :category";
        $params[':category'] = $category;
    }

    if ($search) {
        $where_conditions[] = "(p.title LIKE :search OR p.content LIKE :search OR p.excerpt LIKE :search)";
        $params[':search'] = "%$search%";
    }

    $where_clause = implode(' AND ', $where_conditions);

    $query = "SELECT p.*, c.name as category_name, c.slug as category_slug,
                     u.name as author_name, u.email as author_email,
                     COUNT(co.id) as comments_count
              FROM posts p
              LEFT JOIN categories c ON p.category_id = c.id
              LEFT JOIN users u ON p.author_id = u.id
              LEFT JOIN comments co ON p.id = co.post_id AND co.status = 'approved'
              WHERE $where_clause
              GROUP BY p.id
              ORDER BY p.created_at DESC
              LIMIT :limit OFFSET :offset";

    $stmt = $db->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $posts = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $posts[] = [
            "id" => (int)$row['id'],
            "title" => $row['title'],
            "content" => $row['content'],
            "excerpt" => $row['excerpt'],
            "category" => $row['category_name'] ?: 'Sin categoría',
            "category_slug" => $row['category_slug'],
            "author" => $row['author_name'] ?: 'Anónimo',
            "date" => $row['created_at'],
            "status" => $row['status'],
            "featured_image" => $row['featured_image'],
            "read_time" => $row['read_time'] ?: '1 min read',
            "likes" => (int)$row['likes'],
            "views" => (int)$row['views'],
            "comments_count" => (int)$row['comments_count']
        ];
    }

    // Contar total
    $count_query = "SELECT COUNT(*) as total FROM posts p WHERE $where_clause";
    $count_stmt = $db->prepare($count_query);
    foreach ($params as $key => $value) {
        $count_stmt->bindValue($key, $value);
    }
    $count_stmt->execute();
    $total = $count_stmt->fetch(PDO::FETCH_ASSOC)['total'];

    http_response_code(200);
    echo json_encode([
        "posts" => $posts,
        "pagination" => [
            "page" => $page,
            "pages" => ceil($total / $limit),
            "total" => (int)$total,
            "limit" => $limit
        ]
    ]);
}

function handleGetPostById($db, $post_id) {
    // Verificar si el usuario está autenticado y obtener su rol
    $user_id = null;
    $user_role = null;
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        try {
            $tokenData = json_decode(base64_decode($token), true);
            if ($tokenData && isset($tokenData['exp']) && $tokenData['exp'] > time()) {
                $user_id = $tokenData['user_id'];
                $user_role = $tokenData['role'] ?? null;
            }
        } catch (Exception $e) {
            // Token inválido, continuar sin usuario autenticado
        }
    }

    // Construir la consulta condicionalmente
    $where_condition = "p.id = :id";
    if (!$user_id) {
        // Usuario no autenticado: solo posts publicados
        $where_condition .= " AND p.status = 'published'";
    } elseif ($user_role === 'admin') {
        // Admin: acceso a todos los posts (publicados y drafts)
        // No agregar condición adicional
    } else {
        // Usuario autenticado normal: posts publicados O posts en draft del usuario
        $where_condition .= " AND (p.status = 'published' OR (p.status = 'draft' AND p.author_id = :user_id))";
    }

    $query = "SELECT p.*, c.name as category_name, c.slug as category_slug,
                      u.name as author_name, u.email as author_email,
                      GROUP_CONCAT(t.name) as tags,
                      COUNT(co.id) as comments_count
               FROM posts p
               LEFT JOIN categories c ON p.category_id = c.id
               LEFT JOIN users u ON p.author_id = u.id
               LEFT JOIN post_tags pt ON p.id = pt.post_id
               LEFT JOIN tags t ON pt.tag_id = t.id
               LEFT JOIN comments co ON p.id = co.post_id AND co.status = 'approved'
               WHERE $where_condition
               GROUP BY p.id";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $post_id);
    if ($user_id && $user_role !== 'admin') {
        $stmt->bindParam(':user_id', $user_id);
    }
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Post no encontrado."));
        return;
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // Obtener comentarios
    $comments_query = "SELECT c.*, u.name as user_name, u.avatar as user_avatar
                       FROM comments c
                       LEFT JOIN users u ON c.user_id = u.id
                       WHERE c.post_id = :post_id AND c.status = 'approved'
                       ORDER BY c.created_at ASC";
    $comments_stmt = $db->prepare($comments_query);
    $comments_stmt->bindParam(':post_id', $post_id);
    $comments_stmt->execute();

    $comments = [];
    while ($comment_row = $comments_stmt->fetch(PDO::FETCH_ASSOC)) {
        $comments[] = [
            "id" => (int)$comment_row['id'],
            "author_name" => $comment_row['user_name'] ?: $comment_row['author_name'],
            "content" => $comment_row['content'],
            "date" => $comment_row['created_at'],
            "user_avatar" => $comment_row['user_avatar']
        ];
    }

    $post = [
        "id" => (int)$row['id'],
        "title" => $row['title'],
        "content" => $row['content'],
        "excerpt" => $row['excerpt'],
        "category" => $row['category_name'] ?: 'Sin categoría',
        "category_slug" => $row['category_slug'],
        "author" => $row['author_name'] ?: 'Anónimo',
        "date" => $row['created_at'],
        "status" => $row['status'],
        "featured_image" => $row['featured_image'],
        "read_time" => $row['read_time'] ?: '1 min read',
        "likes" => (int)$row['likes'],
        "views" => (int)$row['views'],
        "comments_count" => (int)$row['comments_count'],
        "tags" => $row['tags'] ? explode(',', $row['tags']) : [],
        "comments" => $comments
    ];

    http_response_code(200);
    echo json_encode(array("post" => $post));
}

function handleGetCategories($db) {
    $query = "SELECT c.*, COUNT(p.id) as post_count
              FROM categories c
              LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
              GROUP BY c.id
              ORDER BY c.name ASC";

    $stmt = $db->prepare($query);
    $stmt->execute();

    $categories = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $categories[] = [
            "id" => (int)$row['id'],
            "name" => $row['name'],
            "slug" => $row['slug'],
            "description" => $row['description'],
            "icon" => $row['icon'],
            "post_count" => (int)$row['post_count']
        ];
    }

    http_response_code(200);
    echo json_encode(array("categories" => $categories));
}

function handleIncrementViews($db, $post_id) {
    $query = "UPDATE posts SET views = views + 1 WHERE id = :id AND status = 'published'";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $post_id);

    if ($stmt->execute()) {
        // Obtener el nuevo contador de vistas
        $count_query = "SELECT views FROM posts WHERE id = :id";
        $count_stmt = $db->prepare($count_query);
        $count_stmt->bindParam(':id', $post_id);
        $count_stmt->execute();
        $views = $count_stmt->fetch(PDO::FETCH_ASSOC)['views'];

        http_response_code(200);
        echo json_encode(array("views" => (int)$views));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Error al incrementar vistas."));
    }
}

function handleCreateComment($db, $post_id) {
    $data = json_decode(file_get_contents("php://input"));

    if (!isset($data->content) || trim($data->content) === '') {
        http_response_code(400);
        echo json_encode(array("message" => "El contenido del comentario es requerido."));
        return;
    }

    // Verificar que el post existe y está publicado
    $post_query = "SELECT id FROM posts WHERE id = :id AND status = 'published'";
    $post_stmt = $db->prepare($post_query);
    $post_stmt->bindParam(':id', $post_id);
    $post_stmt->execute();

    if ($post_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Post no encontrado."));
        return;
    }

    // Obtener información del usuario si está autenticado
    $user_id = null;
    $author_name = isset($data->author_name) ? Helpers::sanitizeInput($data->author_name) : null;
    $author_email = isset($data->author_email) ? Helpers::sanitizeInput($data->author_email) : null;

    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        try {
            $tokenData = json_decode(base64_decode($token), true);
            if ($tokenData && isset($tokenData['exp']) && $tokenData['exp'] > time()) {
                $user_id = $tokenData['user_id'];
                // Si está autenticado, obtener nombre y email del usuario
                $user_query = "SELECT name, email FROM users WHERE id = :id";
                $user_stmt = $db->prepare($user_query);
                $user_stmt->bindParam(':id', $user_id);
                $user_stmt->execute();
                $user_data = $user_stmt->fetch(PDO::FETCH_ASSOC);
                $author_name = $user_data['name'];
                $author_email = $user_data['email'];
            }
        } catch (Exception $e) {
            // Token inválido, usar datos del formulario
        }
    }

    $query = "INSERT INTO comments (post_id, user_id, author_name, author_email, content, status)
              VALUES (:post_id, :user_id, :author_name, :author_email, :content, 'pending')";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':post_id', $post_id);
    $stmt->bindParam(':user_id', $user_id);
    $stmt->bindParam(':author_name', $author_name);
    $stmt->bindParam(':author_email', $author_email);
    $content = Helpers::sanitizeInput($data->content);
    $stmt->bindParam(':content', $content);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode(array("message" => "Comentario enviado exitosamente."));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Error al guardar el comentario."));
    }
}
?>