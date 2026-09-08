<?php
require_once __DIR__ . "/flight-config.php";

function stories_dir() {
  $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . "data";
  if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
  }
  return $dir;
}

function stories_pending_path() {
  return stories_dir() . DIRECTORY_SEPARATOR . "stories-pending.json";
}

function stories_published_path() {
  return stories_dir() . DIRECTORY_SEPARATOR . "stories-published.json";
}

function stories_topics() {
  return array(
    "Uçuş",
    "Bagaj",
    "Ayıplı ürün / hizmet",
    "E-ticaret / iade",
    "Kira / depozito",
    "Diğer"
  );
}

function stories_admin_password() {
  return flight_config_string("STORIES_ADMIN_PASSWORD", "");
}

function stories_read_list($path) {
  if (!is_readable($path)) {
    return array();
  }
  $raw = file_get_contents($path);
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : array();
}

function stories_write_list($path, $list) {
  $dir = dirname($path);
  if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
  }
  $tmp = $path . ".tmp";
  $json = json_encode(array_values($list), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) {
    return false;
  }
  if (file_put_contents($tmp, $json, LOCK_EX) === false) {
    return false;
  }
  return @rename($tmp, $path);
}

function stories_clean($value, $max, $keepNewlines = false) {
  $value = trim(strip_tags((string) $value));
  if ($keepNewlines) {
    $value = preg_replace("/[^\S\n]+/u", " ", $value);
    $value = preg_replace("/\n{3,}/u", "\n\n", $value);
  } else {
    $value = preg_replace("/\s+/u", " ", $value);
  }
  if (!is_string($value)) {
    $value = "";
  }
  if (function_exists("mb_substr")) {
    return mb_substr($value, 0, $max);
  }
  return substr($value, 0, $max);
}

function stories_month_label($ts) {
  $months = array(
    1 => "Ocak", 2 => "Şubat", 3 => "Mart", 4 => "Nisan",
    5 => "Mayıs", 6 => "Haziran", 7 => "Temmuz", 8 => "Ağustos",
    9 => "Eylül", 10 => "Ekim", 11 => "Kasım", 12 => "Aralık"
  );
  $m = (int) date("n", $ts);
  $label = isset($months[$m]) ? $months[$m] : "";
  return $label . " " . date("Y", $ts);
}

function stories_public_item($row) {
  $ts = isset($row["published_at"]) ? (int) $row["published_at"] : time();
  $city = isset($row["city"]) ? trim((string) $row["city"]) : "";
  $date = stories_month_label($ts);
  $meta = $city !== "" ? $city . " · " . $date : $date;
  $reply = isset($row["reply"]) ? trim((string) $row["reply"]) : "";
  $replyTs = isset($row["reply_at"]) ? (int) $row["reply_at"] : 0;
  $replyMeta = $reply !== "" && $replyTs > 0 ? stories_month_label($replyTs) : "";
  return array(
    "id" => isset($row["id"]) ? (string) $row["id"] : "",
    "name" => isset($row["name"]) ? (string) $row["name"] : "Anonim",
    "topic" => isset($row["topic"]) ? (string) $row["topic"] : "Diğer",
    "text" => isset($row["text"]) ? (string) $row["text"] : "",
    "meta" => $meta,
    "reply" => $reply,
    "reply_meta" => $replyMeta
  );
}

function stories_find_index($list, $id) {
  foreach ($list as $i => $row) {
    if (isset($row["id"]) && (string) $row["id"] === (string) $id) {
      return $i;
    }
  }
  return -1;
}

function stories_json($http, $payload) {
  http_response_code($http);
  header("Content-Type: application/json; charset=utf-8");
  header("Cache-Control: no-store");
  header("X-Content-Type-Options: nosniff");
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}
