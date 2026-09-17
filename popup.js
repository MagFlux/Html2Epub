const convertButton = document.querySelector('#convert');
const status = document.querySelector('#status');
const result = document.querySelector('#result');

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

function imageExtension(contentType, imageUrl) {
  const extensions = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp'
  };
  if (extensions[contentType]) {
    return extensions[contentType];
  }

  const extension = imageUrl.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase();
  return extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : 'bin';
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
        const contentType = blob.type || 'application/octet-stream';
        imagePath = `images/image-${images.length + 1}.${imageExtension(contentType, resolvedSource)}`;
        imagePaths.set(resolvedSource, imagePath);
        images.push({ path: imagePath, blob, contentType });
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

function createEpub(article, sourceUrl, embeddedImages) {
  const zip = new JSZip();
  const title = article.title || 'Untitled article';
  const identifier = `urn:html2epub:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const escapedTitle = escapeXml(title);
  const escapedIdentifier = escapeXml(identifier);
  const escapedSourceUrl = escapeXml(sourceUrl || '');

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
      <h1>${escapedTitle}</h1>
      ${article.content}
    </article>
  </body>
</html>`);
  zip.file('OEBPS/style.css', `body { line-height: 1.5; }
p { margin: 0 0 1em; }
img { max-width: 100%; height: auto; }`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head><title>Contents</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol><li><a href="content.xhtml">${escapedTitle}</a></li></ol>
    </nav>
  </body>
</html>`);
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${escapedIdentifier}"/></head>
  <docTitle><text>${escapedTitle}</text></docTitle>
  <navMap><navPoint id="article" playOrder="1"><navLabel><text>${escapedTitle}</text></navLabel><content src="content.xhtml"/></navPoint></navMap>
</ncx>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapedIdentifier}</dc:identifier>
    <dc:title>${escapedTitle}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
    <dc:source>${escapedSourceUrl}</dc:source>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  ${embeddedImages.map((image, index) => `    <item id="image-${index + 1}" href="${image.path}" media-type="${escapeXml(image.contentType)}"/>`).join('\n')}
  </manifest>
  <spine toc="ncx"><itemref idref="content"/></spine>
</package>`);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

async function convertCurrentPage() {
  convertButton.disabled = true;
  result.hidden = true;
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

    setStatus('Embedding images...');
    const preparedArticle = await prepareEmbeddedImages(article.content, tab.url);
    setStatus(`Building EPUB${preparedArticle.images.length ? ` with ${preparedArticle.images.length} image${preparedArticle.images.length === 1 ? '' : 's'}` : ''}...`);
    const epubBlob = await createEpub({ ...article, content: preparedArticle.html }, tab.url, preparedArticle.images);
    const downloadUrl = URL.createObjectURL(epubBlob);
    await chrome.downloads.download({
      url: downloadUrl,
      filename: safeFilename(article.title),
      saveAs: true
    });

    setStatus(`Downloaded ${article.title || 'untitled article'}.`);
    result.textContent = preparedArticle.html;
    result.hidden = false;
  } catch (error) {
    setStatus(error.message || 'Could not convert this page.', true);
  } finally {
    convertButton.disabled = false;
  }
}

convertButton.addEventListener('click', convertCurrentPage);
