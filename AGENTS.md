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
- Keep `README.md` up to date with every code change.

## Documentation Maintenance (mandatory for AI agents)

- When any code, permission, UI, option, file, or EPUB output change occurs, update `README.md` in the same change.
- Sync at minimum: feature summary, Load in Chrome steps, behavior/options (e.g. Include images default and storage), Files list, permissions/host access notes, and EPUB packaging details.
- Do not leave `README.md` describing removed features, renamed files, or outdated permissions.

## License Compliance (mandatory for AI agents)

- The project license is GNU Affero General Public License v3.0 or later (`LICENSE.md`). Any AI agent making code or dependency changes must keep the repository compliant with it.
- Before finishing a change, verify: no new runtime code, vendored file, or dependency introduces a license incompatible with AGPL-3.0-or-later.
- Compatible inputs include permissive licenses (MIT, BSD, ISC, Zlib, Apache-2.0 with notices preserved) and GPL-3.0-or-later (including dual `MIT OR GPL-3.0-or-later` used under its GPL-3.0 option). Apache-2.0 code may be included in an AGPL-3.0 work; GPL-3.0 and AGPL-3.0 code may be combined per AGPL-3.0 section 13.
- Do not add GPL-2.0-only, proprietary, unknown-license, or attribution-stripped code without explicit human approval. Never remove copyright or license headers from `readability.js`, `jszip.min.js`, or any vendored file.
- When adding, upgrading, or removing a dependency or vendored file: update `package.json` / `package-lock.json` only via the package manager, re-copy the vendored distribution, confirm its embedded license header, and update `NOTICE.md` with name, version, license, source, and compliance basis.
- Keep `NOTICE.md` accurate. It is the dependency/license breakdown of record.

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
