<?php
require_once __DIR__ . "/lib/env.php";
require_once __DIR__ . "/lib/rate-limit.php";
require_once __DIR__ . "/lib/stories-store.php";

flight_load_env();

session_name("btp_stories_admin");
if (PHP_VERSION_ID >= 70300) {
  session_set_cookie_params(array(
    "lifetime" => 0,
    "path" => "/",
    "httponly" => true,
    "samesite" => "Lax"
  ));
} else {
  session_set_cookie_params(0, "/");
}
session_start();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function stories_admin_body() {
  $ctype = isset($_SERVER["CONTENT_TYPE"]) ? strtolower((string) $_SERVER["CONTENT_TYPE"]) : "";
  if (strpos($ctype, "application/json") !== false) {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    return is_array($body) ? $body : array();
  }
  return $_POST;
}

function stories_admin_authed() {
  return !empty($_SESSION["stories_admin"]);
}

$action = isset($_GET["action"]) ? (string) $_GET["action"] : "";
$body = array();
if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $body = stories_admin_body();
  if ($action === "" && isset($body["action"])) {
    $action = (string) $body["action"];
  }
}

if ($action === "status" || ($action === "" && $_SERVER["REQUEST_METHOD"] === "GET")) {
  $password = stories_admin_password();
  stories_json(200, array(
    "ok" => true,
    "configured" => $password !== "",
    "authed" => stories_admin_authed()
  ));
}

if ($action === "login") {
  if (!flight_rate_limit_ok("stories-admin-login:" . flight_client_ip(), 8, 900)) {
    stories_json(429, array("ok" => false, "message" => "Çok fazla deneme. Lütfen sonra tekrar deneyin."));
  }
  $password = stories_admin_password();
  if ($password === "") {
    stories_json(503, array("ok" => false, "message" => "Onay şifresi tanımlı değil. api/lib/local-config.php içinde STORIES_ADMIN_PASSWORD yazın."));
  }
  $given = isset($body["password"]) ? (string) $body["password"] : "";
  if (!hash_equals($password, $given)) {
    stories_json(401, array("ok" => false, "message" => "Şifre yanlış."));
  }
  $_SESSION["stories_admin"] = true;
  stories_json(200, array("ok" => true, "authed" => true));
}

if ($action === "logout") {
  $_SESSION = array();
  if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), "", time() - 42000, $params["path"]);
  }
  session_destroy();
  stories_json(200, array("ok" => true, "authed" => false));
}

if (!stories_admin_authed()) {
  stories_json(401, array("ok" => false, "message" => "Giriş yapın."));
}

if ($action === "list") {
  $pending = stories_read_list(stories_pending_path());
  $published = stories_sort_published(stories_read_list(stories_published_path()));
  $pendingOut = array();
  foreach ($pending as $row) {
    $pendingOut[] = array(
      "id" => isset($row["id"]) ? (string) $row["id"] : "",
      "name" => isset($row["name"]) ? (string) $row["name"] : "",
      "topic" => isset($row["topic"]) ? (string) $row["topic"] : "",
      "city" => isset($row["city"]) ? (string) $row["city"] : "",
      "text" => isset($row["text"]) ? (string) $row["text"] : "",
      "email" => isset($row["email"]) ? (string) $row["email"] : "",
      "created_label" => isset($row["created_at"]) ? stories_month_label((int) $row["created_at"]) : ""
    );
  }
  $publishedOut = array();
  foreach ($published as $row) {
    $publishedOut[] = stories_public_item($row);
  }
  stories_json(200, array(
    "ok" => true,
    "pending" => $pendingOut,
    "published" => $publishedOut
  ));
}

if ($action === "approve") {
  $id = isset($body["id"]) ? (string) $body["id"] : "";
  $pending = stories_read_list(stories_pending_path());
  $idx = stories_find_index($pending, $id);
  if ($idx < 0) {
    stories_json(404, array("ok" => false, "message" => "Yorum bulunamadı."));
  }
  $row = $pending[$idx];
  array_splice($pending, $idx, 1);
  $published = stories_sort_published(stories_read_list(stories_published_path()));
  array_unshift($published, array(
    "id" => $row["id"],
    "name" => $row["name"],
    "topic" => $row["topic"],
    "topic_label" => isset($row["topic_label"]) ? $row["topic_label"] : $row["topic"],
    "city" => isset($row["city"]) ? $row["city"] : "",
    "text" => $row["text"],
    "published_at" => time()
  ));
  if (count($published) > 200) {
    $published = array_slice($published, 0, 200);
  }
  if (!stories_write_list(stories_pending_path(), $pending) || !stories_write_list(stories_published_path(), $published)) {
    stories_json(500, array("ok" => false, "message" => "Onay kaydedilemedi."));
  }
  stories_json(200, array("ok" => true));
}

if ($action === "reject") {
  $id = isset($body["id"]) ? (string) $body["id"] : "";
  $pending = stories_read_list(stories_pending_path());
  $idx = stories_find_index($pending, $id);
  if ($idx < 0) {
    stories_json(404, array("ok" => false, "message" => "Yorum bulunamadı."));
  }
  array_splice($pending, $idx, 1);
  if (!stories_write_list(stories_pending_path(), $pending)) {
    stories_json(500, array("ok" => false, "message" => "Silinemedi."));
  }
  stories_json(200, array("ok" => true));
}

if ($action === "unpublish") {
  $id = isset($body["id"]) ? (string) $body["id"] : "";
  $published = stories_sort_published(stories_read_list(stories_published_path()));
  $idx = stories_find_index($published, $id);
  if ($idx < 0) {
    stories_json(404, array("ok" => false, "message" => "Yayındaki yorum bulunamadı."));
  }
  array_splice($published, $idx, 1);
  if (!stories_write_list(stories_published_path(), $published)) {
    stories_json(500, array("ok" => false, "message" => "Yayından alınamadı."));
  }
  stories_json(200, array("ok" => true));
}

if ($action === "reply") {
  $id = isset($body["id"]) ? (string) $body["id"] : "";
  $reply = stories_clean(isset($body["reply"]) ? $body["reply"] : "", 2000, true);
  $published = stories_sort_published(stories_read_list(stories_published_path()));
  $idx = stories_find_index($published, $id);
  if ($idx < 0) {
    stories_json(404, array("ok" => false, "message" => "Yayındaki yorum bulunamadı."));
  }
  if ($reply === "") {
    unset($published[$idx]["reply"], $published[$idx]["reply_at"]);
  } else {
    $published[$idx]["reply"] = $reply;
    $published[$idx]["reply_at"] = time();
  }
  if (!stories_write_list(stories_published_path(), $published)) {
    stories_json(500, array("ok" => false, "message" => "Yanıt kaydedilemedi."));
  }
  stories_json(200, array("ok" => true));
}

stories_json(400, array("ok" => false, "message" => "Geçersiz işlem."));
