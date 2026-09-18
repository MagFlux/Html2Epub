# NOTICE — Dependency and License Breakdown

## Project license

Html2Epub is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). See `LICENSE.md`.

All first-party files (`popup.js`, `content.js`, `popup.html`, `popup.css`, `manifest.json`) are conveyed under AGPL-3.0-or-later.

## Runtime / vendored dependencies (shipped in the extension)

| Component | Version | License | Source | Compliance basis |
|---|---|---|---|---|
| `@mozilla/readability` (vendored as `readability.js`) | 0.5.0 | Apache-2.0 | https://github.com/mozilla/readability | Apache-2.0 is compatible with AGPL-3.0 as a one-way combination; the combined work is conveyed under AGPL-3.0-or-later. Apache copyright header and license text are preserved in `readability.js`. |
| `jszip` (vendored as `jszip.min.js`) | 3.10.2 | MIT OR GPL-3.0-or-later | https://github.com/Stuk/jszip | Project uses it under the MIT option, which is permissive and AGPL-3.0-compatible. (The GPL-3.0-or-later option would also be combinable per AGPL-3.0 §13.) Dual-license header is preserved in `jszip.min.js`. |
| `pako` (bundled inside `jszip.min.js`) | 1.0.11 | MIT AND Zlib | https://github.com/nodeca/pako | Both MIT and Zlib are permissive and AGPL-3.0-compatible. Attribution preserved in the JSZip bundle header. |

The extension is dependency-free at runtime apart from these vendored files. `node_modules/` is not committed (see `.gitignore`) and is not shipped.

## Build-time only dependencies (not shipped, not committed)

Installed via `npm install` from `package.json` / `package-lock.json` for re-vendoring only:

| Package | Version | License |
|---|---|---|
| `lie` | 3.3.0 | MIT |
| `readable-stream` | 2.3.8 | MIT |
| `setimmediate` | 1.0.5 | MIT |
| `immediate` | 3.0.6 | MIT |
| `inherits` | 2.0.4 | ISC |
| `isarray` | 1.0.0 | MIT |
| `core-util-is` | 1.0.3 | MIT |
| `process-nextick-args` | 2.0.1 | MIT |
| `safe-buffer` | 5.1.2 | MIT |
| `util-deprecate` | 1.0.2 | MIT |
| `string_decoder` | 1.1.1 | MIT |

MIT, ISC, and Zlib are permissive licenses compatible with AGPL-3.0-or-later. They impose only copyright-notice preservation, which npm package metadata satisfies; none impose copyleft conditions on this project.

## Why this combination is compliant

- No GPL-2.0-only, proprietary, or unknown-license code is included.
- Permissive components (MIT / ISC / Zlib) permit inclusion in an AGPL-3.0 work with notices preserved.
- Apache-2.0 permits inclusion in an AGPL-3.0 work with notices preserved; the combined work is governed by AGPL-3.0-or-later.
- JSZip's dual license permits use under MIT, avoiding any additional copyleft obligation beyond AGPL-3.0-or-later.
- Vendored headers in `readability.js` and `jszip.min.js` are preserved per `AGENTS.md` development rules.

## Agent obligations

- Keep this file accurate when adding, upgrading, or removing any dependency or vendored file.
- Never strip copyright or license headers.
- Verify new inputs against the compatibility rule in `AGENTS.md` ("License Compliance") before finishing.
