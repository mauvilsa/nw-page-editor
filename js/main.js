$(window).load( function () {
  global.window = window;
  global.$ = $;
  global.gui = require('nw.gui');

  Mousetrap.bind( 'mod+d', function () { global.gui.Window.get().showDevTools(); return false; } );
  Mousetrap.bind( 'mod+o', function () { $('#openFile').click(); return false; } );
  Mousetrap.bind( 'mod+s', function () { saveFile(); return false; } );
  Mousetrap.bind( 'mod+q', function () { saveSafeClose(); return false; } );
  Mousetrap.bind( 'pagedown', function () { $('#nextPage').click(); return false; } );
  Mousetrap.bind( 'pageup', function () { $('#prevPage').click(); return false; } );

  /// Confirm that changes will be saved on exit ///
  function saveSafeClose() {
    //alert( 'window closing ...' );
    if ( typeof global.pageCanvas !== 'undefined' && global.pageCanvas.hasChanged() )
      if ( autosave ||
           confirm('WARNING: Modifications will be saved on exit! Select Cancel to discard them.') )
        $('#saveFile').click();
    global.gui.Window.get().close(true);
  }
  global.gui.Window.get().on( 'close', saveSafeClose ); // @todo Bug: not working when clicking on the window top bar x button
  $('#quit').click( saveSafeClose );

  /// Automatic save ///
  var autosave = false;
  $('#autoSave input').change( function () {
      autosave =
        $('#autoSave input').prop('checked') ? true : false ;
    } );
  setInterval( function () { 
      if ( autosave && global.pageCanvas.hasChanged() ) {
        console.log('automatic saving ...');
        $('#saveFile').click();
      }
    }, 15000 );

  /// Create OSX menubar ///
  var gui = require('nw.gui');
  if ( process.platform === "darwin" ) {
    var mb = new global.gui.Menu( { type: 'menubar' } );
    mb.createMacBuiltin( global.gui.App.manifest.window.title, {} );
    global.gui.Window.get().menu = mb;
  }

  //global.gui.Window.get().maximize();

  /// Resize container when window size changes ///
  var container = $('#container');
  function setHeight() {
    container.css( 'height', $(window).innerHeight() );
    //$.stylesheet('#xpg_styles { #container }').css( 'height', $(document).innerHeight() ); // Doesn't work with <!DOCTYPE html>, why?
  }
  setHeight();
  $(window).resize(setHeight);

  /// Make controls resizable ///
  $('#controls').click( function () { window.setTimeout( function () { $('html').css('cursor',''); }, 50 ); } ); // interact.js resize cursor bug
  interact('#controls')
    .resizable( { edges: { left: false, right: false, bottom: false, top: true } } )
    .on( 'resizemove', function ( event ) {
        var controlsHeight = event.rect.height/$(window).innerHeight();
        $.stylesheet('#xpg_styles { #controls }').css( 'height', (100*controlsHeight)+'%' );
        $.stylesheet('#xpg_styles { #xpg }').css( 'height', (100*(1-controlsHeight))+'%' );
        //$('#controls').css( 'height', (100*controlsHeight)+'%' );
        //$('#xpg').css( 'height', (100*(1-controlsHeight))+'%' );
        global.pageCanvas.adjustViewBox();
      } );

  /// Create PageCanvas instance ///
  global.pageCanvas = new global.PageCanvas( 'xpg',
    { handleHref: '../css/handle.svg#bullseye',
      stylesId: 'xpg_styles',
      textareaId: 'xpg_textedit',
      page2svgHref: '../xslt/page2svg.xslt',
      svg2pageHref: '../xslt/svg2page.xslt',
      sortattrHref: '../xslt/sortattr.xslt',
      handleError: function ( err ) { alert(err.message+"\n"+err.stack); throw err; },
      onFirstChange: function () { $('#saveFile').prop( 'disabled', false ); },
      onUnload: function () { $('#saveFile').prop( 'disabled', true ); $('#stateInfo span').text('-'); },
      onSelect: function ( elem ) {
          //var g = $(elem).closest('g');
          var
          g = $(elem).closest('g'),
          text = g.find('> text');
          $('#selectedType').text(g.attr('class').replace(/ .*/,''));
          $('#selectedId').text(g.attr('id'));
          if ( text.length !== 0 ) {
            text = global.pageCanvas.cfg.textFormatter(text.html());
            $('#xpg_textedit').val(text);
          }
          $('.selected-parent-line').removeClass('selected-parent-line');
          $('.selected-parent-region').removeClass('selected-parent-region');
          g.parents('.TextLine').addClass('selected-parent-line');
          g.parents('.TextRegion').addClass('selected-parent-region');
        },
      onUnselect: function () {
          $('#selectedType').text('-');
          $('#selectedId').text('-');
          $('#xpg_textedit').val('');
          //$('.selected-parent-line').removeClass('selected-parent-line');
          //$('.selected-parent-region').removeClass('selected-parent-region');
        },
      onClone: function ( clone ) {
          clone
            .find('.selected-parent-line, .selected-parent-region')
            .removeClass('selected-parent-line selected-parent-region');
        },
      delConfirm: function ( elem ) {
          var
          id = $(elem).attr('id'),
          type = $(elem).attr('class').replace(/ .*/,'');
          return confirm('WARNING: You are about to remove '+type+' with id '+id+'. Continue?');
        },
      onValidText: function () { $('#xpg_textedit').css('background-color',''); },
      onInvalidText: function () { $('#xpg_textedit').css('background-color','red'); },
      onInvalidTextUnselect: function ( err ) { alert('Invalid XML text: '+err.message); }
    } );

  /// Setup page number navigation ///
  $('#pageNum').keyup( function ( event ) { if ( event.keyCode == 13 ) loadFile(); } );
  $('#prevPage').click( function () { changePage(-1); } );
  $('#nextPage').click( function () { changePage(1); } );
  function changePage( offset ) {
    if ( global.pageCanvas.hasChanged() )
      if ( confirm('WARNING: Modifications will be saved on page change! Select Cancel to discard them.') )
        $('#saveFile').click();
    var fileNum = parseInt($('#pageNum').val()) + offset;
    if ( isNaN(fileNum) )
      fileNum = 1;
    else if ( fileNum <= 0 )
      fileNum = fileList.length + fileNum ;
    else if ( fileNum > fileList.length )
      fileNum = fileNum - fileList.length ;
    $('#pageNum').val(fileNum);
    loadFile();
  }

  var
  osBar = ( process.platform.substr(0,3) === 'win' ? '\\' : '/' ),
  fileList,
  loadedFile,
  prevFileContents = null;

  /// Function that initializes the list of all *.xml provided files or all found in base directory ///
  function loadFileList( file ) {
    if ( ! file )
      return;

    var
    fileNum = 1,
    filelist = [],
    basedir,
    files,
    fs = require('fs');

    if ( Object.prototype.toString.call(file) === '[object Array]' ) {
      basedir = '';
      files = file;
      file = '';
    }
    else {
      var fstat = fs.statSync(file);
      if ( fstat.isDirectory() ) {
        basedir = file;
        file = '';
      }
      else {
        basedir = file.replace(/[/\\][^/\\]+$/,'');
        file = file.replace(/.*[/\\]/,'');
      }
      files = fs.readdirSync(basedir);
    }

    filelist = [];
    for ( var n=0; n<files.length; n++ )
      if ( files[n].substr(-4).toLowerCase() === '.xml' ) {
        filelist.push( ( basedir ? basedir+osBar : '' ) + files[n] );
        if ( file === files[n] )
          fileNum = filelist.length;
      }

    if ( filelist.length === 0 )
      global.pageCanvas.throwError( 'Expected at least one Page .xml file to load' );

    fileList = filelist;
    $('#pageNum').val(fileNum);
    $('#totPages').text(fileList.length);
    $('#prevPage, #pageNum, #nextPage').prop( 'disabled', fileList.length > 1 ? false : true );
    loadFile();
  }

  /// Function for loading the selected file into the page canvas ///
  function loadFile() {
    var fileNum = parseInt($('#pageNum').val());
    if ( isNaN(fileNum) || fileNum <= 0 || fileNum > fileList.length )
      return;

    var
    filepath = fileList[fileNum-1],
    newtitle = global.gui.App.manifest.window.title + ' -- ' + filepath.replace( new RegExp('^'+process.env.HOME+'/'), '~/' );

    require('fs').readFile( filepath, 'utf8', function ( err, data ) {
        if ( err )
          return global.pageCanvas.cfg.handleError( err );
        prevFileContents = data;
        loadedFile = filepath;
        global.pageCanvas.loadXmlPage( data, filepath.replace(/[/\\][^/\\]+$/,'') );
        global.$('title').text(newtitle);
        global.$('#pageFile').text(filepath.replace(/^.+[/\\]/,'').replace(/\.xml$/,''));
      } );
  }

  /// Function to handle open file dialog ///
  function chooseFile( name, callback ) {
    var chooser = global.$(name);
    chooser.unbind('change');
    chooser.change( function ( event ) { callback(global.$(this).val()); } );
    chooser.trigger('click');
  }

  /// Button to open file ///
  $('#openFile').click( function () {
      chooseFile( "#openFileDialog", function(filename) {
          loadFileList(filename);
        } );
    } );

  /// Open file if provided as argument ///
  if ( global.gui.App.argv.length > 0 ) {
    if ( global.gui.App.argv.length == 1 )
      loadFileList( global.gui.App.argv[0] );
    else
      loadFileList( global.gui.App.argv );
    // @todo Allow that an arg be a file list

    window.setTimeout( function () { global.pageCanvas.fitPage(); }, 200 );
  }

  /// Button to save file ///
  $('#saveFile').click( saveFile );
  function saveFile() {
    var fs = require('fs');

    if ( prevFileContents ) {
      fs.writeFile( loadedFile+'~', prevFileContents, function ( err ) {
          if ( err )
            global.pageCanvas.cfg.handleError( err );
        } );
      prevFileContents = null;
    }

    var pageXml = global.pageCanvas.getXmlPage();
    fs.writeFile( loadedFile, pageXml, function ( err ) {
        if ( err )
          global.pageCanvas.cfg.handleError( err );
      } );

    $('#saveFile').prop( 'disabled', true );
    global.pageCanvas.setUnchanged();
  }

  /// Button to toggle image visibility ///
  $('#viewImage').click( toggleViewImage );
  function toggleViewImage() {
    if ( $('#xpg').hasClass('image_hidden') )
      $('#viewImage').text('Hide image');
    else
      $('#viewImage').text('Show image');
    $('#xpg').toggleClass('image_hidden');
  }
  toggleViewImage();
  toggleViewImage();

  /// Button to toggle text visibility ///
  $('#viewText').click( toggleViewText );
  function toggleViewText() {
    if ( $('#xpg').hasClass('text_hidden') )
      $('#viewText').text('Hide text');
    else
      $('#viewText').text('Show text');
    $('#xpg').toggleClass('text_hidden');
  }
  toggleViewText();
  //toggleViewText();

  /// Button to toggle regions visibility ///
  $('#viewRegions').click( toggleViewRegions );
  function toggleViewRegions() {
    if ( $('#xpg').hasClass('regions_hidden') )
      $('#viewRegions').text('Hide regions');
    else
      $('#viewRegions').text('Show regions');
    $('#xpg').toggleClass('regions_hidden');
  }
  toggleViewRegions();

  /// Center selected checkbox ///
  $('#autoCenter input').change( function () {
      global.pageCanvas.cfg.centerOnSelection =
        $('#autoCenter input').prop('checked') ? true : false ;
    } );
  $('#autoCenter input').click();

  /// Radio buttons modes ///
  $('#pointsMode input').change( function () {
      if ( $('#pointsMode input').is(':checked') )
        global.pageCanvas.mode.wordTextBbox();
    } );
  $('#dragMode input').change( function () {
      if ( $('#dragMode input').is(':checked') )
        global.pageCanvas.mode.wordTextDrag();
    } );
  $('#pointsMode input').click();
} );
