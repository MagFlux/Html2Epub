# Html2Epub Chrome Extension

A Manifest V3 Chrome extension that uses Mozilla's [Readability.js](https://github.com/mozilla/readability) algorithm to extract the current page's main article title and clean HTML content.

## Load in Chrome

1. Run `npm install` from this directory if dependencies have not been installed.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this directory.
5. Open an article, click the extension icon, then choose **Convert to EPUB**.

The popup extracts the title and clean HTML, embeds available article images under `OEBPS/images/`, packages everything as an EPUB 3.0 file, and starts a browser download. The **Include images** checkbox controls whether images are embedded; it is checked by default and the choice is remembered for next time via `chrome.storage.sync`. Pages that Chrome protects, such as `chrome://` pages or the Chrome Web Store, cannot be injected. Images that block extension requests are omitted from the EPUB.

## Files

- `manifest.json`: MV3 metadata, permissions, and popup registration.
- `popup.html`, `popup.css`, `popup.js`: popup UI, click-to-inject workflow, EPUB packaging, and download.
- `content.js`: runs in the page's isolated world and calls `Readability`.
- `readability.js`: vendored distribution from `@mozilla/readability`.
- `jszip.min.js`: vendored browser bundle from `jszip`.
