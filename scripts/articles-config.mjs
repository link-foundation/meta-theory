/**
 * Configuration for all archived articles
 *
 * This configuration is used by the generalized download and verification scripts
 * to work with all articles in the archive.
 */

export const ARTICLES = {
  '0.0.0': {
    version: '0.0.0',
    title: 'Math introduction to Deep Theory',
    url: 'https://habr.com/en/articles/658705/',
    language: 'en',
    archivePath: 'archive/0.0.0',
    markdownFile: 'article.md',
    screenshotFile: 'article.png',
    imagesDir: 'images',
    // Images in this article are stored on external habrastorage URLs
    // They reference directly in markdown without local download
    hasLocalImages: false
  },
  '0.0.1': {
    version: '0.0.1',
    title: 'Глубокая Теория Связей 0.0.1',
    titleEnglish: 'Deep Theory of Links 0.0.1',
    url: 'https://habr.com/ru/articles/804617/',
    language: 'ru',
    archivePath: 'archive/0.0.1',
    markdownFile: 'article.md',
    screenshotFile: 'article.png',
    imagesDir: 'images',
    // Images in this article are stored on external habrastorage URLs
    // They reference directly in markdown without local download
    hasLocalImages: false
  },
  '0.0.2': {
    version: '0.0.2',
    title: 'The Links Theory 0.0.2',
    url: 'https://habr.com/en/articles/895896/',
    language: 'en',
    archivePath: 'archive/0.0.2',
    markdownFile: 'article.md',
    screenshotFile: 'article.png',
    imagesDir: 'images',
    // This article has locally downloaded figure images
    hasLocalImages: true,
    expectedFigures: 13
  }
};

/**
 * Get article configuration by version
 */
export function getArticle(version) {
  const article = ARTICLES[version];
  if (!article) {
    throw new Error(`Unknown article version: ${version}. Available: ${Object.keys(ARTICLES).join(', ')}`);
  }
  return article;
}

/**
 * Get all article versions
 */
export function getAllVersions() {
  return Object.keys(ARTICLES);
}

/**
 * Get all articles
 */
export function getAllArticles() {
  return Object.values(ARTICLES);
}
