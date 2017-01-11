/// <reference path="../lib/jquery-3.1.1.min.js" />

"use strict";
var HanziLookup = HanziLookup || {};

HanziLookup.CharacterMatch = (function (character, score) {
  this.character = character;
  this.score = score;
});

