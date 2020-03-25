/**
 * Interactive editing of Page XMLs functionality.
 *
 * @version $Version: 2020.03.25$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

/* jshint esversion: 6 */

/* @todo Capture tabs when modals open */

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
          if ( pageCanvas.cfg.modeFilter === '.xpath-select' )
            filterMode();
          setDocumentProperties();
        },
      onMouseMove: updateCursor,
      onUnload: function () { $('#stateInfo span').text('-'); },
      onSelect: function ( elem ) {
          var
          g = $(elem).closest('g'),
          editable = pageCanvas.util.getSortedEditables(),
          text = g.find('> .TextEquiv > .Unicode');
          $('#selectedType').text( g.hasClass('TableCell') ? 'TableCell' : g.attr('class').replace(/ .*/,'') );
          $('#selectedId').text( g.is('.Page') && ! g.attr('id') ? $('.Page').index(g)+1 : g.attr('id') );
          $('#modeElement').text((editable.index(g)+1)+'/'+editable.length);

          updateSelectedInfo();

          if ( text.length !== 0 ) {
            text = pageCanvas.cfg.textFormatter(text.html());
            $('#textedit').val(text);
          }
          else
            $('#textedit').val('');

          $('[class*=selected-parent-]').removeClass( function (index, className) {
              return (className.match(/(^|\s)selected-parent-\S+/g) || []).join(' ');
            } );
          g.closest('.Word').addClass('selected-parent-word');
          g.closest('.TextLine').addClass('selected-parent-line');
          g.closest('.TextRegion').addClass('selected-parent-region');
          g.closest('.Page').addClass('selected-parent-page');

          if ( prop_modal.hasClass('modal-active') )
            populatePropertyModal(g);
        },
      onSelectedDblclick: function () { openPropertyModal($('.selected')); },
      onProtectionChange: updateSelectedInfo,
      onPointsChangeEnd: function ( elem ) {
          if ( $(elem).closest('g').is('.TextLine') )
            updateSelectedInfo();
        },
      onFinishCoords: editModeAfterCreate,
      onFinishBaseline: editModeAfterCreate,
      onFinishTable: editModeAfterCreate,
      onEscOverride: function () {
          if ( prop_modal.is('.modal-active') ) {
            closePropModal();
            return false;
          }
          else if ( $('#readme-modal').is('.modal-active') ) {
            $('#readme-modal').removeClass('modal-active');
            return false;
          }
          else if ( window.getComputedStyle($('#drawer')[0]).display !== 'none' ) {
            $('#drawerButton').click();
            return false;
          }
          return true;
        },
      onNoEditEsc: function () {
          $('[class*=selected-parent-]').removeClass( function (index, className) {
              return (className.match(/(^|\s)selected-parent-\S+/g) || []).join(' ');
            } );
        },
      onUnselect: function () {
          $('#selectedType').text('-');
          $('#selectedId').text('-');
          $('#modeElement').text('-/'+$('.editable').length);
          $('#textedit').val('');
          $('#textinfo').empty();
          setDocumentProperties();
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
            .find('[class*=selected-parent-]')
            .removeClass( function (index, className) {
                return (className.match(/(^|\s)selected-parent-\S+/g) || []).join(' ');
              } );
          clone
            .find('.xpath-select')
            .removeClass('xpath-select');
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
      onValidText: function () { $('#textedit').removeClass('field-invalid'); },
      onInvalidText: function () { $('#textedit').addClass('field-invalid'); },
      onInvalidTextUnselect: function ( err ) { alert('Invalid XML text: '+err.message); },
      allowPointsChange: confirmCoordsChange,
      allowRemovePolyPoint: confirmCoordsChange,
      allowAddPolyPoint: confirmCoordsChange
    } );

  var entsToReplace = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  };
  function replaceEnts(ent) {
    return entsToReplace[ent] || ent;
  }
  function escapeEnts(str) {
    return str.replace(/[&<>]/g, replaceEnts);
  }

  function scaleFont( fact ) {
    var
    currSize = parseFloat( $('#textinfo').css('font-size') ),
    cssrule = '#'+pageCanvas.cfg.stylesId+'{ #textedit, #textinfo }';
    $.stylesheet(cssrule).css( 'font-size', (fact*currSize)+'px' );
    saveDrawerState();
  }
  Mousetrap.bind( 'mod+shift+pagedown', function () { scaleFont(0.9); return false; } );
  Mousetrap.bind( 'mod+shift+pageup', function () { scaleFont(1/0.9); return false; } );

  /// Display info about selected element ///
  function updateSelectedInfo() {
    var
    elem = $('.selected').closest('g'),
    info = '',
    isprotected = pageCanvas.util.isReadOnly(elem),
    imgorie = elem.closest('.Page').children('.PageImage').attr('orientation'),
    orie = pageCanvas.util.getBaselineOrientation(elem),
    textsetby = $(elem).children('.TextEquiv').attr('setBy'),
    coordssetby = $(elem).children('.Coords').attr('setBy'),
    baselinesetby = $(elem).children('.Baseline').attr('setBy'),
    textconf = pageCanvas.util.getTextConf(elem),
    coordsconf = pageCanvas.util.getCoordsConf(elem),
    baselineconf = pageCanvas.util.getBaselineConf(elem),
    props = pageCanvas.util.getPropertiesWithConf(elem),
    members = pageCanvas.util.getGroupMembersWithConf(elem),
    readdir = pageCanvas.util.getReadingDirection(elem);
    if ( isprotected )
      info += '<div>Element is <b>protected</b></div>';
    info += readdir !== 'ltf' ? '' : '<div>Read direction: '+pageCanvas.util.getReadingDirection()+'</div>';
    if ( imgorie && parseInt(imgorie) )
      info += '<div>Image orientation: '+imgorie+'°</div>';
    if ( textsetby || textconf ) {
      info += '<div>TextEquiv:</div>';
      if ( textsetby )
        info += '<div>&nbsp;&nbsp;setBy: '+textsetby+'</div>';
      if ( textconf )
        info += '<div>&nbsp;&nbsp;conf: '+textconf+'</div>';
    }
    if ( coordssetby || coordsconf ) {
      info += '<div>Coords:</div>';
      if ( coordssetby )
        info += '<div>&nbsp;&nbsp;setBy: '+coordssetby+'</div>';
      if ( coordsconf )
        info += '<div>&nbsp;&nbsp;conf: '+coordsconf+'</div>';
    }
    if ( baselinesetby || baselineconf || typeof orie !== 'undefined' ) {
      info += '<div>Baseline:</div>';
      if ( typeof orie !== 'undefined' )
        info += '<div>&nbsp;&nbsp;orientation: '+((orie*180/Math.PI).toFixed(1))+'°</div>';
      if ( baselinesetby )
        info += '<div>&nbsp;&nbsp;setBy: '+baselinesetby+'</div>';
      if ( baselineconf )
        info += '<div>&nbsp;&nbsp;conf: '+baselineconf+'</div>';
    }
    if ( elem.is('.Group') ) {
      if ( elem.attr('conf') )
        info += '<div>Group confidence: '+elem.attr('conf')+'</div>';
      info += '<div>Group members:</div>';
      for ( var m=0; m<members.length; m++ ) {
        info += '<div>&nbsp;&nbsp;id='+members[m].id+'&nbsp;&nbsp;type='+members[m].type;
        if ( members[m].conf )
          info += '&nbsp;&nbsp;conf='+members[m].conf;
        info += '</div>';
      }
    }
    if ( Object.keys(props).length ) {
      info += '<div>Properties:</div>';
      info += formatProps(props);
    }
    elem.parents('g').each( function() {
        var props = pageCanvas.util.getPropertiesWithConf(this);
        if ( Object.keys(props).length ) {
          info += '<div>Properties of ancestor '+$(this).attr('class').replace(/ .*/,'')+':</div>';
          info += formatProps(props);
        }
      } );
    $('#textinfo').html(info);
  }

  function closeDocument() {
    pageCanvas.clearCanvas();
    $('#textinfo').empty();
  }
  pageCanvas.closeDocument = closeDocument;

  function setDocumentProperties() {
    var
    info = '',
    procs = $('svg > Metadata > Process'),
    page_imgs = $('.PageImage'),
    props = pageCanvas.util.getPropertiesWithConf($('svg'));
    info += '<div>Metadata:</div>';
    info += '<div>&nbsp;&nbsp;Creator: '+$('svg > Metadata > Creator').text()+'</div>';
    info += '<div>&nbsp;&nbsp;Created: '+$('svg > Metadata > Created').text()+'</div>';
    info += '<div>&nbsp;&nbsp;LastChange: '+$('svg > Metadata > LastChange').text()+'</div>';
    procs.each( function ( idx ) {
        var
        proc_id = $(this).attr('id'),
        proc_start = $(this).attr('started'),
        proc_time = $(this).attr('time'),
        proc_tool = $(this).attr('tool'),
        proc_ref = $(this).attr('ref');
        info += '<div>&nbsp;&nbsp;Process '+idx+':';
        if ( proc_id )
          info += ' id='+proc_id;
        info += ' started='+proc_start+' time='+proc_time;
        if ( proc_tool )
          info += ' tool="'+proc_tool+'"';
        if ( proc_ref )
          info += ' ref="'+proc_ref+'"';
      } );
    if ( Object.keys(props).length ) {
      info += '<div>Document properties:</div>';
      info += formatProps(props);
    }
    info += '<div>Document pages:</div>';
    for ( var n=0; n<page_imgs.length; n++ )
      info += '<div>&nbsp;&nbsp;'+(n+1)+': '+escapeEnts(page_imgs.eq(n).attr('data-href'))+'</div>';
    $('#textinfo').html(info);
  }

  function formatProps( props ) {
    var info='';
    for ( var k in props ) {
      var
      value = props[k].value?'&nbsp;&nbsp;⇒&nbsp;&nbsp;'+escapeEnts(props[k].value):'',
      conf = props[k].conf?'conf='+props[k].conf:'',
      setBy = props[k].setBy?'setBy='+props[k].setBy:'';
      extra = conf||setBy?'&nbsp;('+conf+(conf&&setBy?' ':'')+setBy+')':'';
      info += '<div>&nbsp;&nbsp;'+escapeEnts(k)+extra+value+'</div>';
    }
    return info;
  }

  /// Setup properties modal box ///
  var
  prop_elem = null,
  prop_modal = $('#prop-modal'),
  props_div = $('#props'),
  text_props_div = $('div.modal-textequiv-props'),
  coords_props_div = $('div.modal-coords-props'),
  baseline_props_div = $('div.modal-baseline-props');
  $('#prop-modal .close').click(closePropModal);
  $(window).click( function (event) { if (event.target == prop_modal[0]) closePropModal(); } );
  Mousetrap.bind( 'mod+e', function () { openPropertyModal($('.selected')); } );

  function closePropModal() {
    flushPropertyModal();
    prop_modal.removeClass('modal-active');
  }

  function flushPropertyModal() {
    var keys = [];
    props_div.find('div:not([isnew])').each( function () {
        var
        key = $(this).find('input.key').val().trim();
        if ( ! key )
          $(this).find('button').click();
        else
          keys.push(key);
      } );
    props_div.find('div[isnew]').each( function () {
        var
        key = $(this).find('input.key').val().trim(),
        val = $(this).find('input.val').val().trim(),
        setBy = $(this).find('input.setBy').val().trim(),
        conf = $(this).find('input.conf').val().trim();
        if ( ! key )
          return;
        if ( $.inArray(key,keys) >= 0 )
          return pageCanvas.warning('Refusing to replace duplicate property: key='+key);
        pageCanvas.util.setProperty( key, val, prop_elem, true, conf, setBy );
      } );
    Mousetrap.unbind('alt+a');
    props_div.empty();
    text_props_div.empty();
    coords_props_div.empty();
    baseline_props_div.empty();
    $('.modal-textequiv-props').hide();
    $('.modal-coords-props').hide();
    $('.modal-baseline-props').hide();
    $('#props-target').html();
    if ( prop_elem ) {
      if ( prop_elem.is($('.Page').parent()) )
        setDocumentProperties();
      else
        updateSelectedInfo();
    }
    prop_elem = null;
  }

  function openPropertyModal( elem ) {
    if ( elem.is('.selected') )
      elem = elem.closest('g');
    else
      elem = $('.Page').parent();
    populatePropertyModal(elem);
    prop_modal.addClass('modal-active');
    $('#props input.key').focus();
    event.stopPropagation();
  }

  function populatePropertyModal( elem ) {
    flushPropertyModal();
    var
    isreadonly = pageCanvas.util.isReadOnly(elem),
    add = $('<button tabIndex="-1">Add new property (alt+a)</button>');//,
    target = $('#selectedType').text()+' '+$('#selectedId').text();
    prop_elem = elem;

    $('#props-target').html( target === '- -' ? 'Document' : target );

    function updateElemConf( elem, input ) {
      var
      elem_name = elem.attr('class').replace(/ .*/, ''),
      conf_val = parseFloat(input[0].value);
      if ( conf_val >= 0.0 && conf_val <= 1.0 && ! isNaN(conf_val) ) {
        input.removeClass('field-invalid');
        elem.attr('conf', input[0].value);
        pageCanvas.registerChange(elem_name+' confidence '+elem.parent().attr('id'));
      }
      else {
        input.addClass('field-invalid');
        elem.removeAttr('conf');
        pageCanvas.registerChange(elem_name+' confidence '+elem.parent().attr('id'));
      }
    }

    function updateElemSetBy( elem, input ) {
      var
      elem_name = elem.attr('class').replace(/ .*/, '');
      setBy_val = input[0].value.trim();
      if ( setBy_val ) {
        elem.attr('setBy', setBy_val);
        pageCanvas.registerChange(elem_name+' setBy '+elem.parent().attr('id'));
      }
      else {
        elem.removeAttr('setBy');
        pageCanvas.registerChange(elem_name+' setBy '+elem.parent().attr('id'));
      }
    }

    function addConfsInput() {
      var
      textsetby = $(elem).children('.TextEquiv').attr('setBy'),
      coordssetby = $(elem).children('.Coords').attr('setBy'),
      baselinesetby = $(elem).children('.Baseline').attr('setBy'),
      textconf = pageCanvas.util.getTextConf(elem),
      coordsconf = pageCanvas.util.getCoordsConf(elem),
      baselineconf = pageCanvas.util.getBaselineConf(elem);
      if ( elem.children('.TextEquiv').length > 0 ) {
        var
        textsetbyin = $('<input tabIndex="1" class="setBy mousetrap" type="text" value="'+(textsetby?textsetby:'')+'"/>'), 
        textconfin = $('<input tabIndex="1" class="conf mousetrap" type="text" value="'+(textconf?textconf:'')+'"/>');
        textsetbyin.on( 'input', function () { updateElemSetBy( elem.children('.TextEquiv'), textsetbyin ); } );
        textconfin.on( 'input', function () { updateElemConf( elem.children('.TextEquiv'), textconfin ); } );
        text_props_div.filter('div')
          .append('setBy:').append(textsetbyin)
          .append('Conf:').append(textconfin);
        $('.modal-textequiv-props').show();
      }
      if ( elem.children('.Coords').length > 0 ) {
        var
        coordssetbyin = $('<input tabIndex="1" class="setBy mousetrap" type="text" value="'+(coordssetby?coordssetby:'')+'"/>'), 
        coordsconfin = $('<input tabIndex="1" class="conf mousetrap" type="text" value="'+(coordsconf?coordsconf:'')+'"/>');
        coordssetbyin.on( 'input', function () { updateElemSetBy( elem.children('.Coords'), coordssetbyin ); } );
        coordsconfin.on( 'input', function () { updateElemConf( elem.children('.Coords'), coordsconfin ); } );
        coords_props_div.filter('div')
          .append('setBy:').append(coordssetbyin)
          .append('Conf:').append(coordsconfin);
        $('.modal-coords-props').show();
      }
      if ( elem.children('.Baseline').length > 0 ) {
        var
        baselinesetbyin = $('<input tabIndex="1" class="setBy mousetrap" type="text" value="'+(baselinesetby?baselinesetby:'')+'"/>'), 
        baselineconfin = $('<input tabIndex="1" class="conf mousetrap" type="text" value="'+(baselineconf?baselineconf:'')+'"/>');
        baselinesetbyin.on( 'input', function () { updateElemSetBy( elem.children('.Baseline'), baselinesetbyin ); } );
        baselineconfin.on( 'input', function () { updateElemConf( elem.children('.Baseline'), baselineconfin ); } );
        baseline_props_div.filter('div')
          .append('setBy:').append(baselinesetbyin)
          .append('Conf:').append(baselineconfin);
        $('.modal-baseline-props').show();
      }
    }

    function checkInvalidKeys() {
      var keyDict = {};
      props_div.find('input.key').each(function () {
          var tkey = $(this).val().trim();
          if ( tkey in keyDict ) {
            keyDict[tkey].count += 1;
            keyDict[tkey].elems.push(this);
          }
          else
            keyDict[tkey] = {'count': 1, 'elems': [this]};
        });
      for ( const [k, v] of Object.entries(keyDict) )
        if ( v.count > 1 )
          $(v.elems).addClass('field-invalid');
        else
          $(v.elems).removeClass('field-invalid');
    }

    function addPropInput( prop, isnew ) {
      var
      prop_val = prop.attr('value'),
      prop_setBy = prop.attr('setBy'),
      prop_conf = prop.attr('conf'),
      div = $('<div/>'),
      key = $('<input tabIndex="1" class="key mousetrap" type="text" value="'+escapeEnts(prop.attr('key'))+'"/>'),
      val = $('<input tabIndex="1" class="val mousetrap" type="text" value="'+(prop_val?escapeEnts(prop_val):'')+'"/>'),
      setBy = $('<input tabIndex="1" class="setBy mousetrap" type="text" value="'+(prop_setBy?escapeEnts(prop_setBy):'')+'"/>'),
      conf = $('<input tabIndex="1" class="conf mousetrap" type="text" value="'+(prop_conf?escapeEnts(prop_conf):'')+'"/>'),
      del = $('<button tabIndex="-1">🗑</button>');
      if ( isreadonly ) {
        key.prop('disabled',true);
        val.prop('disabled',true);
        setBy.prop('disabled',true);
        conf.prop('disabled',true);
      }
      if ( typeof isnew !== 'undefined' && isnew )
        div.attr('isnew','');
      key.on( 'input', function () {
          prop.attr('key',key[0].value);
          checkInvalidKeys();
          if ( ! div.is('[isnew]') )
            pageCanvas.registerChange('properties '+elem.attr('id'));
        } );
      val.on( 'input', function () {
          prop.attr('value',val[0].value);
          pageCanvas.registerChange('properties '+elem.attr('id'));
        } );
      setBy.on( 'input', function () { updateElemSetBy( prop, setBy ); } );
      conf.on( 'input', function () { updateElemConf( prop, conf ); } );
      del.click( function () {
          if ( isreadonly )
            return pageCanvas.warning('Not possible to remove properties from read only elements');
          var elem_desc = '';
          if ( elem.is('svg') )
            elem_desc = 'document';
          else
            elem_desc = elem.attr('class').replace(/ .*/,'')+' with id='+elem.attr('id');
          if ( confirm('Delete property with key="'+prop.attr('key')+'" from '+elem_desc+'?') ) {
            div.remove();
            pageCanvas.util.delProperty( prop.attr('key'), elem );
          }
        } );
      div
        .append('Key:').append(key)
        .append('Value:').append(val)
        .append('setBy:').append(setBy)
        .append('Conf:').append(conf)
        .append(del)
        .insertBefore(add);
      key.focus();
    }

    addConfsInput();
    props_div.empty();
    props_div.append(add);
    Mousetrap.bind( 'alt+a', function () { add.click(); return false; } );
    elem.children('.Property:not([key=protected])').each( function () { addPropInput( $(this) ); } );
    add.click( function () {
        if ( isreadonly )
          return pageCanvas.warning('Not possible to add properties to read only elements');
        addPropInput( $(document.createElementNS(pageCanvas.util.sns,'g')).addClass('Property').attr('key','').attr('value',''), true );
      } );
  }

  /// Ask before modifying polyrect or rect ///
  var axisaligned = $('#axisAligned input');
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
      else if ( ! axisaligned.prop('checked') && pageCanvas.util.isAxisAligned(elem) ) {
        if ( ! confirm('WARNING: '+($(parent).attr('class').replace(/ .*/,''))+' with id '+parent.id+' will no longer be an axis aligned polygon. Continue?') )
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
        saveDrawerState();
        adjustSize();
      } );

  /// Make text info resizable ///
  interact('#textinfo')
    .resizable( { edges: { left: true, right: false, bottom: false, top: false } } )
    .on( 'resizemove', function ( event ) {
        $.stylesheet('#page_styles { #textinfo }').css( 'width', event.rect.width+'px' );
        $.stylesheet('#page_styles { #textedit }').css( 'padding-right', event.rect.width+'px' );
        saveDrawerState();
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


  /// xpath support for filter ///
  function svgResolver() { return pageCanvas.util.sns; }

  /// Setup text filter ///
  var
  filterHistory = [],
  filterPosition = -1,
  textfilter_input = $('#textFilter input')[0],
  textfilter = $('#textFilter');

  function filterMode() {
    var
    jqfilter = '',
    text = textfilter_input.value.replace(/[\t\n\r]+/g,' ').trim();
    if ( textfilter.is(':visible') && text ) {
      if ( text[0] !== '!' )
        text.split(/\s+/)
          .forEach( function( w ) {
            w = w.trim();
            jqfilter += /[.[:#]/.test(w[0]) ? w : ':contains('+w+')';
          } );
      else {
        $('.xpath-select').removeClass('xpath-select');
        var
        num = 0,
        sel = [];
        try {
          var
          iter = document.evaluate(text.substr(1), pageCanvas.util.svgRoot, svgResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null),
          node = iter.iterateNext();
          while ( node ) {
            num++;
            sel.push(node);
            node = iter.iterateNext();
          }
        } catch ( e ) {}
        $(sel).addClass('xpath-select');
        jqfilter = '.xpath-select';
      }
    }
    pageCanvas.cfg.modeFilter = jqfilter;
    handleEditMode();
    $(textfilter_input).focus();
    return false;
  }
  $(textfilter_input)
    .on( 'input', filterMode )
    .on( 'keyup', function (e) {
        if ( e.keyCode == 38 /*up*/ || e.keyCode == 40 /*down*/ ) {
          var newFilterPosition = filterPosition + ( e.keyCode == 38 ? +1 : -1 );
          if ( newFilterPosition >= 0 && newFilterPosition < filterHistory.length ) {
            filterPosition = newFilterPosition;
            textfilter_input.value = filterHistory[filterPosition];
            filterMode();
          }
        }
        else if ( e.keyCode === 13 /*enter*/ ) {
          handleEditMode();
          $(e.target).focus();
          addToFilterHistory();
        }
      } );
  Mousetrap.bind( 'mod+f', function () {
      if ( ! textfilter.is(':visible') ) {
        textfilter.toggle();
        $('.xpath-select').removeClass('xpath-select');
        filterHistory = localStorage.filterHistory ? JSON.parse(localStorage.filterHistory) : [];
      }
      $(textfilter_input).focus();
      return filterMode();
    } );
  function clearFilter() {
    textfilter.toggle(false);
    $('.xpath-select').removeClass('xpath-select');
    filterMode();
  }
  $('#clearFilter').click(clearFilter);
  Mousetrap.bind( 'mod+shift+f', clearFilter );
  function addToFilterHistory() {
    var text = textfilter_input.value.replace(/[\t\n\r]+/g,' ').trim();
    if ( filterHistory.length > 0 && filterHistory[0] == text )
      return;
    filterHistory.unshift(text);
    if ( filterHistory.length > 1000 )
      filterHistory = filterHistory.slice(0, 1000);
    localStorage.filterHistory = JSON.stringify(filterHistory);
  }

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
  Mousetrap.bind( 'mod+enter', function () { $('#drawerButton').click(); return false; } );
  $('#drawerButton').click( function() {
      $('#drawer').toggle();
      $(this).toggleClass('is-active');
    } );

  /// Keyboad shortcuts to cycle through edit modes ///
  function cycleEditMode( name, offset ) {
    var
    opts = $('#editModesFieldset input[name='+name+']:not([disabled])'),
    optsel = opts.index(opts.filter(':checked'));
    if ( opts.length > 1 )
      opts.eq( (optsel+offset)%opts.length ).parent().click();
    return false;
  }
  Mousetrap.bind( 'mod+,', function () { return cycleEditMode( 'mode1', 1 ); } );
  Mousetrap.bind( 'mod+shift+,', function () { return cycleEditMode( 'mode1', -1 ); } );
  Mousetrap.bind( 'mod+.', function () { return cycleEditMode( 'mode2', 1 ); } );
  Mousetrap.bind( 'mod+shift+.', function () { return cycleEditMode( 'mode2', -1 ); } );

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
    $('#drawer select').each( function () {
        drawerState[$(this).attr('name')] = $(this).val();
      } );

    drawerState.bottom_pane_font_size = parseFloat( $('#textinfo').css('font-size') );
    drawerState.bottom_pane_height = $('#textedit').css('height');
    drawerState.bottom_info_width = $('#textinfo').css('width');

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
    $('#drawer select').each( function () {
        if ( typeof drawerState[$(this).attr('name')] !== 'undefined' )
          $(this).val(drawerState[$(this).attr('name')]);
      } );
    if ( 'bottom_pane_font_size' in drawerState )
      $.stylesheet('#page_styles { #textedit, #textinfo }').css( 'font-size', drawerState.bottom_pane_font_size+'px' );
    if ( 'bottom_pane_height' in drawerState ) {
      $.stylesheet('#page_styles { #textedit, #textinfo }').css( 'height', drawerState.bottom_pane_height );
      adjustSize();
    }
    if ( 'bottom_info_width' in drawerState )
      $.stylesheet('#page_styles { #textinfo }').css( 'width', drawerState.bottom_info_width );

    handleEditMode();
  }

  /// Restore saved drawer state on window initialization ///
  loadDrawerState();

  /// Save drawer state on non-mode drawer changes ///
  $('#generalFieldset input, #newPropsFieldset input, #visibilityFieldset input')
    .change(saveDrawerState);

  /// Setup page rotations ///
  function handlePageRotation( event ) {
    var sel = $('.selected');
    if ( sel.length == 0 ) {
      var pgs = $('.Page');
      if ( pgs.length == 1 )
        sel = pgs;
      else
        pageCanvas.cfg.handleWarning('An element needs to be selected to know which page to rotate.');
    }
    pageCanvas.util.rotatePage( event.target.id === 'rotateClockwise' ? 90 : -90, sel );
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
  function populateReadme() {
    $.ajax({ url: '../README.md', dataType: 'text' })
      .fail( function () { console.log('Failed to retrieve readme.'); } )
      .done( function ( data ) {
          $('#readme-modal > .modal-content')[0].innerHTML = marked(data);
          var
          ul = $('<ul/>'),
          content = $('#readme-modal > .modal-content'),
          versions = pageCanvas.getVersion(),
          keys = Object.keys(versions).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
          for ( var k in keys ) {
            k = keys[k];
            $('<li>'+k+': '+versions[k]+'</li>').appendTo(ul);
            //console.log(k+': '+versions[k]);
          }
          $('<h1>Component versions</h1>').appendTo(content);
          ul.appendTo(content);
        } );
  }
  $('#openReadme').click( function () {
      if ( $('#readme-modal > .modal-content').find('*').length === 0 )
        populateReadme();
      $('#readme-modal').addClass('modal-active');
    } );

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

  /// Setup group create/modify params ///
  $('#group-member-type')
    .on( 'input', function () { handleEditMode(false); } );
  $('#group-members input')
    .on( 'blur', function () { handleGroupSize(); } )
    .on( 'keyup', handleGroupSize );
  function handleGroupSize (e) {
    if ( !e || e.keyCode === 13 /*enter*/ ) {
      var group_size = parseInt($('#group-members input').val());
      if ( isNaN(group_size) || group_size < 1 )
        $('#group-members input').val('1');
      handleEditMode(false);
    }
  }
  handleGroupSize();

  /// Setup edit mode after create ///
  function editModeAfterCreate( elem, elem_type ) {
    if ( ! $('#editAfterCreate input')[0].checked )
      return;
    window.setTimeout( function () {
        if ( elem_type === 'Baseline' )
          $('#baseMode input')[0].checked = true;
        else
          $('#coorMode input')[0].checked = true;
        handleEditMode(false);
        $(elem).click();
      }, 200 );
  }

  /// Setup tab selection ///
  $('#tab-sort, [id^=tab-sort-]')
    .each(handleTabSort)
    .click(handleTabSort);
  function handleTabSort() {
    var radio = $('label[id^=tab-sort-] input');
    radio.prop('disabled',true).parent().addClass('disabled');
    if ( $('#tab-sort input').prop('checked') ) {
      var sel = '.'+radio.filter(':checked').attr('value');
      console.log('sort sel: '+sel);
      pageCanvas.cfg.editablesSortCompare = function (a,b) { return decreasingConf(a,b,sel); };
      radio.prop('disabled',false).parent().removeClass('disabled');
    }
    else
      pageCanvas.cfg.editablesSortCompare = null;
    pageCanvas.mode.current();
    saveDrawerState();
  }

  function decreasingConf(a, b, sel) {
    var
    ca = $(a).children(sel).attr('conf'),
    cb = $(b).children(sel).attr('conf');
    ca = typeof ca === 'undefined' ? 1e10 : parseFloat(ca);
    cb = typeof cb === 'undefined' ? 1e10 : parseFloat(cb);
    return cb - ca;
  }

  /// Handle text clip ///
  $('#clip-text-reg')
    .each(handleTextClip)
    .click(handleTextClip);
  function handleTextClip() {
    pageCanvas.util.setTextClipping( $(this).children('input').prop('checked') );
  }

  /// Setup edit mode selection ///
  function handleEditMode( showHightlight ) {
    $('.highlight').removeClass('highlight');

    var
    text = $('#textMode input'),
    edit = $('#editAfterCreate input'),
    text_checked = $('#textMode input').prop('checked'),
    rect_checked = $('#coordsRestriction').val() === '4',
    axis_checked = $('#axisAligned input').prop('checked'),
    line_type = $('#textlineRestriction').val(),
    group_member_type = $('#group-member-type').val(),
    group_size = parseInt($('#group-members input').val()),
    other_region = $('#otherMode [list="other-regions"]').val(),
    other_region_type,
    page = $('#pageMode input'),
    region = $('#regMode input'),
    line = $('#lineMode input'),
    word = $('#wordMode input'),
    glyph = $('#glyphMode input'),
    table = $('#tabMode input'),
    group = $('#groupMode input'),
    other = $('#otherMode input'),
    all = $('#allMode input'),
    select = $('#selMode input'),
    baseline = $('#baseMode input'),
    coords = $('#coorMode input'),
    drag = $('#dragMode input'),
    create = $('#createMode input');
    modify = $('#modifyMode input');

    pageCanvas.cfg.coordsMaxPoints = rect_checked ? 4 : 0;

    if ( ! other_region ) {
      $('#otherMode [list="other-regions"]').val('ImageRegion');
      other_region = 'ImageRegion';
    }
    if ( other_region != 'ImageRegion' && other_region != 'SeparatorRegion' && other_region != 'CustomRegion' ) {
      other_region_type = other_region;
      other_region = 'CustomRegion';
    }
    function isvalidpoly( points, elem, complete ) { return pageCanvas.util.isValidCoords(points, elem, complete, other_region); }

    var coords_restriction = false;
    if ( $('#coordsRestriction').val() === '4' && axis_checked )
      coords_restriction = pageCanvas.enum.restrict.AxisAlignedRectangle;
    else if ( axis_checked )
      coords_restriction = pageCanvas.enum.restrict.AxisAligned;

    $('#editModesFieldset input')
      .prop('disabled',false)
      .parent()
      .removeClass('disabled');

    function disable_invalid(list) {
      for ( var n=0; n<list.length; n++ )
        list[n].prop('disabled',true).parent().addClass('disabled');
    }

    /// Page mode ///
    if ( page.prop('checked') ) {
      select.prop('checked',true);
      pageCanvas.mode.pageSelect();
      /// Disable invalid ///
      disable_invalid([baseline, coords, drag, create, modify, text, edit]);
    }

    /// Region modes ///
    else if ( region.prop('checked') ) {
      /// Disable invalid ///
      if ( modify.prop('checked') )
        select.prop('checked',true);
      disable_invalid([modify]);
      /// Region select ///
      if ( select.prop('checked') )
         pageCanvas.mode.regionSelect( text_checked );
      /// Region baselines ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.regionBaselines() ;
      /// Region coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.regionCoords( text_checked, coords_restriction );
      /// Region drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.regionDrag( text_checked );
      /// Region create ///
      else if( create.prop('checked') )
        pageCanvas.mode.regionCoordsCreate( coords_restriction );
    }

    /// Line modes ///
    else if ( line.prop('checked') ) {
      /// Disable invalid ///
      if ( modify.prop('checked') )
        select.prop('checked',true);
      disable_invalid([modify]);
      /// Line select ///
      if ( select.prop('checked') )
        pageCanvas.mode.lineSelect( text_checked );
      /// Line baseline ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.lineBaseline( text_checked, coords_restriction );
      /// Line coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.lineCoords( text_checked, coords_restriction );
      /// Line drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.lineDrag( text_checked );
      /// Line create ///
      else if( create.prop('checked') ) {
        var line_restriction = false;
        if ( line_type === '4' && axis_checked )
          line_restriction = pageCanvas.enum.restrict.AxisAlignedRectangle;
        else if ( axis_checked )
          line_restriction = pageCanvas.enum.restrict.AxisAligned;
        if ( line_type === '4' || line_type === '3+' ) {
          pageCanvas.cfg.coordsMaxPoints = line_type === '4' ? 4 : 0;
          pageCanvas.mode.lineCoordsCreate( line_restriction );
        }
        else {
          pageCanvas.cfg.polyrectOffset = parseFloat($('#baselineOffset').val());
          pageCanvas.cfg.baselineMaxPoints = line_type === '1' ? 2 : 0;
          pageCanvas.mode.lineBaselineCreate( line_restriction );
        }
      }
    }

    /// Word modes ///
    else if ( word.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') || modify.prop('checked') )
        select.prop('checked',true);
      disable_invalid([baseline, modify]);
      /// Word select ///
      if ( select.prop('checked') )
        pageCanvas.mode.wordSelect( text_checked );
      /// Word coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.wordCoords( text_checked, coords_restriction );
      /// Word drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.wordDrag( text_checked );
      /// Word create ///
      else if( create.prop('checked') )
        pageCanvas.mode.wordCoordsCreate( coords_restriction );
    }

    /// Glyph modes ///
    else if ( glyph.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') || modify.prop('checked') )
        select.prop('checked',true);
      disable_invalid([baseline, modify]);
      /// Glyph select ///
      if ( select.prop('checked') )
        pageCanvas.mode.glyphSelect( text_checked );
      /// Glyph coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.glyphCoords( text_checked, coords_restriction );
      /// Glyph drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.glyphDrag( text_checked );
      /// Glyph create ///
      else if( create.prop('checked') )
        pageCanvas.mode.glyphCoordsCreate( coords_restriction );
    }

    /// Table modes ///
    else if ( table.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') || modify.prop('checked') )
        select.prop('checked',true);
      disable_invalid([baseline, modify]);
      /// Table select ///
      if ( select.prop('checked') )
        pageCanvas.mode.cellSelect( text_checked );
      /// Table points ///
      else if( coords.prop('checked') )
        pageCanvas.mode.tablePoints( axis_checked ? pageCanvas.enum.restrict.AxisAlignedRectangle : null );
      /// Table drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.tableDrag();
      /// Table create ///
      else if( create.prop('checked') )
        pageCanvas.mode.tableCreate( axis_checked ? pageCanvas.enum.restrict.AxisAlignedRectangle : null );
    }

    /// Group modes ///
    else if ( group.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      disable_invalid([baseline, coords, drag, text]);
      /// Group select ///
      if ( select.prop('checked') )
        pageCanvas.mode.groupSelect();
      /// Group create ///
      else if( create.prop('checked') )
        pageCanvas.mode.addGroup( group_member_type, group_size, function (e) {
            if ( edit.prop('checked') )
              modify.click();
            else
              select.click();
            window.setTimeout( function () { $(e).click(); }, 100 );
          } );
      /// Group modify ///
      else if( modify.prop('checked') )
        pageCanvas.mode.modifyGroup( group_member_type );
    }

    /// Other regions modes ///
    else if ( other.prop('checked') ) {
      var other_region_sel = '.'+other_region;
      afterCreate = function () {};
      if ( other_region_type ) {
        other_region_sel = '.'+other_region+'[type="'+other_region_type+'"]';
        afterCreate = function ( elem ) { $(elem).parent().attr('type', other_region_type); };
      }
      /// Disable invalid ///
      if ( baseline.prop('checked') || modify.prop('checked') )
        select.prop('checked',true);
      disable_invalid([baseline, modify, text]);
      /// Region select ///
      if ( select.prop('checked') )
        pageCanvas.mode.select( other_region_sel, ':not('+other_region_sel+') > .Coords' );
      /// Region coords ///
      else if( coords.prop('checked') ) {
        if ( coords_restriction )
          pageCanvas.mode.rect( other_region_sel, '> .Coords', ':not('+other_region_sel+') > .Coords', isvalidpoly );
        else
          pageCanvas.mode.points( other_region_sel, '> .Coords', ':not('+other_region_sel+') > .Coords', isvalidpoly );
      }
      /// Region drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.drag( other_region_sel+':hasCoords', '.Page', undefined, ':not('+other_region_sel+') > .Coords' );
      /// Region create ///
      else if( create.prop('checked') )
        pageCanvas.mode.editModeCoordsCreate( coords_restriction, other_region_sel, other_region, '.Page', other_region[0].toLowerCase(), afterCreate );
    }

    /// All mode ///
    else if ( all.prop('checked') ) {
      select.prop('checked',true);
      pageCanvas.mode.allSelect( text_checked );
      /// Disable invalid ///
      disable_invalid([baseline, coords, drag, create, modify, edit]);
    }

    var
    modeElem = $('#editModesFieldset input[name=mode1]:checked').parent().text().trim(),
    modeType = $('#editModesFieldset input[name=mode2]:checked').parent().text().trim();
    if ( $('#editModesFieldset input[name=mode1]:checked').parent().attr('id') == 'otherMode' ) {
      modeElem = $('#editModesFieldset input[list=other-regions]').val();
      if ( modeElem != 'ImageRegion' && modeElem != 'SeparatorRegion' && modeElem != 'CustomRegion' )
        modeElem = 'CustomRegion['+modeElem+']';
    }

    $('#modeActive').text(modeElem+'-'+modeType);
    $('#modeElement').text('-/'+$('.editable').length);
    if ( typeof showHightlight === 'undefined' || showHightlight )
      highlightEditables();
    saveDrawerState();
  }
  $('#editModesFieldset select, #editModesFieldset input, #newPropsFieldset select, #newPropsFieldset input')
    .change(handleEditMode);

  /// Handle round points ///
  $('#roundPoints')
    .each(handleRoundPoints)
    .click(handleRoundPoints);
  function handleRoundPoints() {
    pageCanvas.cfg.roundPoints = $(this).children('input').prop('checked');
  }
} );
