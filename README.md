# meta-theory

The links meta-theory

## Articles Archive

This repository contains archived versions of articles about the links theory:

| Version | Title | Language | URL |
|---------|-------|----------|-----|
| 0.0.0 | Math introduction to Deep Theory | English | https://habr.com/en/articles/658705/ |
| 0.0.1 | Глубокая Теория Связей 0.0.1 | Russian | https://habr.com/ru/articles/804617/ |
| 0.0.2 | The Links Theory 0.0.2 | English | https://habr.com/en/articles/895896/ |

## Scripts

### Verification

Verify that archived markdown articles contain all content from the original web pages:

```bash
# Verify all articles
npm test

# Verify a specific article
node scripts/verify.mjs 0.0.2
node scripts/verify.mjs 0.0.1
node scripts/verify.mjs 0.0.0

# Verify with verbose output
node scripts/verify.mjs 0.0.2 --verbose
```

### Download

Download images and screenshots from articles:

```bash
# Download images for all articles
npm run download:images

# Download screenshots for all articles
npm run download:screenshots

# Download for a specific article
node scripts/download.mjs 0.0.2 --images
node scripts/download.mjs 0.0.1 --screenshot
```

## Directory Structure

```
archive/
├── 0.0.0/                    # Math introduction to Deep Theory
│   ├── article.md            # Markdown content
│   ├── article.png           # Full-page screenshot
│   └── README.md             # Article description
├── 0.0.1/                    # Глубокая Теория Связей 0.0.1
│   ├── article.md
│   └── article.png
└── 0.0.2/                    # The Links Theory 0.0.2
    ├── article.md
    ├── article.png
    ├── images/               # Downloaded figure images
    │   ├── figure-1.png
    │   ├── ...
    │   └── metadata.json
    └── README.md

scripts/
├── articles-config.mjs       # Configuration for all articles
├── download.mjs              # Generalized download script
└── verify.mjs                # Generalized verification script

experiments/                  # Experimental scripts
```

## Installation

```bash
npm install
npx playwright install chromium
```

## Testing

```bash
npm test
```

This runs the verification script against all archived articles, checking that the markdown content matches the original web pages.
