<?php
class Database {
    private $host = "localhost";
    private $db_name = "modern_blog";
    private $username = "root";
    private $password = "";
    public $conn;

    public function connect() {
        $this->conn = null;

        try {
            $this->conn = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8");
        } catch(PDOException $exception) {
            // Mostrar error para debugging
            error_log("Database connection error: " . $exception->getMessage());
            echo "Database connection error: " . $exception->getMessage() . "\n";
            return null;
        }

        return $this->conn;
    }
}
?>
