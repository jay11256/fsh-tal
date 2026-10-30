// Scroll-driven behavior for the page:
//  1. The reel mosaic zooms until its center clip fills the viewport, then
//     the TL;DR caption fades in over it.
//  2. The page background crossfades between the "glass" and "deep" tones
//     according to whichever section's data-tone is in the middle of the screen.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Tone switching ----------
  // A section takes over once its top passes the middle of the viewport, or
  // the fraction given by data-tone-at (the reel waits until it is pinned).
  var toned = Array.prototype.slice.call(document.querySelectorAll('[data-tone]:not(body)'));
  function updateTone() {
    var vh = window.innerHeight;
    var tone = toned[0].dataset.tone;
    toned.forEach(function (el) {
      var at = parseFloat(el.dataset.toneAt || '0.5');
      if (el.getBoundingClientRect().top <= vh * at) tone = el.dataset.tone;
    });
    if (document.body.dataset.tone !== tone) document.body.dataset.tone = tone;
  }

  // ---------- Reel zoom ----------
  var reel = document.querySelector('.reel');
  var zoomReel = reel && !reduceMotion;
  var stage = reel && reel.querySelector('.reel-stage');
  var grid = reel && reel.querySelector('.reel-grid');
  var focus = reel && reel.querySelector('.reel-focus');

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function updateReel() {
    var vw = window.innerWidth;
    var vh = stage.clientHeight;
    var travel = reel.offsetHeight - vh;
    var p = clamp(-reel.getBoundingClientRect().top / travel);

    // Zoom over the first 65% of the scroll, hold, then bring in the caption.
    var zoom = ease(clamp(p / 0.65));
    // offsetWidth/Height ignore transforms, so this is the clip's resting size.
    // Fill the screen on landscape; on portrait just span the width, since
    // covering a tall screen would crop most of the 16:9 clip.
    var cover = vh > vw ? vw / focus.offsetWidth
                        : Math.max(vw / focus.offsetWidth, vh / focus.offsetHeight) * 1.02;
    var scale = 1 + (cover - 1) * zoom;

    grid.style.setProperty('--scale', scale.toFixed(4));
    grid.style.setProperty('--fade', zoom.toFixed(3));
    stage.style.setProperty('--caption', clamp((p - 0.68) / 0.2).toFixed(3));
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }

  function update() {
    updateTone();
    if (zoomReel) updateReel();
  }

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
})();
