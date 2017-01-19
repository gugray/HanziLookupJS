var HanziLookup = HanziLookup || {};

HanziLookup.CubicCurve2D = (function (x1, y1, ctrlx1, ctrly1, ctrlx2, ctrly2, x2, y2) {
  "use strict";
  
  var _x1 = x1;
  var _y1 = y1;
  var _ctrlX1 = ctrlx1;
  var _ctrlY1 = ctrly1;
  var _ctrlX2 = ctrlx2;
  var _ctrlY2 = ctrly2;
  var _x2 = x2;
  var _y2 = y2;

  function getCubicAx() {
    return _x2 - _x1 - getCubicBx() - getCubicCx();
  }
  function getCubicAy() {
    return _y2 - _y1 - getCubicBy() - getCubicCy();
  }
  function getCubicBx() {
    return 3.0 * (_ctrlX2 - _ctrlX1) - getCubicCx();
  }
  function getCubicBy() {
    return 3.0 * (_ctrlY2 - _ctrlY1) - getCubicCy();
  }
  function getCubicCx() {
    return 3.0 * (_ctrlX1 - _x1);
  }
  function getCubicCy() {
    return 3.0 * (_ctrlY1 - _y1);
  }

  function doSolveForX(x) {
    var solutions = [];
    var a = getCubicAx();
    var b = getCubicBx();
    var c = getCubicCx();
    var d = _x1 - x;
    var f = ((3.0 * c / a) - (b*b / (a*a))) / 3.0;
    var g = ((2.0 * b*b*b / (a*a*a)) - (9.0 * b * c / (a*a)) + (27.0 * d / a)) / 27.0;
    var h = (g * g / 4.0) + (f * f * f / 27.0);
    // There is only one real root
    if (h > 0) {
        var u = 0 - g;
        var r = (u / 2) + (Math.pow(h, 0.5));
        var s6 = (Math.pow(r, 0.333333333333333333333333333));
        var s8 = s6;
        var t8 = (u / 2) - (Math.pow(h, 0.5));
        var v7 = (Math.pow((0 - t8), 0.33333333333333333333));
        var v8 = (v7);
        var x3 = (s8 - v8) - (b / (3 * a));
        solutions.push(x3);
    }
    // All 3 roots are real and equal
    else if (f == 0.0 && g == 0.0 && h == 0.0) {
        solutions.push(-Math.pow(d / a, 1.0 / 3.0));
    }
    // All three roots are real (h <= 0)
    else {
        var i = Math.sqrt((g * g / 4.0) - h);
        var j = Math.pow(i, 1.0 / 3.0);
        var k = Math.acos(-g / (2 * i));
        var l = j * -1.0;
        var m = Math.cos(k / 3.0);
        var n = Math.sqrt(3.0) * Math.sin(k / 3.0);
        var p = (b / (3.0 * a)) * -1.0;
        solutions.push(2.0 * j * Math.cos(k / 3.0) - (b / (3.0 * a)));
        solutions.push(l * (m + n) + p);
        solutions.push(l * (m - n) + p);
    }
    return solutions;
  }

  return {
    x1: function() { return _x1; },

    x2: function() { return _x2; },

    getYOnCurve: function(t) {
      var ay = getCubicAy();
      var by = getCubicBy();
      var cy = getCubicCy();
      var tSquared = t * t;
      var tCubed = t * tSquared;
      var y = (ay * tCubed) + (by * tSquared) + (cy * t) + _y1;
      return y;
    },

    solveForX: function(x) {
      return doSolveForX(x);
    },

    getFirstSolutionForX: function(x) {
      var solutions = doSolveForX(x);
      for (var i = 0; i != solutions.length; ++i) {
        var d = solutions[i];
        if (d >= -0.00000001 && d <= 1.00000001) {
          if (d >= 0.0 && d <= 1.0) return d;
          if (d < 0.0) return 0.0;
          return 1.0;
        }
      }
      return NaN;
    }
  };
});
