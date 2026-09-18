(() => {
  const escapeHtml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const findArticleBody = value => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    if (typeof value.articleBody === 'string' && value.articleBody.trim()) {
      return value.articleBody.trim();
    }
    for (const child of Object.values(value)) {
      const articleBody = findArticleBody(child);
      if (articleBody) {
        return articleBody;
      }
    }
    return null;
  };

  const structuredArticleBody = () => {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const body = findArticleBody(JSON.parse(script.textContent));
        if (body) {
          return body;
        }
      } catch {
        // Ignore malformed JSON-LD and continue with Readability.
      }
    }
    return null;
  };

  globalThis.html2EpubExtract = () => {
    const documentClone = document.cloneNode(true);
    // Ars Technica (PhotoSwipe) embeds a hidden `.pswp-caption-content` copy
    // of each image caption for the lightbox alongside the visible caption
    // (`figcaption` or a sibling `.caption`). Readability keeps both and
    // strips class names, so this must run here — before parsing — while the
    // marker class still exists. The visible caption is left untouched.
    documentClone.querySelectorAll('.pswp-caption-content').forEach(caption => {
      caption.remove();
    });
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (!article) {
      return null;
    }

    const articleBody = structuredArticleBody();
    if (articleBody && articleBody.length > article.textContent.length * 1.25) {
      article.content = articleBody
        .split(/\n+/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean)
        .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
        .join('\n');
      article.textContent = articleBody;
      article.length = articleBody.length;
    }

    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      byline: article.byline,
      excerpt: article.excerpt,
      siteName: article.siteName,
      dir: article.dir,
      length: article.length
    };
  };
})();
