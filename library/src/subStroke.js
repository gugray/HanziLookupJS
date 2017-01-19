/// <reference path="../lib/jquery-3.1.1.min.js" />

var HanziLookup = HanziLookup || {};

HanziLookup.SubStroke = (function(direction, length, centerX, centerY) {
  "use strict";
  
  this.direction = direction;
  this.length = length;
  this.centerX = centerX;
  this.centerY = centerY;
});
