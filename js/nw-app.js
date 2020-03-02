/**
 * NW.js app functionality for nw-page-editor.
 *
 * @version $Version: 2020.03.02$
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
    { importSvgXsltHref: [ '../xslt/page2svg.xslt', '../xslt/page_from_2010-03-19.xslt', '../xslt/page_from_2017-07-15.xslt', '../xslt/page_from_omnius.xslt', '../xslt/alto_v2_to_page.xslt', '../xslt/alto_v3_to_page.xslt' ],
      exportSvgXsltHref: [ '../xslt/svg2page.xslt', '../xslt/sortattr.xslt', '../xslt/page_fix_xsd_sequence.xslt' ],
      getImageFromXMLPath: findImageFromPath,
      relativeFontSize: localStorage.relativeFontSize,
      onFontChange: function (s) { localStorage.relativeFontSize = s; },
      onLoad: finishFileLoad,
      onUnload: function () { $('#saveFile').prop('disabled',true); },
      onFirstChange: function () { $('#saveFile').prop('disabled',false); $('title').text($('title').text()+' *'); }
    } );

  var
  xmlExt = 'xml',
  imgExts = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tiff', 'tif', 'webp'],
  reExt = new RegExp('\\.'+xmlExt+'$','i');

  $('#openFileDialog').attr('accept', '.'+xmlExt+','+imgExts.map(f => '.'+f).join(','));

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

  pageCanvas.origGetVersion = pageCanvas.getVersion;
  pageCanvas.getVersion = function () {
    var ver = pageCanvas.origGetVersion();
    ver.node = process.versions.node;
    ver.chromium = process.versions.chromium;
    ver.nw = process.versions.nw;
    ver['nw-page-editor'] = nw.App.manifest.version;
    return ver;
  };

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
  var autosave = $('#autoSave input').prop('checked') ? true : false;
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
        return saveFile( loadFile );
    loadFile();
    return false;
  }

  function findImageFromPath( xml_path ) {
    var
    reImgExts = new RegExp('\\.('+imgExts.join('|')+'|pdf)$','i'),
    file_list = require('glob').sync(xml_path.replace(/^file:\/\//,'').replace(/\.xml$/i,'.*')).filter(x => x.match(reImgExts));
    return file_list.length == 0 ? null : file_list[0].replace(/.*\//, '');
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
  path = require('path'),
  iswin = process.platform.substr(0,3) === 'win',
  osBar = ( iswin ? '\\\\' : '/' ),
  home = process.env.HOME || process.env.USERPROFILE,
  cwd = home,
  badfiles = [],
  fileList,
  loadedFile = null,
  savingFile = false,
  loadingFile = false,
  prevFileContents = null;

  function getFilePath( file, wd ) {
    wd = typeof wd === 'undefined' ? cwd : getFilePath(wd);
    if ( ( iswin && ! /^[a-zA-Z]:\\/.test(file) ) ||
         ( ! iswin && file[0] != '/' ) )
      file = path.join(wd, file);
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

    for ( var n=0; n<argv.length; n++ ) {
      switch ( argv[n] ) {
        case '--disable-features=nw2':
          continue;
        case '--wd':
          if ( fileExists(argv[++n]) )
            cwd = argv[n];
          break;
        case '--js':
          if ( fileExists(argv[++n]) ) {
            $.getScript('file://'+getFilePath(argv[n]));
            if ( fileExists(argv[n].replace(/.js$/, '.css')) )
              $('head').append('<link type="text/css" rel="stylesheet" href="file://'+getFilePath(argv[n].replace(/.js$/, '.css'))+'"/>');
          }
          break;
        case '--css':
          if ( fileExists(argv[++n]) )
            $('head').append('<link type="text/css" rel="stylesheet" href="file://'+getFilePath(argv[n])+'"/>');
          break;
        case '--list':
          if ( fileExists(argv[++n]) )
            try {
              files = files.concat(fs.readFileSync(getFilePath(argv[n])).toString().trim().split("\n").map(f => getFilePath(f))); // jshint ignore:line
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
              files = files.concat(fs.readdirSync(file).filter(f => reExt.test(f)).map(f => path.join(file ,f))); // jshint ignore:line
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
      basefile0 = path.basename(file0),
      basedir = path.dirname(file0);
      files = fs.readdirSync(basedir).filter(f => reExt.test(f) || basefile0 == f).map(f => path.join(basedir, f));
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
    title = filepath.replace( new RegExp('^'+home.replace(/\\/g, '\\\\')), '~' );
    while ( title.includes(osBar) && title.length > maxlength && prevtitle != title ) {
      prevtitle = title;
      title = title.replace( new RegExp('^[^'+osBar+']+'+osBar), '...' );
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

        var creator = 'nw-page-editor v'+nw.App.manifest.version;
        fs.writeFileSync( fxml, pageCanvas.newXmlPage( creator, path.basename(filepath), size.width, size.height ) );
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
        pageCanvas.loadXmlPage( data, 'file://'+filepath, function (m) { finishFileLoad(); pageCanvas.closeDocument(); pageCanvas.warning('Problems loading file '+filepath+'\n\n'+m); } );
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
  else if ( iswin )
    global.pageWindows = [ true ];
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

  /// Open file(s) when dragged to window ///
  window.ondragover = function(e) { e.preventDefault(); return false; }; // prevent default behavior from changing page on dropped file
  window.ondrop = function(e) { e.preventDefault(); return false; }; // NOTE: ondrop events WILL NOT WORK if you do not "preventDefault" in the ondragover event!!
  $('body')[0].ondrop = function (e) {
    e.preventDefault();
    var files = [];
    for (let i = 0; i < e.dataTransfer.files.length; ++i)
      files.push(e.dataTransfer.files[i].path);
    parseArgs(files);
  };

  /// Button to save file ///
  $('#saveFile').click( saveFile );
  function saveFile( afterSave ) {
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
        if ( typeof afterSave !== 'undefined' )
          afterSave();
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

  /// Setup Page XML schema validation ///
  var
  pagexml_xsd_file = '../xsd/pagecontent_searchink.xsd',
  pagexml_xsd = false;
  function loadPageXmlXsd( async ) {
    if ( ! pagexml_xsd )
      $.ajax({ url: pagexml_xsd_file, async: async, dataType: 'xml' })
        .fail( function () { pageCanvas.throwError( 'Failed to retrieve '+pagexml_xsd_file+'. The schema is included as a git submodule. To fix you need to run "git submodule update --init".' ); } )
        .done( function ( data ) {
            pagexml_xsd = (new XMLSerializer()).serializeToString(data);
            pagexml_xsd = unescape(encodeURIComponent(pagexml_xsd));
            pageCanvas.cfg.pagexmlns = $(data).find('[targetNamespace]').attr('targetNamespace');
          } );
  }
  loadPageXmlXsd(true);

  function validatePageXml() {
    var
    val = '',
    pageXml = pageCanvas.getXmlPage();
    if ( ! pageXml )
      return;
    pageXml = unescape(encodeURIComponent(pageXml));
    loadPageXmlXsd(false);
    try {
      var
      intercept = require("intercept-stdout"),
      unhook_intercept = intercept(function(txt) { val += txt; });
      validateXML({ xml: pageXml,
                    schema: pagexml_xsd,
                    arguments: ['--noout', '--schema', 'PageXmlSchema', 'PageXmlFile'] });
      unhook_intercept();
    } catch ( e ) {
      alert( 'Page XML validation failed to execute: '+e );
      return;
    }
    if ( val === '' || ! / validates$/.test(val.trim()) )
      alert( 'Page XML does not validate: '+val );
    else
      alert( 'Page XML validates' );
  }
  $('#pageXmlValidate').on('click',validatePageXml);

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
