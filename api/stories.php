<?php
require_once __DIR__ . "/lib/env.php";
require_once __DIR__ . "/lib/stories-store.php";

flight_load_env();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  stories_json(405, array("ok" => false, "message" => "Yalnızca GET kabul edilir."));
}

$published = stories_read_list(stories_published_path());
$out = array();
foreach ($published as $row) {
  $item = stories_public_item($row);
  if ($item["text"] !== "") {
    $out[] = $item;
  }
}

stories_json(200, array("ok" => true, "stories" => $out));
