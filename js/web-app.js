/**
 * App functionality for the web edition of nw-page-editor.
 *
 * @version $Version: 2020.11.16$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

$(window).on('load', function () {

  /// Additional pageCanvas configuration ///
  pageCanvas.setConfig(
    { importSvgXsltHref: [ '../xslt/page2svg.xslt', '../xslt/page_from_2010-03-19.xslt', '../xslt/page2page.xslt', '../xslt/alto_v2_to_page.xslt', '../xslt/alto_v3_to_page.xslt' ],
      exportSvgXsltHref: [ '../xslt/svg2page.xslt', '../xslt/sortattr.xslt', '../xslt/page_fix_xsd_sequence.xslt' ],
      onLoad: successfulFileLoad,
      onUnload: function () { $('#saveFile').prop('disabled',true); },
      onChange: function () { autosavetime = 0; },
      onFirstChange: function () { $('#saveFile').prop('disabled',false); /*$('title').text($('title').text()+' *');*/ }
    } );

  /// Keyboard bindings ///
  Mousetrap.bind( 'pagedown', function () { $('#nextPage').click(); return false; } );
  Mousetrap.bind( 'pageup', function () { $('#prevPage').click(); return false; } );

  /// Confirm that changes will be saved ///
  function confirmSave( afterconfirm ) {
    if ( typeof pageCanvas !== 'undefined' && pageCanvas.hasChanged() )
      if ( autosave ||
           confirm('WARNING: Modifications will be saved! Select Cancel to discard them.') )
        return saveFile(afterconfirm);
    if ( typeof afterconfirm !== 'undefined' )
      afterconfirm();
  }

  /// Automatic save ///
  var
  autosavetime = 0,
  autosave = false;
  function handleAutoSave() {
      autosave =
        $('#autoSave input').prop('checked') ? true : false ;
    }
  handleAutoSave();
  $('#autoSave input').change( handleAutoSave );
  setInterval( function () { 
      if ( autosave && pageCanvas.hasChanged() ) {
        autosavetime++;
        if ( autosavetime >= 30 ) {
          console.log('automatic saving ...');
          saveFile();
          autosavetime = 0;
        }
      }
    }, 15000 );

  /// Warn about changes when unloading ///
  window.onbeforeunload = function () {
      if ( typeof pageCanvas !== 'undefined' && pageCanvas.hasChanged() )
        return "If you leave the page now your changes will NOT be saved.";
      return;
    };

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
    confirmSave(loadFile);
  }

  var
  fileList = typeof list_xmls !== 'undefined' ? list_xmls : [],
  loadedFile = null,
  savingFile = false,
  loadingFile = false;

  /// Function for loading the selected file into the page canvas ///
  function loadFile() {
    if ( loadingFile || savingFile )
      return false;

    var fileNum = parseInt($('#pageNum').val());
    if ( isNaN(fileNum) || fileNum <= 0 || fileNum > fileList.length )
      return false;

    loadingFile = true;
    $('#spinner').addClass('spinner-active');

    /// Clear current Page ///
    $('#xpg').empty();

    /// Start Page load ///
    $('#prevPage, #pageNum, #nextPage').prop( 'disabled', true );
    loadedFile = fileList[fileNum-1];
    prevNum = fileNum;
    pageCanvas.loadXmlPage( undefined, window.location.origin+window.location.pathname.replace(/[^/]*$/,'')+loadedFile );
    //$('title').text('nw-page-editor - '+filepath.replace(/.*\//,''));

    return true;
  }

  function successfulFileLoad() {
    var
    pageid = loadedFile.replace(/^\.\.\/data\//,''),
    //pageid = loadedFile.replace(/.*\//,'').replace(/\.xml$/,''),
    fileNum = parseInt($('#pageNum').val()),
    url = window.location.pathname +
      window.location.search.replace(/\?n=[0-9]+/,'').replace(/&n=[0-9]+/,'') +
      '&n=' + fileNum;

    /// Check that Page ID is equal to image base ///
    /*if ( $('svg image').attr('xlink:href').replace(/.*\//,'').replace(/\.[^.]+$/,'') !== pageid ) {
      alert('ERROR: Reached unexpeted state while loading file. Attempting to fix by refreshing browser!');
      window.location.reload();
    }*/

    /// Finalize file load ///
    $('#xmlFile').text(pageid);
    //$('#pageName').text(pageid);
    $('#prevPage, #pageNum, #nextPage').prop( 'disabled', false );
    history.replaceState( {}, pageid, url );

    loadingFile = false;
    $('#spinner').removeClass('spinner-active');
  }

  /// Load first page ///
  if ( fileList.length > 0 ) {
    $('#totPages').text(fileList.length);

    var fileNum = parseInt($('#pageNum').val());
    if ( isNaN(fileNum) || fileNum < 1 || fileNum > fileList.length )
      changePage(1);
    else
      loadFile();
  }

  /// Button to save file ///
  Mousetrap.bind( ['mod+s','alt+s'], function () { return saveFile(); } );
  $('#saveFile').click( function () { return saveFile(); } );
  function saveFile( aftersave ) {
    if ( loadingFile || savingFile )
      return false;
    if ( ! pageCanvas.hasChanged() )
      return false;

    savingFile = true;
    $('#spinner').addClass('spinner-active');

    var
    pageXml = pageCanvas.getXmlPage(),
    data = {
      page_editor_version: page_editor_version,
      uname: uname,
      brhash: brhash,
      fname: loadedFile,
      xml: pageXml
    };

    $.ajax({ url: 'saveFile.php', method: 'POST', data: JSON.stringify(data), dataType: 'json', timeout: 8000, contentType: 'application/json;charset=UTF-8' })
      .fail( function () {
          savingFile = false;
          $('#spinner').removeClass('spinner-active');
          pageCanvas.throwError( 'Failed to save file '+loadedFile );
        } )
      .done( function ( data ) {
          if ( data.code !== 200 )
            pageCanvas.throwError( 'Problems saving file '+loadedFile+': '+data.code+': '+data.message );
          else {
            if ( typeof data.message !== 'undefined' )
              pageCanvas.warning( data.message );
            $('#saveFile').prop('disabled',true);
            pageCanvas.setUnchanged();
            savingFile = false;
            $('#spinner').removeClass('spinner-active');
            if ( typeof aftersave !== 'undefined' )
              aftersave();
          }
          savingFile = false;
          $('#spinner').removeClass('spinner-active');
        } );
    return false;
  }

} );
