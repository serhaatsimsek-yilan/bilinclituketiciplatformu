<?php
require_once __DIR__ . "/lib/env.php";
require_once __DIR__ . "/lib/rate-limit.php";
require_once __DIR__ . "/lib/stories-store.php";
require_once __DIR__ . "/lib/formspree.php";

flight_load_env();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  stories_json(405, array("ok" => false, "message" => "Yalnızca POST kabul edilir."));
}

if (!flight_rate_limit_ok("story:" . flight_client_ip(), 6, 3600)) {
  stories_json(429, array("ok" => false, "message" => "Çok fazla gönderim yaptınız. Lütfen sonra tekrar deneyin."));
}

$honeypot = isset($_POST["website"]) ? trim((string) $_POST["website"]) : "";
if ($honeypot !== "") {
  stories_json(200, array("ok" => true));
}

$kvkk = isset($_POST["kvkk"]) ? (string) $_POST["kvkk"] : "";
if ($kvkk === "" || $kvkk === "false" || $kvkk === "0") {
  stories_json(400, array("ok" => false, "message" => "Yayın ve KVKK onayını işaretleyin."));
}

$name = stories_clean(isset($_POST["ad"]) ? $_POST["ad"] : "", 80);
$topic = stories_clean(isset($_POST["konu"]) ? $_POST["konu"] : "", 40);
$city = stories_clean(isset($_POST["sehir"]) ? $_POST["sehir"] : "", 60);
$text = stories_clean(isset($_POST["deneyim"]) ? $_POST["deneyim"] : "", 1200, true);
$email = stories_clean(isset($_POST["email"]) ? $_POST["email"] : "", 120);

if ($name === "") {
  $name = "Anonim";
}
if (!in_array($topic, stories_topics(), true)) {
  stories_json(400, array("ok" => false, "message" => "Geçerli bir konu seçin."));
}
$len = function_exists("mb_strlen") ? mb_strlen($text) : strlen($text);
if ($len < 20) {
  stories_json(400, array("ok" => false, "message" => "Lütfen yaşadığınız sorunu biraz daha ayrıntılı yazın."));
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  stories_json(400, array("ok" => false, "message" => "Geçerli bir e-posta girin."));
}

$pending = stories_read_list(stories_pending_path());
if (count($pending) >= 250) {
  stories_json(503, array("ok" => false, "message" => "Şu an yeni yorum alınamıyor. Lütfen daha sonra deneyin."));
}

$item = array(
  "id" => bin2hex(random_bytes(8)),
  "name" => $name,
  "topic" => $topic,
  "city" => $city,
  "text" => $text,
  "email" => $email,
  "created_at" => time()
);
array_unshift($pending, $item);
if (!stories_write_list(stories_pending_path(), $pending)) {
  stories_json(500, array("ok" => false, "message" => "Yorum kaydedilemedi. Lütfen tekrar deneyin."));
}

formspree_send(array(
  "kaynak" => "bilinclituketiciplatformu-deneyim",
  "_subject" => "BTP yeni yorum onay bekliyor",
  "ad" => $name,
  "konu" => $topic,
  "sehir" => $city,
  "deneyim" => $text,
  "email" => $email,
  "onay" => "https://bilinclituketiciplatformu.com/admin/yorumlar.html"
));

stories_json(200, array("ok" => true));
