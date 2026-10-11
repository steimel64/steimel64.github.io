# steimel64.github.io

The personal site of William Steimel, a forward deployed engineer and AI artist in Tokyo. It covers his engineering
work, an AI film studio (the short film **The Courier**) and an AI record label (first act: **LUNA.EXE**).

**Live:** https://steimel64.github.io

Static HTML, CSS and vanilla JavaScript modules. No framework, no build step and no runtime dependencies: GitHub Pages
serves the repository as it is.

## Pages

| File               | Page            | Highlights                                                                                                   |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `index.html`       | Home            | The Courier loop through a WebGL shader, the three practices, an animated trust run, background and timeline |
| `engineering.html` | Engineering     | Where I help (wired up by scroll-drawn circuit traces), the stack by layer, credentials                      |
| `artistry.html`    | AI Film Studio  | Custom film player with chapters and 23.976 fps timecode, a 3D corridor of film frames, the process          |
| `label.html`       | AI Record Label | LUNA.EXE: procedural WebGL moon, terminal intro, click-to-play lyric videos, listening links, roster         |
| `contact.html`     | Contact         | An oscilloscope that reacts to typing, and a form that drafts an email in the visitor's own mail app         |
| `404.html`         | Not found       | Served automatically by GitHub Pages                                                                         |

`about.html`, `hireme.html`, `music.html` and `research.html` are tiny redirects that keep links to the previous
version of the site working.

## Structure

```
index.html …              one HTML file per page
css/main.css              tokens, base, layout, chrome, components, pages, motion preferences
js/main.js                entry point: shared chrome, then the current page's module (loaded on demand)
js/config.js              every outside link in one place
js/core/                  shared loop and state (env), header and HUD, boot screen, page transitions,
                          ambient rain, scroll reveals, text scramble, ticker, links, video helpers
js/gl/                    WebGL helpers, hero film shader, moon shader
js/fx/                    trust run, circuit traces, frame corridor, oscilloscope
js/pages/                 one module per page
media/                    film (MP4 + WebM), stills (WebP), portrait, Open Graph image
seal.svg, favicon.svg     the hanko logo (full and simplified)
tools/                    local preview launchers, logo generator, Japanese font subsetter
```

## Performance

Every effect is built to keep the same look on modest hardware:

- One shared `requestAnimationFrame` loop. Canvases, shaders and videos pause when off screen or in a background tab.
- Adaptive quality: if frames run slow for a while, the WebGL effects render at a lower internal resolution, and step
  back up when there is headroom. Shader resolution is also capped by pixel ratio and total pixel count.
- The moon's surface (fractal terrain and craters) is baked once into a texture, a few strips per frame, so each frame
  costs one texture read per pixel instead of dozens of noise evaluations.
- The neon rain draws only the two side gutters, and the film grain moves with a compositor-only transform, so no
  full-screen layer is repainted or masked every frame.
- Glows on canvas use pre-drawn sprites and layered strokes instead of `shadowBlur`.
- YouTube loads only when a video is played. Images are responsive and lazy-loaded; the hero still is preloaded.
- `prefers-reduced-motion` turns off autoplay, shaders, the boot screen and transitions.

## Accessibility and privacy

- Semantic landmarks, a skip link, visible focus, labelled controls and alt text on content images.
- Content is readable without JavaScript; motion is layered on top.
- No analytics, cookies or trackers. Lyric videos use YouTube's privacy-enhanced embed, and only after a click.
- The contact form never sends anything itself: it drafts the message for the visitor's own mail app.

## Run it locally

Browsers block module scripts on pages opened straight from disk, so serve the folder:

- **Mac:** double-click `tools/preview.command` (the first time, right-click it and choose Open).
- **Windows:** double-click `tools/preview.bat`.
- **Anywhere:** `python3 -m http.server` in the repository root, then open http://localhost:8000.

## Code quality

Formatting and linting configs live in the repository, and CI runs both on every pull request:

```
npx prettier --check .
npx eslint .
```

## Editing

- **Links** (socials, email, LUNA.EXE platforms): `js/config.js`. A link left as `''` shows "coming soon".
- **Colours, type and spacing:** the tokens at the top of `css/main.css`.
- **Logo:** `python3 tools/seal.py .` regenerates `seal.svg` (full mark) and `favicon.svg` (clean small version). The
  PNG icons are renders of them.
- **Japanese text:** the Japanese display face is subset to the glyphs in use. After changing Japanese text, run
  `python3 tools/subset-jp.py`.

## Rights

The film, music, images, writing and logo are © William Steimel. All rights reserved.
