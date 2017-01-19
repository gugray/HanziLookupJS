/// <reference path="../lib/jquery-3.1.1.min.js" />

var HanziLookup = HanziLookup || {};

HanziLookup.DrawingBoard = (function (elmHost, strokeFinished) {
  "use strict";
  
  var _elmHost = elmHost;
  var _strokeFinised = strokeFinished;
  var _canvas;
  var _ctx;

  // Global options ******************************
  // Width of strokes drawn on screen
  var strokeWidth = 5;

  // UI state
  var clicking = false;
  var lastTouchX = -1;
  var lastTouchY = -1;
  var tstamp;
  var lastPt;

  // An array of arrays; each element is the coordinate sequence for one stroke from the canvas
  // Where "stroke" is everything between button press - move - button release
  var _rawStrokes = [];

  // Canvas coordinates of each point in current stroke, in raw (unanalyzed) form.
  var _currentStroke = null;

  // Overlay. If null, no overlay.
  var _overlay = null;
  var _showSubstrokes = false;
  var _showBoundary = false;
  var _showControlMedians = false;

  // Initializes handwriting recognition (events etc.)
  _canvas = $('<canvas class="stroke-input-canvas" width="256" height="256"></canvas>');
  _elmHost.append(_canvas);
  _ctx = _canvas[0].getContext("2d");
  _canvas.mousemove(function (e) {
    if (!clicking) return;
    var x = e.pageX - $(this).offset().left;
    var y = e.pageY - $(this).offset().top;
    dragClick(x, y);
  });
  _canvas.mousedown(function (e) {
    var x = e.pageX - $(this).offset().left;
    var y = e.pageY - $(this).offset().top;
    startClick(x, y);
  }).mouseup(function (e) {
    var x = e.pageX - $(this).offset().left;
    var y = e.pageY - $(this).offset().top;
    endClick(x, y);
  });
  _canvas.bind("touchmove", function (e) {
    if (!clicking) return;
    e.preventDefault();
    var x = e.originalEvent.touches[0].pageX - $(this).offset().left;
    lastTouchX = x;
    var y = e.originalEvent.touches[0].pageY - $(this).offset().top;
    lastTouchY = y;
    dragClick(x, y);
  });
  _canvas.bind("touchstart", function (e) {
    e.preventDefault();
    document.activeElement.blur();
    var x = e.originalEvent.touches[0].pageX - $(this).offset().left;
    var y = e.originalEvent.touches[0].pageY - $(this).offset().top;
    startClick(x, y);
  }).bind("touchend", function (e) {
    e.preventDefault();
    document.activeElement.blur();
    endClick(lastTouchX, lastTouchY);
    lastTouchX = lastTouchY = -1;
  });

  drawClearCanvas();

  // Draws a clear canvas, with gridlines
  function drawClearCanvas() {
    _ctx.clearRect(0, 0, _ctx.canvas.width, _ctx.canvas.height);
    _ctx.setLineDash([1, 1]);
    _ctx.lineWidth = 0.5;
    _ctx.strokeStyle = "grey";
    _ctx.beginPath();
    _ctx.moveTo(0, 0);
    _ctx.lineTo(_ctx.canvas.width, 0);
    _ctx.lineTo(_ctx.canvas.width, _ctx.canvas.height);
    _ctx.lineTo(0,_ctx.canvas.height);
    _ctx.lineTo(0, 0);
    _ctx.stroke();
    _ctx.beginPath();
    _ctx.moveTo(0, 0);
    _ctx.lineTo(_ctx.canvas.width, _ctx.canvas.height);
    _ctx.stroke();
    _ctx.beginPath();
    _ctx.moveTo(_ctx.canvas.width, 0);
    _ctx.lineTo(0, _ctx.canvas.height);
    _ctx.stroke();
    _ctx.beginPath();
    _ctx.moveTo(_ctx.canvas.width / 2, 0);
    _ctx.lineTo(_ctx.canvas.width / 2, _ctx.canvas.height);
    _ctx.stroke();
    _ctx.beginPath();
    _ctx.moveTo(0, _ctx.canvas.height / 2);
    _ctx.lineTo(_ctx.canvas.width, _ctx.canvas.height / 2);
    _ctx.stroke();
  }

  function startClick(x, y) {
    clicking = true;
    _currentStroke = [];
    lastPt = [x, y];
    _currentStroke.push(lastPt);
    _ctx.strokeStyle = "grey";
    _ctx.setLineDash([]);
    _ctx.lineWidth = strokeWidth;
    _ctx.beginPath();
    _ctx.moveTo(x, y);
    tstamp = new Date();
  }

  function dragClick(x, y) {
    if ((new Date().getTime() - tstamp) < 50) return;
    tstamp = new Date();
    var pt = [x, y];
    if ((pt[0] == lastPt[0]) && (pt[1] == lastPt[1])) return;
    _currentStroke.push(pt);
    lastPt = pt;
    _ctx.lineTo(x, y);
    _ctx.stroke();
  }

  function endClick(x, y) {
    clicking = false;
    if (x == -1) return;
    _ctx.lineTo(x, y);
    _ctx.stroke();
    _currentStroke.push([x, y]);
    _rawStrokes.push(_currentStroke);
    _currentStroke = [];
    // Tell the world a stroke has finished
    if (_strokeFinised) _strokeFinised();
  }

  // Redraws raw strokes on the canvas.
  function redrawInput() {
    // Draw strokes proper
    for (var i1 in _rawStrokes) {
      _ctx.strokeStyle = "grey";
      _ctx.setLineDash([]);
      _ctx.lineWidth = strokeWidth;
      _ctx.beginPath();
      _ctx.moveTo(_rawStrokes[i1][0][0], _rawStrokes[i1][0][1]);
      var len = _rawStrokes[i1].length;
      for (var i2 = 0; i2 < len - 1; i2++) {
        _ctx.lineTo(_rawStrokes[i1][i2][0], _rawStrokes[i1][i2][1]);
        _ctx.stroke();
      }
      _ctx.lineTo(_rawStrokes[i1][len - 1][0], _rawStrokes[i1][len - 1][1]);
      _ctx.stroke();
    }

    // No additional info: quit here.
    if (!_overlay) return;

    // Bounding rectangle
    if (_showBoundary) {
      _ctx.strokeStyle = "blue";
      _ctx.setLineDash([1, 1]);
      _ctx.lineWidth = 0.5;
      _ctx.beginPath();
      _ctx.moveTo(_overlay.left, _overlay.top);
      _ctx.lineTo(_overlay.right, _overlay.top);
      _ctx.stroke();
      _ctx.lineTo(_overlay.right, _overlay.bottom);
      _ctx.stroke();
      _ctx.lineTo(_overlay.left, _overlay.bottom);
      _ctx.stroke();
      _ctx.lineTo(_overlay.left, _overlay.top);
      _ctx.stroke();
    }

    // Skeleton strokes
    if (_showSubstrokes) {
      for (var six = 0; six != _overlay.xStrokes.length; ++six) {
        var xstroke = _overlay.xStrokes[six];
        _ctx.strokeStyle = "red";
        _ctx.setLineDash([]);
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(xstroke[0][0], xstroke[0][1]);
        _ctx.arc(xstroke[0][0], xstroke[0][1], 3, 0, 2 * Math.PI, true);
        _ctx.fillStyle = "red";
        _ctx.fill();
        for (var i = 1; i < xstroke.length; ++i) {
          _ctx.lineTo(xstroke[i][0], xstroke[i][1]);
          _ctx.stroke();
          _ctx.beginPath();
          _ctx.arc(xstroke[i][0], xstroke[i][1], 3, 0, 2 * Math.PI, true);
          _ctx.fillStyle = "red";
          _ctx.fill();
        }
      }
    }

    // Control character medians
    if (_showControlMedians && _overlay.yStrokes) {
      for (var six = 0; six != _overlay.yStrokes.length; ++six) {
        var ystroke = _overlay.yStrokes[six];
        _ctx.strokeStyle = "#e6cee6";
        _ctx.setLineDash([]);
        _ctx.lineWidth = strokeWidth;
        _ctx.beginPath();
        _ctx.moveTo(ystroke[0][0], ystroke[0][1]);
        for (var i = 1; i < ystroke.length; ++i) {
          _ctx.lineTo(ystroke[i][0], ystroke[i][1]);
          _ctx.stroke();
        }
      }
    }

    // Control character's skeleton strokes
    if (_overlay.zStrokes) {
      for (var six = 0; six != _overlay.zStrokes.length; ++six) {
        var xstroke = _overlay.zStrokes[six];
        _ctx.strokeStyle = "green";
        _ctx.setLineDash([]);
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(xstroke[0][0], xstroke[0][1]);
        _ctx.arc(xstroke[0][0], xstroke[0][1], 3, 0, 2 * Math.PI, true);
        _ctx.fillStyle = "green";
        _ctx.fill();
        for (var i = 1; i < xstroke.length; ++i) {
          _ctx.lineTo(xstroke[i][0], xstroke[i][1]);
          _ctx.stroke();
          _ctx.beginPath();
          _ctx.arc(xstroke[i][0], xstroke[i][1], 3, 0, 2 * Math.PI, true);
          _ctx.fillStyle = "green";
          _ctx.fill();
        }
      }
    }
  }

  return {
    // Clear canvas and resets gathered strokes data for new input.
    clearCanvas: function () {
      _rawStrokes.length = 0;
      // Caller must make canvas redraw! And they will.
    },

    // Undoes the last stroke input by the user.
    undoStroke: function () {
      // Sanity check: nothing to do if input is empty (no strokes yet)
      if (_rawStrokes.length == 0) return;
      // Remove last stroke
      _rawStrokes.length = _rawStrokes.length - 1;
      // Caller must make canvas redraw! And they will.
    },

    // Clones the strokes accumulated so far. Three-dimensional array:
    // - array of strokes, each of which is
    // - array of points, each of which is
    // - two-dimensional array of coordinates
    cloneStrokes: function () {
      var res = [];
      for (var i = 0; i != _rawStrokes.length; ++i) {
        var stroke = [];
        for (var j = 0; j != _rawStrokes[i].length; ++j) {
          stroke.push([_rawStrokes[i][j][0], _rawStrokes[i][j][1]]);
        }
        res.push(stroke);
      }
      return res;
    },

    // Redraw canvas, e.g., after undo or clear
    redraw: function() {
      drawClearCanvas();
      redrawInput();
    },

    // Adds overlay to visualize analysis
    enrich: function(overlay, showSubstrokes, showBoundary, showControlMedians) {
      _overlay = overlay;
      _showBoundary = showBoundary;
      _showSubstrokes = showSubstrokes;
      _showControlMedians = showControlMedians;
      drawClearCanvas();
      redrawInput();
    }
  };

});
