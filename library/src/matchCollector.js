/// <reference path="analyzedCharacter.js" />

var HanziLookup = HanziLookup || {};

HanziLookup.MatchCollector = (function (limit) {
  "use strict";
  
  var _count = 0;
  var _matches = [];

  for (var i = 0; i != limit; ++i) _matches.push(null);

  function findSlot(score) {
    var ix;
    for (ix = 0; ix < _count; ++ix) {
      if (_matches[ix].score < score) return ix;
    }
    return ix;
  }

  function removeExistingLower(match) {
    var ix = -1;
    for (var i = 0; i != _count; ++i) {
      if (_matches[i].character == match.character) {
        ix = i;
        break;
      }
    }
    // Not there yet: we're good, match doesn't need to be skipped
    if (ix == -1) return false;
    // New score is not better: skip this match
    if (match.score <= _matches[ix].score) return true;
    // Remove existing match; don't skip new. Means shifting array left.
    for (var i = ix; i < _matches.length - 1; ++i)
      _matches[i] = _matches[i + 1];
    --_count;
    return false;
  }

  function doFileMatch(match) {
    // Already at limit: don't bother if new match's score is smaller than current minimum
    if (_count == _matches.length && match.score <= _matches[_matches.length - 1].score)
      return;
    // Remove if we already have this character with a lower score
    // If "true", we should skip new match (already there with higher score)
    if (removeExistingLower(match)) return;
    // Where does new match go? (Keep array sorted largest score to smallest.)
    var pos = findSlot(match.score);
    // Slide rest to the right
    for (var i = _matches.length - 1; i > pos; --i)
      _matches[i] = _matches[i - 1];
    // Replace at position
    _matches[pos] = match;
    // Increase count if we're just now filling up
    if (_count < _matches.length) ++_count;
  }

  function doGetMatches() {
    return _matches.slice(0, _count);
  }

  return {
    fileMatch: function(match) { doFileMatch(match); },
    getMatches: function() { return doGetMatches(); }
  };
});
