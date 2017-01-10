/// <reference path="../lib/jquery-3.1.1.min.js" />
/// <reference path="subStroke.js" />

"use strict";
var HL = HL || {};

HL.AnalyzedStroke = (function(points, pivotIndexes, subStrokes) {
  this.points = points;
  this.pivotIndexes = pivotIndexes;
  this.subStrokes = subStrokes;
});
