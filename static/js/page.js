// Page behavior:
//  - Marks the slide crossing the middle of the viewport as .is-active, which
//    plays its .reveal transitions (CSS) and updates the nav's theme and
//    current link. Slides snap into place via CSS scroll-snap, and wheel/keys
//    page one slide at a time with an eased transition.
//  - Behavior/view picker on the Examples slide.
//  - Copy-to-clipboard for the BibTeX.
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var nav = document.querySelector('.globalnav');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.globalnav-links a'));

  // Stagger each slide's text reveals in document order.
  slides.forEach(function (slide) {
    slide.querySelectorAll('.copy .reveal').forEach(function (el, i) {
      el.style.setProperty('--i', i);
    });
  });

  function activate(slide) {
    slides.forEach(function (s) { s.classList.toggle('is-active', s === slide); });
    nav.dataset.theme = slide.classList.contains('theme-dark') ? 'dark' : 'light';
    // Comparison belongs under Results in the nav.
    var id = slide.id === 'comparison' ? 'results' : slide.id;
    navLinks.forEach(function (a) {
      a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'true' : 'false');
    });
  }

  if ('IntersectionObserver' in window) {
    // A thin band across the middle of the screen decides the active slide,
    // which also works for slides taller than the viewport on small screens.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) activate(entry.target);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    slides.forEach(function (s) { io.observe(s); });
  } else {
    slides.forEach(function (s) { s.classList.add('is-active'); });
  }

  // ---------- Paging: one wheel gesture / key press = one slide ----------
  // Native scroll-snap snaps back on small trackpad swipes and lets inertia
  // drift past a slide, so on large screens with a mouse/trackpad the root
  // stops scrolling natively (.is-paged sets overflow: hidden) and wheel,
  // keys and in-page links ease from slide to slide here. Touch devices keep
  // native CSS snapping.
  var paged = window.matchMedia(
    '(min-width: 901px) and (min-height: 601px) and (hover: hover) and (pointer: fine)'
  );
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;
  var animating = false;

  function updatePaged() {
    root.classList.toggle('is-paged', paged.matches);
  }
  updatePaged();
  if (paged.addEventListener) paged.addEventListener('change', updatePaged);

  function currentIndex() {
    var y = window.scrollY, best = 0;
    slides.forEach(function (s, i) {
      if (Math.abs(s.offsetTop - y) < Math.abs(slides[best].offsetTop - y)) best = i;
    });
    return best;
  }

  // easeInOutCubic, close to Apple's page-transition feel
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function goTo(index) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    var from = window.scrollY;
    var to = slides[index].offsetTop;
    if (from === to) return;
    if (reduceMotion.matches) { window.scrollTo(0, to); return; }

    animating = true;
    var duration = Math.min(1000, 600 + Math.abs(index - currentIndex()) * 80);
    var start = performance.now();
    requestAnimationFrame(function step(now) {
      var t = Math.min(1, (now - start) / duration);
      window.scrollTo(0, from + (to - from) * ease(t));
      if (t < 1) return requestAnimationFrame(step);
      animating = false;
    });
  }

  // Keep the current slide aligned when the window is resized.
  var resizeTimer;
  window.addEventListener('resize', function () {
    if (!paged.matches) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      window.scrollTo(0, slides[currentIndex()].offsetTop);
    }, 100);
  });

  // A trackpad swipe arrives as a stream of wheel events followed by a long
  // inertia tail whose deltas only shrink. One swipe should move one slide, so
  // after a move the rest of that stream is ignored, until either the wheel
  // goes quiet briefly or the deltas speed up again (a fresh swipe made while
  // the old inertia is still trickling in).
  var WHEEL_THRESHOLD = 12;   // px of scroll needed to trigger a move
  var gestureUsed = false, lastWheel = 0, accumulated = 0, recent = [];

  function mean(a) {
    return a.reduce(function (s, x) { return s + x; }, 0) / a.length;
  }

  window.addEventListener('wheel', function (e) {
    if (!paged.matches || e.ctrlKey) return;               // ctrl = pinch zoom
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;    // sideways: table/code scroll
    e.preventDefault();
    var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    var now = performance.now();
    if (now - lastWheel > 120) { gestureUsed = false; accumulated = 0; recent = []; }
    lastWheel = now;

    recent.push(Math.abs(delta));
    if (recent.length > 8) recent.shift();
    // Inertia decays; a clear, sustained jump in speed means a new swipe has
    // started (the newest delta must also top everything before it, so noisy
    // inertia from some touchpads doesn't count).
    var older = recent.slice(0, 4);
    if (gestureUsed && !animating && recent.length === 8 &&
        mean(recent.slice(4)) > mean(older) * 1.5 &&
        recent[7] > Math.max.apply(null, older)) {
      gestureUsed = false;
      accumulated = 0;
    }

    if (animating || gestureUsed) return;
    accumulated += delta;
    if (Math.abs(accumulated) < WHEEL_THRESHOLD) return;
    gestureUsed = true;
    goTo(currentIndex() + (accumulated > 0 ? 1 : -1));
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (!paged.matches || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('button, a, input, textarea, select, pre')) {
      if (e.key === ' ' || e.key === 'Spacebar') return;
    }
    var step = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (e.key === ' ') step = e.shiftKey ? -1 : 1;
    if (e.key === 'Home') { e.preventDefault(); return goTo(0); }
    if (e.key === 'End') { e.preventDefault(); return goTo(slides.length - 1); }
    if (!step) return;
    e.preventDefault();
    if (!animating) goTo(currentIndex() + step);
  });

  // In-page links (nav, "back to top") use the same eased transition.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || !paged.matches) return;
    var target = document.querySelector(a.getAttribute('href'));
    var index = slides.indexOf(target);
    if (index < 0) return;
    e.preventDefault();
    goTo(index);
  });

  // ---------- Examples picker ----------
  var clip = document.querySelector('.example-clip');
  var picker = document.querySelector('.picker');
  var segmented = document.querySelector('.segmented');
  if (clip && picker && segmented) {
    var state = { clip: '07414', name: 'Bite', view: 'raw' };
    var viewNames = { raw: 'raw footage', masks: 'SAM3 masks', tracks: 'tracked points' };

    function src(id, view) {
      return './static/images/dataset_examples/clip_' + id + '_' + view + '.gif';
    }

    function show() {
      var next = src(state.clip, state.view);
      if (clip.getAttribute('src') === next) return;
      clip.classList.add('is-swapping');
      setTimeout(function () {
        clip.onload = clip.onerror = function () { clip.classList.remove('is-swapping'); };
        clip.src = next;
        clip.alt = state.name + ', ' + viewNames[state.view];
      }, 200);
    }

    function press(group, button) {
      group.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
      });
    }

    picker.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      press(picker, b);
      state.clip = b.dataset.clip;
      state.name = b.textContent;
      show();
    });

    segmented.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      press(segmented, b);
      state.view = b.dataset.view;
      show();
    });

    // Warm the cache so switching is instant once the page has loaded.
    window.addEventListener('load', function () {
      picker.querySelectorAll('button').forEach(function (b) {
        ['raw', 'masks', 'tracks'].forEach(function (view) {
          new Image().src = src(b.dataset.clip, view);
        });
      });
    });
  }

  // ---------- Copy BibTeX ----------
  var copy = document.getElementById('copy-bibtex');
  var bibtex = document.getElementById('bibtex');
  if (copy && bibtex && navigator.clipboard) {
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(bibtex.textContent).then(function () {
        copy.textContent = 'Copied';
        setTimeout(function () { copy.textContent = 'Copy BibTeX'; }, 2000);
      });
    });
  } else if (copy) {
    copy.hidden = true;
  }
})();
