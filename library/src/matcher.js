/// <reference path="analyzedCharacter.js" />
/// <reference path="characterMatch.js" />
/// <reference path="matchCollector.js" />

var HanziLookup = HanziLookup || {};

// Magic constants
HanziLookup.MAX_CHARACTER_STROKE_COUNT = 48;
HanziLookup.MAX_CHARACTER_SUB_STROKE_COUNT = 64;
HanziLookup.DEFAULT_LOOSENESS = 0.15;
HanziLookup.AVG_SUBSTROKE_LENGTH = 0.33; // an average length (out of 1)
HanziLookup.SKIP_PENALTY_MULTIPLIER = 1.75; // penalty mulitplier for skipping a stroke
HanziLookup.CORRECT_NUM_STROKES_BONUS = 0.1; // max multiplier bonus if characters has the correct number of strokes
HanziLookup.CORRECT_NUM_STROKES_CAP = 10; // characters with more strokes than this will not be multiplied

HanziLookup.Matcher = (function (dataName, looseness) {
  "use strict";
  
  var _looseness = looseness || HanziLookup.DEFAULT_LOOSENESS;
  var _repo = HanziLookup.data[dataName].chars;
  var _sbin = HanziLookup.data[dataName].substrokes;
  var _scoreMatrix = buildScoreMatrix();
  var _charsChecked;
  var _subStrokesCompared;

  var DIRECTION_SCORE_TABLE;
  var LENGTH_SCORE_TABLE;
  var POS_SCORE_TABLE;

  // Init score tables
  initScoreTables();

  function doMatch(inputChar, limit, ready) {
    // Diagnostic counters
    _charsChecked = 0;
    _subStrokesCompared = 0;

    // This will gather matches
    var matchCollector = new HanziLookup.MatchCollector(limit);

    // Edge case: empty input should return no matches; but permissive lookup does find a few...
    if (inputChar.analyzedStrokes.length == 0)
      return matchCollector.getMatches();

    // Flat format: matching needs this. Only transform once.
    var inputSubStrokes = [];
    for (var i = 0; i != inputChar.analyzedStrokes.length; ++i) {
      var stroke = inputChar.analyzedStrokes[i];
      for (var j = 0; j != stroke.subStrokes.length; ++j) {
        inputSubStrokes.push(stroke.subStrokes[j]);
      }
    }

    // Some pre-computed looseness magic
    var strokeCount = inputChar.analyzedStrokes.length;
    var subStrokeCount = inputChar.subStrokeCount;
    // Get the range of strokes to compare against based on the loosness.
    // Characters with fewer strokes than strokeCount - strokeRange
    // or more than strokeCount + strokeRange won't even be considered.
    var strokeRange = getStrokesRange(strokeCount);
    var minimumStrokes = Math.max(strokeCount - strokeRange, 1);
    var maximumStrokes = Math.min(strokeCount + strokeRange, HanziLookup.MAX_CHARACTER_STROKE_COUNT);
    // Get the range of substrokes to compare against based on looseness.
    // When trying to match sub stroke patterns, won't compare sub strokes
    // that are farther about in sequence than this range.  This is to make
    // computing matches less expensive for low loosenesses.
    var subStrokesRange = getSubStrokesRange(subStrokeCount);
    var minSubStrokes = Math.max(subStrokeCount - subStrokesRange, 1);
    var maxSubStrokes = Math.min(subStrokeCount + subStrokesRange, HanziLookup.MAX_CHARACTER_SUB_STROKE_COUNT);
    // Iterate over all characters in repo
    for (var cix = 0; cix != _repo.length; ++cix) {
      var repoChar = _repo[cix];
      var cmpStrokeCount = repoChar[1];
      var cmpSubStrokes = repoChar[2];
      if (cmpStrokeCount < minimumStrokes || cmpStrokeCount > maximumStrokes) continue;
      if (cmpSubStrokes.length < minSubStrokes || cmpSubStrokes.length > maxSubStrokes) continue;
      // Match against character in repo
      var match = matchOne(strokeCount, inputSubStrokes, subStrokesRange, repoChar);
      // File; collector takes care of comparisons and keeping N-best
      matchCollector.fileMatch(match);
    }
    // When done: just return collected matches
    // This is an array of CharacterMatch objects
    ready(matchCollector.getMatches());
  }
  
  function getStrokesRange(strokeCount) {
    if (_looseness == 0) return 0;
    if (_looseness == 1) return HanziLookup.MAX_CHARACTER_STROKE_COUNT;
    // We use a CubicCurve that grows slowly at first and then rapidly near the end to the maximum.
    // This is so a looseness at or near 1.0 will return a range that will consider all characters.
    var ctrl1X = 0.35;
    var ctrl1Y = strokeCount * 0.4;
    var ctrl2X = 0.6;
    var ctrl2Y = strokeCount;
    var curve = new HanziLookup.CubicCurve2D(0, 0, ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, 1, HanziLookup.MAX_CHARACTER_STROKE_COUNT);
    var t = curve.getFirstSolutionForX(_looseness);
    // We get the t value on the parametrized curve where the x value matches the looseness.
    // Then we compute the y value for that t. This gives the range.
    return Math.round(curve.getYOnCurve(t));
  }
  
  function getSubStrokesRange(subStrokeCount) {
    // Return the maximum if looseness = 1.0.
    // Otherwise we'd have to ensure that the floating point value led to exactly the right int count.
    if (_looseness == 1.0) return HanziLookup.MAX_CHARACTER_SUB_STROKE_COUNT;
    // We use a CubicCurve that grows slowly at first and then rapidly near the end to the maximum.
    var y0 = subStrokeCount * 0.25;
    var ctrl1X = 0.4;
    var ctrl1Y = 1.5 * y0;
    var ctrl2X = 0.75;
    var ctrl2Y = 1.5 * ctrl1Y;
    var curve = new HanziLookup.CubicCurve2D(0, y0, ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, 1, HanziLookup.MAX_CHARACTER_SUB_STROKE_COUNT);
    var t = curve.getFirstSolutionForX(_looseness);
    // We get the t value on the parametrized curve where the x value matches the looseness.
    // Then we compute the y value for that t. This gives the range.
    return Math.round(curve.getYOnCurve(t));
  }

  function buildScoreMatrix() {
    // We use a dimension + 1 because the first row and column are seed values.
    var dim = HanziLookup.MAX_CHARACTER_SUB_STROKE_COUNT + 1;
    var res = [];
    for (var i = 0; i < dim; i++) {
      res.push([]);
      for (var j = 0; j < dim; j++) res[i].push(0);
    }
    // Seed the first row and column with base values.
    // Starting from a cell that isn't at 0,0 to skip strokes incurs a penalty.
    for (var i = 0; i < dim; i++) {
      var penalty = -HanziLookup.AVG_SUBSTROKE_LENGTH * HanziLookup.SKIP_PENALTY_MULTIPLIER * i;
      res[i][0] = penalty;
      res[0][i] = penalty;
    }
    return res;
  }

  function matchOne(inputStrokeCount, inputSubStrokes, subStrokesRange, repoChar) {
    // Diagnostic counter
    ++_charsChecked;

    // Calculate score. This is the *actual* meat.
    var score = computeMatchScore(inputStrokeCount, inputSubStrokes, subStrokesRange, repoChar);
    // If the input character and the character in the repository have the same number of strokes, assign a small bonus.
    // Might be able to remove this, doesn't really add much, only semi-useful for characters with only a couple strokes.
    if (inputStrokeCount == repoChar[1] && inputStrokeCount < HanziLookup.CORRECT_NUM_STROKES_CAP) {
      // The bonus declines linearly as the number of strokes increases, writing 2 instead of 3 strokes is worse than 9 for 10.
      var bonus = HanziLookup.CORRECT_NUM_STROKES_BONUS * Math.max(HanziLookup.CORRECT_NUM_STROKES_CAP - inputStrokeCount, 0) / HanziLookup.CORRECT_NUM_STROKES_CAP;
      score += bonus * score;
    }
    return new HanziLookup.CharacterMatch(repoChar[0], score);
  }

  function computeMatchScore(strokeCount, inputSubStrokes, subStrokesRange, repoChar) {
    for (var x = 0; x < inputSubStrokes.length; x++) {
      // For each of the input substrokes...
      var inputDirection = inputSubStrokes[x].direction;
      var inputLength = inputSubStrokes[x].length;
      var inputCenter = [inputSubStrokes[x].centerX, inputSubStrokes[x].centerY];
      for (var y = 0; y < repoChar[2]; y++) {
        // For each of the compare substrokes...
        // initialize the score as being not usable, it will only be set to a good
        // value if the two substrokes are within the range.
        var newScore = Number.NEGATIVE_INFINITY;
        if (Math.abs(x - y) <= subStrokesRange)
        {
          // The range is based on looseness.  If the two substrokes fall out of the range
          // then the comparison score for those two substrokes remains Double.MIN_VALUE and will not be used.
          var compareDirection = _sbin[repoChar[3] + y * 3]; // repoChar[2][y][0];
          var compareLength = _sbin[repoChar[3] + y * 3 + 1]; // repoChar[2][y][1];
          var compareCenter = null;
          var bCenter = _sbin[repoChar[3] + y * 3 + 2];
          if (bCenter > 0) compareCenter = [(bCenter & 0xf0) >>> 4, bCenter & 0x0f];
          // We incur penalties for skipping substrokes.
          // Get the scores that would be incurred either for skipping the substroke from the descriptor, or from the repository.
          var skip1Score = _scoreMatrix[x][y + 1] - (inputLength / 256 * HanziLookup.SKIP_PENALTY_MULTIPLIER);
          var skip2Score = _scoreMatrix[x + 1][y] - (compareLength / 256 * HanziLookup.SKIP_PENALTY_MULTIPLIER);
          // The skip score is the maximum of the scores that would result from skipping one of the substrokes.
          var skipScore = Math.max(skip1Score, skip2Score);
          // The matchScore is the score of actually comparing the two substrokes.
          var matchScore = computeSubStrokeScore(inputDirection, inputLength, compareDirection, compareLength, inputCenter, compareCenter);
          // Previous score is the score we'd add to if we compared the two substrokes.
          var previousScore = _scoreMatrix[x][y];
          // Result score is the maximum of skipping a substroke, or comparing the two.
          newScore = Math.max(previousScore + matchScore, skipScore);
        }
        // Set the score for comparing the two substrokes.
        _scoreMatrix[x + 1][y + 1] = newScore;
      }
    }
    // At the end the score is the score at the opposite corner of the matrix...
    // don't need to use count - 1 since seed values occupy indices 0
    return _scoreMatrix[inputSubStrokes.length][repoChar[2]];
  }

  function computeSubStrokeScore(inputDir, inputLen, repoDir, repoLen, inputCenter, repoCenter) {
    // Diagnostic counter
    ++_subStrokesCompared;

    // Score drops off after directions get sufficiently apart, start to rise again as the substrokes approach opposite directions.
    // This in particular reflects that occasionally strokes will be written backwards, this isn't totally bad, they get
    // some score for having the stroke oriented correctly.
    var directionScore = getDirectionScore(inputDir, repoDir, inputLen);
    //var directionScore = Math.max(Math.cos(2.0 * theta), 0.3 * Math.cos((1.5 * theta) + (Math.PI / 3.0)));

    // Length score gives an indication of how similar the lengths of the substrokes are.
    // Get the ratio of the smaller of the lengths over the longer of the lengths.
    var lengthScore = getLengthScore(inputLen, repoLen);
    // Ratios that are within a certain range are fine, but after that they drop off, scores not more than 1.
    //var lengthScore = Math.log(lengthScore + (1.0 / Math.E)) + 1;
    //lengthScore = Math.min(lengthScore, 1.0);

    // For the final "classic" score we just multiply the two scores together.
    var score = lengthScore * directionScore;

    // If we have center points (from MMAH data), reduce score if strokes are farther apart
    if (repoCenter) {
      var dx = inputCenter[0] - repoCenter[0];
      var dy = inputCenter[1] - repoCenter[1];
      var closeness = POS_SCORE_TABLE[dx * dx + dy * dy];

      // var dist = Math.sqrt(dx * dx + dy * dy);
      // // Distance is [0 .. 21.21] because X and Y are all [0..15]
      // // Square distance is [0..450]
      // // TO-DO: a cubic function for this too
      // var closeness = 1 - dist / 22;
      // Closeness is always [0..1]. We reduce positive score, and make negative more negative.
      if (score > 0) score *= closeness;
      else score /= closeness;
    }
    return score;
  }

  function initScoreTables() {
    // Builds a precomputed array of values to use when getting the score between two substroke directions.
    // Two directions should differ by 0 - Pi, and the score should be the (difference / Pi) * score table's length
    // The curve drops as the difference grows, but rises again some at the end because
    // a stroke that is 180 degrees from the expected direction maybe OK passable.
    var dirCurve = new HanziLookup.CubicCurve2D(0, 1.0, 0.5, 1.0, 0.25, -2.0, 1.0, 1.0);
    DIRECTION_SCORE_TABLE = initCubicCurveScoreTable(dirCurve, 256);

    // Builds a precomputed array of values to use when getting the score between two substroke lengths.
    // A ratio less than one is computed for the two lengths, and the score should be the ratio * score table's length.
    // Curve grows rapidly as the ratio grows and levels off quickly.
    // This is because we don't really expect lengths to vary a lot.
    // We are really just trying to distinguish between tiny strokes and long strokes.
    var lenCurve = new HanziLookup.CubicCurve2D(0, 0, 0.25, 1.0, 0.75, 1.0, 1.0, 1.0);
    LENGTH_SCORE_TABLE = initCubicCurveScoreTable(lenCurve, 129);

    POS_SCORE_TABLE = [];
    for (var i = 0; i <= 450; ++i) {
      POS_SCORE_TABLE.push(1 - Math.sqrt(i) / 22);
    }
  }

  function initCubicCurveScoreTable(curve, numSamples) {
    var x1 = curve.x1();
    var x2 = curve.x2();
    var range = x2 - x1;
    var x = x1;
    var xInc = range / numSamples;  // even incrementer to increment x value by when sampling across the curve
    var scoreTable = [];
    // Sample evenly across the curve and set the samples into the table.
    for (var i = 0; i < numSamples; i++) {
      var t = curve.getFirstSolutionForX(Math.min(x, x2));
      scoreTable.push(curve.getYOnCurve(t));
      x += xInc;
    }
    return scoreTable;
  }

  function getDirectionScore(direction1, direction2, inputLength) {
    // Both directions are [0..255], integer
    var theta = Math.abs(direction1 - direction2);
    // Lookup table for actual score function
    var directionScore = DIRECTION_SCORE_TABLE[theta];
    // Add bonus if the input length is small.
    // Directions doesn't really matter for small dian-like strokes.
    if (inputLength < 64) {
      var shortLengthBonusMax = Math.min(1.0, 1.0 - directionScore);
      var shortLengthBonus = shortLengthBonusMax * (1 - (inputLength / 64));
      directionScore += shortLengthBonus;
    }
    return directionScore;
  }

  function getLengthScore(length1, length2) {
    // Get the ratio between the two lengths less than one.
    var ratio;
    // Shift for "times 128"
    if (length1 > length2) ratio = Math.round((length2 << 7) / length1);
    else ratio = Math.round((length1 << 7) / length2);
    // Lookup table for actual score function
    return LENGTH_SCORE_TABLE[ratio];
  }

  return {
    match: function(analyzedChar, limit, ready) { doMatch(analyzedChar, limit, ready); },

    getCounters: function() {
      return {
        chars: _charsChecked,
        subStrokes: _subStrokesCompared
      };
    }
  };
});
