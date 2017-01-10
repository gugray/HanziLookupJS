/// <reference path="../lib/jquery-3.1.1.min.js" />

"use strict";
var HL = HL || {};

HL.SubStroke = (function(direction, length, centerX, centerY) {
  this.direction = direction;
  this.length = length;
  this.centerX = centerX;
  this.centerY = centerY;
});
