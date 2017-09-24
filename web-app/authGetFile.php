<?php
/**
 * Returns the referenced file if properly authenticated.
 *
 * @version $Version: 2017.09.24$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2017-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

require_once('common.inc.php');

if ( ! isset($_REQUEST['f']) || empty($_REQUEST['f']) ||
     ! isset($_REQUEST['b']) || empty($_REQUEST['b']) ) {
  http_response_code(400);
  exit;
}

$file = realpath($_REQUEST['b'].'/'.$_REQUEST['f']);

if ( ! is_file($file) || substr($file,0,strlen($_REQUEST['b'])) !== $_REQUEST['b'] ) {
  http_response_code(404);
  exit;
}

header('Content-Type: '.mime_content_type($file));
header('Content-Length: '.filesize($file));
readfile($file);
