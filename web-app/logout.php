<?php
/**
 * Logs out of htpasswd authentication.
 *
 * @version $Version: 2017.09.24$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2017-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

require_once('htpasswd.inc.php');
logout_htpasswd();
header('Cache-Control: no-store, must-revalidate');

// @todo In Firefox and Safari the 401 does not invalidate current credentials
?>
<html>
  <head>
    <title>Logged out.</title>
  </head>
  <body>
    You have successfully logged out. If you go back to the previous page,
    your browser cache might log you in again. To avoid this you should close
    the browser.
  </body>
</html>
