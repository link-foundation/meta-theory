# meta-theory

The links meta-theory

## Download PDFs

[Download all PDFs (ZIP)](https://github.com/link-foundation/meta-theory/releases/latest/download/meta-theory-pdfs.zip) · [Latest PDF release](https://github.com/link-foundation/meta-theory/releases/latest)

| Theory version | Status | Latest PDF |
| --- | --- | --- |
| 0.0.0 | Archived article, English | [Download PDF](https://github.com/link-foundation/meta-theory/releases/latest/download/meta-theory-0.0.0.pdf) |
| 0.0.1 | Archived article, Russian | [Download PDF](https://github.com/link-foundation/meta-theory/releases/latest/download/meta-theory-0.0.1.pdf) |
| 0.0.2 | Archived article, English | [Download PDF](https://github.com/link-foundation/meta-theory/releases/latest/download/meta-theory-0.0.2.pdf) |
| 0.0.3 | Draft, Russian | [Download PDF](https://github.com/link-foundation/meta-theory/releases/latest/download/meta-theory-0.0.3.pdf) |

These links become available after the first PDF workflow runs on `main`.
Each PDF release includes every version, local figures, rendered formulas, searchable text, clickable references, and page numbers on A4 pages. The 0.0.3 PDF assembles all ten draft sections and is labeled as a draft.

Releases use `0.0.x.r`: `x` is the highest included theory version and `r` is the publication revision, starting at `0`. For example, `0.0.3.0` and `0.0.3.1` both include PDFs for 0.0.0–0.0.3. The filenames stay fixed so these links always download the newest edition of each theory version. Previous revisions remain available in [all releases](https://github.com/link-foundation/meta-theory/releases).

## Build PDFs locally

Use Node.js 22.13 or newer within the 22.x series (also required by the existing web-capture package):

```bash
npm ci
npx puppeteer browsers install chrome
npm run build:pdf
npm run test:pdf
npm run verify:pdf

# Build one theory version or choose an output directory
node scripts/build-pdf.mjs 0.0.2 --output dist/custom-pdf --verbose
```

Output is in `dist/pdf/`: the PDFs, an all-PDF ZIP, standalone HTML previews, `manifest.json` with source files and SHA-256 hashes, and `SHA256SUMS`. The conversion uses local images and bundled fonts; it does not fetch article content or rendering assets from the internet. After downloading the PDFs, ZIP, manifest, and checksum file into one directory, verify them with `sha256sum -c SHA256SUMS`.

For containers that cannot use Chromium's sandbox, set `PDF_NO_SANDBOX=1`. To use an existing compatible Chrome installation, set `PUPPETEER_EXECUTABLE_PATH` to its executable.

The [PDF workflow](.github/workflows/pdf.yml) tests and builds every version on pull requests, retaining PDFs and previews as review artifacts. Each push to `main` publishes a complete release automatically; it can also be run manually on `main`. A rerun of the same commit reuses its release, and an interrupted upload resumes the draft before publication. New theory versions are discovered from `archive/0.0.x/article.md` or `drafts/0.0.x/article/NN-section.md`; add their download link to this table.

See the [issue #59 case study](docs/case-studies/issue-59/README.md) for requirements, research, alternatives, and validation evidence.

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

### Habr Article Sync

Download the current read-only article state, download the edit-form state, compare them exactly, and apply a local markdown source to the Habr editor through browser automation:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 \
  --draft latest \
  --headed
```

The sync command is dry-run by default and prints full unified diffs. Use `prefill --headed --keep-open` to review changes with outgoing writes blocked. Pass `--write` to enable remote draft autosaves after reviewing the comparison. See [docs/habr-article-sync.md](docs/habr-article-sync.md) for the full workflow.

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
├── habr-article-sync.mjs     # Habr edit-form sync helper
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
