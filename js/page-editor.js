/**
 * Interactive editing of Page XMLs functionality.
 *
 * @version $Version: 2016.10.02$
 * @author Mauricio Villegas <mauvilsa@upv.es>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauvilsa@upv.es>
 * @license MIT License
 */

$(window).on('load', function () {

  /// Create PageCanvas instance ///
  var pageCanvas = window.pageCanvas = new window.PageCanvas( 'xpg',
    { dragpointHref: '../css/dragpoint.svg#bullseye',
      stylesId: 'page_styles',
      textareaId: 'textedit',
      page2svgHref: '../xslt/page2svg.xslt',
      svg2pageHref: '../xslt/svg2page.xslt',
      sortattrHref: '../xslt/sortattr.xslt',
      handleError: function ( err ) { alert(err.message+"\n"+err.stack); throw err; },
      handleWarning: function ( msg ) { console.log('WARNING: '+msg); alert('WARNING: '+msg); },
      onLoad: function () { $('#imageBase').text(pageCanvas.util.imgBase); },
      onUnload: function () { $('#stateInfo span').text('-'); },
      onSelect: function ( elem ) {
          var
          g = $(elem).closest('g'),
          text = g.find('> text');
          $('#selectedType').text(g.attr('class').replace(/ .*/,''));
          $('#selectedId').text(g.attr('id'));
          if ( text.length !== 0 ) {
            text = pageCanvas.cfg.textFormatter(text.html());
            $('#textedit').val(text);
          }
          $('.selected-parent-line').removeClass('selected-parent-line');
          $('.selected-parent-region').removeClass('selected-parent-region');
          g.closest('.TextLine').addClass('selected-parent-line');
          g.closest('.TextRegion').addClass('selected-parent-region');
        },
      onUnselect: function () {
          $('#selectedType').text('-');
          $('#selectedId').text('-');
          $('#textedit').val('');
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
      delRowColConfirm: function ( id, row, col ) {
          var type = row ? 'row '+row : 'column '+col;
          return confirm('WARNING: You are about to remove '+type+' from table with id '+id+'. Continue?');
        },
      //textValidator: SvgCanvas.strXmlValidate,
      onValidText: function () { $('#textedit').css('background-color',''); },
      onInvalidText: function () { $('#textedit').css('background-color','red'); },
      onInvalidTextUnselect: function ( err ) { alert('Invalid XML text: '+err.message); }
    } );

  /// Resize container when window size changes ///
  function adjustSize() {
    var height = $(window).innerHeight() - $('#statusBar').outerHeight();
    if ( $('#hide-text-edit input').prop('checked') )
      height -= $('#textedit').outerHeight();
    $.stylesheet('#page_styles { .page_container }').css( 'height', height+'px' );
    $.stylesheet('#page_styles { #cursor }').css( 'bottom', $('#hide-text-edit input').prop('checked') ? $('#textedit').outerHeight()+'px' : 0 );
    pageCanvas.adjustViewBox();
  }
  adjustSize();
  $(window).resize(adjustSize);

  /// Make text edit box resizable and hidable ///
  $('#textedit').click( function () { window.setTimeout( function () { $('html').css('cursor',''); }, 50 ); } ); // interact.js resize cursor bug
  interact('#textedit')
    .resizable( { edges: { left: false, right: false, bottom: false, top: true } } )
    .on( 'resizemove', function ( event ) {
        $('#textedit').css('height',event.rect.height+'px');
        $.stylesheet('#page_styles { #textedit }').css( 'height', event.rect.height+'px' );
        adjustSize();
      } );

  /// Cursor coordinates ///
  var
  point = null,
  cursorX = $('#cursorX'),
  cursorY = $('#cursorY');
  $('.page_container').mousemove( function ( event ) {
      // @todo Do not update too often
      if ( typeof pageCanvas.util.svgRoot === 'undefined' )
        return;
      if ( ! point )
        point = pageCanvas.util.svgRoot.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      point = pageCanvas.util.toViewboxCoords(point);
      if ( ! point )
        return;
      cursorX.text(point.x.toFixed(0));
      cursorY.text(point.y.toFixed(0));
    } );
  $('#cursor').mouseover( function () { $('#cursor').toggleClass('cursor-left cursor-right'); } );

  /// Drawer button ///
  Mousetrap.bind( 'mod+m', function () { $('#drawerButton').click(); return false; } );
  $('#drawerButton').click( function() {
      //$('#drawer').slideToggle();
      $('#drawer').toggle();
      $(this).toggleClass('is-active');
    } );

  /// Setup visibility checkboxes ///
  function handleVisibility() {
    if ( this.id === 'hide-text-edit' )
      adjustSize();
    return $(this).children('input').prop('checked') ?
      $('#container').removeClass(this.id) :
      $('#container').addClass(this.id) ;
  }
  $('label[id^=hide-]')
    .each(handleVisibility)
    .click(handleVisibility);

  /// Setup selected centering checkbox ///
  function handleAutoCenter() {
    pageCanvas.cfg.centerOnSelection =
      $(this).children('input').prop('checked') ? true : false ;
  }
  $('#centerSelected')
    .each(handleAutoCenter)
    .click(handleAutoCenter);

  /// Setup text properties ///
  function handleReadingDirection() {
    if ( $(this).children('input').prop('checked') )
      pageCanvas.cfg.readingDirection = $(this).children('input').attr('value');
  }
  $('label[id^=read-]')
    .each(handleReadingDirection)
    .click(handleReadingDirection);
  function handleTextOrientation() {
    if ( $(this).children('input').prop('checked') )
      pageCanvas.cfg.textOrientation = parseFloat( $(this).children('input').attr('value') );
  }
  $('label[id^=orient-]')
    .each(handleTextOrientation)
    .click(handleTextOrientation);

  /// Setup edit mode selection ///
  function handleEditMode() {
    var
    text = $('#textMode input'),
    rect = $('#rectMode input'),
    region = $('#regMode input'),
    line = $('#lineMode input'),
    word = $('#wordMode input'),
    glyph = $('#glyphMode input'),
    table = $('#tabMode input'),
    select = $('#selMode input'),
    baseline = $('#baseMode input'),
    coords = $('#coorMode input'),
    drag = $('#dragMode input'),
    create = $('#createMode input');

    $('#editModes input')
      .prop('disabled',false)
      .parent()
      .removeClass('disabled');

    /// Region modes ///
    if ( region.prop('checked') ) {
      /// Region select ///
      if ( select.prop('checked') )
         pageCanvas.mode.regionSelect( text.prop('checked') );
      /// Region baselines ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.regionBaselines() ;
      /// Region coords ///
      else if( coords.prop('checked') ) {
        if ( rect.prop('checked') )
          pageCanvas.mode.regionRect( text.prop('checked') );
        else
          pageCanvas.mode.regionCoords( text.prop('checked') );
      }
      /// Region drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.regionDrag( text.prop('checked') );
      /// Region create ///
      else if( create.prop('checked') )
        pageCanvas.mode.regionCreate( rect.prop('checked') );
    }

    /// Line modes ///
    else if ( line.prop('checked') ) {
      /// Line select ///
      if ( select.prop('checked') )
        pageCanvas.mode.lineSelect( text.prop('checked') );
      /// Line baseline ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.lineBaseline( text.prop('checked') );
      /// Line coords ///
      else if( coords.prop('checked') ) {
        if ( rect.prop('checked') )
          pageCanvas.mode.lineRect( text.prop('checked') );
        else
          pageCanvas.mode.lineCoords( text.prop('checked') );
      }
      /// Line drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.lineDrag( text.prop('checked') );
      /// Line create ///
      else if( create.prop('checked') )
        pageCanvas.mode.lineCreate();
    }

    /// Word modes ///
    else if ( word.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') || create.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      create.prop('disabled',true).parent().addClass('disabled');
      /// Word select ///
      if ( select.prop('checked') )
        pageCanvas.mode.wordSelect( text.prop('checked') );
      /// Word coords ///
      else if( coords.prop('checked') ) {
        if ( rect.prop('checked') )
          pageCanvas.mode.wordRect( text.prop('checked') );
        else
          pageCanvas.mode.wordCoords( text.prop('checked') );
      }
      /// Word drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.wordDrag( text.prop('checked') );
    }

    /// Glyph modes ///
    else if ( glyph.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') || create.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      create.prop('disabled',true).parent().addClass('disabled');
      /// Glyph select ///
      if ( select.prop('checked') )
        pageCanvas.mode.glyphSelect( text.prop('checked') );
      /// Glyph coords ///
      else if( coords.prop('checked') ) {
        if ( rect.prop('checked') )
          pageCanvas.mode.glyphRect( text.prop('checked') );
        else
          pageCanvas.mode.glyphCoords( text.prop('checked') );
      }
      /// Glyph drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.glyphDrag( text.prop('checked') );
    }

    /// Table modes ///
    else if ( table.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Table select ///
      if ( select.prop('checked') )
        pageCanvas.mode.regionSelect( text.prop('checked') );
      /// Table points ///
      else if( coords.prop('checked') )
        pageCanvas.mode.tablePoints();
      /// Table drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.tableDrag();
      /// Table create ///
      else if( create.prop('checked') )
        pageCanvas.mode.tableCreate( rect.prop('checked') );
    }

  }
  $('#editModes label')
    .click(handleEditMode);
  handleEditMode();

} );
