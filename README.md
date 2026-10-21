# Kalimah Maze: The Lost Language Archives

Arabic-learning pixel-art maze game. A single static file (`index.html`): HTML, CSS and vanilla JS, no build step, no dependencies. Fonts load from Google Fonts and fall back to system fonts when offline.

## Features
- Modes: Adventure, Vocabulary Hunt, Nahwu Run (grammar questions, explanations in Indonesian).
- Five difficulty levels, four zones, the Living Lexicon (Discovered, Recall, Reverse, Mastered).
- Procedural background music and sound effects (Web Audio, no audio files).

## Main menu remaster
- New hierarchy: title, one large primary "Mulai" button, then mode, difficulty and secondary actions (Lexicon, Review, Settings).
- Separate desktop (two columns) and mobile (single column, Start above the fold) layouts, plus a compact landscape layout; safe-area insets respected.
- **Bahasa Indonesia is the default language** on first launch. English remains available from the `ID/EN` button or Settings. The choice is saved in `localStorage` (`kalimah-maze-v1`, `set.lang`). Arabic words, Nahwu content and Arabic script are never translated.
- Audio: master, music and effects volume sliders, mute button (also `M`), settings persisted. Music starts after the first tap or key press (browser autoplay rules) and fades between menu and zone music.
- Reduced motion is respected (system setting and in-game toggle).
- If initialization throws before the game is ready, a short error screen with a reload button is shown instead of an endless loading screen.

## Run locally
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8000`.

## Deploy
Any static host works. For GitHub Pages: Settings, Pages, deploy from branch `main`, folder `/ (root)`. Not configured or verified here.

## Testing status
Checked with a headless Chromium (Playwright) smoke test: no page errors; no horizontal scroll at 375x667, 667x375, 820x1180, 1440x900 and 2560x1080; Indonesian default; language switch and persistence after reload; Settings and game start. There is no automated test suite in the repo.
Not verified: real iOS/Android devices, audible audio quality and crossfades, full Indonesian coverage of every game screen (the recall, results and lexicon screens were translated but only spot-checked).

## Known limitations
- Not a PWA (no manifest or service worker).
- Word list is small (24 words); Nahwu content is marked as an unreviewed draft in the game.
- No license file is included; add one before public release.
