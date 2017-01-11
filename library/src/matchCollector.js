/// <reference path="../lib/jquery-3.1.1.min.js" />
/// <reference path="analyzedCharacter.js" />

"use strict";
var HanziLookup = HanziLookup || {};

HanziLookup.MatchCollector = (function (limit) {
  var _limit = limit;
  var _matches = [];

  function doFileMatch(match) {
    // Check if we already have same character - update score then
    // In the meantime, gather lowest score
    var loScore = Number.MAX_VALUE;
    var loScoreIx = -1;
    for (var i = 0; i != _matches.length; ++i) {
      var thisScore = _matches[i].score;
      if (thisScore < loScore) {
        loScore = thisScore;
        loScoreIx = i;
      }
      if (_matches[i].character == match.character && thisScore < match.score) {
        _matches[i].score = match.score;
        return;
      }
    }
    // If there are fewer items than limit, just add
    if (_matches.length < _limit) {
      _matches.push(match);
      return;
    }
    // If new match's score is bigger than current lowest, replace that
    if (match.score > loScore) {
      _matches[loScoreIx] = match;
    }
  }

  function doGetMatches() {
    // Sort matches, then return sorted array
    _matches.sort(function(a, b) {
      return b.score - a.score;
    });
    return _matches;
  }

  return {
    fileMatch: function(match) { doFileMatch(match); },
    getMatches: function() { return doGetMatches(); }
  };
});
