# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page academic project page for the paper *Automated Temporal Localization of Behavior in Cichlid Fish with Few-Shot Trajectory Tokens* (FSH-TAL), styled after Apple's product pages. Hand-written HTML/CSS plus one vanilla JS file; no build step, no package manager, no tests.

Preview locally:
```
python3 -m http.server -d . 8000
```
then open `http://localhost:8000`.

## Structure

- `index.html` — the entire page: a fixed translucent nav bar plus a sequence of full-screen `<section class="slide">`s (title, overview/TL;DR + teaser, abstract, dataset, examples, method, results, comparison table, cite).
- `static/css/index.css` — all styles; Apple palette and type tokens on `:root`.
- `static/js/page.js` — active-slide tracking, paging, the Examples picker, and copy-BibTeX.
- `static/images/dataset_examples/clip_<id>_{raw,masks,tracks}.gif` — 320×180 GIFs; each clip ID has three variants (raw footage, SAM3 masks, tracked points). Behavior → clip ID mapping lives in the Examples picker's `data-clip` attributes.
- `static/css/bulma.min.css`, `static/css/fontawesome.*`, `static/js/fontawesome.*` are leftovers from the original Nerfies template and are not loaded by the page. The two icons the page uses (Font Awesome `file-pdf` and `github`) are inlined as `<symbol>`s at the top of `<body>` and referenced with `<use href="#icon-…">`; Data/Models use the 🤗 emoji.
- The Paper/Code/Data/Models links appear twice, on the title slide and in the nav bar's `.globalnav-actions`, so keep both copies in sync. Below 1180px the nav's section links hide to make room for the buttons, and below 520px the "FSH-TAL" brand hides too.

## Things that aren't obvious from a single file

- **Slide layout.** Every slide is `.slide > .slide-inner > (.copy, .media)`: a 40/60 grid of text and media. A slide's theme comes from `theme-light` / `theme-gray` / `theme-dark`; the nav bar switches to its dark style when the active slide is `theme-dark`. Below 900px wide the grid stacks to one column and slides grow to fit their content.
- **Paging.** On large screens with a mouse/trackpad (`(min-width: 901px) and (min-height: 601px) and (hover: hover) and (pointer: fine)`, mirrored in CSS), `page.js` adds `html.is-paged`, which sets `overflow: hidden` on the root. Native scrolling is off, and wheel gestures, arrow/Page/Space/Home/End keys and in-page `#` links all go through `goTo()`, which eases `window.scrollTo` over ~0.6–1s. 12px of wheel delta (`WHEEL_THRESHOLD`) triggers a move; the rest of that wheel stream (trackpad inertia) is then ignored until there is a 120ms gap or the deltas clearly accelerate again, which marks a fresh swipe made during the old inertia tail. Elsewhere (touch, small screens) CSS `scroll-snap-type: y mandatory` applies, and snapping is disabled entirely below 900px wide or 600px tall so long slides can scroll. Content on a paged slide must fit in one viewport, since anything overflowing it can't be reached.
- **Reveal transitions.** Elements with `.reveal` start hidden (only when `html.js` is set, so the page works without JS) and animate in when their slide gets `.is-active`. The active slide is whichever one crosses a thin band in the middle of the viewport (IntersectionObserver). Text reveals stagger via a `--i` index that `page.js` assigns per slide; `.media.reveal` scales up instead of sliding. Everything is disabled under `prefers-reduced-motion`.
- **Comparison slide.** It's grouped under "Results" in the nav (`page.js` maps `comparison` to `results` for `aria-current`).
- **Externally hosted assets.** The animated teaser is an `<iframe>` pointing at `bds062.github.io/projects/cichlid-social-behavior/teaser/` and the Paper button links to a PDF on the same site. Neither lives in this repo; `static/images/teaser.png` is the old static teaser and is not used.
- **Venue.** The page and logo say WACV 2027, while the BibTeX in `index.html` and `README.md` still cite the ECCV 2026 CV4Ecology workshop (intentionally reverted in commit `02c3ee1`). Don't "fix" one to match the other without asking.
