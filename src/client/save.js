// Save data. localStorage can throw or come back empty (private window,
// blocked site data), so every access is guarded and the game works without it.
var R = window.R = window.R || {};

R.Save = (function () {
  var KEY = 'offlineRacer.save.v1';
  var EMPTY = { bestTicks: null, bestSplits: [], ghost: null, runs: 0 };

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(EMPTY));
      var data = JSON.parse(raw);
      return {
        bestTicks: typeof data.bestTicks === 'number' ? data.bestTicks : null,
        bestSplits: Array.isArray(data.bestSplits) ? data.bestSplits : [],
        ghost: Array.isArray(data.ghost) ? data.ghost : null,
        runs: typeof data.runs === 'number' ? data.runs : 0
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(EMPTY));
    }
  }

  function write(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try { window.localStorage.removeItem(KEY); return true; }
    catch (e) { return false; }
  }

  return { read: read, write: write, clear: clear };
})();
