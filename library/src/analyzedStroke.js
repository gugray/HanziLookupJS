/// <reference path="subStroke.js" />

var HanziLookup = HanziLookup || {};

HanziLookup.AnalyzedStroke = (function(points, pivotIndexes, subStrokes) {
  "use strict";
  
  this.points = points;
  this.pivotIndexes = pivotIndexes;
  this.subStrokes = subStrokes;
});
