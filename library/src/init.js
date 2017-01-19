var HanziLookup = HanziLookup || {};

HanziLookup.data = {};

HanziLookup.init = (function (dataName, url, ready) {
  "use strict";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status === 200) {
      dataReceived(dataName, xhr.responseText);
      ready(true);
    }
    else ready(false);
  };
  xhr.send();

  function dataReceived(dataName, responseText) {
    HanziLookup.data[dataName] = JSON.parse(responseText);
    HanziLookup.data[dataName].substrokes = HanziLookup.decodeCompact(HanziLookup.data[dataName].substrokes);
  }
});
