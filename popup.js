const convertButton = document.querySelector('#convert');
const status = document.querySelector('#status');
const includeImagesInput = document.querySelector('#include-images');

const INCLUDE_IMAGES_KEY = 'includeImages';
const INCLUDE_IMAGES_DEFAULT = false;

function hasSyncStorage() {
  return Boolean(chrome?.storage?.sync);
}

async function getIncludeImages() {
  if (!hasSyncStorage()) {
    return INCLUDE_IMAGES_DEFAULT;
  }
  const stored = await chrome.storage.sync.get(INCLUDE_IMAGES_KEY);
  return stored[INCLUDE_IMAGES_KEY] ?? INCLUDE_IMAGES_DEFAULT;
}

async function setIncludeImages(value) {
  if (!hasSyncStorage()) {
    return;
  }
  await chrome.storage.sync.set({ [INCLUDE_IMAGES_KEY]: value });
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function safeFilename(title) {
  const filename = (title || 'article')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 99);
  return `${filename || 'article'}.epub`;
}

function toXhtml(html) {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = parsed.body.firstElementChild;
  const serializer = new XMLSerializer();
  return Array.from(wrapper.childNodes)
    .map(node => serializer.serializeToString(node))
    .join('');
}

function stripImages(html) {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = parsed.body.firstElementChild;
  wrapper.querySelectorAll('figure').forEach(figure => {
    if (figure.querySelector('img, picture')) {
      figure.remove();
    }
  });
  wrapper.querySelectorAll('img').forEach(image => image.remove());
  wrapper.querySelectorAll('picture').forEach(picture => picture.remove());
  return toXhtml(wrapper.innerHTML);
}

const MAX_EMBEDDED_IMAGE_EDGE = 1600;
const EMBEDDED_IMAGE_QUALITY = 0.82;

async function compressImage(blob) {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();

  try {
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, MAX_EMBEDDED_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create an image canvas.');
    }

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not encode image.')), 'image/jpeg', EMBEDDED_IMAGE_QUALITY);
    });
    return { blob: compressedBlob, contentType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareEmbeddedImages(html, sourceUrl) {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = parsed.body.firstElementChild;
  const images = [];
  const imagePaths = new Map();
  const imageElements = Array.from(wrapper.querySelectorAll('img[src]'));

  for (const imageElement of imageElements) {
    const originalSource = imageElement.getAttribute('src');
    if (!originalSource || originalSource.startsWith('blob:')) {
      imageElement.remove();
      continue;
    }

    try {
      const resolvedSource = originalSource.startsWith('data:')
        ? originalSource
        : new URL(originalSource, sourceUrl).href;
      let imagePath = imagePaths.get(resolvedSource);

      if (!imagePath) {
        const response = await fetch(resolvedSource);
        if (!response.ok) {
          throw new Error(`Image request failed with ${response.status}`);
        }
        const blob = await response.blob();
        const compressedImage = await compressImage(blob);
        const contentType = compressedImage.contentType;
        imagePath = `images/image-${images.length + 1}.jpg`;
        imagePaths.set(resolvedSource, imagePath);
        images.push({ path: imagePath, blob: compressedImage.blob, contentType });
      }

      imageElement.setAttribute('src', imagePath);
      imageElement.removeAttribute('srcset');
      imageElement.removeAttribute('sizes');
    } catch {
      imageElement.remove();
    }
  }

  return { html: toXhtml(wrapper.innerHTML), images };
}

function wrapCoverText(text, maxCharsPerLine = 34) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [''];
  }

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    if (word.length <= maxCharsPerLine) {
      current = word;
      continue;
    }

    const chunkSize = maxCharsPerLine;
    for (let start = 0; start < word.length; start += chunkSize) {
      lines.push(word.slice(start, start + chunkSize));
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 4);
}

