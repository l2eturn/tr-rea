// Keyboard -> input bitfield. Also hosts the two "cheat" keys, which exist to
// demonstrate that tampering with client state never changes the result.
var R = window.R = window.R || {};

R.Input = (function () {
  var IN = R.IN;
  var down = {};
  var once = {};

  var MAP = {
    ArrowLeft: IN.LEFT, KeyA: IN.LEFT,
    ArrowRight: IN.RIGHT, KeyD: IN.RIGHT,
    Space: IN.JUMP, ArrowUp: IN.JUMP, KeyW: IN.JUMP,
    ArrowDown: IN.SLIDE, KeyS: IN.SLIDE, ShiftLeft: IN.SLIDE, ShiftRight: IN.SLIDE
  };

  var HOTKEYS = ['KeyR', 'KeyC', 'KeyV', 'KeyG', 'KeyL'];

  function attach(target) {
    (target || window).addEventListener('keydown', function (e) {
      if (MAP[e.code] || HOTKEYS.indexOf(e.code) >= 0) e.preventDefault();
      if (!down[e.code]) once[e.code] = true;
      down[e.code] = true;
    });
    (target || window).addEventListener('keyup', function (e) {
      down[e.code] = false;
    });
    window.addEventListener('blur', function () { down = {}; });
  }

  return {
    attach: attach,

    sample: function () {
      var bits = 0;
      for (var code in MAP) {
        if (down[code]) bits |= MAP[code];
      }
      return bits;
    },

    // True once per physical press.
    pressed: function (code) {
      if (once[code]) { once[code] = false; return true; }
      return false;
    },

    isDown: function (code) { return !!down[code]; }
  };
})();
