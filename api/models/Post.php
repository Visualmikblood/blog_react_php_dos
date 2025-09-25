<?php
class Post {
    private $conn;
    private $table = 'posts';

    public $id;
    public $title;
    public $content;
    public $excerpt;
    public $category_id;
    public $author_id;
    public $featured_image;
    public $status;
    public $read_time;
    public $likes;
    public $views;
    public $created_at;
    public $updated_at;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create() {
        file_put_contents(__DIR__ . '/../debug.log', date('Y-m-d H:i:s') . " Post::create - featured_image: " . $this->featured_image . "\n", FILE_APPEND);
        $query = "INSERT INTO " . $this->table . "
                  SET title = :title,
                      content = :content,
                      excerpt = :excerpt,
                      category_id = :category_id,
                      author_id = :author_id,
                      featured_image = :featured_image,
                      status = :status,
                      read_time = :read_time";

        $stmt = $this->conn->prepare($query);

        // Sanitizar datos
        $this->title = htmlspecialchars(strip_tags($this->title));
        // Para el contenido, no sanitizar ya que es HTML/markdown escrito por admin de confianza
        // $this->content = $this->sanitizeContent($this->content);
        $this->excerpt = htmlspecialchars(strip_tags($this->excerpt));
        // Para featured_image, solo sanitizar si no es una URL externa
        if ($this->featured_image && filter_var($this->featured_image, FILTER_VALIDATE_URL)) {
            // Es una URL válida, mantenerla como está pero eliminar tags HTML
            $this->featured_image = strip_tags($this->featured_image);
        } else {
            // No es URL o es ruta local, sanitizar normalmente
            $this->featured_image = htmlspecialchars(strip_tags($this->featured_image));
        }
        $this->status = htmlspecialchars(strip_tags($this->status));
        $this->read_time = htmlspecialchars(strip_tags($this->read_time));

        // Bind datos
        $stmt->bindParam(':title', $this->title);
        $stmt->bindParam(':content', $this->content);
        $stmt->bindParam(':excerpt', $this->excerpt);
        $stmt->bindParam(':category_id', $this->category_id);
        $stmt->bindParam(':author_id', $this->author_id);
        $stmt->bindParam(':featured_image', $this->featured_image);
        $stmt->bindParam(':status', $this->status);
        $stmt->bindParam(':read_time', $this->read_time);

        if ($stmt->execute()) {
            file_put_contents(__DIR__ . '/../debug.log', date('Y-m-d H:i:s') . " Post::create - Query ejecutada exitosamente\n", FILE_APPEND);
            return true;
        }

        file_put_contents(__DIR__ . '/../debug.log', date('Y-m-d H:i:s') . " Post::create - Error ejecutando query: " . implode(", ", $stmt->errorInfo()) . "\n", FILE_APPEND);
        return false;
    }

    public function read() {
        $query = "SELECT p.*, c.name as category_name, c.slug as category_slug,
                         u.name as author_name, u.email as author_email
                  FROM " . $this->table . " p
                  LEFT JOIN categories c ON p.category_id = c.id
                  LEFT JOIN users u ON p.author_id = u.id
                  ORDER BY p.created_at DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        return $stmt;
    }

    public function readOne() {
        $query = "SELECT p.*, c.name as category_name, c.slug as category_slug,
                         u.name as author_name, u.email as author_email
                  FROM " . $this->table . " p
                  LEFT JOIN categories c ON p.category_id = c.id
                  LEFT JOIN users u ON p.author_id = u.id
                  WHERE p.id = :id
                  LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $this->title = $row['title'];
            $this->content = $row['content'];
            $this->excerpt = $row['excerpt'];
            $this->category_id = $row['category_id'];
            $this->author_id = $row['author_id'];
            $this->featured_image = $row['featured_image'];
            $this->status = $row['status'];
            $this->read_time = $row['read_time'];
            $this->likes = $row['likes'];
            $this->views = $row['views'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    public function update() {
        $query = "UPDATE " . $this->table . "
                  SET title = :title,
                      content = :content,
                      excerpt = :excerpt,
                      category_id = :category_id,
                      featured_image = :featured_image,
                      status = :status,
                      read_time = :read_time,
                      updated_at = NOW()
                  WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        // Sanitizar datos
        $this->title = htmlspecialchars(strip_tags($this->title));
        // Para el contenido, no sanitizar ya que es HTML/markdown escrito por admin de confianza
        // $this->content = $this->sanitizeContent($this->content);
        $this->excerpt = htmlspecialchars(strip_tags($this->excerpt));
        // Para featured_image, manejar diferentes tipos de URLs
        if ($this->featured_image) {
            if (filter_var($this->featured_image, FILTER_VALIDATE_URL)) {
                // Es una URL externa válida, mantenerla como está pero eliminar tags HTML
                $this->featured_image = strip_tags($this->featured_image);
            } elseif (strpos($this->featured_image, '/') === 0) {
                // Es una ruta local que empieza con /, mantenerla sin sanitizar
                // No hacer nada, mantener como está
            } else {
                // Otro tipo de valor, sanitizar normalmente
                $this->featured_image = htmlspecialchars(strip_tags($this->featured_image));
            }
        }
        $this->status = htmlspecialchars(strip_tags($this->status));
        $this->read_time = htmlspecialchars(strip_tags($this->read_time));

        // Bind datos
        $stmt->bindParam(':title', $this->title);
        $stmt->bindParam(':content', $this->content);
        $stmt->bindParam(':excerpt', $this->excerpt);
        $stmt->bindParam(':category_id', $this->category_id);
        $stmt->bindParam(':featured_image', $this->featured_image);
        $stmt->bindParam(':status', $this->status);
        $stmt->bindParam(':read_time', $this->read_time);
        $stmt->bindParam(':id', $this->id);

        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    public function delete() {
        $query = "DELETE FROM " . $this->table . " WHERE id = :id";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);

        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

}
?>
