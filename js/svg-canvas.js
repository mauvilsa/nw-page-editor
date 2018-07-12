/**
 * Javascript library for viewing and interactive editing of SVGs.
 *
 * @version $Version: 2018.07.12$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

// @todo Bug: draggable may be behind other elements, could add transparent polygon on top to ease dragging
// @todo Allow use without keyboard shortcuts and no Mousetrap dependency
// @todo Function to get number of undo/redo states
// @todo On points edit mode, allow to move element using arrows
// @todo Add points by key shortcut plus click, previewing the result as the mouse moves
// @todo Only allow drop if valid points
// @todo Rectangle for measuring size and offset
// @todo Rectangle for selecting?

(function( global ) {
  'use strict';

  var
  sns = 'http://www.w3.org/2000/svg',
  xns = 'http://www.w3.org/1999/xlink',
  version = '$Version: 2018.07.12$'.replace(/^\$Version. (.*)\$/,'$1');

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
    self.cfg.registerChangeEnabled = true;
    self.cfg.dragpointHref = null;
    self.cfg.stylesId = null;
    self.cfg.textareaId = null;
    self.cfg.textParser = svgTextParser;
    self.cfg.textFormatter = svgTextFormatter;
    self.cfg.textValidator = function () { return false; };
    self.cfg.multilineText = true;
    self.cfg.onPanZoomChange = [];
    self.cfg.onMouseMove = [];
    self.cfg.onSetEditText = [];
    self.cfg.onValidText = [];
    self.cfg.onInvalidText = [];
    self.cfg.onInvalidTextUnselect = [];
    self.cfg.onTextChange = [];
    self.cfg.onSetEditing = [];
    self.cfg.onRemoveEditing = [];
    self.cfg.onPointsChange = [];
    self.cfg.onPointsChangeEnd = [];
    self.cfg.onInvalidPoints = [];
    self.cfg.onFirstChange = [];
    self.cfg.onChange = [];
    self.cfg.onLoad = [];
    self.cfg.onUnload = [];
    self.cfg.onSelect = [];
    self.cfg.onUnselect = [];
    self.cfg.onDelete = [];
    self.cfg.onProtectionChange = [];
    self.cfg.onChangeContainer = [];
    self.cfg.onDragStart = [];
    self.cfg.onDragEnd = [];
    self.cfg.onDrop = [];
    self.cfg.onDropOutsideOfDropzone = [];
    self.cfg.onClone = [];
    self.cfg.onCloneInternal = [];
    self.cfg.onModeOff = [];
    self.cfg.onRemovePolyPoint = [];
    self.cfg.onAddPolyPoint = [];
    self.cfg.onEscOverride = [];
    self.cfg.onNoEditEsc = [];
    self.cfg.onRestoreHistory = [];
    self.cfg.modeFilter = '';
    self.cfg.allowPointsChange = null;
    self.cfg.allowRemovePolyPoint = null;
    self.cfg.allowAddPolyPoint = null;
    self.cfg.centerOnSelection = false;
    self.cfg.roundPoints = false;
    self.cfg.captureEscape = true;
    self.cfg.handleEscape = handleEscape;
    self.cfg.dropOverlap = 0.2;
    self.cfg.editablesSortCompare = null;
    self.cfg.cycleEditablesLoop = false;
    self.cfg.onCycleEditables = [];
    self.cfg.delTask = null;
    self.cfg.delSelector = null;
    self.cfg.delConfirm = function () { return false; };
    self.cfg.handleError = function ( err ) { throw err; };
    self.cfg.handleWarning = function ( warn ) { console.log('warning: '+warn); };

    /// Utility variables and functions ///
    self.util = {};
    self.util.sns = sns;
    self.util.xns = xns;
    self.util.svgAux = document.createElementNS(sns,'svg');
    self.util.svgRoot = null;
    self.util.mouseCoords = null;
    self.util.dragging = false;
    self.util.registerChange = registerChange;
    self.util.unselectElem = unselectElem;
    self.util.selectElem = selectElem;
    self.util.moveElem = moveElem;
    self.util.removeEditings = removeEditings;
    self.util.setEditing = setEditing;
    self.util.setEditPoints = setEditPoints;
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
    self.util.isRect = isRect;
    self.util.isReadOnly = isReadOnly;
    self.util.textReplace = textReplace;
    self.util.strXmlValidate = strXmlValidate;
    self.util.selectFiltered = selectFiltered;
    self.util.select = function ( selector ) { $(svgRoot).find(selector).first().click(); };

    /// Object for enabling / disabling modes ///
    self.mode = {};
    self.mode.interactables = [];
    self.mode.disablers = [];
    self.mode.off = editModeOff;
    self.mode.current = self.mode.off;
    self.mode.currentMultisel = null;
    self.mode.select = editModeSelect;
    self.mode.selectMultiple = editModeSelectMultiple;
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
            if ( $.isArray(self.cfg[op]) ) {
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

    /// Disable pointer events by class and child elements of selectable or editable ///
    $.stylesheet('#'+self.cfg.stylesId+
        '{ #'+svgContainer.id+' .no-pointer-events,'+
        '  #'+svgContainer.id+' .Coords.selectable ~ g .Coords,'+
        '  #'+svgContainer.id+' .Coords.editable ~ g .Coords,'+
        '  #'+svgContainer.id+' g.selectable g .Coords,'+
        '  #'+svgContainer.id+' g.editable g .Coords }')
      .css( 'pointer-events', 'none' );

    /**
     * Returns the version of the library.
     */
    self.getVersion = function () {
      return { SvgCanvas: version,
               jquery: $.fn.jquery };
    };

    /**
     * Calls the handleError with the given message and then throws the error if handler returns true.
     *
     * @param {string}  err    The error message or an error object.
     */
    self.throwError = function ( err ) {
      if ( typeof err === 'string' )
        err = new Error( err );
      if ( self.cfg.handleError(err) )
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
      if ( ! self.cfg.registerChangeEnabled )
        return;
      pushChangeHistory(changeType);
      if ( ! hasChanged )
        for ( var n=0; n<self.cfg.onFirstChange.length; n++ )
          self.cfg.onFirstChange[n]();
      for ( var m=0; m<self.cfg.onChange.length; m++ )
        self.cfg.onChange[m]();
      hasChanged = true;
    }
    self.registerChange = registerChange;

    /**
     * Sets the state of the SVG to unchanged.
     */
    self.setUnchanged = function () {
      hasChanged = false;
    };

    /**
     * Sets the state of the SVG to changed.
     */
    self.setChanged = function () {
      hasChanged = true;
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
      self.util.mouseCoords = svgRoot.createSVGPoint();
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

      for ( var n=0; n<self.cfg.onRestoreHistory.length; n++ )
        self.cfg.onRestoreHistory[n]();

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

    /**
     * Checks if an element can be modified or not.
     */
    function isReadOnly( elem ) {
      elem = typeof elem === 'undefined' ? svgRoot : elem;
      elem = elem instanceof jQuery ? elem : $(elem);
      return elem.closest('#'+svgContainer.id+' .protected, #'+svgContainer.id+'.readonly').length > 0;
    }

    ///////////////////////////////////////////
    /// Keep track of mouse cursor position ///
    ///////////////////////////////////////////

    $(svgContainer).mousemove( function ( event ) {
        if ( ! svgRoot )
          return;
        var point = svgRoot.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        point = self.util.toViewboxCoords(point);
        self.util.mouseCoords.x = point.x;
        self.util.mouseCoords.y = point.y;
        for ( var k=0; k<self.cfg.onMouseMove.length; k++ )
          self.cfg.onMouseMove[k](point);
      } );


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
        boxX0 = xmin ;
        boxY0 = ymin + ( svgR < canvasR ? 0 : ( height - boxH ) / 2 );
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        fitState = FITTED.WIDTH;
        dragpointScale();
        for ( var k=0; k<self.cfg.onPanZoomChange.length; k++ )
          self.cfg.onPanZoomChange[k](boxW,boxH);
        return false;
      }

      function fitHeight() {
        boxH = height ;
        boxW = height * canvasR ;
        boxY0 = ymin ;
        boxX0 = xmin + ( svgR > canvasR ? 0 : ( width - boxW ) / 2 );
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        fitState = FITTED.HEIGHT;
        dragpointScale();
        for ( var k=0; k<self.cfg.onPanZoomChange.length; k++ )
          self.cfg.onPanZoomChange[k](boxW,boxH);
        return false;
      }

      function fitPage() {
        if( svgR < canvasR )
          fitHeight();
        else
          fitWidth();
        fitState = FITTED.PAGE;
        return false;
      }

      function zoom( amount, point, factor ) {
        point = typeof point == 'undefined' ? { x:boxX0+0.5*boxW, y:boxY0+0.5*boxH } : point ;
        factor = typeof factor == 'undefined' ? 0.05 : factor ;
        var
        center = 0.2,
        pboxW = boxW,
        pboxH = boxH,
        scale = amount > 0 ?
          Math.pow( 1.0-factor, amount ) :
          Math.pow( 1.0+factor, -amount ) ;
        boxW *= scale;
        boxH *= scale;
        boxX0 = scale * ( boxX0 - point.x ) + point.x;
        boxY0 = scale * ( boxY0 - point.y ) + point.y;
        boxX0 = (1-center) * boxX0 + center * ( point.x - 0.5*boxW );
        boxY0 = (1-center) * boxY0 + center * ( point.y - 0.5*boxH );
        viewBoxLimits();
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        fitState = FITTED.NONE;
        dragpointScale();
        for ( var k=0; k<self.cfg.onPanZoomChange.length; k++ )
          self.cfg.onPanZoomChange[k](boxW,boxH);
        return false;
      }

      /**
       * Moves center of viewbox.
       */
      function pan( dx, dy ) {
        //console.log('called pan dx='+dx+' dy='+dy);
        //boxX0 -= dx * boxW ;
        //boxY0 -= dy * boxH ;
        var S = boxW < boxH ? boxW : boxH;
        boxX0 -= dx * S ;
        boxY0 -= dy * S ;
        viewBoxLimits();
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
        for ( var k=0; k<self.cfg.onPanZoomChange.length; k++ )
          self.cfg.onPanZoomChange[k](boxW,boxH);
        return false;
      }

      /**
       * Sets a specific viewBox.
       */
      function setViewBox( new_boxX0, new_boxY0, new_boxW, new_boxH ) {
        boxX0 = new_boxX0;
        boxY0 = new_boxY0;
        boxW = new_boxW;
        boxH = new_boxH;
        svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
      }

      /// Pan on wheel and zoom on shift+wheel ///
      function wheelPanZoom( event ) {
        event = event.originalEvent;
        if ( event.deltaX === 0 && event.deltaY === 0 )
          return false;
        event.preventDefault();
        if ( event.shiftKey )
          return zoom( event.deltaX+event.deltaY > 0 ? 1 : -1, selectedCenter() );
        else {
          var x=0, y=0;
          if ( Math.abs(event.deltaX) > Math.abs(event.deltaY) )
            x = event.deltaX > 0 ? -0.02 : 0.02;
          else
            y = event.deltaY > 0 ? -0.02 : 0.02;
          return pan(x,y);
        }
      }
      $(svgRoot).on('wheel',wheelPanZoom);

      /// Keyboard shortcuts ///
      Mousetrap.bind( ['alt+0','mod+0'], function () { return fitPage(); } );
      Mousetrap.bind( ['alt+shift w','mod+shift w'], function () { return fitWidth(); } );
      Mousetrap.bind( ['alt+shift h','mod+shift h'], function () { return fitHeight(); } );
      Mousetrap.bind( ['alt+=','mod+='], function () { return zoom(1,selectedCenter()); } );
      Mousetrap.bind( ['alt+-','mod+-'], function () { return zoom(-1,selectedCenter()); } );
      Mousetrap.bind( ['alt+right','mod+right'], function () { return pan(-0.02,0); } );
      Mousetrap.bind( ['alt+left', 'mod+left'], function () { return pan(0.02,0); } );
      Mousetrap.bind( ['alt+up',   'mod+up'], function () { return pan(0,0.02); } );
      Mousetrap.bind( ['alt+down', 'mod+down'], function () { return pan(0,-0.02); } );

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
      self.setViewBox = setViewBox;

      $(window).resize( function () { self.adjustViewBox(); } );
    };

    function viewBoxLimits() {
      var factW = boxW/width, factH = boxH/height;
      if ( factW > 1.2 && factH > 1.2 ) {
        if ( factW < factH ) {
          boxW = 1.2 * width;
          boxH = width / canvasR;
        }
        else {
          boxH = 1.2 * height;
          boxW = height * canvasR;
        }
      }
      if ( factW > 1 && factH > 1 ) {
        boxX0 = ( width - boxW ) / 2;
        boxY0 = ( height - boxH ) / 2;
      }

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
      scale = 0.0025 * Math.min( boxW, boxH );
      $.stylesheet(cssrule).css( 'transform', 'scale('+scale+')' );
    }

    /**
     * Returns the current canvas range.
     */
    self.util.canvasRange = function () {
      return { width:width, height:height, x:xmin, y:ymin };
    };

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
    function selectedCenter() {
      var sel = $(svgRoot).find('.selected').closest('g');
      if ( sel.length > 0 && ! sel.hasClass('dragging') ) {
        var rect = sel[0].getBBox();
        return { x: rect.x + 0.5*rect.width, y: rect.y + 0.5*rect.height };
      }
      else
        return self.util.mouseCoords;
    }

    /**
     * Centers the viewbox on the selected element.
     */
    function panToSelected() {
      var point = selectedCenter();
      if ( ! point )
        return;
      boxX0 = point.x - 0.5*boxW;
      boxY0 = point.y - 0.5*boxH;
      viewBoxLimits();
      svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );
    }

    /**
     * Centers and zooms the viewbox on the selected element.
     */
    function panZoomTo( fact, limits, sel ) {
      if ( typeof sel === 'undefined' )
        sel = '.selected';
      if ( typeof sel === 'string' )
        sel = $(svgRoot).find(sel).closest('g');
      if ( typeof sel === 'object' && ! ( sel instanceof jQuery ) )
        sel = $(sel);
      if ( sel.length === 0 || sel.hasClass('dragging') )
        return;
      var rect = sel[0].getBBox();

      if ( typeof fact.w !== 'undefined' ) {
        boxW = rect.width / fact.w;
        boxH = boxW / canvasR;
      }
      else if ( typeof fact.h !== 'undefined' ) {
        boxH = rect.height / fact.h;
        boxW = boxH * canvasR;
      }

      boxX0 = (rect.x + 0.5*rect.width) - 0.5*boxW;
      boxY0 = (rect.y + 0.5*rect.height) - 0.5*boxH;

      if ( typeof limits === 'undefined' || limits )
        viewBoxLimits();

      svgRoot.setAttribute( 'viewBox', boxX0+' '+boxY0+' '+boxW+' '+boxH );

      dragpointScale();

      for ( var k=0; k<self.cfg.onPanZoomChange.length; k++ )
        self.cfg.onPanZoomChange[k](boxW,boxH);
    }
    self.util.panZoomTo = panZoomTo;

    /**
     * Selects svg elements for mode optionally filtered.
     */
    function selectFiltered( selector ) {
      if ( self.cfg.modeFilter ) {
        try {
          var sel = $(svgRoot).find(selector+self.cfg.modeFilter);
          return sel;
        } catch(e) {}
      }
      return $(svgRoot).find(selector);
    }

    //////////////////////////////
    /// Import and export SVGs ///
    //////////////////////////////

    /**
     * Returns a clone of the SVG without all of the editor data.
     */
    self.getSvgClone = function ( internal ) {
      var n,
      clone = $(svgRoot).clone(),
      classes = [ 'selectable', 'selected',
                  'editable', 'editing', 'prev-editing',
                  'draggable', 'dragging',
                  'drawing',
                  'dropzone', 'not-dropzone', 'drop-active', 'drop-target', 'can-drop',
                  'no-pointer-events' ];

      if ( typeof internal === 'undefined' || ! internal ) {
        for ( n = classes.length-1; n>=0; n-- )
          clone.find('.'+classes[n]).removeClass(classes[n]);
        clone.find('#'+svgContainer.id+'_defs, use').remove();
        for ( n=0; n<self.cfg.onClone.length; n++ )
          self.cfg.onClone[n](clone);
      }
      for ( n=0; n<self.cfg.onCloneInternal.length; n++ )
        self.cfg.onCloneInternal[n](clone);

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
        try { svgDoc = $.parseXML( svgDoc ); } catch(e) { self.throwError(e); }
      if ( ! svgDoc.nodeName || $(svgDoc).find('> svg').length === 0 )
        return self.throwError( "Expected as input an SVG document" );

      /// Remove all content in container element ///
      clearContainer();

      /// Append SVG and initialize ///
      hasChanged = false;
      clearChangeHistory();
      panzoom = false;
      svgContainer.appendChild( svgDoc.documentElement ? svgDoc.documentElement : svgDoc );
      self.util.svgRoot = svgRoot = svgContainer.firstChild;
      self.util.mouseCoords = svgRoot.createSVGPoint();

      $(document.createElementNS(self.util.sns,'defs'))
        .attr('id',svgContainer.id+'_defs')
        .prependTo(svgRoot);

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
      defs = $('#'+svgContainer.id+'_defs')[0];

      if ( ! self.cfg.dragpointHref ) {
        dragpoint = document.createElementNS(sns,'g');
        $(document.createElementNS(sns,'circle'))
          .attr( { 'r': 3, 'x': 0, 'y': 0 } )
          .appendTo(dragpoint);
        $(document.createElementNS(sns,'circle'))
          .attr( { 'r': 0.5, 'x': 0, 'y': 0 } )
          .appendTo(dragpoint);
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
      if ( typeof svgElem === 'object' && ! ( svgElem instanceof jQuery ) )
        svgElem = $(svgElem);
      if ( typeof svgElem === 'undefined' ) {
        svgElem = $(svgRoot).find('.selected');
        if ( svgElem.length === 0 )
          return;
      }
      else if( ! svgElem.hasClass('selected') )
        return;
      svgElem.removeClass('selected');
      //for ( var n=0; n<self.cfg.onUnselect.length; n++ )
      //  svgElem.each( function () { self.cfg.onUnselect[n](this); } );
      svgElem.each( function () {
          for ( var n=0; n<self.cfg.onUnselect.length; n++ )
            self.cfg.onUnselect[n](this);
        } );
    }

    /**
     * Sets selected to given element.
     */
    function selectElem( svgElem, reselect, nocenter ) {
      if ( $(svgElem).hasClass('selected') &&
           ( typeof reselect === 'undefined' || ! reselect ) )
        return;
      unselectElem();
      if ( $(document.activeElement).filter('input[type=text], textarea').length > 0 )
        $(document.activeElement).blur();
      $(svgElem).addClass('selected');
      if ( self.cfg.centerOnSelection &&
           ( typeof nocenter === 'undefined' || ! nocenter ) )
        panToSelected();
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
      selElem = $(svgRoot).find('.selected').first();
      if ( selElem.length === 0 || isReadOnly(selElem) )
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

        if ( self.cfg.delTask )
          self.cfg.delTask(delElem);
        else
          $(delElem).remove();

        registerChange('deleted '+elemPath);
      }
      return false;
    }
    Mousetrap.bind( 'mod+del', function () { return handleDeletion(); } );
    Mousetrap.bind( 'del', function () {
      if ( ( self.cfg.textareaId && ! $('#'+self.cfg.textareaId).prop('disabled') ) ||
           $(document.activeElement).filter('input[type=text]').length > 0 )
        return true;
      return handleDeletion(); } );

    /**
     * Toggles protection of the selected element's group.
     */
    function toggleProtection() {
      var sel = $(svgRoot).find('.selected').first().closest('g');
      if ( sel.length === 0 )
        return true;
      if ( isReadOnly() )
        return true;
      sel.toggleClass('protected');
      if ( sel.hasClass('protected') )
        $('#'+self.cfg.textareaId)
          .blur()
          .prop( 'disabled', true );
      else
        $('#'+self.cfg.textareaId)
          .prop( 'disabled', false )
          .focus();
      for ( var n=0; n<self.cfg.onProtectionChange.length; n++ )
        self.cfg.onProtectionChange[n](sel);
      registerChange('toggled protection of '+getElementPath(sel));
      return false;
    }
    self.util.toggleProtection = toggleProtection;
    Mousetrap.bind( 'mod+p', function () { return toggleProtection(); } );

    /**
     * Adds or removes protection of an element group
     */
    function setProtection( val, sel ) {
      if ( $('#'+svgContainer.id+'.readonly').length > 0 )
        return false;

      if ( typeof sel === 'undefined' )
        sel = '.selected';
      if ( typeof sel === 'string' )
        sel = $(svgRoot).find(sel);
      sel = $(sel).closest('g, svg');
      if ( sel.length === 0 )
        return false;

      /// Set as protected ///
      if ( val ) {
        if ( ! sel.hasClass('protected') && sel.closest('#'+svgContainer.id+' .protected').length === 0 ) {
          sel.addClass('protected');
          if ( sel.is('.selected') || sel.children('.selected').length > 0 )
            $('#'+self.cfg.textareaId)
              .blur()
              .prop( 'disabled', true );
          for ( var n=0; n<self.cfg.onProtectionChange.length; n++ )
            self.cfg.onProtectionChange[n](sel);
          registerChange('added protection to '+getElementPath(sel));
          return true;
        }
      }

      /// Remove protection ///
      else {
        if ( sel.hasClass('protected') && sel.closest('#'+svgContainer.id+' .protected').length > 0 ) {
          sel.removeClass('protected');
          if ( sel.is('.selected') || sel.children('.selected').length > 0 )
            $('#'+self.cfg.textareaId)
              .prop( 'disabled', false )
              .focus();
          for ( var m=0; m<self.cfg.onProtectionChange.length; m++ )
            self.cfg.onProtectionChange[m](sel);
          registerChange('removed protection from '+getElementPath(sel));
          return true;
        }
      }

      return false;
    }
    self.util.setProtection = setProtection;

    /**
     * Returns the elements under a given point optionally filtered by a jquery selector.
     */
    function elementsFromPoint( point, filter ) {
      point = typeof point.pageX !== 'undefined' ?
        { x:point.pageX, y:point.pageY }:
        point;
      var
      elem = document.elementsFromPoint ?
        $(document.elementsFromPoint(point.x,point.y)):
        $(elementsFromPointPolyfill(point.x,point.y));
      return typeof filter !== 'undefined' ?
        elem.filter(filter):
        elem;
    }
    self.util.elementsFromPoint = elementsFromPoint;

    function elementsFromPointPolyfill(x,y) {
      var elements = [], previousPointerEvents = [], current, i, d;

      // get all elements via elementFromPoint, and remove them from hit-testing in order
      while ((current = document.elementFromPoint(x,y)) && elements.indexOf(current) === -1 && current !== null) {
        // push the element and its current style
        elements.push(current);
        previousPointerEvents.push({
            value: current.style.getPropertyValue('pointer-events'),
            priority: current.style.getPropertyPriority('pointer-events')
          });

        // add "pointer-events: none", to get to the underlying element
        current.style.setProperty('pointer-events', 'none', 'important');
      }

      // restore the previous pointer-events values
      for(i = previousPointerEvents.length-1; i>=0; i-- ) {
        d = previousPointerEvents[i];
        elements[i].style.setProperty('pointer-events', d.value?d.value:'', d.priority);
      }

      return elements;
    }


    //////////////////
    /// Edit modes ///
    //////////////////

    /**
     * Turns off all edit modes.
     */
    function editModeOff() {
      removeEditings();

      for ( var n=0; n<self.mode.interactables.length; n++ )
        self.mode.interactables[n].unset();
      self.mode.interactables = [];

      //interact('#'+svgContainer.id+' .draggable').unset();
      $(svgRoot)
        .find('.draggable')
        .removeClass('draggable');
      //interact('#'+svgContainer.id+' .dropzone').unset();
      $(svgRoot)
        .find('.dropzone')
        .removeClass('dropzone');

      $(svgRoot)
        .find('.no-pointer-events')
        .removeClass('no-pointer-events');

      $(svgRoot)
        .find('.selectable')
        .removeClass('selectable')
        .off('click');

      $(svgRoot)
        .find('.editable')
        .removeClass('editable')
        .off('click')
        .each( function () {
            if ( typeof this.setEditing !== 'undefined' )
              delete this.setEditing;
          } );

      $('#'+self.cfg.textareaId)
        //.off('keyup change')
        .off('input')
        .val('')
        .prop( 'disabled', true );

      for ( n=0; n<self.mode.disablers.length; n++ )
        self.mode.disablers[n]();
      self.mode.disablers = [];

      for ( n=0; n<self.cfg.onModeOff.length; n++ )
        self.cfg.onModeOff[n]();

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
    function handleEscape(e) {
      if ( ! self.cfg.captureEscape )
        return true;
      for ( var n=0; n<self.cfg.onEscOverride.length; n++ )
        if ( ! self.cfg.onEscOverride[n](e) )
          return true;
      if ( $(svgRoot).find('.editing').length > 0 )
        removeEditings();
      else if ( $(svgRoot).find('.drawing').length > 0 )
        self.util.finishDrawing();
      else if ( self.mode.currentMultisel ) {
        $(svgRoot).find('.selected').removeClass('selected');
        var currentMultisel = self.mode.currentMultisel;
        self.mode.currentMultisel = null;
        currentMultisel();
      }
      else {
        $(svgRoot).find('.prev-editing').removeClass('prev-editing');
        for ( var k=0; k<self.cfg.onNoEditEsc.length; k++ )
          self.cfg.onNoEditEsc[k]();
      }
      return false;
    }
    Mousetrap.bind( 'esc', function (e) { return self.cfg.handleEscape(e); } );

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
              setEditPoints( svgElem, opts.points_selector, opts.restrict, true, opts.points_validator );
              break;
            case 'text+points':
              setEditText( svgElem, opts.text_selector, opts.text_creator, true );
              setEditPoints( svgElem, opts.points_selector, opts.restrict, false, opts.points_validator );
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
      //$(svgRoot).find('.prev-editing').removeClass('prev-editing').click();
      var prev = $(svgRoot).find('.prev-editing');
      if ( prev.length > 0 )
        prev.removeClass('prev-editing').click();
      else
        $(svgRoot).find('.editable').first().click();
    }

    /**
     * Function to get current editables sorted if editablesSortCompare defined.
     */
    function getSortedEditables() {
      var editables = $(svgRoot).find('.editable');
      if ( editables.length > 0 && self.cfg.editablesSortCompare )
        editables.sort(self.cfg.editablesSortCompare);
      return editables;
    }
    self.util.getSortedEditables = getSortedEditables;

    /**
     * Function to cycle through editables using a keyboard shortcut.
     */
    function cycleEditables( offset, e ) {
      if ( document.activeElement != $('#'+self.cfg.textareaId)[0] && 
           $(document.activeElement).filter('input[type=text], textarea').length > 0 )
        return true;
      var
      editables = getSortedEditables(),
      currEditing = $(svgRoot).find('.editing'),
      newEditing;
      if ( editables.length === 0 )
        return;
      if ( currEditing.length === 0 ) {
        newEditing = editables.index( $(svgRoot).find('.prev-editing') );
        if ( newEditing < 0 )
          newEditing = offset > 0 ? 0 : editables.length - 1 ;
      }
      else if( self.cfg.cycleEditablesLoop )
        newEditing = ( editables.index(currEditing) + offset ) % editables.length;
      else {
        newEditing = editables.index(currEditing) + offset;
        if ( newEditing < 0 )
          newEditing = 0;
        else if ( newEditing >= editables.length )
          newEditing = editables.length-1;
      }
      newEditing = editables.eq(newEditing);
      if ( newEditing.length > 0 && currEditing[0] !== newEditing[0] ) {
        if ( newEditing[0].hasOwnProperty('setEditing') )
          newEditing[0].setEditing();
        else
          newEditing.click();
      }
      for ( var n=0; n<self.cfg.onCycleEditables.length; n++ )
        self.cfg.onCycleEditables(editables);
      return false;
    }

    Mousetrap.bind( 'tab', function () { return cycleEditables(1); } );
    Mousetrap.bind( 'shift+tab', function () { return cycleEditables(-1); } );

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
    function editModeSelect( selector, noevents ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeSelect.apply(this,args); };
      if ( ! svgRoot )
        return true;

      selectFiltered(selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'select' );
          } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

      prevEditing();

      return false;
    }

    /**
     * Initializes the mode for selecting multiple elements.
     *
     * @param {array}     elem_selectors  CSS selectors for relation elements.
     * @param {array}     elem_nums       Number of elements to select with each selector.
     * @param {function}  onNew           Function to execute when new element selected.
     * @param {function}  onAll           Function to execute when all elements selected.
     */
    function editModeSelectMultiple( elem_selectors, elem_nums, onNew, onAll ) {
      if ( ! self.util.svgRoot )
        return true;

      if ( elem_selectors.constructor !== Array )
        elem_selectors = [ elem_selectors ];
      if ( elem_nums.constructor !== Array )
        elem_nums = [ elem_nums ];
      if ( elem_selectors.length !== elem_nums.length )
        self.throwError('editModeSelectMultiple requires same dimensionality of elem_selectors and elem_nums');

      self.mode.off();
      self.cfg.handleEscape();

      var args = arguments;
      self.mode.currentMultisel = function () { return editModeSelectMultiple.apply(this,args); };

      var
      selNum = 0,
      accum = elem_nums.slice(),
      elems = [];

      for ( var n=1; n<accum.length; n++ )
        accum[n] += accum[n-1];

      function newElemSelected( event ) {
        for ( var n=0; n<elems.length; n++ )
          if ( elems[n] === event.target )
            return true;
        self.mode.off();
        if ( elems.length === 0 )
          $(svgRoot).find('.prev-editing').removeClass('prev-editing');
        $(event.target).addClass('selected');
        elems.push(event.target);
        if ( elems.length === accum[selNum] )
          selNum++;
        if ( selNum < elem_selectors.length ) {
          self.util.selectFiltered(elem_selectors[selNum])
            .addClass('selectable')
            .click(newElemSelected);
          if ( onNew )
            onNew(elems,event);
        }
        else {
          self.mode.currentMultisel = null;
          if ( onAll )
            onAll(elems,event);
        }
        return false;
      }

      self.util.selectFiltered(elem_selectors[selNum])
        .addClass('selectable')
        .click(newElemSelected);
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
    function editModeTextRect( tap_selector, points_selector, text_selector, text_creator, noevents, isvalidrect ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeTextRect.apply(this,args); };
      if ( ! svgRoot )
        return true;

      selectFiltered(tap_selector)
        .each( function () {
          var numrect = 0;
          $(this).find(points_selector)
            .each( function () { numrect += isRect(this) ? 1 : 0 ; } );
          if ( numrect > 0 )
            $(this)
              .addClass('editable')
              .click( function ( event ) {
                  setEditing( event, 'text+points', {
                      points_selector: points_selector,
                      points_validator: isvalidrect,
                      restrict: 'rect',
                      text_selector: text_selector,
                      text_creator: text_creator
                    } );
                } );
        } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

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
    function editModeTextPoints( tap_selector, points_selector, text_selector, text_creator, noevents, isvalidpoints ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeTextPoints.apply(this,args); };
      if ( ! svgRoot )
        return true;

      selectFiltered(tap_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'text+points', {
                points_selector: points_selector,
                points_validator: isvalidpoints,
                text_selector: text_selector,
                text_creator: text_creator
              } );
          } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

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
    function editModeTextDrag( drag_selector, drop_selector, text_selector, text_creator, noevents ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeTextDrag.apply(this,args); };
      if ( ! svgRoot )
        return true;

      setDraggables( drag_selector, drop_selector );

      selectFiltered(drag_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'text', {
                text_selector: text_selector,
                text_creator: text_creator
              } );
          } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

      prevEditing();

      return false;
    }


    //////////////////////
    /// Text edit mode ///
    //////////////////////

    /**
     * Initializes the edit text mode.
     *
     * @param {string}   sel            CSS selector or selected object.
     * @param {string}   searchvalue    Value or regular expression for replacement.
     * @param {string}   newvalue       Value to replace with.
     */
    function textReplace( sel, searchvalue, newvalue, elemid ) {
      if ( typeof sel === 'undefined' )
        sel = '.selected';
      if ( typeof sel === 'string' )
        sel = $(self.util.svgRoot).find(sel);
      if ( typeof sel === 'object' && ! ( sel instanceof jQuery ) )
        sel = $(sel);
      //sel = sel.closest('g');
      if ( sel.length < 1 )
        return 0;

      if ( typeof elemid === 'undefined' )
        elemid = getElementPath;

      var
      numRep = 0,
      numNotText = 0,
      numReadOnly = 0,
      numInvalid = 0;
      sel.each( function () {
          var textElem = $(this);
          if ( ! textElem.is('text') ) {
            numNotText++;
            return;
          }
          if ( self.util.isReadOnly(textElem) ) {
            numReadOnly++;
            return;
          }
          var prevText = self.cfg.textFormatter(textElem.html());
          var newText = prevText.replace( searchvalue, newvalue );
          if ( prevText != newText ) {
            var isinvalid = self.cfg.textValidator(newText,true,textElem);
            if ( isinvalid ) {
              console.log(isinvalid);
              numInvalid++;
              return;
            }
            textElem.html( self.cfg.textParser(newText) );
            for ( var n=0; n<self.cfg.onTextChange.length; n++ )
              self.cfg.onTextChange[n](textElem[0]);
            registerChange('text replacement of '+elemid(textElem));
            console.log('applied replacement on '+elemid(textElem));
            console.log(prevText);
            console.log(newText);
            numRep++;
          }
        } );

      if ( numNotText+numReadOnly+numInvalid > 0 )
       console.log('error: problems replacing '+(numNotText+numReadOnly+numInvalid)+' elements ('+numNotText+' not text, '+numReadOnly+' read only, '+numInvalid+' produced invalid text)');

      return numRep;
    }

    /**
     * Initializes the edit text mode.
     *
     * @param {string}   tap_selector   CSS selector for elements to enable editing.
     * @param {string}   text_selector  CSS selector for the text element to edit.
     * @param {function} text_creator   Called when text element does not exist.
     */
    function editModeText( tap_selector, text_selector, text_creator, noevents ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeText.apply(this,args); };
      if ( ! svgRoot )
        return true;

      selectFiltered(tap_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'text', { text_selector: text_selector, text_creator: text_creator } );
          } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

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
        //.off('keyup change')
        .off('input')
        .val(prevText)
        //.on( 'keyup change', function ( event ) {
        .on( 'input', function ( event ) {
            var currText = textarea.val();
            if ( ! self.cfg.multilineText && currText.match(/[\t\n\r]/) ) {
            //if ( ( event.keyCode === 13 /* enter */ || event.keyCode === 46 /* del */ || event.type === 'paste' ) && ! self.cfg.multilineText ) {
              currText = currText.replace(/[\t\n\r]/g,' ').trim();
              textarea.val(currText);
            }
            if ( prevText === currText )
              return;
            var isinvalid = self.cfg.textValidator(currText,true,svgElem);
            if ( isinvalid )
              for ( n=0; n<self.cfg.onInvalidText.length; n++ )
                self.cfg.onInvalidText[n]( isinvalid );
            else
              for ( n=0; n<self.cfg.onValidText.length; n++ )
                self.cfg.onValidText[n]();
            textElem.html( self.cfg.textParser(currText) );
            for ( n=0; n<self.cfg.onTextChange.length; n++ )
              self.cfg.onTextChange[n](textElem[0]);
            registerChange('text edit of '+getElementPath(textElem));
            prevText = currText;
          } );

      if ( ! isReadOnly(textElem) )
        textarea
          .prop( 'disabled', false )
          .focus();

      var isinvalid = self.cfg.textValidator(prevText,false,svgElem);
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
        var isinvalid = self.cfg.textValidator(currText,false,svgElem);
        if ( isinvalid )
          for ( var n=0; n<self.cfg.onInvalidTextUnselect.length; n++ )
            self.cfg.onInvalidTextUnselect[n]( isinvalid, svgElem );
        if ( prevText !== currText ) {
          textElem.html( self.cfg.textParser(currText) );
          for ( var m=0; m<self.cfg.onTextChange.length; m++ )
            self.cfg.onTextChange[m](textElem[0]);
          registerChange('text edit of '+getElementPath(textElem));
        }
        $(svgElem).removeClass('editing');
        unselectElem(svgElem);
        $('#'+self.cfg.textareaId)
          //.off('keyup change')
          .off('input')
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
    function editModeRect( tap_selector, points_selector, noevents, isvalidrect ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeRect.apply(this,args); };
      if ( ! svgRoot )
        return true;

      selectFiltered(tap_selector)
        .each( function () {
          var numrect = 0;
          $(this).find(points_selector)
            .each( function () { numrect += isRect(this) ? 1 : 0 ; } );
          if ( numrect > 0 )
            $(this)
              .addClass('editable')
              .click( function ( event ) {
                  setEditing( event, 'points', {
                      points_selector: points_selector,
                      points_validator: isvalidrect,
                      restrict: 'rect'
                    } );
                } );
        } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

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
      lgth = pts.numberOfItems;

      if ( lgth < 3 )
        return;

      /// shoelace formula to determine if clockwise or counterclockwise ///
      for ( n=lgth-1; n>=0; n-- )
        area += ( pts.getItem((n+1)%lgth).x - pts.getItem(n).x ) * ( pts.getItem((n+1)%lgth).y + pts.getItem(n).y );

      /// Reverse order if counterclockwise ///
      if ( area > 0 ) {
        tmp = [];
        for( n=lgth-1; n>=0; n-- )
          tmp.push(pts.getItem(n));
        pts.clear();
        for( n=0; n<lgth; n++ )
          pts.appendItem(tmp[n]);
      }
    }

    /**
     * Standardizes a quadrilateral to be top-left clockwise.
     */
    function standardizeQuad( elem, alreadyclockwise ) {
      if ( elem.points.numberOfItems !== 4 )
        return false;

      if ( ! ( typeof alreadyclockwise === 'boolean' && alreadyclockwise ) )
        standardizeClockwise(elem);

      var n, tmp, slope,
      sslope = Infinity,
      shift = 0,
      pts = elem.points;

      /// determine shift to start at top-left ///
      for ( n=0; n<4; n++ )
        if ( pts.getItem((n+1)%4).x > pts.getItem(n).x ) {
          slope = Math.abs( (pts.getItem((n+1)%4).y-pts.getItem(n).y) / (pts.getItem((n+1)%4).x-pts.getItem(n).x) );
          if ( slope < sslope ) {
            shift = n;
            sslope = slope;
          }
        }
      if ( shift > 0 ) {
        tmp = [ pts.getItem(0), pts.getItem(1), pts.getItem(2), pts.getItem(3) ];
        pts.clear();
        for ( n=0; n<4; n++ )
          pts.appendItem(tmp[(n+shift)%4]);
      }

      return true;
    }

    /**
     * Initializes the points edit mode.
     *
     * @param {string}   tap_selector     CSS selector for elements to enable editing.
     * @param {string}   points_selector  CSS selector for element(s) to edit points.
     */
    function editModePoints( tap_selector, points_selector, noevents, isvalidpoints ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModePoints.apply(this,args); };
      if ( ! svgRoot )
        return true;

      selectFiltered(tap_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'points', {
                points_selector: points_selector,
                points_validator: isvalidpoints,
                restrict: false
              } );
          } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

      prevEditing();

      return false;
    }

    /**
     * Makes the points of an SVG element editable.
     *
     * @param {object}   svgElem          Selected element for editing.
     * @param {string}   points_selector  CSS selector for the element to edit.
     */
    function setEditPoints( svgElem, points_selector, restrict, resetedit, isvalidpoints ) {
      var
      restrict_rect = restrict === 'rect' ? true : false,
      rootMatrix,
      isprotected,
      originalPoints = [],
      editElems = $(svgElem),
      editElem = [],
      pointIdx = [],
      numElems = 0,
      k = 0;

      if ( ! isvalidpoints )
        isvalidpoints = function () { return true; };

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
        var k, elem, points, rmpoint,
        point = $(svgRoot).find('.activepoint');
        if ( point.length === 0 )
          return false;
        point = parseInt( point.attr('data-index') );
        elem = editElem[point];
        points = elem.points;
        if ( points.numberOfItems < 3 )
          return false;
        if ( self.cfg.allowRemovePolyPoint && ! self.cfg.allowRemovePolyPoint(elem) )
          return false;

        point = pointIdx[point];
        rmpoint = points.getItem(point);
        points.removeItem(point);

        for ( k=0; k<self.cfg.onRemovePolyPoint.length; k++ )
          self.cfg.onRemovePolyPoint[k](elem,point,rmpoint);

        self.mode.off();
        self.mode.current();
        prevEditing();

        return false;
      }
      Mousetrap.bind( '- .', removePolyPoint );

      /// Point add ///
      function addPolyPoint() {
        var k, elem, points, point, point2,
        point1 = $(svgRoot).find('.activepoint');
        if ( point1.length === 0 )
          return false;
        point1 = parseInt( point1.attr('data-index') );
        elem = editElem[point1];
        points = elem.points;
        if ( points.numberOfItems < 2 )
          return false;
        if ( self.cfg.allowAddPolyPoint && ! self.cfg.allowAddPolyPoint(elem) )
          return false;

        point = svgRoot.createSVGPoint();
        point1 = pointIdx[point1];
        point2 = point1 + (point1 === points.numberOfItems-1 ? -1 : 1);
        point.x = 0.5*(points.getItem(point1).x+points.getItem(point2).x);
        point.y = 0.5*(points.getItem(point1).y+points.getItem(point2).y);
        points.insertItemBefore(point,point2);

        for ( k=0; k<self.cfg.onAddPolyPoint.length; k++ )
          self.cfg.onAddPolyPoint[k](elem,point2);

        self.mode.off();
        self.mode.current();
        prevEditing();

        return false;
      }
      Mousetrap.bind( '+ .', addPolyPoint );

      /// Setup dragpoints for dragging ///
      var interactable = interact('#'+svgContainer.id+' .dragpoint')
        .draggable( {
            onstart: function ( event ) {
              var
              k = event.target.getAttribute('data-index')|0,
              svgElem = editElem[k],
              selectable = $(editElem[k]).closest('.selectable');
              if ( selectable.length !== 0 )
                selectElem( selectable[0] );

              rootMatrix = svgRoot.getScreenCTM();

              isprotected = isReadOnly(svgElem);
              if ( self.cfg.allowPointsChange && ! self.cfg.allowPointsChange(svgElem) )
                isprotected = true;

              self.util.dragging = true;
            },
            onmove: function ( event ) {
              if ( isprotected )
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

              if ( isprotected )
                return;

              var i, point, dragpoint,
              k = event.target.getAttribute('data-index')|0,
              svgElem = editElem[k],
              points = svgElem.points,
              isvalid = isvalidpoints(pointListToArray(points),svgElem,true);
              if ( ! isvalid ) {
                for ( k=0, i=0; k<originalPoints.length; k++ )
                  if ( editElem[k] === svgElem ) {
                    point = points.getItem(i);
                    dragpoint = $(self.util.svgRoot).find('.dragpoint[data-index='+i+']')[0];
                    point.x = dragpoint.x.baseVal.value = originalPoints[k].x;
                    point.y = dragpoint.y.baseVal.value = originalPoints[k].y;
                    i++;
                  }
                for ( k=0; k<self.cfg.onInvalidPoints.length; k++ )
                  self.cfg.onInvalidPoints[k](svgElem);
              }
              else {
                for ( k=0, i=0; k<originalPoints.length; k++ )
                  if ( editElem[k] === svgElem ) {
                    point = points.getItem(i);
                    originalPoints[k].x = point.x;
                    originalPoints[k].y = point.y;
                    i++;
                  }

                for ( k=0; k<self.cfg.onPointsChangeEnd.length; k++ )
                  self.cfg.onPointsChangeEnd[k](svgElem);

                registerChange('points edit of '+getElementPath(svgElem));
              }
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
      if ( numElems > 0 )
        selectElem( numElems > 1 ? svgElem : $(svgElem).find('.selectable')[0] );

      /// Element function to remove editing ///
      var prevRemove = typeof svgElem.removeEditing !== 'undefined' ?
        svgElem.removeEditing : false ;

      svgElem.removeEditing = function ( unset ) {
        if ( prevRemove )
          prevRemove(false);
        Mousetrap.unbind(['- .','+ .']);
        interactable.unset();
        $(svgRoot).find('.dragpoint').remove();
        $(svgElem).removeClass('editing').find('.selectable, ~ > .selectable').removeClass('selectable selected');
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
    function editModeDrag( drag_selector, drop_selector, move_select_func, noevents ) {
      self.mode.off();
      var args = arguments;
      self.mode.current = function () { return editModeDrag.apply(this,args); };
      if ( ! svgRoot )
        return true;

      setDraggables( drag_selector, drop_selector, move_select_func );

      selectFiltered(drag_selector)
        .addClass('editable')
        .click( function ( event ) {
            setEditing( event, 'select' );
          } );

      if ( noevents )
        $(svgRoot).find(noevents)
          .addClass('no-pointer-events');

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

      selectFiltered(drag_selector).addClass('draggable');
      var interactable = interact('#'+svgContainer.id+' .draggable')
        .draggable( {
            onstart: function ( event ) {
                $(event.target).addClass('dragging');
                selectElem(event.target);
                rootMatrix = svgRoot.getScreenCTM();
                isprotected = isReadOnly(event.target);
                self.util.dragging = true;
                for ( var n=0; n<self.cfg.onDragStart.length; n++ )
                  self.cfg.onDragStart[n](event.target);
              },
            onmove: function ( event ) {
                if ( isprotected )
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
                for ( var m=0; m<self.cfg.onDragEnd.length; m++ )
                  self.cfg.onDragEnd[m](event.target);
                if ( ! isprotected )
                  registerChange('dragging of '+getElementPath(event.target));
                window.setTimeout( function () { self.util.dragging = false; }, 100 );
              },
              restrict: { restriction: svgRoot }
          } )
        .styleCursor(false);
      self.mode.interactables.push(interactable);

      if ( typeof drop_selector !== 'undefined' ) {
        $(svgRoot).find(drop_selector).addClass('dropzone');
        interactable = interact('#'+svgContainer.id+' .dropzone')
          .dropzone( {
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
                  for ( var m=0; m<self.cfg.onChangeContainer.length; m++ )
                    self.cfg.onChangeContainer[m](event.relatedTarget);
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
        self.mode.interactables.push(interactable);
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
      if ( ! svgRoot )
        return true;

      setDrawRect( createrect, isvalidrect, onfinish, delrect );

      //prevEditing();

      return false;
    }

    /**
     * Creates an array of SVGPoints from a SVGPointList.
     */
    function pointListToArray( point_list ) {
      var n, point_array = [];
      for ( n=0; n<point_list.numberOfItems; n++ )
        point_array.push(point_list.getItem(n));
      return point_array;
    }
    self.util.pointListToArray = pointListToArray;

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
        elem.points.getItem(1).x = elem.points.getItem(2).x = point.x;
        elem.points.getItem(2).y = elem.points.getItem(3).y = point.y;
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
        if ( elem )
          finishRect(event);
        else {
          if ( ! isvalidrect([point]) )
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

          if ( ! isvalidrect(pointListToArray(elem.points),elem) )
            return;

          event.stopPropagation();
          event.preventDefault();
        }

        $(elem).removeClass('drawing');

        if ( ! isvalidrect(pointListToArray(elem.points),elem,true) )
          delrect(elem);

        else {
          standardizeQuad(elem);
          if ( onfinish )
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
      if ( ! svgRoot )
        return true;

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
        elem.points.getItem(elem.points.numberOfItems-1).x = point.x;
        elem.points.getItem(elem.points.numberOfItems-1).y = point.y;
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
          if ( ! isvalidpoly(pointListToArray(elem.points),elem) )
            return;
          if ( polylimit > 0 && elem.points.numberOfItems >= polylimit )
            return finishPoly( event );
          elem.points.appendItem(point);
        }
        else {
          if ( ! isvalidpoly([point]) )
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
          if ( ! isvalidpoly(pointListToArray(elem.points),elem) )
            return;

          event.stopPropagation();
          event.preventDefault();
        }
        else if ( elem.points.numberOfItems > 2 )
          elem.points.removeItem(elem.points.numberOfItems-1);
        while ( elem.points.numberOfItems > 2 &&
                elem.points.getItem(elem.points.numberOfItems-1).x == elem.points.getItem(elem.points.numberOfItems-2).x &&
                elem.points.getItem(elem.points.numberOfItems-1).y == elem.points.getItem(elem.points.numberOfItems-2).y )
          elem.points.removeItem(elem.points.numberOfItems-1);

        $(elem).removeClass('drawing');

        if ( ! isvalidpoly(pointListToArray(elem.points),elem,true) )
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
