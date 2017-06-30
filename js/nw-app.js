/**
 * NW.js app functionality for nw-page-editor.
 *
 * @version $Version: 2017.06.30$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

// @todo Bug: sometimes an additional empty window is created when opening from command line and app already running
// @todo Preserve window size and position when reopening app
// @todo Displace new windows so that they do not appear on top of the first
// @todo When undo/redo returns to saved state, disable save button

$(window).on('load', function () {

  var
  win = nw.Window.get(),
  pageCanvas = window.pageCanvas;

  /// Additional pageCanvas configuration ///
  pageCanvas.setConfig(
    { onUnload: function () { $('#saveFile').prop( 'disabled', true ); },
      onFirstChange: function () { $('#saveFile').prop( 'disabled', false ); $('title').text($('title').text()+' *'); },
      imageLoader: function ( image, onLoad ) {
          if ( typeof image === 'string' )
            return /\.tif{1,2}$/i.test(image);
          if ( process.platform === "win32" )
            pageCanvas.throwError( 'TIFF images not supported in Windows.' );
          try {
            var data = require('child_process').execSync( 'convert '+image.attr('xlink:href')+' jpeg:- | base64' );
            //var data = require('child_process').execSync( 'convert '+image.attr('xlink:href')+' jpeg:-' );
            if ( data.length === 0 )
              pageCanvas.throwError( 'Problems converting image. Is ImageMagick installed and in the PATH?' );
            image.attr( 'xlink:href', 'data:image/jpeg;base64,'+data );
            //data = new Blob(data, {type:"image/jpeg"});
            //var url = URL.createObjectURL(data);
            //image.on('load', function() {
            //  URL.revokeObjectURL(url);
            //});
            //image.attr( 'xlink:href', url );
            onLoad();
          } catch ( e ) {
            pageCanvas.throwError( 'Problems converting image. Is ImageMagick installed and in the PATH?' );
          }
        }
    } );

  var
  xmlExt = 'xml' /*'spf'*/ ,
  reExt = new RegExp('\\.'+xmlExt+'$','i');
  if ( xmlExt === 'spf' )
    pageCanvas.setXslt( '../xslt/spf2svg.xslt', '../xslt/svg2spf.xslt', '../xslt/sortattr.xslt' );

  /// Keyboard bindings ///
  Mousetrap.bind( process.platform === "darwin" ? 'mod+option+i' : 'ctrl+shift+i', function () { win.showDevTools(); return false; } );
  Mousetrap.bind( 'mod+o', function () { $('#openFile').click(); return false; } );
  Mousetrap.bind( 'mod+s', function () { saveFile(); return false; } );
  Mousetrap.bind( 'mod+shift+s', function () { $('#saveFileAs').click(); return false; } );
  Mousetrap.bind( 'mod+q', function () { saveSafeClose(); return false; } );
  Mousetrap.bind( 'mod+n', newWindow );
  Mousetrap.bind( 'pagedown', function () { $('#nextPage').click(); return false; } );
  Mousetrap.bind( 'pageup', function () { $('#prevPage').click(); return false; } );
  Mousetrap.bind( 'mod+shift+r', function () {
      if ( typeof pageCanvas !== 'undefined' && pageCanvas.hasChanged() )
        if ( confirm('WARNING: Modifications will be lost on reload! Select Cancel to abort.') )
          loadFile();
      return false;
    } );
  Mousetrap.bind( 'mod+option+r', function () { win.reloadIgnoringCache(); } );

  Mousetrap.bind( 'mod+a', function () {
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
  function saveSafeClose() {
    if ( typeof pageCanvas !== 'undefined' && pageCanvas.hasChanged() )
      if ( autosave ||
           confirm('WARNING: Modifications will be saved on exit! Select Cancel to discard them.') )
        saveFile();
    win.close(true);
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

  /// Setup page number navigation ///
  $('#pageNum').keyup( function ( event ) { if ( event.keyCode == 13 ) changePage(0); } );
  $('#prevPage').click( function () { changePage(-1); } );
  $('#nextPage').click( function () { changePage(1); } );
  var prevNum = 0;
  function changePage( offset ) {
    var fileNum = parseInt($('#pageNum').val()) + offset;
    if ( isNaN(fileNum) || fileNum < 1 || fileNum > fileList.length )
      fileNum = prevNum === 0 ? 1 : prevNum;
    $('#pageNum').val(fileNum);
    if ( fileNum === prevNum )
      return;
    if ( pageCanvas.hasChanged() )
      if ( autosave ||
           confirm('WARNING: Modifications will be saved on page change! Select Cancel to discard them.') )
        saveFile();
    loadFile();
  }

  /// Function that checks if ImageMagick is installed ///
  function is_ImageMagick_installed() {
    var cp = require('child_process');
    try {
      cp.execSync( 'identify logo:' );
      cp.execSync( 'convert logo: null:' );
    } catch ( e ) {
      return false;
    }
    return true;
  }

  /// Function that returns the size of an image given its path ///
  function getImageSize( file ) {
    var imgsize = '';
    try {
      imgsize = require('child_process').execSync( 'identify -format "%w %h" '+file );
    } catch ( e ) {
      if ( ! is_ImageMagick_installed() )
        pageCanvas.throwError( 'ImageMagick not installed or not in PATH' );
    }

    if ( imgsize === '' )
      return;

    return imgsize.toString().split(' ').map(parseFloat);
  }

  var
  osBar = ( process.platform.substr(0,3) === 'win' ? '\\' : '/' ),
  fileList,
  loadedFile = null,
  prevFileContents = null;

  /// Function that initializes the list of all *.xml provided files or all found in base directory ///
  function loadFileList( file, loaddir ) {
    if ( ! file )
      return false;

    var n,
    fileNum = 1,
    filelist = [],
    basedir = '',
    files = [ file ],
    fs = require('fs');

    if ( Object.prototype.toString.call(file) === '[object Array]' ) {
      files = file;
      file = '';
    }
    else {
      var fstat = fs.statSync(file);
      if ( fstat.isDirectory() ) {
        basedir = file.replace(/\/\.$/,'');
        file = '';
        files = fs.readdirSync(basedir);
      }
      else if ( typeof loaddir !== 'undefined' && loaddir ) {
        var ofile = file;
        basedir = file.replace(/[/\\][^/\\]+$/,'');
        file = file.replace(/.*[/\\]/,'');
        files = fs.readdirSync(basedir);

        if ( ! reExt.test(file) ) {
          var
          fbase = file.replace(/\.[^.]+$/,''),
          iXml = files.findIndex( function (f) { return f.substr(-4).toLowerCase() === '.'+xmlExt && f.slice(0,-4) === fbase; } );
          if ( iXml >= 0 )
            file = files[iXml];
          else {
            var size = getImageSize(ofile);
            if ( ! size ) {
              pageCanvas.warning( 'File apparently not an image: '+file );
              return false;
            }
            if ( ! confirm('A new Page XML file will be created for image '+file) )
              return false;

            var
            filepath = basedir+osBar+file.replace(/\.[^.]+$/,'.'+xmlExt),
            newtitle = appTitle(filepath),
            data = pageCanvas.newXmlPage( 'nw-page-editor', file, size[0], size[1] );

            fileList = [ filepath ];
            $('#pageNum').val(fileNum);
            $('#totPages').text(fileList.length);
            $('#prevPage, #pageNum, #nextPage').prop( 'disabled', fileList.length > 1 ? false : true );

            prevFileContents = null;
            loadedFile = filepath;
            prevNum = fileNum;
            pageCanvas.loadXmlPage( data, 'file://'+filepath );
            pageCanvas.registerChange( 'xml created' );
            $('title').text(newtitle+' *');

            return true;
          }
        }
      }
    }

    for ( n=0; n<files.length; n++ )
      if ( files[n].substr(-4).toLowerCase() === '.'+xmlExt ) {
        filelist.push( ( basedir ? basedir+osBar : '' ) + files[n] );
        if ( file === files[n] )
          fileNum = filelist.length;
      }

    if ( filelist.length === 0 ) {
      pageCanvas.warning( 'Expected at least one Page XML file to load' );
      return false;
    }

    fileList = filelist;
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
    title = filepath.replace( new RegExp('^'+process.env.HOME+'/'), '~/' );
    while ( title.includes('/') && title.length > maxlength && prevtitle != title ) {
      prevtitle = title;
      title = title.replace(/^[^/]+\//,'');
    }
    return nw.App.manifest.window.title + ' - ' + title;
  }

  /// Function for loading the selected file into the page canvas ///
  function loadFile() {
    var fileNum = parseInt($('#pageNum').val());
    if ( isNaN(fileNum) || fileNum <= 0 || fileNum > fileList.length )
      return false;

    var
    filepath = fileList[fileNum-1],
    newtitle = appTitle(filepath);

    require('fs').readFile( filepath, 'utf8', function ( err, data ) {
        if ( err )
          return pageCanvas.cfg.handleError( err );
        prevFileContents = data;
        loadedFile = filepath;
        prevNum = fileNum;
        pageCanvas.loadXmlPage( data, 'file://'+filepath );
        $('title').text(newtitle);
      } );

    return true;
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

      chooseFile( "#openFileDialog", function(filename) {
          loadFileList(filename,true);
        } );
    } );

  /// Open file if provided as argument ///
  if ( nw.App.argv.length > 0 && window.location.hash === '#1' ) {
    if ( loadFileList( nw.App.argv.length == 1 ? nw.App.argv[0] : nw.App.argv ) )
      window.setTimeout( function () {
          if ( typeof pageCanvas.fitPage !== 'undefined' )
            pageCanvas.fitPage();
        }, 300 );
  }

  if ( typeof global.argv !== 'undefined' ) {
    if ( loadFileList( global.argv.length == 1 ? global.argv[0] : global.argv ) )
      window.setTimeout( function () { pageCanvas.fitPage(); }, 300 );
    delete global.argv;
  }

  nw.App.on( 'open', function ( argv ) {
console.log('argv: '+argv);
      global.argv = argv.replace(/.*nw-page-editor /,'').split(' ');
      newWindow();
    } );

  /// Button to save file ///
  $('#saveFile').click( saveFile );
  function saveFile() {
    var fs = require('fs');

    if ( prevFileContents )
      fs.writeFile( loadedFile+'~', prevFileContents, function ( err ) {
          if ( err )
            pageCanvas.cfg.handleError( err );
          prevFileContents = null;
        } );

    var pageXml = pageCanvas.getXmlPage();
    fs.writeFile( loadedFile, pageXml, function ( err ) {
        if ( err )
          pageCanvas.cfg.handleError( err );
      } );

    $('#saveFile').prop( 'disabled', true );
    $('title').text($('title').text().replace(/ \*$/,''));
    pageCanvas.setUnchanged();
  }

  /// Button to save file as ///
  $('#saveFileAs').click( function () {
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
          saveFile();
          $('title').text( appTitle(filepath) );
        } );
    } );

} );
