<!DOCTYPE html>
<!--
  - Main PHP file of nw-page-editor web edition.
  -
  - @version $Version: 2017.09.24$
  - @author Mauricio Villegas <mauricio_ville@yahoo.com>
  - @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
  - @license MIT License
  -->

<?php
require_once('common.inc.php');

header('Cache-Control: no-store, must-revalidate');

/// Check that document is specified and exists ///
if ( ! isset($_GET['f']) ) {
  echo 'error: no xml or directory specified';
  exit;
}
if ( ! file_exists('../data/'.$_GET['f']) ) {
  echo 'error: xml or directory not found';
  exit;
}

/// Create list of files ///
if ( is_dir('../data/'.$_GET['f']) ) {
  $thelist = glob('../data/'.$_GET['f'].'/*.xml');
  array_walk( $thelist, function ( &$item ) { $item = "'".$item."'"; } );
}
elseif ( is_file('../data/'.$_GET['f']) && preg_match('/\.lst$/',$_GET['f']) ) {
  $thelist = explode("\n",trim(file_get_contents('../data/'.$_GET['f'])));
  array_walk( $thelist, function ( &$item ) { $item = "'../data/".$item."'"; } );
}
elseif ( is_file('../data/'.$_GET['f']) && preg_match('/\.xml$/',$_GET['f']) ) {
  $thelist = array("'../data/".$_GET['f']."'");
}
else {
  echo 'error: unexpected file type';
  exit;
}

/// Export variables to javascript ///
$script = "<script>\n";
$script .= "var page_editor_version='nw-page-editor_v$version';\n";
$script .= "var uname = '".$uname."';\n";
$script .= "var brhash = '".$_COOKIE['PHP_AUTH_BR']."';\n";
$script .= "var list_xmls = [ ".implode(', ',$thelist)." ];\n";
$script .= "</script>\n";
?>

<html>
<head>
  <meta charset="UTF-8"/>
  <title>nw-page-editor v<?=$version?> - <?=$uname?></title>
  <link rel="icon" href="data:;base64,iVBORw0KGgo="/>
  <link type="text/css" rel="stylesheet" id="page_styles" href="../css/page-editor.css<?=$v?>"/>
  <script type="text/javascript" src="../js/jquery-3.2.1.min.js"></script>
  <script type="text/javascript" src="../js/jquery.stylesheet-0.3.7.min.js"></script>
  <script type="text/javascript" src="../js/interact-1.2.9.min.js"></script>
  <script type="text/javascript" src="../js/mousetrap-1.6.0.min.js"></script>
  <script type="text/javascript" src="../js/tiff-2016-11-01.min.js"></script>
  <script type="text/javascript" src="../js/pdfjs-1.8.579.min.js"></script>
  <script type="text/javascript" src="../js/svg-canvas.js<?=$v?>"></script>
  <script type="text/javascript" src="../js/page-canvas.js<?=$v?>"></script>
  <script type="text/javascript" src="../js/page-editor.js<?=$v?>"></script>
  <?=$script?>
  <script type="text/javascript" src="../js/web-app.js<?=$v?>"></script>
