// Scroll-linked motion, in the spirit of Apple's product pages. Every effect is
// a pure function of scroll position (no timed animations), so it tracks the
// scrollbar exactly and reverses when scrolling back up.
//
//   data-scroll="rise"   fades in and slides up as it enters the viewport
//   data-scroll="zoom"   grows from slightly smaller to full size as it enters
//   data-scroll="exit"   fades and shrinks away as it scrolls off the top
//   data-scroll="words"  each word lights up in turn while its section is pinned
//
// The page background also crossfades between the "glass" and "deep" tones
// based on which [data-tone] section has passed the middle of the screen.
//
// Element positions are measured once (and again on resize/load), using
// offsetTop so our own transforms never feed back into the measurements; each
// frame then only reads window.scrollY and writes transforms and opacity.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  // easeOutCubic: quick start, soft landing
  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  function docTop(el) {
    var y = 0;
    for (; el; el = el.offsetParent) y += el.offsetTop;
    return y;
  }

  var toned = Array.prototype.slice.call(document.querySelectorAll('[data-tone]:not(body)'));
  var items = reduceMotion ? [] : Array.prototype.slice.call(
    document.querySelectorAll('[data-scroll]')
  ).map(function (el) {
    var item = { el: el, kind: el.dataset.scroll, last: -1 };
    if (item.kind === 'words') {
      // Wrap each word in a span, keeping the spaces between them.
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      item.words = words.map(function (word, i) {
        var span = document.createElement('span');
        span.textContent = word;
        el.appendChild(span);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        return span;
      });
      item.section = el.closest('section');
    }
    return item;
  });

  var vh = window.innerHeight;
  var toneTops = [];

  function measure() {
    vh = window.innerHeight;
    toneTops = toned.map(docTop);
    items.forEach(function (item) {
      var box = item.section || item.el;
      item.top = docTop(box);
      item.height = box.offsetHeight;
    });
    render(true);
  }

  function render(force) {
    var y = window.scrollY;

    var tone = toned.length ? toned[0].dataset.tone : null;
    for (var t = 0; t < toned.length; t++) {
      if (toneTops[t] - y <= vh * 0.5) tone = toned[t].dataset.tone;
    }
    if (tone && document.body.dataset.tone !== tone) document.body.dataset.tone = tone;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var p;
      if (it.kind === 'exit') {
        p = clamp(y / (it.height * 0.7));
      } else if (it.kind === 'words') {
        // From the section reaching mid-screen until just before it unpins.
        var start = it.top - vh * 0.5;
        var end = it.top + it.height - vh * 1.15;
        p = clamp((y - start) / (end - start));
      } else {
        // From the element's top entering at the bottom edge until it is
        // a third of the way up the screen.
        p = ease(clamp((vh - (it.top - y)) / (vh * 0.66)));
      }
      p = Math.round(p * 1000) / 1000;
      if (!force && p === it.last) continue;
      it.last = p;
      apply(it, p);
    }
  }

  function apply(it, p) {
    var s = it.el.style;
    if (it.kind === 'rise') {
      s.opacity = p;
      s.transform = 'translate3d(0,' + ((1 - p) * 56).toFixed(1) + 'px,0)';
    } else if (it.kind === 'zoom') {
      s.opacity = 0.35 + 0.65 * p;
      s.transform = 'scale(' + (0.88 + 0.12 * p).toFixed(4) + ')';
    } else if (it.kind === 'exit') {
      s.opacity = 1 - p;
      s.transform = 'translate3d(0,' + (p * -40).toFixed(1) + 'px,0) scale(' + (1 - 0.06 * p).toFixed(4) + ')';
    } else if (it.kind === 'words') {
      var n = it.words.length;
      for (var w = 0; w < n; w++) {
        var lit = clamp(p * (n + 1) - w);
        it.words[w].style.opacity = (0.16 + 0.84 * lit).toFixed(3);
      }
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      render(false);
    });
  }

  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  // Lazy images and web fonts shift layout after first paint.
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
})();
