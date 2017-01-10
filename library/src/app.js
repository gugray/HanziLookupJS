/// <reference path="../lib/jquery-3.1.1.min.js" />
/// <reference path="strokeInput.js" />
/// <reference path="analyzedCharacter.js" />
/// <reference path="analyzedStroke.js" />
/// <reference path="strokeInputOverlay.js" />
/// <reference path="subStroke.js" />

"use strict";
var HL = HL || {};

var HanziLookupApp = (function() {
  var _strokeInput;
  var _scriptsToLoad = -1;

  var _coptShowInput = !(localStorage.getItem("coptShowInput") == "no");
  var _coptShowSubstrokes = localStorage.getItem("coptShowSubstrokes") == "yes";
  var _coptShowBoundary = localStorage.getItem("coptShowBoundary") == "yes";
  var _coptShowMedians = localStorage.getItem("coptShowMedians") == "yes";
  var _coptShowMedSubs = localStorage.getItem("coptShowMedSubs") == "yes";

  var _ctrlChar = null;

  $(document).ready(function () {
    _strokeInput = HL.StrokeInput($("#stroke-canvas").first(), strokeFinished);
    initJSLoader();
    initCanvasCommands();
    initControlCharacters();
  });

  function initJSLoader() {
    _scriptsToLoad = 3;
    var script1 = document.createElement('script');
    script1.src = "./src/x-hl-strokes.js";
    script1.onload = function (e) { onScriptLoaded(e); }
    document.head.appendChild(script1);
    var script2 = document.createElement('script');
    script2.src = "./src/x-mmah-medians.js";
    script2.onload = function (e) { onScriptLoaded(e); }
    document.head.appendChild(script2);
    var script3 = document.createElement('script');
    script3.src = "./src/x-mmah-strokes.js";
    script3.onload = function (e) { onScriptLoaded(e); }
    document.head.appendChild(script3);
  }

  function onScriptLoaded (e) {
    --_scriptsToLoad;
    if (_scriptsToLoad == 0) {
      $("#jsLoader").addClass("loaded");
      updateCanvas();
    }
  }

  function initControlCharacters() {
    var last = localStorage.getItem("controlCharacters");
    if (last) $("#txtChar").val(last);
    updateControlPicker();
    $("#txtChar").bind("input", function() {
      localStorage.setItem("controlCharacters", $("#txtChar").val());
      updateControlPicker();
    });
  }

  function updateControlPicker() {
    $(".controlChars").html("");
    var input = $("#txtChar").val();
    for (var i = 0; i != input.length; ++i) {
      var cls = "pickable";
      if (i == 0) {
        cls += " selected";
        _ctrlChar = input[i];
      }
      $(".controlChars").append("<span class='" + cls + "'>" + input[i] + "</span>");
    }
    $(".controlChars .pickable").click(function() {
      $(".pickable").removeClass("selected");
      $(this).addClass("selected");
      _ctrlChar = $(this).text();
      updateCanvas();
    });
  }

  function updateResultChars(elmHost, matches) {
    elmHost.html("");
    for (var i = 0; i != matches.length; ++i) {
      var cls = "pickable";
      elmHost.append("<span class='" + cls + "'>" + matches[i].character + "</span>");
    }
    elmHost.find(".pickable").click(function() {
      $(".pickable").removeClass("selected");
      $(this).addClass("selected");
      _ctrlChar = $(this).text();
      updateCanvas();
    });
  }

  function initCanvasCommands() {
    // Actual commands
    $(".ccmdUndo").click(function(evt) {
      _strokeInput.undoStroke();
      updateCanvas();
      strokeFinished();
    });
    $(".ccmdClear").click(function() {
      _strokeInput.clearCanvas();
      updateCanvas();
      $(".lookupTimerHL").text("--");
      $(".hanziLookupChars").html("");
      $(".lookupTimerMMAH").text("--");
      $(".mmahLookupChars").html("");
    });

    // Options
    if (_coptShowInput) $(".coptShowInput").addClass("on");
    if (_coptShowSubstrokes) $(".coptShowSubstrokes").addClass("on");
    if (_coptShowBoundary) $(".coptShowBoundary").addClass("on");
    if (_coptShowMedians) $(".coptShowMedians").addClass("on");
    if (_coptShowMedSubs) $(".coptShowMedSubs").addClass("on");
    $(".coptShowInput").click(function() {
      if ($(".coptShowInput").hasClass("on")) {
        $(".coptShowInput").removeClass("on");
        localStorage.setItem("coptShowInput", "no");
        _coptShowInput = false;
      }
      else {
        $(".coptShowInput").addClass("on");
        localStorage.setItem("coptShowInput", "yes");
        _coptShowInput = true;
      }
      updateCanvas();
    });
    $(".coptShowSubstrokes").click(function() {
      if ($(".coptShowSubstrokes").hasClass("on")) {
        $(".coptShowSubstrokes").removeClass("on");
        localStorage.setItem("coptShowSubstrokes", "no");
        _coptShowSubstrokes = false;
      }
      else {
        $(".coptShowSubstrokes").addClass("on");
        localStorage.setItem("coptShowSubstrokes", "yes");
        _coptShowSubstrokes = true;
      }
      updateCanvas();
    });
    $(".coptShowBoundary").click(function() {
      if ($(".coptShowBoundary").hasClass("on")) {
        $(".coptShowBoundary").removeClass("on");
        localStorage.setItem("coptShowBoundary", "no");
        _coptShowBoundary = false;
      }
      else {
        $(".coptShowBoundary").addClass("on");
        localStorage.setItem("coptShowBoundary", "yes");
        _coptShowBoundary = true;
      }
      updateCanvas();
    });
    $(".coptShowMedians").click(function() {
      if ($(".coptShowMedians").hasClass("on")) {
        $(".coptShowMedians").removeClass("on");
        localStorage.setItem("coptShowMedians", "no");
        _coptShowMedians = false;
      }
      else {
        $(".coptShowMedians").addClass("on");
        localStorage.setItem("coptShowMedians", "yes");
        _coptShowMedians = true;
      }
      updateCanvas();
    });
    $(".coptShowMedSubs").click(function() {
      if ($(".coptShowMedSubs").hasClass("on")) {
        $(".coptShowMedSubs").removeClass("on");
        localStorage.setItem("coptShowMedSubs", "no");
        _coptShowMedSubs = false;
      }
      else {
        $(".coptShowMedSubs").addClass("on");
        localStorage.setItem("coptShowMedSubs", "yes");
        _coptShowMedSubs = true;
      }
      updateCanvas();
    });
  }

  function lookup(analyzedChar) {
    // Vanilla HanziLookup
    var tsStart = new Date().getTime();
    var matcher = new HL.Matcher(HL.StrokeDataHL);
    var matches = matcher.match(analyzedChar, 15);
    var elapsed = new Date().getTime() - tsStart;
    updateResultChars($(".hanziLookupChars"), matches);
    $(".lookupTimerHL").text(elapsed + "ms");
    // MMAH data
    tsStart = new Date().getTime();
    matcher = new HL.Matcher(HL.StrokeDataMMAH);
    matches = matcher.match(analyzedChar, 15);
    elapsed = new Date().getTime() - tsStart;
    updateResultChars($(".mmahLookupChars"), matches);
    $(".lookupTimerMMAH").text(elapsed + "ms");
  }

  function strokeFinished() {
    // Upon stroke, we switch input back on
    $(".coptShowInput").addClass("on");
    localStorage.setItem("coptShowInput", "yes");
    _coptShowInput = true;
    var analyzedChar = updateCanvas();
    // Recognize!
    lookup(analyzedChar);
  }

  function updateCanvas() {
    // Analyze raw strokes
    var ac = new HL.AnalyzedCharacter(_strokeInput.cloneStrokes());
    // Fetch "skeleton" strokes for analysis overlay
    var xstrokes = [];
    for (var i = 0; i != ac.analyzedStrokes.length; ++i) {
      var as = ac.analyzedStrokes[i];
      var points = [];
      for (var j = 0; j != as.pivotIndexes.length; ++j) {
        points.push(as.points[as.pivotIndexes[j]]);
      }
      xstrokes.push(points);
    }
    // Get control character's medians, if requested and available
    var ystrokes = [];
    for (var i = 0; i != HL.MediansMMAH.length; ++i) {
      var itm = HL.MediansMMAH[i];
      if (itm[0] == _ctrlChar) {
        ystrokes = itm[1];
      }
    }
    if (ystrokes.length == 0) ystrokes = null;
    // Analyze median for substrokes, if requested and available
    var zstrokes = null;
    if (ystrokes && _coptShowMedSubs) {
      zstrokes = [];
      var acz = new HL.AnalyzedCharacter(ystrokes);
      for (var i = 0; i != acz.analyzedStrokes.length; ++i) {
        var as = acz.analyzedStrokes[i];
        var points = [];
        for (var j = 0; j != as.pivotIndexes.length; ++j) {
          points.push(as.points[as.pivotIndexes[j]]);
        }
        zstrokes.push(points);
      }
    }
    var sio = new HL.StrokeInputOverlay(ac.top, ac.right, ac.bottom, ac.left, xstrokes, ystrokes, zstrokes);
    _strokeInput.enrich(sio, _coptShowSubstrokes, _coptShowBoundary, _coptShowMedians);
    // Analyzed char is our courtesty to the caller
    return ac;
  }

})();