function createCoverSvg(title, author) {
  const titleLines = wrapCoverText(title, 34);
  const authorLines = author ? wrapCoverText(author, 38) : [];
  const titleFontSize = titleLines.length > 2 ? 46 : 56;
  const authorFontSize = 28;
  const titleStartY = 760;
  const authorStartY = 1175;
  const textLines = titleLines.map((line, index) => {
    const y = titleStartY + (index * 82);
    return `  <text x="600" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${titleFontSize}" font-weight="700" fill="#111111">${escapeXml(line)}</text>`;
  }).join('\n');

  const authorText = authorLines.length ? authorLines.map((line, index) => {
    const y = authorStartY + (index * 32);
    return `  <text x="600" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${authorFontSize}" font-weight="600" letter-spacing="2.5" fill="#444444">${escapeXml(line).toUpperCase()}</text>`;
  }).join('\n') : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800" role="img" aria-labelledby="title desc">
  <title>${escapeXml(title)}</title>
  <desc>Cover image for ${escapeXml(title)}</desc>
  <rect width="1200" height="1800" fill="#FFFFFF"/>
  <g>
${textLines}
${authorText}
  </g>
</svg>`;
}

function createEpub(article, sourceUrl, embeddedImages) {
  const zip = new JSZip();
  const title = article.title || 'Untitled article';
  const author = article.byline ? article.byline.trim() : '';
  const identifier = `urn:html2epub:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const escapedTitle = escapeXml(title);
  const escapedAuthor = escapeXml(author);
  const escapedIdentifier = escapeXml(identifier);
  const escapedSourceUrl = escapeXml(sourceUrl || '');
  const coverSvg = createCoverSvg(title, author);

  for (const image of embeddedImages) {
    zip.file(`OEBPS/${image.path}`, image.blob);
  }

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
  zip.file('OEBPS/cover.svg', coverSvg);
  zip.file('OEBPS/cover.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <title>${escapedTitle}</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body class="cover-page">
    <img class="cover-image" src="cover.svg" alt="${escapedTitle}" />
  </body>
</html>`);
  zip.file('OEBPS/content.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <title>${escapedTitle}</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body>
    <article>
      ${article.content}
    </article>
  </body>
</html>`);
  zip.file('OEBPS/style.css', `body { line-height: 1.5; }
.cover-page {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
.cover-image {
  display: block;
  width: 100%;
  height: 100vh;
  object-fit: contain;
  margin: 0;
  padding: 0;
}
p { margin: 0 0 1em; }
img { max-width: 100%; height: auto; }`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head><title>Contents</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
        <li><a href="cover.xhtml">Cover</a></li>
        <li><a href="content.xhtml">${escapedTitle}</a></li>
      </ol>
    </nav>
  </body>
</html>`);
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${escapedIdentifier}"/></head>
  <docTitle><text>${escapedTitle}</text></docTitle>
  <navMap>
    <navPoint id="cover" playOrder="1"><navLabel><text>Cover</text></navLabel><content src="cover.xhtml"/></navPoint>
    <navPoint id="article" playOrder="2"><navLabel><text>${escapedTitle}</text></navLabel><content src="content.xhtml"/></navPoint>
  </navMap>
</ncx>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapedIdentifier}</dc:identifier>
    <dc:title>${escapedTitle}</dc:title>
    ${author ? `<dc:creator>${escapedAuthor}</dc:creator>` : ''}
    <dc:subject>Article</dc:subject>
    <dc:language>en</dc:language>
    <meta name="cover" content="cover-image"/>
    <meta property="dcterms:modified">${modified}</meta>
    <dc:source>${escapedSourceUrl}</dc:source>
  </metadata>
  <manifest>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  ${embeddedImages.map((image, index) => `    <item id="image-${index + 1}" href="${image.path}" media-type="${escapeXml(image.contentType)}"/>`).join('\n')}
  </manifest>
  <spine toc="ncx"><itemref idref="cover"/><itemref idref="content"/></spine>
</package>`);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

async function convertCurrentPage() {
  convertButton.disabled = true;
  setStatus('Reading current page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab found.');
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['readability.js', 'content.js']
    });

    const [{ result: article }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.html2EpubExtract()
    });

    if (!article) {
      throw new Error('Readability could not find an article on this page.');
    }

    let html;
    let images;

    if (await getIncludeImages()) {
      setStatus('Embedding images...');
      const preparedArticle = await prepareEmbeddedImages(article.content, tab.url);
      html = preparedArticle.html;
      images = preparedArticle.images;
      setStatus(`Building EPUB${images.length ? ` with ${images.length} image${images.length === 1 ? '' : 's'}` : ''}...`);
    } else {
      setStatus('Building EPUB...');
      html = stripImages(article.content);
      images = [];
    }

    const epubBlob = await createEpub({ ...article, content: html }, tab.url, images);
    const downloadUrl = URL.createObjectURL(epubBlob);
    await chrome.downloads.download({
      url: downloadUrl,
      filename: safeFilename(article.title),
      saveAs: true
    });

    setStatus(`Downloaded ${article.title || 'untitled article'}.`);
  } catch (error) {
    setStatus(error.message || 'Could not convert this page.', true);
  } finally {
    convertButton.disabled = false;
  }
}

includeImagesInput.addEventListener('change', async () => {
  await setIncludeImages(includeImagesInput.checked);
});

(async () => {
  includeImagesInput.checked = await getIncludeImages();
})();

convertButton.addEventListener('click', convertCurrentPage);
