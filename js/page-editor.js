/**
 * Interactive editing of Page XMLs functionality.
 *
 * @version $Version: 2017.10.16$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

$(window).on('load', function () {

  /// Create PageCanvas instance ///
  var pageCanvas = window.pageCanvas = new window.PageCanvas( 'xpg',
    { stylesId: 'page_styles',
      textareaId: 'textedit',
      handleError: function ( err ) { alert(err.message+"\n"+err.stack); throw err; },
      handleWarning: function ( msg ) { console.log('WARNING: '+msg); alert('WARNING: '+msg); },
      onLoad: function () {
          //$('#imageBase').text(pageCanvas.util.imgBase);
          handleEditMode();
          window.setTimeout( function () { setPropertyTag(); }, 100 );
        },
      onMouseMove: updateCursor,
      onUnload: function () { $('#stateInfo span').text('-'); },
      onSelect: function ( elem ) {
          var
          g = $(elem).closest('g'),
          editable = $('.editable'),
          text = g.find('> text');
          $('#selectedType').text( g.hasClass('TableCell') ? 'TableCell' : g.attr('class').replace(/ .*/,'') );
          $('#selectedId').text( g.is('.Page') && ! g.attr('id') ? $('.Page').index(g)+1 : g.attr('id') );
          $('#modeElement').text((editable.index(g)+1)+'/'+editable.length);

          updateSelectedInfo();

          if ( text.length !== 0 ) {
            text = pageCanvas.cfg.textFormatter(text.html());
            $('#textedit').val(text);
          }

          $('.selected-parent-line').removeClass('selected-parent-line');
          $('.selected-parent-region').removeClass('selected-parent-region');
          g.closest('.TextLine').addClass('selected-parent-line');
          g.closest('.TextRegion').addClass('selected-parent-region');

          setPropertyTag(g);
        },
      onPointsChangeEnd: function ( elem ) {
          if ( $(elem).closest('g').is('.TextLine') )
            updateSelectedInfo();
        },
      onNoEditEsc: function () {
          $('.selected-parent-line').removeClass('selected-parent-line');
          $('.selected-parent-region').removeClass('selected-parent-region');
        },
      onUnselect: function () {
          $('#selectedType').text('-');
          $('#selectedId').text('-');
          $('#modeElement').text('-/'+$('.editable').length);
          $('#textedit').val('');
          $('#textinfo').empty();
          setPropertyTag();
        },
      onDragStart: function () {
          $('#container').addClass('hide-prop-tag');
        },
      onDragEnd: function () {
          if ( $('#hide-prop-tag > input').prop('checked') )
            $('#container').removeClass('hide-prop-tag');
        },
      onClone: function ( clone ) {
          clone
            .find('.selected-parent-line, .selected-parent-region')
            .removeClass('selected-parent-line selected-parent-region');
        },
      /*onCloneInternal: function ( clone ) {
          clone
            .find('.highlight')
            .removeClass('highlight');
        },*/
      delConfirm: function ( elem ) {
          var
          id = $(elem).attr('id'),
          type = $(elem).attr('class').replace(/ .*/,'')+' '+id;
          if ( elem.length > 1 ) {
            var parent = $(elem).parent();
            if ( parent.length === 1 && $(elem).parent().hasClass('Page') )
              type = elem.length+' child elements from Page '+($('.Page').index(parent)+1);
            else if ( parent.length === 1 && $(elem).parent().hasClass('TableCell') )
              type = elem.length+' child elements from TableCell '+parent.attr('id');
            else
              type = elem.length+' elements with IDs: '+elem.map(function(){return this.id;}).get().join(', ');
          }
          return confirm('WARNING: You are about to remove '+type+'. Continue?');
        },
      delRowColConfirm: function ( id, row, col ) {
          var type = row ? 'row '+row : 'column '+col;
          return confirm('WARNING: You are about to remove '+type+' from TableRegion '+id+'. Continue?');
        },
      onValidText: function () { $('#textedit').css('background-color',''); },
      onInvalidText: function () { $('#textedit').css('background-color','red'); },
      onInvalidTextUnselect: function ( err ) { alert('Invalid XML text: '+err.message); },
      allowPointsChange: confirmCoordsChange,
      allowRemovePolyPoint: confirmCoordsChange,
      allowAddPolyPoint: confirmCoordsChange
    } );

  /// Display info about selected element ///
  function updateSelectedInfo() {
    var
    elem = $('.selected'),
    orie = pageCanvas.util.getBaselineOrientation(elem),
    textconf = pageCanvas.util.getTextConf(elem),
    coordsconf = pageCanvas.util.getCoordsConf(elem),
    baselineconf = pageCanvas.util.getBaselineConf(elem),
    info = '<div>Read direction: '+pageCanvas.util.getReadingDirection()+'</div>';
    if ( typeof orie !== 'undefined' ) {
      info += '<div>Baseline orientation: '+((orie*180/Math.PI).toFixed(1))+'°</div>';
    }
    if ( textconf )
      info += '<div>Text confidence: '+textconf+'</div>';
    if ( coordsconf )
      info += '<div>Coords confidence: '+coordsconf+'</div>';
    if ( baselineconf )
      info += '<div>Baseline confidence: '+baselineconf+'</div>';
    $('#textinfo').html(info);
  }

  /// Setup properties modal box ///
  var
  prop_elem = null,
  prop_modal = $('#prop-modal');
  $('#prop-modal .close').click(closePropModal);
  $(window).click( function (event) { if (event.target == prop_modal[0]) closePropModal(); } );
  Mousetrap.bind( 'mod+e', function () { $('.prop-tag').click(); } );

  function closePropModal() {
    prop_modal.find('div[isnew]').each( function () {
        var
        key = $(this).find('input.key'),
        val = $(this).find('input.val');
        if ( ! key.val().trim() )
          return pageCanvas.warning('Ignoring new property with emply key');
        pageCanvas.util.setProperty( key.val().trim(), val.val().trim(), prop_elem );
      } );
    prop_modal.removeClass('modal-active');
    setPropertyTag(prop_elem);
  }

  function setPropertyTag( elem ) {
    $('.prop-tag').remove();
    var nprops, bbox, text,
    pageprops = typeof elem === 'undefined' ? true : false;
    elem = pageprops ? $('.Page') : elem;
    if ( elem.length === 0 )
      return;
    nprops = elem.children('.Property').length;
    bbox = elem[0].getBBox();
    text = $(document.createElementNS( pageCanvas.util.sns, 'text' ))
      .html('PROPS['+nprops+']')
      .addClass('prop-tag')
      .click(function ( event ) { return openPropertyModal(elem,event); });
    text.attr('transform','translate('+(bbox.x+3)+','+(bbox.y+(text[0].getBBox().height*(pageprops?1:-1)))+')');
    text.appendTo(elem);
  }

  function openPropertyModal( elem ) {
    var
    isreadonly = pageCanvas.util.isReadOnly(elem),
    add = $('<a>ADD</a>'),
    props = $('#props'),
    target = $('#selectedType').text()+' '+$('#selectedId').text();
    prop_elem = elem;

    $('#props-target').html( target === '- -' ? 'Page' : $('#selectedType').text()+' '+$('#selectedId').text() );

    function addPropInput( prop, isnew ) {
      var
      div = $('<div/>'),
      key = $('<label>Key:<input class="key" type="text" value="'+prop.attr('key')+'"/></label>'),
      key_txt = key.children('input')[0],
      val = $('<label>Value:<input class="val" type="text" value="'+prop.attr('value')+'"/></label>'),
      val_txt = val.children('input')[0],
      del = $('<a>DEL</a>');
      if ( isreadonly ) {
        $(key_txt).prop('disabled',true);
        $(val_txt).prop('disabled',true);
      }
      if ( typeof isnew !== 'undefined' && isnew )
        div.attr('isnew','');
      key.on( 'input', function () {
          prop.attr('key',key_txt.value);
          // @todo When isnew and key same as other property warn about overwrite.
          pageCanvas.registerChange('properties '+elem.attr('id'));
        } );
      val.on( 'input', function () {
          prop.attr('value',val_txt.value);
          pageCanvas.registerChange('properties '+elem.attr('id'));
        } );
      del.click( function () {
          if ( isreadonly )
            return pageCanvas.warning('Not possible to remove properties from read only elements');
          if ( confirm('Delete property ("'+prop.attr('key')+'","'+prop.attr('value')+'") from '+elem.attr('class').replace(/ .*/,'')+' with id='+elem.attr('id')+'?') ) {
            div.remove();
            pageCanvas.util.delProperty( prop.attr('key'), elem );
            setPropertyTag(elem);
          }
        } );
      div
        .append(key)
        .append(' ')
        .append(val)
        .append(' ')
        .append(del)
        .insertBefore(add);
    }

    props.empty();
    props.append(add);
    elem.children('.Property').each( function () { addPropInput( $(this) ); } );
    add.click( function () {
        if ( isreadonly )
          return pageCanvas.warning('Not possible to add properties to read only elements');
        addPropInput( $(document.createElementNS(pageCanvas.util.sns,'g')).addClass('Property').attr('key','').attr('value',''), true );
      } );

    prop_modal.addClass('modal-active');

    event.stopPropagation();
  }

  /// Ask before modifying polyrect or rect ///
  function confirmCoordsChange( elem ) {
    if ( $(elem).is('.Coords') ) {
      var parent = $(elem).parent()[0];
      if ( $(parent).is('.TextLine[polystripe]') ) {
        if ( confirm('WARNING: TextLine with id '+parent.id+' will no longer be a polystripe. Continue?') )
          $(parent).removeAttr('polystripe');
        return false;
      }
      else if ( $(parent).is('.TextLine[polyrect]') ) {
        if ( confirm('WARNING: TextLine with id '+parent.id+' will no longer be a polyrect. Continue?') )
          $(parent).removeAttr('polyrect');
        return false;
      }
      else if ( pageCanvas.util.isRect(elem) ) {
        if ( $('#rectMode input').prop('checked') )
          return true;
        if ( ! confirm('WARNING: '+($(parent).attr('class').replace(/ .*/,''))+' with id '+parent.id+' will no longer be a rectangle. Continue?') )
          return false;
      }
    }
    return true;
  }

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
        $.stylesheet('#page_styles { #textedit, #textinfo }').css( 'height', event.rect.height+'px' );
        adjustSize();
      } );

  /// Cursor coordinates ///
  var
  cursorX = $('#cursorX'),
  cursorY = $('#cursorY');
  function updateCursor( point ) {
    cursorX.text(point.x.toFixed(0));
    cursorY.text(point.y.toFixed(0));
  }
  $('#cursor').mouseover( function () { $('#cursor').toggleClass('cursor-left cursor-right'); } );

  /// Highlighting of editables for a moment ///
  function highlightEditables( timeout ) {
      if ( typeof timeout === 'undefined' || timeout ) {
        //$('.editable').addClass('highlight');
        $('#xpg').addClass('highlight');
        var num = ++hTimeoutNum;
        window.setTimeout( function () {
            if ( num == hTimeoutNum )
              $('#xpg').removeClass('highlight');
              //$('.highlight').removeClass('highlight');
          }, 500 );
      }
      else
        $('#xpg').toggleClass('highlight');
        //$('.editable').toggleClass('highlight');
      return false;
    }
  var hTimeoutNum = 0;
  $('#modeElement').on( 'click', highlightEditables );
  Mousetrap.bind( 'mod+h', highlightEditables );
  Mousetrap.bind( 'mod+shift+h', function () { highlightEditables(false); } );

  /// Show only image for a moment ///
  function showOnlyImage( timeout ) {
      if ( typeof timeout === 'undefined' || timeout ) {
        $('#xpg').addClass('onlyimage');
        var num = ++iTimeoutNum;
        window.setTimeout( function () {
            if ( num == iTimeoutNum )
              $('.onlyimage').removeClass('onlyimage');
          }, 500 );
      }
      else
        $('#xpg').toggleClass('onlyimage');
      return false;
    }
  var iTimeoutNum = 0;
  Mousetrap.bind( 'mod+i', showOnlyImage );


  /// Setup text filter ///
  function filterMode( event ) {
    var
    jqfilter = '',
    filter_input = $('#textFilter input')[0],
    text = filter_input.value.replace(/[\t\n\r]/g,' ').trim();
    if ( $('#textFilter').is(":visible") && text )
      text.split(/\s+/)
        .forEach( function( w ) {
          w = w.trim();
          jqfilter += /[.[:#]/.test(w[0]) ? w : ':contains("'+w+'")';
        } );
    pageCanvas.cfg.modeFilter = jqfilter;
    handleEditMode();
    $(filter_input).focus();
    return false;
  }
  $('#textFilter input').on( 'input', filterMode );
  Mousetrap.bind( 'mod+f', function () { $('#textFilter').toggle(); return filterMode(); } );
  $('#clearFilter').click( function () {
      $('#textFilter input').val('');
      filterMode();
    } );

  /// Make jQuery :contains case insensitive to improve filter usage experience ///
  jQuery.expr[':'].Contains = function(a, i, m) {
    return jQuery(a).text().toUpperCase()
        .indexOf(m[3].toUpperCase()) >= 0;
  };
  jQuery.expr[':'].contains = function(a, i, m) {
    return jQuery(a).text().toUpperCase()
        .indexOf(m[3].toUpperCase()) >= 0;
  };

  /// Drawer button ///
  Mousetrap.bind( 'mod+m', function () { $('#drawerButton').click(); return false; } );
  $('#drawerButton').click( function() {
      $('#drawer').toggle();
      $(this).toggleClass('is-active');
    } );

  /// Save state of drawer in local storage ///
  function saveDrawerState() {
    var drawerState = {};
    $('#drawer label').each( function () {
        var input = $(this).children('input');
        switch( input.attr('type') ) {
          case 'checkbox':
            drawerState[this.id] = input.prop('checked');
            break;
          case 'radio':
            if ( input.prop('checked') )
              drawerState[input.attr('name')] = this.id;
            break;
          case 'text':
            drawerState[this.id] = input.val();
            break;
        }
      } );

    localStorage.drawerState = JSON.stringify(drawerState);
  }

  /// Load drawer state from local storage ///
  function loadDrawerState() {
    if ( typeof localStorage.drawerState === 'undefined' ) {
      console.log('warning: drawer state not found in local storage');
      return handleEditMode();
    }

    var drawerState = JSON.parse(localStorage.drawerState);
    $('#drawer label').each( function () {
        var input = $(this).children('input');
        switch( input.attr('type') ) {
          case 'checkbox':
            if ( typeof drawerState[this.id] !== 'undefined' )
              input.prop('checked',drawerState[this.id]);
            break;
          case 'radio':
            if ( typeof drawerState[input.attr('name')] !== 'undefined' &&
                 drawerState[input.attr('name')] === this.id )
              input.prop('checked',true);
            break;
          case 'text':
            if ( typeof drawerState[this.id] !== 'undefined' )
              input.val(drawerState[this.id]);
            break;
        }
      } );

    handleEditMode();
  }

  /// Restore saved drawer state on window initialization ///
  loadDrawerState();

  /// Save drawer state on non-mode drawer changes ///
  $('#generalFieldset input, #newPropsFieldset input, #visibilityFieldset input')
    .change(saveDrawerState);

  /// Setup page rotations ///
  function handlePageRotation( event ) {
    pageCanvas.util.rotatePage( event.target.id === 'rotateClockwise' ? 90 : -90 );
    return false;
  }
  $('#rotateClockwise, #rotateAnticlockwise').click(handlePageRotation);

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

  /// Setup selected centering checkbox ///
  function handleXmlTextValidate() {
    pageCanvas.cfg.textValidator = $(this).children('input').prop('checked') ?
      pageCanvas.util.strXmlValidate :
      function () { return false; };
  }
  $('#xmlTextValidate')
    .each(handleXmlTextValidate)
    .click(handleXmlTextValidate);

  /// Setup readme ///
  $.ajax({ url: '../README.md', dataType: 'text' })
    .fail( function () { console.log('Failed to retrieve readme.'); } )
    .done( function ( data ) {
        $('#readme-modal > .modal-content')[0].innerHTML = marked(data);
      } );
  $('#openReadme').click( function () { $('#readme-modal').addClass('modal-active'); } );

  $('.modal-content').click( function (e) { e.stopPropagation(); } );
  $('[id$=-modal]').click( function () { $('.modal-active').removeClass('modal-active'); } );

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
      switch ( $(this).children('input').attr('value') ) {
        case 'u':
          pageCanvas.cfg.baselineFirstAngleRange = [ -Math.PI/4, Math.PI/4 ];
          break;
        case 'l':
          pageCanvas.cfg.baselineFirstAngleRange = [ Math.PI/4, 3*Math.PI/4 ];
          break;
        case 'r':
          pageCanvas.cfg.baselineFirstAngleRange = [ -3*Math.PI/4, -Math.PI/4 ];
          break;
        //case 'd':
        //  pageCanvas.cfg.baselineFirstAngleRange = [ 3*Math.PI/4, -3*Math.PI/4 ];
        //  break;
        case 'a':
          pageCanvas.cfg.baselineFirstAngleRange = null;
          break;
      }
  }
  $('label[id^=orient-]')
    .each(handleTextOrientation)
    .click(handleTextOrientation);

  /// Setup table size ///
  $('label[id^="table-"] input')
    .on( 'input', handleTableSize );
  function handleTableSize () {
    pageCanvas.cfg.tableSize = [
      parseInt($('input[name="table-rows"]').val()),
      parseInt($('input[name="table-cols"]').val()) ];
  }
  handleTableSize();

  /// Setup edit mode selection ///
  function handleEditMode() {
    $('.highlight').removeClass('highlight');

    var
    text = $('#textMode input'),
    rect = $('#rectMode input'),
    twoptb = $('#twoPointBase input'),
    page = $('#pageMode input'),
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

    pageCanvas.cfg.baselineMaxPoints = twoptb.prop('checked') ? 2 : 0;

    $('#editModesFieldset input')
      .prop('disabled',false)
      .parent()
      .removeClass('disabled');

    /// Page mode ///
    if ( page.prop('checked') ) {
      select.prop('checked',true);
      pageCanvas.mode.pageSelect();
      /// Disable invalid ///
      baseline.prop('disabled',true).parent().addClass('disabled');
      coords.prop('disabled',true).parent().addClass('disabled');
      drag.prop('disabled',true).parent().addClass('disabled');
      create.prop('disabled',true).parent().addClass('disabled');
    }

    /// Region modes ///
    else if ( region.prop('checked') ) {
      /// Region select ///
      if ( select.prop('checked') )
         pageCanvas.mode.regionSelect( text.prop('checked') );
      /// Region baselines ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.regionBaselines() ;
      /// Region coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.regionCoords( text.prop('checked'), rect.prop('checked') );
      /// Region drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.regionDrag( text.prop('checked') );
      /// Region create ///
      else if( create.prop('checked') )
        pageCanvas.mode.regionCoordsCreate( rect.prop('checked') );
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
      else if( coords.prop('checked') )
        pageCanvas.mode.lineCoords( text.prop('checked'), rect.prop('checked') );
      /// Line drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.lineDrag( text.prop('checked') );
      /// Line create ///
      else if( create.prop('checked') ) {
        if ( rect.prop('checked') )
          pageCanvas.mode.lineCoordsCreate(true);
        else
          pageCanvas.mode.lineBaselineCreate();
      }
    }

    /// Word modes ///
    else if ( word.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Word select ///
      if ( select.prop('checked') )
        pageCanvas.mode.wordSelect( text.prop('checked') );
      /// Word coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.wordCoords( text.prop('checked'), rect.prop('checked') );
      /// Word drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.wordDrag( text.prop('checked') );
      /// Word create ///
      else if( create.prop('checked') )
        pageCanvas.mode.wordCoordsCreate( rect.prop('checked') );
    }

    /// Glyph modes ///
    else if ( glyph.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Glyph select ///
      if ( select.prop('checked') )
        pageCanvas.mode.glyphSelect( text.prop('checked') );
      /// Glyph coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.glyphCoords( text.prop('checked'), rect.prop('checked') );
      /// Glyph drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.glyphDrag( text.prop('checked') );
      /// Glyph create ///
      else if( create.prop('checked') )
        pageCanvas.mode.glyphCoordsCreate( rect.prop('checked') );
    }

    /// Table modes ///
    else if ( table.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Table select ///
      if ( select.prop('checked') )
        pageCanvas.mode.cellSelect( text.prop('checked') );
      /// Table points ///
      else if( coords.prop('checked') )
        pageCanvas.mode.tablePoints( rect.prop('checked') );
      /// Table drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.tableDrag();
      /// Table create ///
      else if( create.prop('checked') )
        pageCanvas.mode.tableCreate( rect.prop('checked') );
    }

    $('#modeElement').text('-/'+$('.editable').length);
    highlightEditables();
    saveDrawerState();
  }
  $('#editModesFieldset input')
    .click(handleEditMode);
} );