</head>
<body>
  <div id="container">
    <div id="statusBar">
      <button id="prevPage" disabled="" class="tooltip-down" data-tooltip="previous page">&lt;</button>
      <div id="pageNumWrap">
        <input type="text" id="pageNum" class="mousetrap" value="0" disabled=""/>/<span id="totPages">0</span>
      </div>
      <button id="nextPage" disabled="" class="tooltip-down" data-tooltip="next page">&gt;</button>
      <div id="textFilter" style="display:none;">
        <b class="tooltip-down" data-tooltip="select only elements containing this text">Filter:</b>
        <input name="filter" type="text" placeholder="text filter" class="mousetrap"/>
        <button id="clearFilter">X</button>
      </div>
      <div id="stateInfo">
        <!--<b>Base:</b> <span id="imageBase">-</span>-->
        <b>Selected (<span id="modeElement">-</span>):</b> <span id="selectedType">-</span> <span id="selectedId">-</span>
      </div>
      <button id="drawerButton" class="menu-toggle c-hamburger c-hamburger--htx">
        <span>toggle menu</span>
      </button>
    </div>
    <div id="xpg" class="page_container"></div>
    <textarea id="textedit" class="mousetrap" placeholder="Text edit box" disabled=""></textarea>
    <div id="textinfo"></div>
  </div>

  <div id="cursor" class="cursor-right">
    <span id="cursorX">-</span>,<span id="cursorY">-</span>
  </div>

  <div id="drawer">
    <fieldset id="generalFieldset">
      <button id="saveFile" disabled="">Save</button>
      <span>User: <?php echo $uname; if ( isset($_COOKIE['PHP_AUTH_USER']) ) echo ' | <a href="logout.php">logout</a>';?></span>
      <!--<button id="help">Help</button>-->
      <label id="autoSave"><input class="mousetrap" type="checkbox"/> Auto-save</label>
      <label id="centerSelected"><input class="mousetrap" type="checkbox"/> Center on selection</label>
      <label id="xmlTextValidate"><input class="mousetrap" type="checkbox"/> Validate text as XML</label>
    </fieldset>
    <fieldset id="editModesFieldset">
      <legend>Edit modes</legend>
      <label id="textMode"><input class="mousetrap" type="checkbox" checked=""/> Text editable</label>
      <label id="rectMode"><input class="mousetrap" type="checkbox" checked=""/> Restrict to rectangle</label>
      <label id="twoPointBase"><input class="mousetrap" type="checkbox"/> Single segment baselines</label>
      <div class="radio-set">
        <label id="selMode"><input class="mousetrap" type="radio" name="mode2" value="select" checked=""/> Select</label>
        <label id="baseMode"><input class="mousetrap" type="radio" name="mode2" value="baseline"/> Baseline</label>
        <label id="coorMode"><input class="mousetrap" type="radio" name="mode2" value="coords"/> Coords</label>
        <label id="dragMode"><input class="mousetrap" type="radio" name="mode2" value="drag"/> Drag</label>
        <label id="createMode"><input class="mousetrap" type="radio" name="mode2" value="create"/> Create</label>
      </div>
      <div class="radio-set">
        <label id="regMode"><input class="mousetrap" type="radio" name="mode1" value="region"/> Region</label>
        <label id="lineMode"><input class="mousetrap" type="radio" name="mode1" value="line" checked=""/> Line</label>
        <label id="wordMode"><input class="mousetrap" type="radio" name="mode1" value="word"/> Word</label>
        <label id="glyphMode"><input class="mousetrap" type="radio" name="mode1" value="glyph"/> Glyph</label>
        <label id="tabMode"><input class="mousetrap" type="radio" name="mode1" value="table"/> Table</label>
      </div>
    </fieldset>
    <fieldset id="newPropsFieldset">
      <legend>Properties (for new elements)</legend>
      <div>
        Read direction:
        <label id="read-ltr"><input class="mousetrap" type="radio" name="read-dir" value="ltr" checked=""/> →</label>
        <label id="read-rtl"><input class="mousetrap" type="radio" name="read-dir" value="rtl"/> ←</label>
        <label id="read-ttb"><input class="mousetrap" type="radio" name="read-dir" value="ttb"/> ↓</label>
      </div>
      <div>
        Text orientation:
        <label id="orient-u"><input class="mousetrap" type="radio" name="line-orient" value="0" checked=""/> 0°</label>
        <label id="orient-l"><input class="mousetrap" type="radio" name="line-orient" value="-90"/> -90°</label>
        <label id="orient-r"><input class="mousetrap" type="radio" name="line-orient" value="90"/> 90°</label>
        <label id="orient-d"><input class="mousetrap" type="radio" name="line-orient" value="180"/> 180°</label>
      </div>
      <div>
        Table size:
        <label id="table-rows"><input class="mousetrap" type="text" name="table-rows" value="3"/> rows</label>
        <label id="table-cols"><input class="mousetrap" type="text" name="table-cols" value="3"/> columns</label>
      </div>
    </fieldset>
    <fieldset id="visibilityFieldset">
      <legend>Visibility</legend>
      <label id="hide-text-edit"><input class="mousetrap" type="checkbox" checked=""/> Text edit box</label>
      <label id="hide-img"><input class="mousetrap" type="checkbox" checked=""/> Image</label>
      <label id="hide-prop-tag"><input class="mousetrap" type="checkbox" checked=""/> Property tag</label>
      <div class="visibility-set">
        Region:
        <label id="hide-text-reg"><input class="mousetrap" type="checkbox"/> text</label>
        <label id="hide-poly-reg"><input class="mousetrap" type="checkbox"/> polygons</label>
      </div>
      <div class="visibility-set">
        Line:
        <label id="hide-text-line"><input class="mousetrap" type="checkbox"/> text</label>
        <label id="hide-poly-line"><input class="mousetrap" type="checkbox"/> polygons</label>
        <label id="hide-baselines"><input class="mousetrap" type="checkbox" checked=""/> baselines</label>
      </div>
      <div class="visibility-set">
        Word:
        <label id="hide-text-word"><input class="mousetrap" type="checkbox"/> text</label>
        <label id="hide-poly-word"><input class="mousetrap" type="checkbox"/> polygons</label>
      </div>
      <div class="visibility-set">
        Glyph:
        <label id="hide-text-glyph"><input class="mousetrap" type="checkbox"/> text</label>
        <label id="hide-poly-glyph"><input class="mousetrap" type="checkbox"/> polygons</label>
      </div>
    </fieldset>
  </div>
  <div id="prop-modal" class="modal">
    <div class="modal-content">
      <span class="close">&#215;</span>
      <h3>Properties for <span id="props-target"/></h3>
      <div id="props"/>
    </div>
  </div>
</body>
</html>
