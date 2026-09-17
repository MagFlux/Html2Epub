# AGENTS.md

## Project Overview

Html2Epub is a Chrome Manifest V3 extension. The popup extracts the readable article from the active tab, packages it as an EPUB 3.0 archive, and downloads the result.

## Architecture

- `manifest.json` defines the MV3 extension, popup, active-tab scripting, image host access, and downloads permission.
- `popup.html`, `popup.css`, and `popup.js` implement the UI and EPUB generation flow.
- `content.js` runs in the page's isolated world and exposes `html2EpubExtract()`.
- `readability.js` is the vendored Mozilla Readability distribution.
- `jszip.min.js` is the vendored browser JSZip bundle.
- EPUB files are generated in `popup.js` under `OEBPS/`.

## Development Rules

- Keep the extension dependency-free at runtime; update `jszip.min.js` or `readability.js` only by copying the corresponding package distribution after dependency changes.
- Do not commit `node_modules/`; it is covered by `.gitignore`.
- Preserve the separate third-party licenses for the vendored Readability and JSZip files.
- Keep extracted article HTML escaped or serialized safely before placing it into XHTML or XML documents.
- Use the existing popup-to-content-script flow and preserve the minimum permissions needed by the feature.

## Validation

Run these checks from the repository root after JavaScript changes:

```sh
node --check popup.js
node --check content.js
node --check readability.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('manifest.json')); JSON.parse(fs.readFileSync('package.json'));"
git diff --check
```

For packaging changes, use JSZip to inspect a generated archive and verify at least:

- `mimetype` is the first uncompressed entry and contains `application/epub+zip`.
- `META-INF/container.xml` points to `OEBPS/content.opf`.
- `OEBPS/content.opf` declares EPUB version 3.0, the XHTML content, navigation, stylesheet, NCX, and embedded images.
- `OEBPS/content.xhtml` references local image paths.

## Manual Chrome Test

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select the repository directory.
3. Open a normal article page, then click the extension action.
4. Click **Convert to EPUB** and verify the browser download prompt.
5. Open the downloaded EPUB in an EPUB reader and check article text, paragraph spacing, images, and navigation.

Chrome-protected pages such as `chrome://` URLs and the Chrome Web Store cannot be injected.
