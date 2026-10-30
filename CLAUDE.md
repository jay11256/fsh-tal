# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page academic project page for the paper *Automated Temporal Localization of Behavior in Cichlid Fish with Few-Shot Trajectory Tokens* (FSH-TAL). Originally built from the Nerfies template, now hand-written HTML/CSS with one small vanilla JS file (no Bulma or jQuery on the page); no build step, no package manager, no tests.

Preview locally:
```
python3 -m http.server -d . 8000
```
then open `http://localhost:8000`.

## Structure

- `index.html` — the entire page. Sections in order: hero (title, authors, links, WACV logo) → reel (clip mosaic + TL;DR) → teaser iframe → Abstract → Dataset → Method → Results → BibTeX → footer.
- `static/css/index.css` — all styles, with the color tokens on `:root`. `fontawesome.*` is vendored and shouldn't be edited; `bulma.min.css` is left over from the template and no longer linked.
- `static/js/page.js` — scroll-driven reel zoom and background tone switching (see below).
- `static/images/dataset_examples/clip_<id>_{raw,masks,tracks}.gif` — 320×180 GIFs shown in the Dataset grid; each clip ID has three variants (raw footage, SAM3 masks, tracked points).

## Things that aren't obvious from a single file

- **Externally hosted assets.** The animated teaser is an `<iframe>` pointing at `bds062.github.io/projects/cichlid-social-behavior/teaser/` and the Paper button links to a PDF on the same site. Neither lives in this repo; `static/images/teaser.png` is the old static teaser and is no longer shown on the page.
- **Design tokens.** Palette comes from the tank: `--glass` (light background), `--ink`, `--deep` (dark sections), `--yellow` (male *A. burtoni*; highlights and focus rings only), `--silt` (muted text). Type is Schibsted Grotesk throughout. Text colors use `--fg` / `--fg-muted` / `--rule` / `--link`, which are redefined under `body[data-tone="deep"]`, so new elements should use those rather than fixed colors.
- **Tone switching.** Every top-level section carries `data-tone="glass"` or `"deep"`. `page.js` sets `body[data-tone]` to the tone of the last section whose top has passed the viewport midpoint (or the fraction in `data-tone-at`; the reel uses `0.1` so it only goes dark once pinned), and the body background/text crossfade. Sections themselves are transparent, so a new section just needs a `data-tone`.
- **Reel.** `.reel` is 300vh tall with a sticky `.reel-stage`. `page.js` maps scroll progress to `--scale` and `--fade` on `.reel-grid` (the 3×3 mosaic scales around its center tile, `.reel-focus`, until it covers the viewport; on portrait screens it only spans the width) and `--caption` on the stage (scrim + TL;DR). The center tile must stay the middle of an odd-sized grid for the zoom origin to work. Under `prefers-reduced-motion` the reel is a static grid with the caption below.
- **Dataset clip grid.** `.clip-grid` uses a fixed label column mirrored by right padding so the middle column stays centered; labels are rotated vertical text.
- **Venue.** The page and logo say WACV 2027, while the BibTeX in `index.html` and `README.md` still cite the ECCV 2026 CV4Ecology workshop (intentionally reverted in commit `02c3ee1`). Don't "fix" one to match the other without asking.
