// Page behavior:
//  - Marks the slide crossing the middle of the viewport as .is-active, which
//    plays its .reveal transitions (CSS) and updates the nav's theme and
//    current link. Slides snap into place via CSS scroll-snap, and wheel/keys
//    page one slide at a time with an eased transition.
//  - Per-slide extras on activation: videos play (others pause) and
//    [data-count] numbers count up.
//  - The two results charts, built from the data below.
//  - Raw/masks/tracks switch on the Dataset slide.
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

  // Slides grouped under another slide's nav link.
  var NAV_GROUP = { model: 'tracking', perbehavior: 'results' };
  var activeSlide = null;

  function activate(slide) {
    if (slide === activeSlide) return;
    activeSlide = slide;
    slides.forEach(function (s) { s.classList.toggle('is-active', s === slide); });
    nav.dataset.theme = slide.classList.contains('theme-dark') ? 'dark' : 'light';
    var id = NAV_GROUP[slide.id] || slide.id;
    navLinks.forEach(function (a) {
      a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'true' : 'false');
    });
    updateWalls(slide);
    playVideos(slide);
    countUp(slide);
  }

  // ---------- Videos: only the active slide's clips play ----------
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function playVideos(slide) {
    document.querySelectorAll('video').forEach(function (v) {
      if (!slide.contains(v)) { v.pause(); return; }
      // decorative background loops stay still for reduced motion
      if (reduceMotion.matches && v.classList.contains('bg')) return;
      // wall clips keep their own place in the loop; the rest start over
      if (!v.classList.contains('bg')) {
        try { v.currentTime = 0; } catch (e) {}
      }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  }

  // ---------- Clip walls (title and links slides) ----------
  // Raw dataset clips (static/media/wall/, 480×270 copies) tiled across the
  // slide in a random order, each started at a random point in its loop. Browsers cap how many video players a page may
  // hold (~75 desktop, fewer on phones), so a wall only exists while its slide
  // is active, with about 30 tiles at most.
  var WALL_CLIPS = [
    '00006', '00019', '00020', '00039', '00053', '00527', '00528', '00585', '00663', '00843', '00844',
    '00852', '02308', '02362', '02363', '02471', '02474', '04371', '07414', '08877', '08984'
  ];
  var MAX_TILES = 30;

  function buildWall(wall) {
    clearWall(wall);
    var w = wall.clientWidth, h = wall.clientHeight;
    if (!w || !h) return;
    var cols = Math.max(2, Math.round(w / Math.sqrt(w * h * 16 / 9 / MAX_TILES)));
    var rows = function () { return Math.ceil(h / (w / cols * 9 / 16)); };
    while (cols > 2 && cols * rows() > MAX_TILES) cols--;
    wall.style.setProperty('--cols', cols);
    var order = WALL_CLIPS.slice().sort(function () { return Math.random() - 0.5; });
    for (var i = 0, n = cols * rows(); i < n; i++) {
      var v = document.createElement('video');
      v.className = 'bg';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.src = './static/media/wall/clip_' + order[i % order.length] + '.mp4';
      // seek only once the (small) clip is fully buffered: an earlier seek
      // can stall on servers without range requests, or be dropped mid-play()
      v.wallOffset = Math.random();
      ['canplaythrough', 'playing', 'timeupdate'].forEach(function (type) {
        v.addEventListener(type, seekToOffset);
      });
      wall.appendChild(v);
    }
  }

  function seekToOffset() {
    if (this.seeded || this.readyState < 4 || !this.duration) return;
    this.currentTime = this.wallOffset * this.duration;
    if (this.currentTime > 0.05 || this.wallOffset < 0.02) this.seeded = true;
  }

  function clearWall(wall) {
    wall.querySelectorAll('video').forEach(function (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();   // releases the player
      wall.removeChild(v);
    });
  }

  function updateWalls(slide) {
    document.querySelectorAll('.clip-wall').forEach(function (wall) {
      if (slide.contains(wall)) {
        if (!wall.firstChild) buildWall(wall);
      } else if (wall.firstChild) {
        clearWall(wall);
      }
    });
  }

  var wallTimer;
  window.addEventListener('resize', function () {
    clearTimeout(wallTimer);
    wallTimer = setTimeout(function () {
      var wall = activeSlide && activeSlide.querySelector('.clip-wall');
      if (wall) { buildWall(wall); playVideos(activeSlide); }
    }, 200);
  });

  // Clips in a [data-sync] row show the same moment through different stages,
  // so the others follow the first one whenever they drift apart.
  setInterval(function () {
    document.querySelectorAll('[data-sync]').forEach(function (row) {
      var vids = row.querySelectorAll('video');
      var master = vids[0];
      if (!master || master.paused) return;
      for (var i = 1; i < vids.length; i++) {
        if (!vids[i].seeking && Math.abs(vids[i].currentTime - master.currentTime) > 0.08) {
          vids[i].currentTime = master.currentTime;
        }
      }
    });
  }, 250);

  // ---------- Count-ups: [data-count] numbers tick up as they appear ----------
  function format(n, el) {
    if (el.dataset.sep) return Math.round(n).toLocaleString('en-US');
    return n.toFixed(+(el.dataset.decimals || 0));
  }

  function countUp(slide) {
    slide.querySelectorAll('[data-count]').forEach(function (el) {
      var target = +el.dataset.count;
      if (reduceMotion.matches) { el.textContent = format(target, el); return; }
      var start = performance.now() + 350;
      var run = el.countRun = (el.countRun || 0) + 1;
      el.textContent = format(0, el);
      requestAnimationFrame(function tick(now) {
        if (el.countRun !== run) return;
        var t = Math.min(1, Math.max(0, (now - start) / 900));
        el.textContent = format(target * (1 - Math.pow(1 - t, 3)), el);
        if (t < 1) requestAnimationFrame(tick);
      });
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

  // ---------- Charts ----------
  var NS = 'http://www.w3.org/2000/svg';

  function el(svg, name, attrs, text) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  function delay(e, seconds) {
    e.style.setProperty('--d', seconds + 's');
    return e;
  }

  // mAP@IoU (%) at IoU 0.1 … 0.9, from the WACV extended version's supplemental Table 1
  var IOU = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  var SERIES = [
    { name: 'MIL classifier',  cls: 's-mil',   v: [25.7, 20.7, 12.0, 8.0, 4.6, 2.1, 0.5, 0.3, 0.1] },
    { name: 'MIL + post-proc', cls: 's-milpp', v: [39.1, 31.4, 20.7, 9.5, 3.1, 0.4, 0.1, 0.0, 0.0] },
    { name: 'ASM-Loc',         cls: 's-asm',   v: [26.8, 22.2, 16.9, 11.1, 6.1, 2.8, 1.2, 0.4, 0.1] },
    { name: 'HR-Pro',          cls: 's-hrpro', v: [33.6, 28.4, 21.7, 12.3, 7.8, 3.9, 1.2, 0.5, 0.1] },
    { name: 'ActionFormer',    cls: 's-af',    v: [35.1, 34.2, 32.2, 29.8, 25.4, 20.6, 14.0, 7.9, 2.4] },
    { name: 'FSH-TAL (ours)',  cls: 's-ours',  v: [53.3, 50.9, 48.7, 45.5, 41.3, 35.2, 24.7, 14.4, 4.9] }
  ];

  // Per-behavior AP (%), IoU 0.1–0.7, with annotated events and recordings containing it
  var BEHAVIORS = [
    { name: 'Tilt',   ap: 54.1, events: '594',   recs: 11, color: 'var(--c6)' },
    { name: 'Peck',   ap: 48.8, events: '529',   recs: 11, color: 'var(--c4)' },
    { name: 'Lead',   ap: 45.6, events: '1,455', recs: 16, color: 'var(--c3)' },
    { name: 'Quiver', ap: 41.6, events: '1,262', recs: 17, color: 'var(--c5)' },
    { name: 'Bite',   ap: 38.9, events: '3,516', recs: 15, color: 'var(--c1)' },
    { name: 'Chase',  ap: 36.8, events: '846',   recs: 12, color: 'var(--c2)' }
  ];

  function buildMapChart(svg) {
    var L = 58, R = 706, T = 18, B = 346;
    function X(i) { return L + (IOU[i] - 0.1) / 0.8 * (R - L); }
    function Y(v) { return B - v / 60 * (B - T); }
    for (var v = 0; v <= 60; v += 10) {
      el(svg, 'line', { x1: L, x2: R, y1: Y(v), y2: Y(v), class: 'grid' });
      el(svg, 'text', { x: L - 10, y: Y(v) + 5, 'text-anchor': 'end', class: 'tick' }, v);
    }
    IOU.forEach(function (t, i) {
      el(svg, 'text', { x: X(i), y: B + 22, 'text-anchor': 'middle', class: 'tick' }, t.toFixed(1));
    });
    el(svg, 'text', { x: (L + R) / 2, y: B + 48, 'text-anchor': 'middle', class: 'axis' }, 'IoU threshold');
    el(svg, 'text', { x: 14, y: (T + B) / 2, 'text-anchor': 'middle', class: 'axis',
                      transform: 'rotate(-90 14 ' + (T + B) / 2 + ')' }, 'mAP (%)');
    SERIES.forEach(function (s, k) {
      var d = s.v.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
      var ours = s.cls === 's-ours';
      var path = el(svg, 'path', { d: d, class: 'line ' + s.cls + (ours ? ' draw' : ' pop') });
      el(path, 'title', {}, s.name + ': ' + s.v.map(function (v, i) {
        return 'IoU ' + IOU[i].toFixed(1) + ' ' + v.toFixed(1) + '%';
      }).join(', '));
      if (ours) {
        path.style.setProperty('--len', Math.ceil(path.getTotalLength() + 2));
        path.style.setProperty('--dur', '1.4s');
        delay(path, 1.4);
      } else {
        delay(path, 0.4 + k * 0.15);
      }
    });
    SERIES[5].v.forEach(function (v, i) {
      var dot = delay(el(svg, 'circle', { cx: X(i), cy: Y(v), r: 5, class: 'dot pop' }), 1.5 + i * 0.14);
      el(dot, 'title', {}, 'FSH-TAL, IoU ' + IOU[i].toFixed(1) + ': ' + v.toFixed(1) + '% mAP');
    });
    delay(el(svg, 'text', { x: X(0) + 10, y: Y(53.3) - 12, class: 'dlabel ours pop' }, 'FSH-TAL (ours)'), 2.6);
    delay(el(svg, 'text', { x: X(3) + 10, y: Y(29.8) - 12, class: 'dlabel pop' }, 'ActionFormer'), 1.3);
  }

  function buildApChart(svg) {
    var L = 60, R = 710, T = 30, B = 320, MAX = 60;
    var band = (R - L) / BEHAVIORS.length, w = 76;
    function Y(v) { return B - v / MAX * (B - T); }
    for (var v = 0; v <= MAX; v += 20) {
      el(svg, 'line', { x1: L, x2: R, y1: Y(v), y2: Y(v), class: 'grid' });
      el(svg, 'text', { x: L - 10, y: Y(v) + 5, 'text-anchor': 'end', class: 'tick' }, v);
    }
    el(svg, 'text', { x: 16, y: (T + B) / 2, 'text-anchor': 'middle', class: 'axis',
                      transform: 'rotate(-90 16 ' + (T + B) / 2 + ')' }, 'AP (%)');
    BEHAVIORS.forEach(function (b, i) {
      var cx = L + band * (i + 0.5), x = cx - w / 2, y = Y(b.ap), r = 4;
      // rounded top corners only; the bar sits square on the baseline
      var d = 'M' + x + ',' + B + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
              'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + B + 'Z';
      var bar = delay(el(svg, 'path', { d: d, fill: b.color, class: 'grow' }), 0.4 + i * 0.12);
      el(bar, 'title', {}, b.name + ': ' + b.ap.toFixed(1) + '% AP, ' + b.events + ' events in ' + b.recs + ' recordings');
      delay(el(svg, 'text', { x: cx, y: y - 10, 'text-anchor': 'middle', class: 'bar-val pop' }, b.ap.toFixed(1)), 1.2 + i * 0.08);
      el(svg, 'text', { x: cx, y: B + 28, 'text-anchor': 'middle', class: 'bar-name' }, b.name);
      el(svg, 'text', { x: cx, y: B + 50, 'text-anchor': 'middle', class: 'tick' }, b.events + ' · ' + b.recs);
    });
    el(svg, 'line', { x1: L, x2: R, y1: B, y2: B, class: 'base' });
    el(svg, 'text', { x: (L + R) / 2, y: B + 88, 'text-anchor': 'middle', class: 'sub' },
       'annotated events · recordings containing the behavior');
  }

  var mapChart = document.getElementById('map-chart');
  var apChart = document.getElementById('ap-chart');
  if (mapChart) buildMapChart(mapChart);
  if (apChart) buildApChart(apChart);

  // ---------- Dataset: raw / masks / tracks ----------
  var segmented = document.querySelector('#dataset .segmented');
  if (segmented) {
    var tiles = Array.prototype.slice.call(document.querySelectorAll('#dataset .tile'));
    segmented.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      segmented.querySelectorAll('button').forEach(function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      tiles.forEach(function (tile) {
        var video = tile.querySelector('video');
        video.classList.add('is-swapping');
        setTimeout(function () {
          video.src = './static/media/beh_' + tile.dataset.behavior + '_' + b.dataset.view + '.mp4';
          video.addEventListener('loadeddata', function () { video.classList.remove('is-swapping'); }, { once: true });
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        }, 200);
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
