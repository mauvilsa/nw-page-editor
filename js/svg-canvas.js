/**
 * Javascript library for viewing and interactive editing of SVGs.
 *
 * @version $Version: 2016-09-23$
 * @author Mauricio Villegas <mauvilsa@upv.es>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauvilsa@upv.es>
 * @license MIT License
 */

// @todo Bug: draggable may be behind other elements, could add transparent polygon on top to ease dragging
// @todo Zoom dependent on mouse cursor position if mouse wheel or on selected element if keyboard
// @todo Search within text nodes
// @todo Allow use without keyboard shortcuts and no Mousetrap dependency
// @todo Function to get number of undo/redo states
// @todo On points edit mode, allow to move element using arrows
// @todo Rectangle for measuring size and offset
// @todo Selection of multiple elements?

(function( global ) {
  'use strict';

  var
  sns = 'http://www.w3.org/2000/svg',
  xns = 'http://www.w3.org/1999/xlink',
  version = '$Version: 2016-09-23$'.replace(/^\$Version. (.*)\$/,'version $1');

  /// Set SvgCanvas global object ///
  if ( ! global.SvgCanvas )
    global.SvgCanvas = SvgCanvas;

  /**
   * Constructor for SvgCanvas instances.
   *
   * @param {string} svgContainer   ID of the container element.
   * @param {object} config         Object specifying configuration options.
   * @class
   */
  function SvgCanvas( svgContainer, config ) {
    /// Private variables ///
    var
    self = this,
    svgRoot,
    hasChanged = false,
    changeHistory = [],
    historyPosition = 0,
    canvasW,
    canvasH,
    canvasR,
    fitState,
    FITTED = { NONE: 0, WIDTH: 1, HEIGHT: 2, PAGE: 3 },
    panzoom,
    xmin,
    ymin,
    width,
    height,
    boxX0,
    boxY0,
    boxW,
    boxH;

    /// Check container element ///
    svgContainer = document.getElementById(svgContainer);
    if ( ! svgContainer || ! svgContainer.nodeName )
      return self.throwError( 'Container must be a DOM element' );

    /// Configurable options ///
    self.cfg = {};
    self.cfg.historySize = 10;
    self.cfg.dragpointHref = null;
    self.cfg.stylesId = null;
    self.cfg.textareaId = null;
    self.cfg.textParser = svgTextParser;
    self.cfg.textFormatter = svgTextFormatter;
    self.cfg.textValidator = function () { return false; };
    self.cfg.pointsValidator = function () { return false; };
    self.cfg.multilineText = true;
    self.cfg.onSetEditText = [];
    self.cfg.onValidText = [];
    self.cfg.onInvalidText = [];
    self.cfg.onInvalidTextUnselect = [];
    self.cfg.onSetEditing = [];
    self.cfg.onRemoveEditing = [];
    self.cfg.onPointsChange = [];
    self.cfg.onValidPoints = [];
    self.cfg.onInvalidPoints = [];
    self.cfg.onFirstChange = [];
    self.cfg.onLoad = [];
    self.cfg.onUnload = [];
    self.cfg.onSelect = [];
    self.cfg.onUnselect = [];
    self.cfg.onDelete = [];
    //self.cfg.onChangeContainer = [];
    self.cfg.onDrop = [];
    self.cfg.onDropOutsideOfDropzone = [];
    self.cfg.onClone = [];
    //self.cfg.onModeOff = [];
    self.cfg.centerOnSelection = false;
    self.cfg.roundPoints = false;
    self.cfg.dropOverlap = 0.2;
    self.cfg.delSelector = null;
    self.cfg.delConfirm = function () { return false; };
    self.cfg.handleError = function ( err ) { throw err; };
    self.cfg.handleWarning = function ( warn ) { console.log('warning: '+warn); };

    /// Utility variables and functions ///
    self.util = {};
    self.util.sns = sns;
    self.util.xns = xns;
    self.util.svgRoot = document.createElementNS(self.util.sns,'svg');
    self.util.dragging = false;
    self.util.registerChange = registerChange;
    self.util.unselectElem = unselectElem;
    self.util.selectElem = selectElem;
    self.util.moveElem = moveElem;
    self.util.removeEditings = removeEditings;
    self.util.setEditing = setEditing;
    self.util.prevEditing = prevEditing;
    self.util.setDrawPoly = setDrawPoly;
    self.util.setDrawRect = setDrawRect;
    self.util.dragpointScale = dragpointScale;
    self.util.clearChangeHistory = clearChangeHistory;
    self.util.pushChangeHistory = pushChangeHistory;
    self.util.restoreHistory = restoreHistory;
    self.util.toViewboxCoords = toViewboxCoords;
    self.util.toScreenCoords = toScreenCoords;
    self.util.standardizeClockwise = standardizeClockwise;
    self.util.standardizeQuad = standardizeQuad;
    self.util.strXmlValidate = strXmlValidate;
    self.util.select = function ( selector ) { $(svgRoot).find(selector).first().click(); };

    /// Object for enabling / disabling modes ///
    self.mode = {};
    self.mode.disablers = [];
    self.mode.off = editModeOff;
    self.mode.current = self.mode.off;
    self.mode.select = editModeSelect;
    self.mode.textRect = editModeTextRect;
    self.mode.textPoints = editModeTextPoints;
    self.mode.textDrag = editModeTextDrag;
    self.mode.text = editModeText;
    self.mode.rect = editModeRect;
    self.mode.points = editModePoints;
    self.mode.drag = editModeDrag;
    self.mode.drawPoly = drawModePoly;
    self.mode.drawRect = drawModeRect;

    /**
     * Applies configuration options to the SvgCanvas instance.
     *
     * @param {object}  config    Configuration options.
     */
    self.setConfig = function ( config ) {
      if ( ! config )
        return;
      for ( var op in config )
        if ( config.hasOwnProperty(op) ) {
          if ( self.cfg.hasOwnProperty(op) ) {
            if ( op.match(/^on[A-Z]/) ) {
              if ( $.isArray(config[op]) )
                self.cfg[op] = config[op];
              else
                self.cfg[op].push(config[op]);
            }
            else
              self.cfg[op] = config[op];
            delete config[op];
          }
          else
            return self.throwError( 'No configuration option: "'+op+'"' );
        }
    };
    /// Apply input configuration ///
    self.setConfig( config );
    if ( ! self.cfg.stylesId )
      self.cfg.stylesId = svgContainer.id+'_styles';

    $.stylesheet('#'+self.cfg.stylesId+'{ #'+svgContainer.id+' .no-pointer-events }')
      .css( 'pointer-events', 'visibleStroke' );

    /**
     * Returns the version of the library.
     */
    self.getVersion = function () {
      return [ 'SvgCanvas: '+version/*,
               'jquery: '+$.fn.jquery*/ ];
    };

    /**
     * Calls the handleError with the given message and then throws the error.
     *
     * @param {string}  message    The error message.
     */
    self.throwError = function ( message ) {
      var err = new Error( message );
      self.cfg.handleError( err );
      throw err;
    };

    /**
     * Calls the handleWarning with the given message.
     *
     * @param {string}  message    The warning message.
     */
    self.warning = function ( message ) {
      self.cfg.handleWarning( message );
    };

    /**
     * Calls the first change callback and sets the state of the SVG to changed.
     */
    function registerChange( changeType ) {
      pushChangeHistory(changeType);
      if ( ! hasChanged )
        for ( var n=0; n<self.cfg.onFirstChange.length; n++ )
          self.cfg.onFirstChange[n]();
      hasChanged = true;
    }

    /**
     * Sets the state of the SVG to unchanged.
     */
    self.setUnchanged = function () {
      hasChanged = false;
    };

    /**
     * Gets the change state of the SVG.
     */
    self.hasChanged = function () {
      return hasChanged;
    };

    /**
     * Clears the change history.
     */
    function clearChangeHistory() {
      changeHistory = [];
      historyPosition = 0;
    }

    /**
     * Restores a state saved in history given a delta change.
     */
    function restoreHistory( delta ) {
      var p = historyPosition + delta;
      if ( delta === 0 || p < 0 || p >= changeHistory.length )
        return true;
      var state = changeHistory[p];

      self.mode.off();

      $(svgContainer).empty();
      $(state.svg).clone().appendTo(svgContainer);
      self.util.svgRoot = svgRoot = svgContainer.firstChild;
      initDragpoint();
      $(svgRoot).click( removeEditings );

      if ( delta < 0 && p < changeHistory.length-1 )
        state = changeHistory[p+1];

      if ( state.panzoom ) {
        self.svgPanZoom( state.panzoom[0], state.panzoom[1], state.panzoom[2], state.panzoom[3] );
        boxX0 = state.panzoom[4];
        boxY0 = state.panzoom[5];
        boxW = state.panzoom[6];
        boxH = state.panzoom[7];
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
      }
      adjustSize();

      state.mode();
      if ( state.selected )
        $(state.selected).click();

      historyPosition += delta;

      return false;
    }
    Mousetrap.bind( 'mod+z', function () { restoreHistory(-1); return false; } );
    Mousetrap.bind( 'mod+y', function () { restoreHistory(1); return false; } );

    /**
     * Saves the current state of the SVG in the change history.
     */
    function pushChangeHistory( changeType ) {
      if ( historyPosition < changeHistory.length-1 )
        changeHistory = changeHistory.slice(0,historyPosition+1);

      var state = {
          type: changeType,
          svg: self.getSvgClone(true),
          panzoom: panzoom ? [ xmin, ymin, width, height, boxX0, boxY0, boxW, boxH ] : false ,
          mode: self.mode.current,
          selected: getElementPath( $(svgRoot).find('.selected') )
        };

      if ( changeHistory.length && changeHistory[changeHistory.length-1].type === changeType )
        changeHistory[changeHistory.length-1] = state;
      else
        changeHistory.push(state);

      if ( changeHistory.length > self.cfg.historySize )
        changeHistory.shift();

      historyPosition = changeHistory.length-1;
      //self.util.changeHistory = changeHistory;
    }

    /**
     * Gets the CSS path of an element.
     */
    function getElementPath( elem ) {
      var
      path = '',
      node = $(elem).first();
      while ( node.length ) {
        var
        realNode = node[0],
        name = realNode.localName;
        if ( ! name )
          break;
        name = name.toLowerCase();

        var
        parent = node.parent(),
        siblings = parent.children(name);
        if ( siblings.length > 1 )
          name += ':eq(' + siblings.index(realNode) + ')';
        path = name + ( path ? '>' + path : '' );
        node = parent;
      }

      return path;
    }


    ////////////////////
    /// Pan and Zoom ///
    ////////////////////

    /**
     * Enables Pan and Zoom of the SVG canvas.
     *
     * @param {int}  xmin    Minimum x value for SVG range.
     * @param {int}  ymin    Minimum y value for SVG range.
     * @param {int}  width   Width for SVG range.
     * @param {int}  height  Height for SVG range.
     */
    self.svgPanZoom = function ( range_xmin, range_ymin, range_width, range_height ) {
      panzoom = true;
      xmin = range_xmin;
      ymin = range_ymin;
      width = range_width;
      height = range_height;
      var
      svgR = width / height ;

      function fitWidth() {
        boxW = width ;
        boxH = width / canvasR ;
        boxX0 = 0 ;
        boxY0 = svgR < canvasR ? 0 : ( height - boxH ) / 2 ;
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        fitState = FITTED.WIDTH;
        dragpointScale();
      }

      function fitHeight() {
        boxH = height ;
        boxW = height * canvasR ;
        boxY0 = 0 ;
        boxX0 = svgR > canvasR ? 0 : ( width - boxW ) / 2 ;
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        fitState = FITTED.HEIGHT;
        dragpointScale();
      }

      function fitPage() {
        if( svgR < canvasR )
          fitHeight();
        else
          fitWidth();
        fitState = FITTED.PAGE;
      }

      function zoom( amount, factor ) {
        factor = typeof factor == 'undefined' ? 0.05 : factor ;
        var
        pboxW = boxW ,
        pboxH = boxH ,
        scale = amount > 0 ?
          Math.pow( 1.0-factor, amount ) :
          Math.pow( 1.0+factor, -amount ) ;
        boxW *= scale ;
        boxH *= scale ;
        boxX0 += 0.5 * ( pboxW - boxW ) ;
        boxY0 += 0.5 * ( pboxH - boxH ) ;
        viewBoxLimits();
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        fitState = FITTED.NONE;

        dragpointScale();
      }

      function pan( dx, dy ) {
        //console.log('called pan dx='+dx+' dy='+dy);
        boxX0 -= dx * boxW ;
        boxY0 -= dy * boxH ;
        viewBoxLimits();
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
      }

      //var printWheel = true;

      /// Zoom on canvas using the mouse wheel ///
      function wheel( event ) {
        //if ( ! event ) event = window.event ;
        var delta = event.wheelDelta || -event.detail ;
        if ( ! delta )
          return false;

        // @todo on trackpad use wheel as pan instead of zoom and do pinch to zoom, but it seems interact.js does not support pinch on trackpad
        /*if( printWheel ) {
          console.log('wheel event: '+event);
          for(var prop in event)
            console.log('  prop: '+prop);
          printWheel = false;
        }*/

        event.preventDefault();
        return zoom( delta > 0 ? 1 : -1 );
      }
      svgRoot.addEventListener( 'mousewheel', wheel, false ); // IE9, Chrome, Safari, Opera
      svgRoot.addEventListener( 'DOMMouseScroll', wheel, false ); // Firefox

      /// Keyboard shortcuts ///
      Mousetrap.bind( 'mod+0', function () { fitPage(); return false; } );
      Mousetrap.bind( 'mod+shift w', function () { fitWidth(); return false; } );
      Mousetrap.bind( 'mod+shift h', function () { fitHeight(); return false; } );
      Mousetrap.bind( 'mod+=', function () { zoom(1); return false; } );
      Mousetrap.bind( 'mod+-', function () { zoom(-1); return false; } );
      Mousetrap.bind( 'mod+right', function () { pan(-0.02,0); return false; } );
      Mousetrap.bind( 'mod+left', function () { pan(0.02,0); return false; } );
      Mousetrap.bind( 'mod+up', function () { pan(0,0.02); return false; } );
      Mousetrap.bind( 'mod+down', function () { pan(0,-0.02); return false; } );

      /// Pan by dragging ///
      interact(svgRoot)
        .draggable({})
        //.ignoreFrom('text')
        .styleCursor(false)
        .on( 'dragstart', function () {
            self.util.dragging = true;
          } )
        .on( 'dragend', function () {
            window.setTimeout( function () { self.util.dragging = false; }, 100 );
          } )
        .on( 'dragmove', function ( event ) {
            pan( event.dx/canvasW, event.dy/canvasH );
            //event.stopPropagation();
            event.preventDefault();
            //return false;
          } );

      fitPage();
      //fitWidth();

      self.fitWidth = fitWidth;
      self.fitHeight = fitHeight;
      self.fitPage = fitPage;

      $(window).resize( function () { self.adjustViewBox(); } );
    };

    function viewBoxLimits() {
      // @todo here limit zoom out?
      if ( boxX0 < xmin + ( boxW <= width ? 0 : width-boxW ) )
           boxX0 = xmin + ( boxW <= width ? 0 : width-boxW ) ;
      if ( boxY0 < ymin + ( boxH <= height ? 0 : height-boxH ) )
           boxY0 = ymin + ( boxH <= height ? 0 : height-boxH ) ;
      if ( boxX0 > xmin + ( boxW <= width ? width-boxW : 0 ) )
           boxX0 = xmin + ( boxW <= width ? width-boxW : 0 ) ;
      if ( boxY0 > ymin + ( boxH <= height ? height-boxH : 0 ) )
           boxY0 = ymin + ( boxH <= height ? height-boxH : 0 ) ;
    }

    /**
     * Adjust the view box of the SVG canvas.
     */
    self.adjustViewBox = function () {
      if ( ! svgRoot )
        return;
      adjustSize();
      viewBoxLimits();
      //console.log('called adjustViewBox: '+boxX0+' '+boxY0+' '+boxW+' '+boxH );
      switch ( fitState ) {
        case FITTED.WIDTH:  self.fitWidth();  break;
        case FITTED.HEIGHT: self.fitHeight(); break;
        case FITTED.PAGE:   self.fitPage();   break;
        default:
          svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
      }
    };

    /**
     * Converts a point from client coordinates to the current viewbox coordinates.
     */
    function toViewboxCoords( point ) {
      if ( ! svgRoot )
        return false;
      if ( typeof point.pageX !== 'undefined' ) {
        var p = point;
        point = svgRoot.createSVGPoint();
        point.x = p.pageX;
        point.y = p.pageY;
      }
      return point.matrixTransform(svgRoot.getScreenCTM().inverse());
    }

    /**
     * Converts a point from viewbox coordinates to the client coordinates.
     */
    function toScreenCoords( point ) {
      if ( ! svgRoot )
        return false;
      var p = point;
      point = svgRoot.createSVGPoint();
      point.x = p.x;
      point.y = p.y;
      return point.matrixTransform(svgRoot.getScreenCTM());
    }

    /**
     * Adjusts the size of the dragpoint graphic for editing points.
     */
    function dragpointScale() {
      var
      cssrule = '#'+self.cfg.stylesId+'{ #'+svgContainer.id+'_dragpoint }',
      scale = 0.0015 * boxW;
      $.stylesheet(cssrule).css( 'transform', 'scale('+scale+')' );
    }

    /**
     * Adjusts the size of the SVG canvas based on its container size.
     */
    function adjustSize() {
      var
      prevW = canvasW,
      prevH = canvasH;
      canvasW = $(svgContainer).innerWidth();
      canvasH = $(svgContainer).innerHeight();
      canvasR = canvasW / canvasH;
      boxW *= canvasW / prevW ;
      boxH *= canvasH / prevH ;
      svgRoot.setAttribute( 'width', canvasW );
      svgRoot.setAttribute( 'height', canvasH );
      //console.log('called adjustSize: '+canvasW+' '+canvasH);
    }

    /**
     * Centers the viewbox on the selected element.
     */
    function centerSelected() {
      var sel = $(svgRoot).find('.selected').closest('g');
      if ( sel.length === 0 || sel.hasClass('dragging') )
        return;
      var
      rect = sel[0].getBBox(),
      cx = rect.x + 0.5*rect.width,
      cy = rect.y + 0.5*rect.height;
      boxX0 = cx - 0.5*boxW;
      boxY0 = cy - 0.5*boxH;
      viewBoxLimits();
      svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
    }

    //////////////////////////////
    /// Import and export SVGs ///
    //////////////////////////////

    /**
     * Returns a clone of the SVG without all of the editor data.
     */
    self.getSvgClone = function ( internal ) {
      var
      clone = $(svgRoot).clone(),
      classes = [ 'selectable', 'selected',
                  'editable', 'editing', 'prev-editing',
                  'draggable', 'dragging',
                  'dropzone', 'drop-active', 'drop-target', 'can-drop',
                  'no-pointer-events' ];

      if ( typeof internal === 'undefined' || ! internal ) {
        for ( var n = classes.length-1; n>=0; n-- )
          clone.find('.'+classes[n]).removeClass(classes[n]);
        clone.find('#'+svgContainer.id+'_defs, .dragpoint').remove();
        for ( n=0; n<self.cfg.onClone.length; n++ )
          self.cfg.onClone[n](clone);
      }

      return clone[0];
    };

    /**
     * Clears the canvas container.
     */
    function clearContainer() {
      self.mode.off();
      for ( var n=0; n<self.cfg.onUnload.length; n++ )
        self.cfg.onUnload[n]();
      while ( svgContainer.hasChildNodes() )
        svgContainer.removeChild( svgContainer.lastChild );
    }

    /**
     * Initializes the SVG canvas using a given SVG source.
     *
     * @param {object}  svgDoc         Object representing an SVG document.
     */
    self.loadXmlSvg = function ( svgDoc ) {
      if ( typeof svgDoc === 'string' )
        try { svgDoc = $.parseXML( svgDoc ); } catch(e) {}
      if ( ! svgDoc.nodeName || $(svgDoc).find('> svg').length === 0 )
        return self.throwError( "Expected as input an SVG document" );

      /// Remove all content in container element ///
      clearContainer();

      /// Append SVG and initialize ///
      hasChanged = false;
      clearChangeHistory();
      panzoom = false;
      svgContainer.appendChild(svgDoc);
      self.util.svgRoot = svgRoot = svgContainer.firstChild;
      adjustSize();
      initDragpoint();

      $(svgRoot).click( removeEditings );

      pushChangeHistory('svg load');

      for ( var n=0; n<self.cfg.onLoad.length; n++ )
        self.cfg.onLoad[n]();
    };

    /**
     * Inserts in an svg defs node the dragpoint graphic for editing points.
     */
    function initDragpoint( dragpointSvg ) {
      if ( $('#'+svgContainer.id+'_dragpoint').length > 0 )
        return;

      if ( typeof dragpointSvg === 'undefined' &&
           self.cfg.dragpointHref &&
           self.cfg.dragpointHref[0] !== '#' ) {
        $.ajax({ url: self.cfg.dragpointHref, dataType: 'xml' })
          .fail( function () { self.throwError( 'Failed to retrive '+self.cfg.dragpointHref ); } )
          .done( function ( data ) { initDragpoint(data); } );
        return;
      }

      var
      dragpoint,
      defs = $('#'+svgContainer.id+'_defs');

      if ( defs.length === 0 ) {
        $(document.createElementNS(self.util.sns,'defs'))
          .attr('id',svgContainer.id+'_defs')
          .prependTo(svgRoot);
        defs = $('#'+svgContainer.id+'_defs');
      }
      defs = defs[0];

      if ( ! self.cfg.dragpointHref ) {
        dragpoint = document.createElementNS( sns, 'circle' );
        $(dragpoint).attr( { 'r': 3, 'x': 0, 'y': 0 } );
      }
      else if ( self.cfg.dragpointHref[0] === '#' ) {
        dragpoint = $(self.cfg.dragpointHref).clone(false,true)[0];
      }
      else {
        dragpoint = dragpointSvg.getElementById(self.cfg.dragpointHref.replace(/.*#/,'')).cloneNode(true);
      }
      dragpoint.setAttribute( 'id', svgContainer.id+'_dragpoint' );
      defs.appendChild( dragpoint );
    }


    /////////////////////////
    /// Element selection ///
    /////////////////////////

    /**
     * Unselects the currently selected element.
     */
    function unselectElem( svgElem ) {
      if ( typeof svgElem === 'undefined' ) {
        svgElem = $(svgRoot).find('.selected');
        if ( svgElem.length === 0 )
          return;
        svgElem = svgElem[0];
      }
      else if( ! $(svgElem).hasClass('selected') )
        return;
      $(svgElem).removeClass('selected');
      for ( var n=0; n<self.cfg.onUnselect.length; n++ )
        self.cfg.onUnselect[n](svgElem);
    }

    /**
     * Sets selected to given element.
     */
    function selectElem( svgElem, reselect, nocenter ) {
      if ( $(svgElem).hasClass('selected') &&
           ( typeof reselect === 'undefined' || ! reselect ) )
        return;
      unselectElem();
      $(svgElem).addClass('selected');
      if ( self.cfg.centerOnSelection && 
           ( typeof nocenter === 'undefined' || ! nocenter ) )
        centerSelected();
      for ( var n=0; n<self.cfg.onSelect.length; n++ )
        self.cfg.onSelect[n](svgElem);
    }

    /**
     * Handles the deletion of SVG elements.
     */
    function handleDeletion () {
      if ( ! self.cfg.delSelector )
        return true;
      //if ( $('#'+self.cfg.textareaId).is(':focus') )
      //  return true;
      var
      selElem = $(svgRoot).find('.selected').first(),
      isprotected = selElem.closest('#'+svgContainer.id+' .protected');
      if ( selElem.length === 0 || isprotected.length > 0 )
        return true;
      var delElem = self.cfg.delSelector( selElem[0] );
      if ( typeof delElem === 'boolean' )
        return delElem;
      if ( delElem && self.cfg.delConfirm(delElem) ) {
        for ( var n=0; n<self.cfg.onDelete.length; n++ )
          self.cfg.onDelete[n](delElem);
        var editables = $('.editable');
        editables = editables.eq(editables.index(delElem)+1).addClass('prev-editing');
        if ( selElem.closest('.editing').length !== 0 )
          removeEditings();
        unselectElem(selElem);
        var elemPath = getElementPath(delElem);
        $(delElem).remove();
        registerChange('deleted '+elemPath);
      }
      return false;
    }
    Mousetrap.bind( 'mod+del', function () { return handleDeletion(); } );
    Mousetrap.bind( 'del', function () {
      if ( self.cfg.textareaId && ! $('#'+self.cfg.textareaId).prop('disabled') )
        return true;
      return handleDeletion(); } );

    /**
     * Toggles protection of the selected element's group.
     */
    function toggleProtection () {
      var sel = $(svgRoot).find('.selected').first().closest('g');
      if ( sel.length === 0 )
        return true;
      sel.toggleClass('protected');
      if ( sel.hasClass('protected') )
        $('#'+self.cfg.textareaId)
          .blur()
          .prop( 'disabled', true );
      registerChange('toggled protection of '+getElementPath(sel));
      return false;
    }
    Mousetrap.bind( ['ins','mod+p'], function () { return toggleProtection(); } );


    //////////////////
    /// Edit modes ///
    //////////////////

    /**
     * Turns off all edit modes.
     */
    function editModeOff() {
      removeEditings();

      interact('#'+svgContainer.id+' .draggable').unset();
      $(svgRoot)
        .find('.draggable')
        .removeClass('draggable');
      $(svgRoot)
        .find('.dropzone')
        .removeClass('dropzone');

      $(svgRoot)
        .find('.no-pointer-events')
        .removeClass('no-pointer-events');

      $(svgRoot)
        .find('.editable')
        .removeClass('editable')
        .off('click')
        .each( function () {
            if ( typeof this.setEditing !== 'undefined' )
              delete this.setEditing;
          } );

      $('#'+self.cfg.textareaId)
        .off('keyup change')
        .val('')
        .prop( 'disabled', true );

      for ( var n=0; n<self.mode.disablers.length; n++ )
        self.mode.disablers[n]();
      self.mode.disablers = [];

      //for ( var n=0; n<self.cfg.onModeOff.length; n++ )
      //  self.cfg.onModeOff[n]();

      return false;
    }

    /**
     * Removes all current editings.
     */
    function removeEditings( event ) {
      if ( ! self.util.dragging ) {
        $(svgRoot).find('.editing').each( function () {
            if ( typeof this.removeEditing !== 'undefined' )
              this.removeEditing(true);
            //else
            //  $(this).removeClass('editing');
            $(this).removeClass('editing').addClass('prev-editing');

            for ( var k=0; k<self.cfg.onRemoveEditing.length; k++ )
              self.cfg.onRemoveEditing[k](this);
          } );
      }
      if ( event ) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    Mousetrap.bind( 'esc', function () {
        if ( $(svgRoot).find('.editing').length > 0 ) 
          removeEditings();
        else if( $(svgRoot).find('.drawing').length > 0 )
          self.util.finishDrawing();
        return false;
      } );

    /**
     * Event handler for when an edit zone is tapped.
     *
     * @param {object}  event   The event object from the tap.
     * @param {string}  mode    Editing mode.
     */
    function setEditing( event, mode, opts ) {
      if ( ! self.util.dragging ) {
        var svgElem = $(event.target).closest('.editable')[0];

        if ( ! svgElem.removeEditing ) {
          switch (mode) {
            case 'select':
              setEditSelect( svgElem, true );
              break;
            case 'text':
              setEditText( svgElem, opts.text_selector, opts.text_creator, true );
              break;
            case 'points':
              setEditPoints( svgElem, opts.points_selector, opts.restrict, true );
              break;
            case 'text+points':
              setEditText( svgElem, opts.text_selector, opts.text_creator, true );
              setEditPoints( svgElem, opts.points_selector, opts.restrict, false );
              break;
          }

          $(svgRoot).find('.prev-editing').removeClass('prev-editing');

          for ( var k=0; k<self.cfg.onSetEditing.length; k++ )
            self.cfg.onSetEditing[k](svgElem);
        }
      }

      if ( event.stopPropagation ) {
        event.stopPropagation();
        event.preventDefault();
      }
    }

    /**
     * Function to enable editing to the element that was previously being edited.
     */
    function prevEditing() {
      $(svgRoot).find('.prev-editing').removeClass('prev-editing').click();
    }

    /**
     * Function to cycle through editables using a keyboard shortcut.
     */
    function cycleEditables( offset, e ) {
      var
      editables = $(svgRoot).find('.editable'),
      currEditing = $(svgRoot).find('.editing'),
      newEditing;
      if ( editables.length === 0 )
        return;
      if ( currEditing.length === 0 ) {
        newEditing = editables.index( $(svgRoot).find('.prev-editing') );
        if ( newEditing < 0 )
          newEditing = offset > 0 ? 0 : editables.length - 1 ;
      }
      else
        newEditing = ( editables.index(currEditing) + offset ) % editables.length;
      newEditing = editables.eq(newEditing);
      if ( newEditing.length > 0 && currEditing[0] !== newEditing[0] ) {
        if ( newEditing[0].hasOwnProperty('setEditing') )
          newEditing[0].setEditing();
        else
          newEditing.click();
      }
    }

    Mousetrap.bind( 'tab', function () { cycleEditables(1); return false; } );
    Mousetrap.bind( 'shift+tab', function () { cycleEditables(-1); return false; } );

    /**
     * Function to cycle through drag points using a keyboard shortcut.
     */
    function cycleDragpoints( offset ) {
      var
      points = $(svgRoot).find('.dragpoint'),
      currPoint = points.filter('.activepoint'),
      newPoint;
      if ( points.length === 0 )
        return;
      if ( currPoint.length === 0 )
        newPoint = offset > 0 ? 0 : points.length - 1 ;
      else
        newPoint = ( points.index(currPoint) + offset ) % points.length;
      newPoint = points.eq(newPoint);
      if ( currPoint[0] !== newPoint[0] )
        newPoint.click();
    }

    Mousetrap.bind( 'ctrl+tab', function () { cycleDragpoints(1); return false; } );
    Mousetrap.bind( 'ctrl+shift+tab', function () { cycleDragpoints(-1); return false; } );

    /**
     * Makes an SVG element editable without any functionality just for cycling available editables.
     *
     * @param {object}   svgElem        Selected element for editing.
     */
    function setEditSelect( svgElem, resetedit ) {
      if ( resetedit )
        removeEditings();

      $(svgElem).addClass('editing');
      selectElem(svgElem);

      /// Element function to remove editing ///
      var prevRemove = typeof svgElem.removeEditing !== 'undefined' ?
        svgElem.removeEditing : false ;

      svgElem.removeEditing = function ( unset ) {
        if ( prevRemove )
          prevRemove(false);
        $(svgElem).removeClass('editing');
        unselectElem(svgElem);
        if ( unset )
          delete svgElem.removeEditing;
      };
    }

    /**
     * Initializes the select only mode.
     *
     * @param {string}   selector    CSS selector for elements to enable selection.
     */
    function editModeSelect( selector ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeSelect.apply(this,args); };

      //console.log( 'select mode: "' + selector + '"' );

      $(svgRoot).find(selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'select' );
          } );

      prevEditing();

      return false;
    }


    ////////////////////////////
    /// Composite edit modes ///
    ////////////////////////////

    /**
     * Initializes the composite rectangle and text edit mode.
     *
     * @param {string}   tap_selector     CSS selector for elements to enable editing.
     * @param {string}   points_selector  CSS selector for element(s) to edit points.
     * @param {string}   text_selector    CSS selector for the text element to edit.
     * @param {function} text_creator     Called when text element does not exist.
     */
    function editModeTextRect( tap_selector, points_selector, text_selector, text_creator ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeTextRect.apply(this,args); };

      //console.log( 'textRect mode: "' + tap_selector + '" "' + points_selector + '" "' + text_selector + '"' );

      $(svgRoot).find(tap_selector).each( function () {
          var numrect = 0;
          $(this).find(points_selector)
            .each( function () { numrect += isRect(this) ? 1 : 0 ; } );
          if ( numrect > 0 )
            $(this)
              .addClass('editable')
              .click( function ( event ) {
                  setEditing( event, 'text+points', {
                      points_selector: points_selector,
                      restrict: 'rect',
                      text_selector: text_selector,
                      text_creator: text_creator
                    } );
                } );
        } );

      prevEditing();

      return false;
    }

    /**
     * Initializes the composite points and text edit mode.
     *
     * @param {string}   tap_selector     CSS selector for elements to enable editing.
     * @param {string}   points_selector  CSS selector for element(s) to edit points.
     * @param {string}   text_selector    CSS selector for the text element to edit.
     * @param {function} text_creator     Called when text element does not exist.
     */
    function editModeTextPoints( tap_selector, points_selector, text_selector, text_creator ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeTextPoints.apply(this,args); };

      //console.log( 'textPoints mode: "' + tap_selector + '" "' + points_selector + '" "' + text_selector + '"' );

      $(svgRoot).find(tap_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'text+points', {
                points_selector: points_selector,
                text_selector: text_selector,
                text_creator: text_creator
              } );
          } );

      prevEditing();

      return false;
    }

    /**
     * Initializes the composite drag and text edit mode.
     *
     * @param {string}   drag_selector    CSS selector for elements to enable dragging.
     * @param {string}   drop_selector    CSS selector for drop zones.
     * @param {string}   text_selector    CSS selector for the text element to edit.
     * @param {function} text_creator     Called when text element does not exist.
     */
    function editModeTextDrag( drag_selector, drop_selector, text_selector, text_creator ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeTextDrag.apply(this,args); };

      //console.log( 'textDrag mode: "' + drag_selector + '" "' + drop_selector + '" "' + text_selector + '"' );

      setDraggables( drag_selector, drop_selector );

      $(svgRoot).find(drag_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'text', {
                text_selector: text_selector,
                text_creator: text_creator
              } );
          } );

      prevEditing();

      return false;
    }


    //////////////////////
    /// Text edit mode ///
    //////////////////////

    /**
     * Initializes the edit text mode.
     *
     * @param {string}   tap_selector   CSS selector for elements to enable editing.
     * @param {string}   text_selector  CSS selector for the text element to edit.
     * @param {function} text_creator   Called when text element does not exist.
     */
    function editModeText( tap_selector, text_selector, text_creator ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeText.apply(this,args); };

      //console.log( 'text mode: "' + tap_selector + '" "' + text_selector + '"' );

      $(svgRoot).find(tap_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'text', { text_selector: text_selector, text_creator: text_creator } );
          } );

      prevEditing();

      return false;
    }

    /**
     * Makes an SVG text element editable.
     *
     * @param {object}   svgElem        Selected element for editing.
     * @param {string}   text_selector  CSS selector for the text element to edit.
     * @param {function} text_creator   Expected to creates an SVG text element if it does not exist.
     */
    function setEditText( svgElem, text_selector, text_creator, resetedit ) {
      var
      prevText,
      textarea = $('#'+self.cfg.textareaId),
      textElem = $(svgElem);

      if ( text_selector )
        textElem = textElem.find(text_selector);
      textElem = textElem.first();

      if ( textElem.length === 0 ) {
        if ( ! text_creator )
          return self.throwError( 'Editable without text element and no creator supplied' );
        text_creator( svgElem, text_selector );
        textElem = $(svgElem).find(text_selector);
      }

      if ( resetedit )
        removeEditings();

      for ( var n=0; n<self.cfg.onSetEditText.length; n++ )
        self.cfg.onSetEditText[n](svgElem);

      $(svgElem).addClass('editing');
      selectElem(svgElem);

      prevText = self.cfg.textFormatter(textElem.html());

      textarea
        .off('keyup change')
        .val(prevText)
        .on( 'keyup change', function ( event ) {
            var currText = textarea.val();
            if ( ( event.keyCode === 13 || event.keyCode === 46 ) && ! self.cfg.multilineText ) {
              currText = currText.replace(/[\t\n\r]/g,' ').trim();
              textarea.val(currText);
            }
            if ( prevText === currText )
              return;
            var isinvalid = self.cfg.textValidator(currText);
            if ( isinvalid )
              for ( n=0; n<self.cfg.onInvalidText.length; n++ )
                self.cfg.onInvalidText[n]( isinvalid );
            else
              for ( n=0; n<self.cfg.onValidText.length; n++ )
                self.cfg.onValidText[n]();
            textElem.html( self.cfg.textParser(currText) );
            registerChange('text edit of '+getElementPath(textElem));
            prevText = currText;
          } );

      var isprotected = $(textElem).closest('#'+svgContainer.id+' .protected');
      if ( isprotected.length === 0 )
        textarea
          .prop( 'disabled', false )
          .focus();

      var isinvalid = self.cfg.textValidator(prevText);
      if ( isinvalid )
        for ( n=0; n<self.cfg.onInvalidText.length; n++ )
          self.cfg.onInvalidText[n]( isinvalid );
      else
        for ( n=0; n<self.cfg.onValidText.length; n++ )
          self.cfg.onValidText[n]();

      /// Element function to remove editing ///
      var prevRemove = typeof svgElem.removeEditing !== 'undefined' ?
        svgElem.removeEditing : false ;

      svgElem.removeEditing = function ( unset ) {
        if ( prevRemove )
          prevRemove(false);
        var currText = textarea.val();
        var isinvalid = self.cfg.textValidator(currText);
        if ( isinvalid )
          for ( var n=0; n<self.cfg.onInvalidTextUnselect.length; n++ )
            self.cfg.onInvalidTextUnselect[n]( isinvalid, svgElem );
        if ( prevText !== currText ) {
          textElem.html( self.cfg.textParser(currText) );
          registerChange('text edit of '+getElementPath(textElem));
        }
        $(svgElem).removeClass('editing');
        unselectElem(svgElem);
        $('#'+self.cfg.textareaId)
          .off('keyup change')
          .val('')
          .prop( 'disabled', true );
        if ( unset )
          delete svgElem.removeEditing;
      };
    }

    /// Invalid text keyboard shortcut ///
    Mousetrap.bind( 'mod+i', function () {
        var
        currText = $('#'+self.cfg.textareaId).val(),
        isinvalid = self.cfg.textValidator(currText);
        if ( isinvalid )
          for ( var n=0; n<self.cfg.onInvalidTextUnselect.length; n++ )
            self.cfg.onInvalidTextUnselect[0]( isinvalid );
        return false;
      } );


    ///////////////////////////
    /// Rectangle edit mode ///
    ///////////////////////////

    /**
     * Initializes the rectangle edit mode.
     *
     * @param {string}   tap_selector     CSS selector for elements to enable editing.
     * @param {string}   points_selector  CSS selector for element(s) to edit points.
     */
    function editModeRect( tap_selector, points_selector ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeRect.apply(this,args); };

      //console.log( 'rect mode: "' + tap_selector + '" "' + points_selector + '"' );

      $(svgRoot).find(tap_selector).each( function () {
          var numrect = 0;
          $(this).find(points_selector)
            .each( function () { numrect += isRect(this) ? 1 : 0 ; } );
          if ( numrect > 0 )
            $(this)
              .addClass('editable')
              .click( function ( event ) {
                  setEditing( event, 'points', { points_selector: points_selector, restrict: 'rect' } );
                } );
        } );

      prevEditing();

      return false;
    }


    ////////////////////////
    /// Points edit mode ///
    ////////////////////////

    /**
     * Checks if a polygon element represents a rectangle.
     */
    function isRect( elem ) {
      if ( typeof elem === 'undefined' ||
           typeof elem.points === 'undefined' ||
           elem.points.numberOfItems !== 4 ||
           elem.points.getItem(0).x !== elem.points.getItem(3).x ||
           elem.points.getItem(1).x !== elem.points.getItem(2).x ||
           elem.points.getItem(0).y !== elem.points.getItem(1).y ||
           elem.points.getItem(2).y !== elem.points.getItem(3).y )
        return false;
      return true;
    }

    /**
     * Standardizes a polygon to be clockwise.
     */
    function standardizeClockwise( elem ) {
      var n, tmp,
      area = 0,
      pts = elem.points,
      lgth = pts.length;

      if ( lgth < 3 )
        return;

      /// shoelace formula to determine if clockwise or counterclockwise ///
      for ( n=lgth-1; n>=0; n-- )
        area += ( pts[(n+1)%lgth].x - pts[n].x ) * ( pts[(n+1)%lgth].y + pts[n].y );

      /// Reverse order if counterclockwise ///
      if ( area > 0 )
        for ( n=Math.floor(lgth/2)-1; n>=0; n-- ) {
          tmp = pts[n];
          pts[n] = pts[lgth-n-1];
          pts[lgth-n-1] = tmp;
        }
    }

    /**
     * Standardizes a quadrilateral to be top-left clockwise.
     */
    function standardizeQuad( elem, alreadyclockwise ) {
      if ( elem.points.length !== 4 )
        return false;

      if ( ! ( typeof alreadyclockwise === 'boolean' && alreadyclockwise ) )
        standardizeClockwise(elem);

      var n, tmp, slope,
      sslope = Infinity,
      shift = 0,
      pts = elem.points;

      /// determine shift to start at top-left ///
      for ( n=0; n<4; n++ )
        if ( pts[(n+1)%4].x > pts[n].x ) {
          slope = Math.abs( (pts[(n+1)%4].y-pts[n].y) / (pts[(n+1)%4].x-pts[n].x) );
          if ( slope < sslope ) {
            shift = n;
            sslope = slope; 
          }
        }
      if ( shift > 0 ) {
        tmp = [ pts[0], pts[1], pts[2], pts[3] ];
        for ( n=0; n<4; n++ )
          pts[n] = tmp[(n+shift)%4];
      }

      return true;
    }

    /**
     * Initializes the points edit mode.
     *
     * @param {string}   tap_selector     CSS selector for elements to enable editing.
     * @param {string}   points_selector  CSS selector for element(s) to edit points.
     */
    function editModePoints( tap_selector, points_selector ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModePoints.apply(this,args); };

      //console.log( 'points mode: "' + tap_selector + '" "' + points_selector + '"' );

      $(svgRoot).find(tap_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'points', { points_selector: points_selector, restrict: false } );
          } );

      prevEditing();
 
      return false;
    }

    /**
     * Makes the points of an SVG element editable.
     *
     * @param {object}   svgElem          Selected element for editing.
     * @param {string}   points_selector  CSS selector for the element to edit.
     */
    function setEditPoints( svgElem, points_selector, restrict, resetedit ) {
      var
      restrict_rect = restrict === 'rect' ? true : false,
      rootMatrix,
      isprotected,
      originalPoints = [],
      transformedPoints = [],
      editElems = $(svgElem),
      editElem = [],
      pointIdx = [],
      numElems = 0,
      k = 0;

      if ( points_selector )
        editElems = editElems.find(points_selector);

      if ( resetedit )
        removeEditings();

      dragpointScale();

      /// Create a dragpoint for each editable point ///
      editElems.each( function () {
          if ( restrict_rect && ! isRect(this) ) {
            console.log('skipping non-rect for '+$(this).closest('g').attr('id'));
            return;
          }

          numElems++;
          $(this).addClass('selectable');
          for ( var i = 0, len = this.points.numberOfItems; i < len; i++ ) {
            var
            dragpoint = document.createElementNS( sns, 'use' ),
            point = this.points.getItem(i),
            newPoint = svgRoot.createSVGPoint();

            dragpoint.setAttributeNS( xns, 'href', '#'+svgContainer.id+'_dragpoint' );
            dragpoint.setAttribute( 'class', 'dragpoint' );
            dragpoint.x.baseVal.value = newPoint.x = point.x;
            dragpoint.y.baseVal.value = newPoint.y = point.y;
            dragpoint.setAttribute( 'data-index', k++ );

            originalPoints.push( newPoint );
            editElem.push( this );
            pointIdx.push( i );

            svgRoot.appendChild(dragpoint);
          }
        } );

      /// Active drag point ///
      $(svgRoot).find('.dragpoint').click( function ( event ) {
          $(svgRoot).find('.activepoint').removeClass('activepoint');
          $(event.target).addClass('activepoint');
          return false;
        } );

      /// Point remove ///
      function removePolyPoint() {
        var points,
        point = $(svgRoot).find('.activepoint');
        if ( point.length === 0 )
          return false;
        point = parseInt( point.attr('data-index') );
        points = editElem[point].points;
        if ( points.length < 3 )
          return false;

        points.removeItem(pointIdx[point]);

        self.mode.off();
        self.mode.current();
        prevEditing();

        return false;
      }
      Mousetrap.bind( '- .', removePolyPoint );

      /// Point add ///
      function addPolyPoint() {
        var points, point, point2,
        point1 = $(svgRoot).find('.activepoint');
        if ( point1.length === 0 )
          return false;
        point1 = parseInt( point1.attr('data-index') );
        points = editElem[point1].points;
        if ( points.length < 2 )
          return false;
        point1 = pointIdx[point1];
        point2 = point1 + (point1 === points.length-1 ? -1 : 1);

        point = svgRoot.createSVGPoint();
        point.x = 0.5*(points[point1].x+points[point2].x);
        point.y = 0.5*(points[point1].y+points[point2].y);
        points.insertItemBefore(point,point2);

        self.mode.off();
        self.mode.current();
        prevEditing();

        return false;
      }
      Mousetrap.bind( '+ .', addPolyPoint );

      /*function applyTransforms ( event ) {
        //console.log('called applyTransforms');
        rootMatrix = svgRoot.getScreenCTM();

        transformedPoints = originalPoints.map( function(point) {
            return point.matrixTransform(rootMatrix);
          } );

        interact('#'+svgContainer.id+' .dragpoint').draggable( {
            snap: {
              targets: transformedPoints,
              range: 2 * Math.max( rootMatrix.a, rootMatrix.d )
              //range: 20 * Math.max( rootMatrix.a, rootMatrix.d )
            }
          } );
      }

      // @todo How does all of this work?
      interact(svgRoot)
        .on( 'mousedown', applyTransforms )
        .on( 'touchstart', applyTransforms );*/

      /// Setup dragpoints for dragging ///
      interact('#'+svgContainer.id+' .dragpoint')
        .draggable( {
            onstart: function ( event ) {
              var
              k = event.target.getAttribute('data-index')|0,
              svgElem = editElem[k],
              selectable = $(editElem[k]).closest('.selectable');
              if ( selectable.length !== 0 )
                selectElem( selectable[0] );

              rootMatrix = svgRoot.getScreenCTM();

              isprotected = $(svgElem).closest('#'+svgContainer.id+' .protected');

              self.util.dragging = true;
            },
            onmove: function ( event ) {
              if ( isprotected.length > 0 )
                return;

              var
              k = event.target.getAttribute('data-index')|0,
              i = pointIdx[k],
              svgElem = editElem[k],
              point = svgElem.points.getItem(i);

              point.x += event.dx / rootMatrix.a;
              point.y += event.dy / rootMatrix.d;
              if ( self.cfg.roundPoints ) {
                point.x = Math.round(point.x);
                point.y = Math.round(point.y);
              }

              event.target.x.baseVal.value = point.x;
              event.target.y.baseVal.value = point.y;

              if ( restrict_rect ) {
                var ix, iy,
                dragpoints = $(svgRoot).find('.dragpoint');
                switch (i) {
                  case 0: ix = 3; iy = 1; break;
                  case 1: ix = 2; iy = 0; break;
                  case 2: ix = 1; iy = 3; break;
                  case 3: ix = 0; iy = 2; break;
                }
                svgElem.points.getItem(ix).x = point.x;
                svgElem.points.getItem(iy).y = point.y;
                dragpoints[k+ix-i].x.baseVal.value = point.x;
                dragpoints[k+iy-i].y.baseVal.value = point.y;
              }

              for ( k=0; k<self.cfg.onPointsChange.length; k++ )
                self.cfg.onPointsChange[k](svgElem);
            },
            onend: function ( event ) {
              //$(svgRoot).removeClass( 'dragging' );
              window.setTimeout( function () { self.util.dragging = false; }, 100 );

              if ( isprotected.length > 0 )
                return;

              var
              k = event.target.getAttribute('data-index')|0,
              svgElem = editElem[k],
              isinvalid = self.cfg.pointsValidator(svgElem);
              if ( isinvalid )
                for ( k=0; k<self.cfg.onInvalidPoints.length; k++ )
                  self.cfg.onInvalidPoints[k]( isinvalid );
              else
                for ( k=0; k<self.cfg.onValidPoints.length; k++ )
                  self.cfg.onValidPoints[k]();

              registerChange('points edit of '+getElementPath(svgElem));
            },
            /*snap: {
              targets: originalPoints,
              range: 30,
              relativePoints: [ { x: 0.5, y: 0.5 } ]
            },*/
            restrict: { restriction: svgRoot }
          } )
        .styleCursor(false);

      // @todo What is this for?
      /*document.addEventListener( 'dragstart', function ( event ) {
          event.preventDefault();
        } );*/

      $(svgElem).addClass('editing');
      selectElem( numElems > 1 ? svgElem : $(svgElem).find('.selectable')[0] );

      /// Element function to remove editing ///
      var prevRemove = typeof svgElem.removeEditing !== 'undefined' ?
        svgElem.removeEditing : false ;

      svgElem.removeEditing = function ( unset ) {
        if ( prevRemove )
          prevRemove(false);
        Mousetrap.unbind(['- .','+ .']);
        $(svgRoot).find('.dragpoint').remove();
        /*interact(svgRoot)
          .off( 'mousedown', applyTransforms )
          .off( 'touchstart', applyTransforms );*/
        $(svgElem).removeClass('editing').find('.selectable').removeClass('selectable');
        unselectElem(svgElem);
        if ( unset )
          delete svgElem.removeEditing;
      };
    }


    ///////////////////////////////////
    /// Drag and drop elements mode ///
    ///////////////////////////////////

    /**
     * Moves an element and its children.
     *
     * @param {object}  elem   SVG element to move.
     * @param {float}   dx     Horizontan displacement.
     * @param {float}   dy     Horizontan displacement.
     */
    function moveElem( elem, dx, dy ) {
      elem = $(elem);
      elem.find('*[points]').each( function () {
          for ( var i = 0, len = this.points.numberOfItems; i < len; i++ ) {
            var point = this.points.getItem(i);
            point.x += dx;
            point.y += dy;
          }
        } );
      elem.find('text').each( function () {
          var mat = this.transform.baseVal[0].matrix;
          mat.e += dx;
          mat.f += dy;
        } );
    }

    /**
     * Initializes the drag edit mode.
     *
     * @param {string}   drag_selector    CSS selector for elements to enable dragging.
     * @param {string}   drop_selector    CSS selector for drop zones.
     * @param {function} move_select_func Selects the elements to be moved.
     */
    function editModeDrag( drag_selector, drop_selector, move_select_func ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeDrag.apply(this,args); };

      //console.log( 'drag mode: "' + drag_selector + '" "' + drop_selector + '"' );

      setDraggables( drag_selector, drop_selector, move_select_func );

      $(svgRoot).find(drag_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'select' );
          } );

      prevEditing();

      return false;
    }

    /**
     * Initializes the drag and optionally drop elements mode.
     *
     * @param {string}   drag_selector    CSS selector for elements to enable dragging.
     * @param {string}   drop_selector    CSS selector for drop zones.
     */
    function setDraggables( drag_selector, drop_selector, move_select_func ) {
      var
      rootMatrix,
      isprotected;

      $(svgRoot).find(drag_selector).addClass('draggable');
      interact('#'+svgContainer.id+' .draggable')
        .draggable( {
            onstart: function ( event ) {
                $(event.target).addClass('dragging');
                selectElem(event.target);
                rootMatrix = svgRoot.getScreenCTM();
                isprotected = $(event.target).closest('#'+svgContainer.id+' .protected');
                self.util.dragging = true;
              },
            onmove: function ( event ) {
                if ( isprotected.length > 0 )
                  return;
                var
                dx = event.dx / rootMatrix.a,
                dy = event.dy / rootMatrix.d;
                if ( self.cfg.roundPoints ) {
                  dx = Math.round(dx);
                  dy = Math.round(dy);
                }
                var elem = $(event.target);
                if ( typeof move_select_func !== 'undefined' )
                  elem = move_select_func(elem);
                moveElem( elem, dx, dy );
                if ( typeof drop_selector !== 'undefined' ) {
                  if ( $(event.target).hasClass('can-drop') )
                    $(event.target).removeClass('not-dropzone');
                  else
                    $(event.target).addClass('not-dropzone');
                }
              },
            onend: function ( event ) {
                if ( $(event.target).hasClass('not-dropzone') )
                  for ( var n=0; n<self.cfg.onDropOutsideOfDropzone.length; n++ )
                    self.cfg.onDropOutsideOfDropzone[n](event.target);
                $(event.target).removeClass('dragging');
                if ( isprotected.length === 0 )
                  registerChange('dragging of '+getElementPath(event.target));
                window.setTimeout( function () { self.util.dragging = false; }, 100 );
              },
              restrict: { restriction: svgRoot }
          } )
        .styleCursor(false);

      if ( typeof drop_selector !== 'undefined' ) {
        $(svgRoot).find(drop_selector).addClass('dropzone');
        interact('#'+svgContainer.id+' .dropzone').dropzone( {
            accept: '.draggable',
            overlap: self.cfg.dropOverlap,
            ondropactivate: function ( event ) {
                event.target.classList.add('drop-active');
              },
            ondragenter: function ( event ) {
                event.target.classList.add('drop-target');
                event.relatedTarget.classList.add('can-drop');
              },
            ondragleave: function ( event ) {
                event.target.classList.remove('drop-target');
                event.relatedTarget.classList.remove('can-drop');
              },
            ondrop: function ( event ) {
                var
                currContainer = $(event.relatedTarget).closest(drop_selector)[0];
                if ( currContainer !== event.target ) {
                  $(event.relatedTarget).appendTo(event.target);
                  //for ( var n=0; n<self.cfg.onChangeContainer.length; n++ )
                  //  self.cfg.onChangeContainer[n](event.relatedTarget);
                  unselectElem(event.relatedTarget);
                  selectElem(event.relatedTarget);
                }
                for ( var n=0; n<self.cfg.onDrop.length; n++ )
                  self.cfg.onDrop[n](event.relatedTarget);
              },
            ondropdeactivate: function ( event ) {
                event.target.classList.remove('drop-active');
                event.target.classList.remove('drop-target');
                event.relatedTarget.classList.remove('can-drop');
              }
          } );
      }
    }

    //////////////////
    /// Draw modes ///
    //////////////////

    /**
     * Initializes the draw polygon rectangle mode.
     *
     * @param {function} createrect   Creates a polygon rectangle element already added to the svg.
     * @param {function} isvalidrect  Validates a list of {x,y} points.
     * @param {function} onfinish     Called when the polygon rectangle is finished.
     * @param {function} delpoly      Removes the polyon rectangle element.
     */
    function drawModeRect( createrect, isvalidrect, onfinish, delrect ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return drawModeRect.apply(this,args); };

      setDrawRect( createrect, isvalidrect, onfinish, delrect );

      //prevEditing();

      return false;
    }

    /**
     * Enables the draw polygon rectangle state.
     *
     * @param {function} createrect   Creates a polygon rectangle element already added to the svg.
     * @param {function} isvalidrect  Validates a list of {x,y} points.
     * @param {function} onfinish     Called when the polygon rectangle is finished.
     * @param {function} delpoly      Removes the polyon rectangle element.
     */
    function setDrawRect( createrect, isvalidrect, onfinish, delrect ) {
      var elem = false;

      function default_createrect() {
        var elem = $(document.createElementNS(self.util.sns,'polygon'))
          .appendTo(svgRoot);
        return elem[0];
      }
      if ( typeof createrect !== 'function' )
        createrect = default_createrect;

      if ( typeof isvalidrect !== 'function' )
        isvalidrect = function () { return true; };

      if ( typeof delrect !== 'function' )
        delrect = function ( elem ) { $(elem).remove(); };

      function updatePoint( event ) {
        if( ! elem )
          return;
        var point = self.util.toViewboxCoords(event);
        if ( self.cfg.roundPoints ) {
          point.x = Math.round(point.x);
          point.y = Math.round(point.y);
        }
        elem.points[1].x = elem.points[2].x = point.x;
        elem.points[2].y = elem.points[3].y = point.y;
      }

      function handleClick( event ) {
        if ( self.util.dragging ||
             ! event.pageX ||
             event.originalEvent.detail > 1 )
          return;

        var point = self.util.toViewboxCoords(event);
        if ( self.cfg.roundPoints ) {
          point.x = Math.round(point.x);
          point.y = Math.round(point.y);
        }
        if( elem )
          finishRect(event);
        else {
          if ( ! isvalidrect( {points:[point]} ) )
            return;
          elem = createrect(event);
          if ( ! elem )
            return;
          elem.points.appendItem(point);
          elem.points.appendItem(self.util.toViewboxCoords(event));
          elem.points.appendItem(self.util.toViewboxCoords(event));
          elem.points.appendItem(self.util.toViewboxCoords(event));
          $(elem).addClass('drawing');
        }

        event.stopPropagation();
        event.preventDefault();

        return false;
      }

      self.util.finishDrawing = finishRect;
      function finishRect( event ) {
        if( ! elem )
          return;
        if ( typeof event !== 'undefined' ) {
          updatePoint(event);

          if ( ! isvalidrect(elem.points,elem) )
            return;

          event.stopPropagation();
          event.preventDefault();
        }

        $(elem).removeClass('drawing');

        if ( ! isvalidrect(elem.points,elem) )
          delrect(elem);

        else if ( typeof onfinish === 'function' ) {
          standardizeQuad(elem);
          onfinish(elem);
        }

        elem = false;

        return false;
      }

      $(svgRoot)
        .mousemove(updatePoint)
        .click(handleClick);

      var eventList = $._data(svgRoot,'events');
      eventList.click.unshift(eventList.click.pop()); // Make this click event first in queue

      self.mode.disablers.push( function () {
          $(svgRoot)
            .off( 'mousemove', updatePoint )
            .off( 'click', handleClick );
          self.util.finishDrawing = null;
        } );
    }

    /**
     * Initializes the draw polyline/polygon mode.
     *
     * @param {function} createpoly   Creates a poly* element already added to the svg.
     * @param {function} isvalidpoly  Validates a list of {x,y} points.
     * @param {function} onfinish     Called when the poly* is finished.
     * @param {function} delpoly      Removes the poly* element.
     */
    function drawModePoly( createpoly, isvalidpoly, onfinish, delpoly ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return drawModePoly.apply(this,args); };

      setDrawPoly( createpoly, isvalidpoly, onfinish, delpoly );

      //prevEditing();

      return false;
    }

    /**
     * Enables the draw polyline/polygon state.
     *
     * @param {function} createpoly   Creates a poly* element already added to the svg.
     * @param {function} isvalidpoly  Validates a list of {x,y} points.
     * @param {function} onfinish     Called when the poly* is finished.
     * @param {function} delpoly      Removes the poly* element.
     * @param {int}      polylimit    Maximum number of points.
     */
    function setDrawPoly( createpoly, isvalidpoly, onfinish, delpoly, polylimit ) {
      var elem = false;
      polylimit = typeof polylimit === 'undefined' ? 0 : polylimit;

      function default_createpoly() {
        var elem = $(document.createElementNS(self.util.sns,'polyline'))
          .appendTo(svgRoot);
        return elem[0];
      }
      if ( typeof createpoly !== 'function' )
        createpoly = default_createpoly;

      if ( typeof isvalidpoly !== 'function' )
        isvalidpoly = function () { return true; };

      if ( typeof delpoly !== 'function' )
        delpoly = function ( elem ) { $(elem).remove(); };

      function updatePoint( event ) {
        if( ! elem )
          return;
        var point = self.util.toViewboxCoords(event);
        if ( self.cfg.roundPoints ) {
          point.x = Math.round(point.x);
          point.y = Math.round(point.y);
        }
        elem.points[elem.points.length-1].x = point.x;
        elem.points[elem.points.length-1].y = point.y;
      }

      function addPoint( event ) {
        if ( self.util.dragging ||
             ! event.pageX ||
             event.originalEvent.detail > 1 )
          return;
        if ( elem && ( event.ctrlKey || event.metaKey ) )
          return finishPoly(event);

        var point = self.util.toViewboxCoords(event);
        if ( self.cfg.roundPoints ) {
          point.x = Math.round(point.x);
          point.y = Math.round(point.y);
        }
        if( elem ) {
          if ( ! isvalidpoly(elem.points,elem) )
            return;
          if ( polylimit > 0 && elem.points.length >= polylimit )
            return finishPoly( event );
          elem.points.appendItem(point);
        }
        else {
          if ( ! isvalidpoly( {points:[point]} ) )
            return;
          elem = createpoly(event);
          if ( ! elem )
            return;
          elem.points.appendItem(point);
          elem.points.appendItem(self.util.toViewboxCoords(event));
          $(elem).addClass('drawing');
        }

        event.stopPropagation();
        event.preventDefault();

        return false;
      }

      self.util.finishDrawing = finishPoly;
      function finishPoly( event ) {
        if( ! elem )
          return;
        if ( typeof event !== 'undefined' ) {
          var point = self.util.toViewboxCoords(event);
          if ( self.cfg.roundPoints ) {
            point.x = Math.round(point.x);
            point.y = Math.round(point.y);
          }
          if ( ! isvalidpoly(elem.points,elem) )
            return;

          event.stopPropagation();
          event.preventDefault();
        }
        else if ( elem.points.length > 2 )
          elem.points.removeItem(elem.points.length-1);
        while ( elem.points.length > 2 &&
                elem.points[elem.points.length-1].x == elem.points[elem.points.length-2].x &&
                elem.points[elem.points.length-1].y == elem.points[elem.points.length-2].y )
          elem.points.removeItem(elem.points.length-1);

        $(elem).removeClass('drawing');

        if ( ! isvalidpoly(elem.points,elem,true) )
          delpoly(elem);

        else if ( typeof onfinish === 'function' )
          onfinish(elem);

        elem = false;

        return false;
      }

      $(svgRoot)
        .mousemove(updatePoint)
        .click(addPoint);

      var eventList = $._data(svgRoot,'events');
      eventList.click.unshift(eventList.click.pop()); // Make this click event first in queue

      self.mode.disablers.push( function () {
          $(svgRoot)
            .off( 'mousemove', updatePoint )
            .off( 'click', addPoint );
          self.util.finishDrawing = null;
        } );
    }

    return self;
  } // function SvgCanvas( svgContainer, config ) {


  ///////////////////////////
  /// Auxiliary functions ///
  ///////////////////////////

  /**
   * Checks that a string is partially valid XML.
   *
   * @param {string}  str    Input text.
   */
  function strXmlValidate( str ) {
    var parse = (new DOMParser()).parseFromString('<text>'+str+'</text>',"text/xml");
    parse = $(parse).find('parsererror');
    if ( parse.length !== 0 ) {
      var err = new Error( parse.find('div').text() );
      return err;
    }
    return false;
  }
  SvgCanvas.strXmlValidate = strXmlValidate;

  /**
   * Converts text with line breaks into an SVG with tspan nodes.
   *
   * @param {string}  val    Input text.
   */
  function svgTextParser( val ) {
    var lines = encodeXmlEntities(val).split(/\r\n|\r|\n/);
    val = '';
    for ( var n = 0; n < lines.length; n++ )
      val += '<tspan x="0" dy="1em">'+lines[n]+'</tspan>';
    return val;
  }

  /**
   * Converts an SVG text node with tspan's into line breaked text.
   *
   * @param {string}  val    Input text.
   */
  function svgTextFormatter( val ) {
    var text = document.createElementNS( sns, 'text' );
    text.innerHTML = val;
    var tspans = $(text).find('tspan');
    if ( tspans.length > 0 ) {
      val = '';
      for ( var n = 0; n < tspans.length; n++ )
        val += decodeXmlEntities($(tspans[n]).text()) + ( n === tspans.length-1 ? "" : "\n" );
    }
    return val.trim();
  }

  /**
   * Decodes XML entities for text: & < >
   */
  function decodeXmlEntities( str ) {
    return str.replace( /&gt;/g, '>' )
              .replace( /&lt;/g, '<' )
              .replace( /&amp;/g, '&' );
  }

  /**
   * Encodes XML entities for text: & < >
   */
  function encodeXmlEntities( str ) {
    return str.replace( /&/g, '&amp;' )
              .replace( /</g, '&lt;' )
              .replace( />/g, '&gt;' );
  }

})( window );
