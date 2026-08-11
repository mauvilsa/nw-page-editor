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

if ( ! isset($_REQUEST['f']) || empty($_REQUEST['f']) ) {
  http_response_code(400);
  exit;
}

/// Serve only files below a server-configured base directory. The base is NOT
/// taken from the request: a client-controlled base makes the containment
/// check below trivially bypassable (see CWE-22 / CWE-552). ///
$base = realpath('/var/www/nw-page-editor');
$file = realpath($base.'/'.$_REQUEST['f']);

if ( $base === false || $file === false || ! is_file($file) ||
     strpos($file, $base.'/') !== 0 ) {
  http_response_code(404);
  exit;
}

header('Content-Type: '.mime_content_type($file));
header('Content-Length: '.filesize($file));
readfile($file);
