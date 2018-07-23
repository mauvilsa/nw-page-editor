/**
 * NW.js app functionality for nw-page-editor.
 *
 * @version $Version: 2018.07.23$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

/*jshint esversion: 6 */ 

// @todo Displace new windows so that they do not appear on top of the first
// @todo When undo/redo returns to saved state, disable save button

$(window).on('load', function () {

  var
  win = nw.Window.get(),
  pageCanvas = window.pageCanvas;

  if ( typeof localStorage.relativeFontSize === 'undefined' )
    localStorage.relativeFontSize = 1;

  /// Additional pageCanvas configuration ///
  pageCanvas.setConfig(
    { importSvgXsltHref: '../xslt/page2svg.xslt',
      exportSvgXsltHref: [ '../xslt/svg2page.xslt', '../xslt/sortattr.xslt' ],
      relativeFontSize: localStorage.relativeFontSize,
      onFontChange: function (s) { localStorage.relativeFontSize = s; },
      onLoad: finishFileLoad,
      onUnload: function () { $('#saveFile').prop('disabled',true); },
      onFirstChange: function () { $('#saveFile').prop('disabled',false); $('title').text($('title').text()+' *'); }
    } );

  var
  xmlExt = 'xml',
  reExt = new RegExp('\\.'+xmlExt+'$','i');

  /// Keyboard bindings ///
  Mousetrap.bind( process.platform === "darwin" ? 'mod+option+i' : 'ctrl+shift+i', function () { win.showDevTools(); return false; } );
  Mousetrap.bind( 'mod+o', function () { $('#openFile').click(); return false; } );
  Mousetrap.bind( 'mod+s', function () { saveFile(); return false; } );
  Mousetrap.bind( 'mod+shift+s', function () { $('#saveFileAs').click(); return false; } );
  Mousetrap.bind( 'mod+p', function () { return printCanvas(); } );
  Mousetrap.bind( ['mod+q','mod+w'], saveSafeClose );
  Mousetrap.bind( 'mod+n', newWindow );
  Mousetrap.bind( ['pagedown','shift+pagedown'], function ( event ) { return changePage( event.shiftKey ? 10 : 1 ); } );
  Mousetrap.bind( ['pageup','shift+pageup'], function ( event ) { return changePage( event.shiftKey ? -10 : -1 ); } );
  Mousetrap.bind( 'mod+shift+r', function () {
      if ( typeof pageCanvas !== 'undefined' && pageCanvas.hasChanged() )
        if ( confirm('WARNING: Modifications will be lost on reload! Select Cancel to abort.') )
          loadFile();
      return false;
    } );
  Mousetrap.bind( 'mod+option+r', function () { win.reloadIgnoringCache(); } );

  Mousetrap.bind( 'alt+z', function () {
      var ver = pageCanvas.getVersion();
      ver.node = process.versions.node;
      ver.chromium = process.versions.chromium;
      ver.nw = process.versions.nw;
      console.log(ver);
    } );

  /// Multiple windows support ///
  if ( typeof global.pageNum === 'undefined' )
    global.pageNum = parseInt(window.location.hash.substr(1));
  function newWindow() {
    var b = win.appWindow.getBounds();
    global.pageNum++;
    nw.Window.open('../html/index.html#'+global.pageNum,{"width":b.width,"height":b.height});
    return false;
  }

  /// Confirm that changes will be saved on exit ///
  function saveSafeClose( event ) {
    saveWindowState();

    if ( typeof event === 'undefined' || event === 'quit' ) {
      //require('fs').writeFileSync( '/tmp/NW-PAGE-EDITOR', 'called saveSafeClose '+(new Date()).toISOString()+"\n", {flag:'a'} );
      // @todo Figure out how to ask if save one close
      saveFile();
    }

    else if ( typeof pageCanvas !== 'undefined' && pageCanvas.hasChanged() )
      if ( autosave ||
           confirm('WARNING: Modifications will be saved on exit! Select Cancel to discard them.') )
        saveFile();

    global.pageWindows[parseInt(window.location.hash.substr(1))-1] = false;
    win.close(true);

    return false;
  }
  win.on( 'close', saveSafeClose );
  $('#quit').click( saveSafeClose );

  /// Automatic save ///
  var autosave = false;
  $('#autoSave input').change( function () {
      autosave =
        $('#autoSave input').prop('checked') ? true : false ;
    } );
  setInterval( function () { 
      if ( autosave && pageCanvas.hasChanged() ) {
        console.log('automatic saving ...');
        saveFile();
      }
    }, 15000 );

  /// Setup document printing ///
  function printCanvas() {
    win.print({autoprint:false, headerFooterEnabled:false, marginsType:1});
    return false;
  }
  $('#print').click(printCanvas);

  /// Setup document navigation ///
  $('#pageNum').keyup( function ( event ) { if ( event.keyCode == 13 ) { $(event.target).blur(); changePage(0); } } );
  $('#prevPage').click( function ( event ) { changePage( event.shiftKey ? -10 : -1 ); } );
  $('#nextPage').click( function ( event ) { changePage( event.shiftKey ? 10 : 1 ); } );
  var prevNum = 0;
  function changePage( offset ) {
    if ( loadingFile || savingFile ) {
      console.log('currently loading or saving file, preventing document change');
      return false;
    }
    var fileNum = parseInt($('#pageNum').val()) + offset;
    if ( isNaN(fileNum) || fileNum < 1 || fileNum > fileList.length )
      fileNum = prevNum === 0 ? 1 : prevNum;
    $('#pageNum').val(fileNum);
    if ( fileNum === prevNum )
      return false;
    if ( pageCanvas.hasChanged() )
      if ( autosave ||
           confirm('WARNING: Modifications will be saved on document change! Select Cancel to discard them.') )
        saveFile();
    loadFile();
    return false;
  }

  function getImageSize( file ) {
    var size;
    try {
      size = require('image-size')(file);
    } catch ( e ) {
      return;
    }
    return size;
  }

  var
  fs = require('fs'),
  iswin = process.platform.substr(0,3) === 'win',
  osBar = ( iswin ? '\\' : '/' ),
  home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
  cwd = home,
  badfiles = [],
  fileList,
  loadedFile = null,
  savingFile = false,
  loadingFile = false,
  prevFileContents = null;

  function getFilePath( file, wd ) {
    wd = typeof wd === 'undefined' ? cwd : getFilePath(wd);
    if ( ( iswin && ! /^[a-zA-Z]:\\\\/.test(file) ) ||
         ( ! iswin && file[0] != '/' ) )
      file = wd+osBar+file;
    return file;
  }

  function fileExists( file ) {
    filepath = getFilePath(file);
    if ( fs.existsSync(filepath) )
      return true;
    badfiles.push(file);
    return false;
  }

  /// Parse arguments and load file ///
  function parseArgs( argv, loaddir ) {
    argv = argv.filter(v => v!=='');
    if ( argv.length === 0 )
      return false;
    argv = argv.map(v => v.replace(/^\+\+/,'--'));

    var
    fileNum = 1,
    files = [];
    badfiles = [];

    function filterReExt(f) { return reExt.test(f); }
    function mapGetFilePath(f) { return getFilePath(f); }
    function wdMapGetFilePath(f) { return getFilePath(f,this); }

    for ( var n=0; n<argv.length; n++ ) {
      switch ( argv[n] ) {
        case '--wd':
          if ( fileExists(argv[++n]) )
            cwd = argv[n];
          break;
        case '--js':
          if ( fileExists(argv[++n]) )
            $.getScript('file://'+getFilePath(argv[n]));
          break;
        case '--css':
          if ( fileExists(argv[++n]) )
            $('head').append('<link type="text/css" rel="stylesheet" href="file://'+getFilePath(argv[n])+'"/>');
          break;
        case '--list':
          if ( fileExists(argv[++n]) )
            try {
              files = files.concat(fs.readFileSync(getFilePath(argv[n])).toString().trim().split("\n").map(mapGetFilePath));
            }
            catch ( e ) {
              badfiles.push(argv[n]);
            }
          break;
        default:
          if ( fileExists(argv[n]) ) {
            var
            file = getFilePath(argv[n]).replace(/\/$/,''),
            fstat = fs.statSync(file);
            if ( fstat.isFile() )
              files.push(file);
            else if ( fstat.isDirectory() )
              files = files.concat(fs.readdirSync(file).filter(filterReExt).map(wdMapGetFilePath,file));
            else
              badfiles.push(argv[n]);
          }
          break;
      }
    }

    if ( badfiles.length > 0 )
      pageCanvas.warning( 'File(s) not found: '+badfiles );
    else if ( files.length === 0 ) {
      pageCanvas.warning( 'Expected at least one file to load' );
      return false;
    }

    if ( loaddir && files.length === 1 ) {
      var
      file0 = files[0],
      basedir = file0.replace(/[/\\][^/\\]+$/,'');
      files = fs.readdirSync(basedir).filter(f => reExt.test(f)).map(mapGetFilePath);
      fileNum = files.indexOf(file0)+1;
    }

    fileList = files;
    prevNum = 0;
    $('#pageNum').val(fileNum);
    $('#totPages').text(fileList.length);
    $('#prevPage, #pageNum, #nextPage').prop( 'disabled', fileList.length > 1 ? false : true );

    return loadFile();
  }

  /// Function for preparing new title for app ///
  function appTitle( filepath ) {
    var
    maxlength = 80,
    prevtitle = '',
    title = filepath.replace( new RegExp('^'+home+osBar), '~'+osBar );
    while ( title.includes(osBar) && title.length > maxlength && prevtitle != title ) {
      prevtitle = title;
      title = title.replace( new RegExp('^[^'+osBar+']+'+osBar), '...'+osBar );
    }
    return nw.App.manifest.window.title + ' - ' + title;
  }

  /// Function for loading the selected file into the page canvas ///
  function loadFile() {
    if ( loadingFile || savingFile )
      return false;

    var fileNum = parseInt($('#pageNum').val());
    if ( isNaN(fileNum) || fileNum <= 0 || fileNum > fileList.length )
      return false;

    loadingFile = true;
    $('#spinner').addClass('spinner-active');

    var
    filepath = fileList[fileNum-1],
    newtitle = appTitle(filepath);

    /// If not xml try load image and create xml ///
    // @todo Proper check that file is page xml, not just by extension
    if ( ! reExt.test(filepath) ) {
      var fxml = filepath.replace(/\.[^.]+$/,'.'+xmlExt);

      if ( ! fileExists(fxml) ) {
        var size = getImageSize(filepath);
        if ( ! size ) {
          pageCanvas.warning( 'File apparently not a Page XML or an image: '+filepath );
          finishFileLoad();
          return false;
        }
        if ( ! confirm('A new Page XML file will be created for image '+filepath) ) {
          finishFileLoad();
          return false;
        }

        fs.writeFileSync( fxml, pageCanvas.newXmlPage( 'nw-page-editor', filepath, size.width, size.height ) );
      }

      filepath = fxml;
      fileList[fileNum-1] = filepath;
    }

    require('fs').readFile( filepath, 'utf8', function ( err, data ) {
        if ( err ) {
          finishFileLoad();
          return pageCanvas.cfg.handleError( err );
        }
        prevFileContents = data;
        window.loadedFile = loadedFile = filepath;
        prevNum = fileNum;
        pageCanvas.loadXmlPage( data, 'file://'+filepath );
        $('title').text(newtitle);
      } );

    return true;
  }

  function finishFileLoad() {
    loadingFile = false;
    $('#spinner').removeClass('spinner-active');
  }

  /// Function to handle open file dialog ///
  function chooseFile( name, callback ) {
    var chooser = $(name);
    chooser.unbind('change');
    chooser.change( function ( event ) { callback($(this).val()); } );
    chooser.trigger('click');
  }

  /// Button to open file ///
  $('#openFile').click( function () {
      var fileNum = parseInt($('#pageNum').val());
      if ( fileNum > 0 )
        $('#openFileDialog').attr('nwworkingdir',fileList[fileNum-1].replace(/[^/]+$/,''));

      chooseFile( '#openFileDialog', function(files) {
          parseArgs( files.split(';'), true );
        } );
    } );

  /// Open file if provided as argument ///
  if ( nw.App.argv.length > 0 && window.location.hash === '#1' ) {
    global.pageWindows = [ true ];
    if ( parseArgs(nw.App.argv) )
      window.setTimeout( function () {
          if ( typeof pageCanvas.fitPage !== 'undefined' )
            pageCanvas.fitPage();
        }, 300 );
  }
  else
    global.pageWindows.push(true);

  if ( typeof global.argv !== 'undefined' ) {
    if ( parseArgs(global.argv) )
      window.setTimeout( function () { pageCanvas.fitPage(); }, 300 );
    delete global.argv;
  }

  /// Open new window if app already running ///
  nw.App.on( 'open', function ( argv ) {
//console.log('argv: '+argv);
      var n;
      for ( n = global.pageWindows.length-1; n>=0; n-- )
        if ( global.pageWindows[n] )
          break;
      if ( n != parseInt(window.location.hash.substr(1))-1 )
        return;
      global.argv = argv.replace(/.*nw-page-editor /,'').split(' ');
      newWindow();
    } );

  /// Button to save file ///
  $('#saveFile').click( saveFile );
  function saveFile() {
    if ( loadingFile || savingFile )
      return false;
    if ( ! pageCanvas.hasChanged() )
      return false;

    savingFile = true;
    $('#spinner').addClass('spinner-active');

    var fs = require('fs');

    if ( prevFileContents )
      fs.writeFile( loadedFile+'~', prevFileContents, function ( err ) {
          if ( err )
            pageCanvas.cfg.handleError( err );
          prevFileContents = null;
        } );

    var pageXml = pageCanvas.getXmlPage();
    fs.writeFile( loadedFile, pageXml, function ( err ) {
        savingFile = false;
        $('#spinner').removeClass('spinner-active');
        if ( err )
          pageCanvas.cfg.handleError( err );
        else {
          $('#saveFile').prop('disabled',true);
          $('title').text($('title').text().replace(/ \*$/,''));
          pageCanvas.setUnchanged();
        }
      } );
  }

  /// Button to save file as ///
  $('#saveFileAs').click( function () {
      if ( loadingFile || savingFile )
        return false;

      var
      fileNum = parseInt($('#pageNum').val()),
      workingdir = fileNum > 0 ? fileList[fileNum-1].replace(/[^/]+$/,'') : '';
      if ( fileNum === 0 )
        return;

      $('#saveFileAsDialog')
        .attr('nwsaveas',fileList[fileNum-1].replace(/.*\//,''))
        .attr('nwworkingdir',workingdir);

      chooseFile( "#saveFileAsDialog", function(filepath) {
          if ( workingdir != filepath.replace(/[^/]+$/,'') )
            return alert( 'Currently it is only allowed to save in the same directory as the original file. Save aborted.' );
          if ( ! reExt.test(filepath) )
            filepath += '.'+xmlExt;
          fileList[fileNum-1] = loadedFile = filepath;
          prevFileContents = null;
          pageCanvas.setChanged();
          saveFile();
          $('title').text( appTitle(filepath) );
        } );
    } );

  /// Check for new version on app start at most every 8 days ///
  function checkForUpdates() {
    var
    checkDays = 8,
    nowDate = new Date(),
    versionCheck = {};

    if ( typeof localStorage.versionCheck !== 'undefined' ) {
      versionCheck = JSON.parse(localStorage.versionCheck);
      lastDate = new Date(Date.parse(versionCheck.lastDate));
      if ( (nowDate-lastDate)/(1000*3600*24) < checkDays )
        return;
    }

    $.ajax({ url: 'https://raw.githubusercontent.com/mauvilsa/nw-page-editor/master/package.json', dataType: 'json' })
      .fail( function () {
          console.log('Failed to check the latest version of nw-page-editor in github.');
        } )
      .done( function ( data ) {
          versionCheck.lastDate = new Date();
          if ( versionCheck.lastVersion < data.version && data.version > nw.App.manifest.version ) {
            versionCheck.lastVersion = data.version;
            alert( 'There is a new version of nw-page-editor available. The github master branch version is '+data.version+' and your running version is '+nw.App.manifest.version+'.' );
          }
          versionCheck.lastVersion = data.version;
          localStorage.versionCheck = JSON.stringify(versionCheck);
        } );
  }
  checkForUpdates();

} );
