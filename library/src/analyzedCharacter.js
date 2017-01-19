/// <reference path="analyzedStroke.js" />
/// <reference path="subStroke.js" />

var HanziLookup = HanziLookup || {};

HanziLookup.AnalyzedCharacter = (function (rawStrokes) {
  "use strict";
  
  // Magic constants used in decomposition of a stroke into substrokes
  var MIN_SEGMENT_LENGTH = 12.5;
  var MAX_LOCAL_LENGTH_RATIO = 1.1;
  var MAX_RUNNING_LENGTH_RATIO = 1.09;

  // Bounding rectangle
  var _top = Number.MAX_SAFE_INTEGER;
  var _bottom = Number.MIN_SAFE_INTEGER;
  var _left = Number.MAX_SAFE_INTEGER;
  var _right = Number.MIN_SAFE_INTEGER;

  var _analyzedStrokes = [];
  var _subStrokeCount = 0;

  // Calculate bounding rectangle
  getBoundingRect(rawStrokes);
  // Build analyzed strokes
  buildAnalyzedStrokes(rawStrokes);

  // Aaand, the result is :)
  this.top = _top <= 256 ? _top : 0;
  this.bottom = _bottom >= 0 ? _bottom : 256;
  this.left = _left <= 256 ? _left : 0;
  this.right = _right >= 0 ? _right : 256;
  this.analyzedStrokes = _analyzedStrokes;
  this.subStrokeCount = _subStrokeCount;

  // Calculates rectangle that bounds all points in raw strokes.
  function getBoundingRect(rawStrokes) {
    for (var i = 0; i != rawStrokes.length; ++i) {
      for (var j = 0; j != rawStrokes[i].length; ++j) {
        var pt = rawStrokes[i][j];
        if (pt[0] < _left) _left = pt[0];
        if (pt[0] > _right) _right = pt[0];
        if (pt[1] < _top) _top = pt[1];
        if (pt[1] > _bottom) _bottom = pt[1];
      }
    }
  }

  // Gets distance between two points
  // a and b are two-dimensional arrays for X, Y
  function dist(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Gets normalized distance between two points
  // a and b are two-dimensional arrays for X, Y
  // Normalized based on bounding rectangle
  function normDist(a, b) {
    var width = _right - _left;
    var height = _bottom - _top;
    // normalizer is a diagonal along a square with sides of size the larger dimension of the bounding box
    var dimensionSquared = width > height ? width * width : height * height;
    var normalizer = Math.sqrt(dimensionSquared + dimensionSquared);
    var distanceNormalized = dist(a, b) / normalizer;
    // Cap at 1 (...why is this needed??)
    return Math.min(distanceNormalized, 1);
  }

  // Gets direction, in radians, from point a to b
  // a and b are two-dimensional arrays for X, Y
  // 0 is to the right, PI / 2 is up, etc.
  function dir(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    var dir = Math.atan2(dy, dx);
    return Math.PI - dir;
  }

  // Calculates array with indexes of pivot points in raw stroke
  function getPivotIndexes(points) {
    // One item for each point: true if it's a pivot
    var markers = [];
    for (var i = 0; i != points.length; ++i) markers.push(false);

    // Cycle variables
    var prevPtIx = 0;
    var firstPtIx = 0;
    var pivotPtIx = 1;

    // The first point of a Stroke is always a pivot point.
    markers[0] = true;

    // localLength keeps track of the immediate distance between the latest three points.
    // We can use localLength to find an abrupt change in substrokes, such as at a corner.
    // We do this by checking localLength against the distance between the first and last
    // of the three points. If localLength is more than a certain amount longer than the
    // length between the first and last point, then there must have been a corner of some kind.
    var localLength = dist(points[firstPtIx], points[pivotPtIx]);

    // runningLength keeps track of the length between the start of the current SubStroke
    // and the point we are currently examining.  If the runningLength becomes a certain
    // amount longer than the straight distance between the first point and the current
    // point, then there is a new SubStroke.  This accounts for a more gradual change
    // from one SubStroke segment to another, such as at a longish curve.
    var runningLength = localLength;

    // Cycle through rest of stroke points.
    for (var i = 2; i < points.length; ++i) {
      var nextPoint = points[i];

      // pivotPoint is the point we're currently examining to see if it's a pivot.
      // We get the distance between this point and the next point and add it
      // to the length sums we're using.
      var pivotLength = dist(points[pivotPtIx], nextPoint);
      localLength += pivotLength;
      runningLength += pivotLength;

      // Check the lengths against the ratios.  If the lengths are a certain among
      // longer than a straight line between the first and last point, then we
      // mark the point as a pivot.
      var distFromPrevious = dist(points[prevPtIx], nextPoint);
      var distFromFirst = dist(points[firstPtIx], nextPoint);
      if (localLength > MAX_LOCAL_LENGTH_RATIO * distFromPrevious || 
          runningLength > MAX_RUNNING_LENGTH_RATIO * distFromFirst) {
        // If the previous point was a pivot and was very close to this point,
        // which we are about to mark as a pivot, then unmark the previous point as a pivot.
        if (markers[prevPtIx] && dist(points[prevPtIx], points[pivotPtIx]) < MIN_SEGMENT_LENGTH) {
          markers[prevPtIx] = false;
        }
        markers[pivotPtIx] = true;
        runningLength = pivotLength;
        firstPtIx = pivotPtIx;
      }
      localLength = pivotLength;
      prevPtIx = pivotPtIx;
      pivotPtIx = i;
    }

    // last point (currently referenced by pivotPoint) has to be a pivot
    markers[pivotPtIx] = true;
    // Point before the final point may need to be handled specially.
    // Often mouse action will produce an unintended small segment at the end.
    // We'll want to unmark the previous point if it's also a pivot and very close to the lat point.
    // However if the previous point is the first point of the stroke, then don't unmark it, because
    // then we'd only have one pivot.
    if (markers[prevPtIx] && dist(points[prevPtIx], points[pivotPtIx]) < MIN_SEGMENT_LENGTH && prevPtIx != 0) {
      markers[prevPtIx] = false;
    }

    // Return result in the form of an index array: includes indexes where marker is true
    var res = [];
    for (var i = 0; i != markers.length; ++i) {
      if (markers[i]) res.push(i);
    }
    return res;
  }

  function getNormCenter(a, b) {
    var x = (a[0] + b[0]) / 2;
    var y = (a[1] + b[1]) / 2;
    var side;
    // Bounding rect is landscape
    if (_right - _left > _bottom - _top) {
      side = _right - _left;
      var height = _bottom - _top;
      x = x - _left;
      y = y - _top + (side - height) / 2;
    }
    // Portrait
    else {
      side = _bottom - _top;
      var width = _right - _left;
      x = x - _left + (side - width) / 2;
      y = y - _top;
    }
    return [x / side, y / side];
  }

  // Builds array of substrokes from stroke's points, pivots, and character's bounding rectangle
  function buildSubStrokes(points, pivotIndexes) {
    var res = [];
    var prevIx = 0;
    for (var i = 0; i != pivotIndexes.length; ++i) {
      var ix = pivotIndexes[i];
      if (ix == prevIx) continue;
      var direction = dir(points[prevIx], points[ix]);
      direction = Math.round(direction * 256.0 / Math.PI / 2.0);
      if (direction == 256) direction = 0;
      var normLength = normDist(points[prevIx], points[ix]);
      normLength = Math.round(normLength * 255);
      var center = getNormCenter(points[prevIx], points[ix]);
      center[0] = Math.round(center[0] * 15);
      center[1] = Math.round(center[1] * 15);
      res.push(new HanziLookup.SubStroke(direction, normLength, center[0], center[1]));
      prevIx = ix;
    }
    return res;
  }

  // Analyze raw input, store result in _analyzedStrokes member.
  function buildAnalyzedStrokes(rawStrokes) {
    // Process each stroke
    for (var i = 0; i != rawStrokes.length; ++i) {
      // Identify pivot points
      var pivotIndexes = getPivotIndexes(rawStrokes[i]);
      // Abstract away substrokes
      var subStrokes = buildSubStrokes(rawStrokes[i], pivotIndexes);
      _subStrokeCount += subStrokes.length;
      // Store all this
      _analyzedStrokes.push(new HanziLookup.AnalyzedStroke(rawStrokes[i], pivotIndexes, subStrokes));
    }
  }

});

