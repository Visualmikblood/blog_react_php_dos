<?php
class Helpers {
    public static function sanitizeInput($input) {
        return htmlspecialchars(strip_tags(trim($input)));
    }

    public static function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }

    public static function generateSlug($string) {
        $slug = strtolower(trim($string));
        $slug = preg_replace('/[^a-z0-9-]+/', '-', $slug);
        $slug = preg_replace('/-+/', '-', $slug);
        return rtrim($slug, '-');
    }

    public static function generateExcerpt($content, $length = 150) {
        $excerpt = strip_tags($content);
        if (strlen($excerpt) > $length) {
            $excerpt = substr($excerpt, 0, $length) . '...';
        }
        return $excerpt;
    }

    public static function calculateReadTime($content) {
        $words_per_minute = 150; // Ajustado para español
        $word_count = str_word_count(strip_tags($content));
        $minutes = $word_count / $words_per_minute;

        if ($minutes < 1) {
            $seconds = round($minutes * 60);
            return max(30, $seconds) . ' sec read'; // Mínimo 30 segundos
        } else {
            return round($minutes) . ' min read';
        }
    }
}
?>
