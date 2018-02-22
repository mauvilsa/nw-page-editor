/**
 * NW.js app functionality for nw-page-editor.
 *
 * @version $Version: 2018.02.22$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

// @todo Displace new windows so that they do not appear on top of the first
// @todo When undo/redo returns to saved state, disable save button

$(window).on('load', function () {

  var
  win = nw.Window.get(),
  pageCanvas = window.pageCanvas;

  /// Additional pageCanvas configuration ///
  pageCanvas.setConfig(
    { importSvgXsltHref: '../xslt/page2svg.xslt',
      exportSvgXsltHref: [ '../xslt/svg2page.xslt', '../xslt/sortattr.xslt' ],
      onLoad: successfulFileLoad,
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
  Mousetrap.bind( 'mod+q', saveSafeClose );
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
  function saveSafeClose( event ) {

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

  /// Setup page number navigation ///
  $('#pageNum').keyup( function ( event ) { if ( event.keyCode == 13 ) { $(event.target).blur(); changePage(0); } } );
  $('#prevPage').click( function () { changePage(-1); } );
  $('#nextPage').click( function () { changePage(1); } );
  var prevNum = 0;
  function changePage( offset ) {
    if ( loadingFile || savingFile ) {
      console.log('currently loading or saving file, preventing page change');
      return;
    }
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
  osBar = ( process.platform.substr(0,3) === 'win' ? '\\' : '/' ),
  fileList,
  loadedFile = null,
  savingFile = false,
  loadingFile = false,
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
      if ( file.length === 3 && file[0] === '--list' )
        files = fs.readFileSync(file[2]).toString().trim().split("\n").map(function ( v ) {
            return v[0] === '/' ? v : file[1]+'/'+v;
          } );
      else
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
            data = pageCanvas.newXmlPage( 'nw-page-editor', file, size.width, size.height );

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

    require('fs').readFile( filepath, 'utf8', function ( err, data ) {
        if ( err ) {
          loadingFile = false;
          $('#spinner').removeClass('spinner-active');
          return pageCanvas.cfg.handleError( err );
        }
        prevFileContents = data;
        loadedFile = filepath;
        prevNum = fileNum;
        pageCanvas.loadXmlPage( data, 'file://'+filepath );
        $('title').text(newtitle);
      } );

    return true;
  }

  function successfulFileLoad() {
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

      chooseFile( "#openFileDialog", function(filename) {
          loadFileList(filename,true);
        } );
    } );

  /// Open file if provided as argument ///
  if ( nw.App.argv.length > 0 && window.location.hash === '#1' ) {
    global.pageWindows = [ true ];
    if ( loadFileList( nw.App.argv.length == 1 ? nw.App.argv[0] : nw.App.argv ) )
      window.setTimeout( function () {
          if ( typeof pageCanvas.fitPage !== 'undefined' )
            pageCanvas.fitPage();
        }, 300 );
  }
  else
    global.pageWindows.push(true);

  if ( typeof global.argv !== 'undefined' ) {
    if ( loadFileList( global.argv.length == 1 ? global.argv[0] : global.argv ) )
      window.setTimeout( function () { pageCanvas.fitPage(); }, 300 );
    delete global.argv;
  }

  nw.App.on( 'open', function ( argv ) {
//console.log('argv: '+argv);
      var n;
      for ( n = global.pageWindows.length-1; n>=0; n-- )
        if ( global.pageWindows[n] )
          break;
      if ( n != parseInt(window.location.hash.substr(1))-1 )
        return;
      global.argv = argv.replace(/.*nw-page-editor /,'').split(' ');
      if ( / --list /.test(argv) )
        global.argv.unshift('--list');
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
