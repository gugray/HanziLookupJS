/// <reference path="../lib/jquery-3.1.1.min.js" />
/// <reference path="subStroke.js" />

"use strict";
var HanziLookup = HanziLookup || {};

HanziLookup.AnalyzedStroke = (function(points, pivotIndexes, subStrokes) {
  this.points = points;
  this.pivotIndexes = pivotIndexes;
  this.subStrokes = subStrokes;
});
