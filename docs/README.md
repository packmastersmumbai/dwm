# TaskFlow Wrapper — GitHub Pages

This `docs/` folder is a static-HTML wrapper that embeds the deployed Google Apps Script web-app inside a full-screen iframe with the **"This application was created by a Google Apps Script user"** banner cropped out via negative-margin offset.

## How to enable

1. Push this repo to GitHub.
2. **Repo Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` → Folder: `/docs` → Save.
3. After ~30 s GitHub Pages will publish at `https://<user>.github.io/<repo>/`.
4. Share that URL with users instead of the raw `script.google.com/...` URL.

## How it works

- `index.html` is a 1-iframe wrapper sized to fill the viewport.
- The iframe is positioned with `top: -42px` on desktop / `-60px` on mobile, and the wrapper has `overflow: hidden`. The GAS banner sits in the iframe's body, scrolled above the visible window.
- A splash screen ("⚡ TaskFlow") shows for at least 1.2 s while the GAS iframe boots, then fades.
- `sw.js` is a minimal Service Worker that caches the wrapper shell so subsequent visits feel instant (the iframe itself can't be cached — Google rules).

## Why a Chrome extension is the wrong fix

`luanpotter/apps-script-remove-warning` only hides the banner for the developer's own browser. Real users wouldn't have it installed. The iframe-wrapper approach above works for every visitor without setup.

## Updating

Whenever a new GAS deployment is pushed (`clasp deploy`), the deployment ID stays the same (`AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw`), so the wrapper does NOT need to be re-edited. The wrapper points to that fixed URL, and `clasp` rewires the URL to serve the latest version.

If the deployment ID ever changes, update the `iframe src` in `index.html` and `git push`.
