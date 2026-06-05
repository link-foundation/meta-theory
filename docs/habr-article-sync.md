# Habr Article Sync

`scripts/habr-article-sync.mjs` automates the safe parts of moving a local markdown draft into a Habr article editor page.

It can:

- download the current public read-only article state to markdown;
- download the current edit-form state to markdown;
- compare both states byte-for-byte before changing anything;
- dry-run a source markdown upload;
- paste source markdown into the Habr editor only when `--write` is passed.

The script uses `browser-commander` to launch and control a persistent Chromium profile. It uses direct Playwright DOM operations for Habr's editor internals because Habr uses CodeMirror for markdown-like source fields and ProseMirror/Tiptap for the visual editor.

## Setup

```bash
npm ci
npx playwright install chromium
```

The default browser profile is `.browser/habr`, which is ignored by git. Use headed mode the first time so you can log in:

```bash
npm run habr:sync -- download-edit \
  --url https://habr.com/ru/article/edit/1018142 \
  --output docs/case-studies/issue-57/runs/edit.md \
  --headed
```

After login, the same profile can be reused in headless mode or with `--headed` for inspection.

## Recommended Workflow

1. Download the read-only article state:

```bash
npm run habr:sync -- download-readonly \
  --url https://habr.com/ru/articles/1018142/ \
  --output docs/case-studies/issue-57/runs/readonly.md
```

2. Download the edit-form state:

```bash
npm run habr:sync -- download-edit \
  --url https://habr.com/ru/article/edit/1018142 \
  --output docs/case-studies/issue-57/runs/edit.md \
  --headed
```

3. Compare both snapshots:

```bash
npm run habr:sync -- compare \
  --left docs/case-studies/issue-57/runs/readonly.md \
  --right docs/case-studies/issue-57/runs/edit.md
```

4. Dry-run the full sync:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 \
  --source drafts/0.0.3/article/index.md \
  --headed
```

5. Apply only after reviewing the dry-run result:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 \
  --source drafts/0.0.3/article/index.md \
  --headed \
  --write
```

## Safety Rules

- `sync` blocks if read-only and edit-form snapshots are not byte-identical. Use `--force` only after reviewing both generated files.
- `apply` and `sync` do not write by default. `--write` is required.
- Writing targets a full-page CodeMirror markdown editor by default. Embedded CodeMirror fields inside formulas/code nodes are ignored.
- After a markdown-mode write, the JSON output includes `postWriteComparison` so you can verify that the editor buffer matches the source markdown.
- If Habr is in WYSIWYG mode, extraction falls back to HTML-to-markdown conversion. Writing to WYSIWYG is disabled unless `--allow-wysiwyg-paste` is passed.
- Habr autosaves drafts. After `--write`, review the article in the browser before moving to settings or publishing.

## Commands

```bash
npm run habr:sync -- download-readonly --url <article-url> --output <file>
npm run habr:sync -- download-edit --url <edit-url> --output <file>
npm run habr:sync -- compare --left <file> --right <file>
npm run habr:sync -- apply --url <edit-url> --source <markdown-file> [--write]
npm run habr:sync -- sync --edit-url <edit-url> --source <markdown-file> [--readonly-url <url>] [--write]
```

Shared options:

- `--profile <dir>`: persistent browser profile, default `.browser/habr`
- `--headed`: run a visible browser
- `--slow-mo <ms>`: slow browser actions
- `--verbose`: enable browser-commander logs
- `--min-markdown-chars <n>`: minimum CodeMirror text length for full Markdown editor detection
- `--force`: allow `sync` to continue after read-only/edit snapshot mismatch
- `--allow-wysiwyg-paste`: paste into ProseMirror when Markdown mode is not detected

## Notes

Habr's own editor documentation says publications can be written with markdown markup and that markdown copied from an external editor should be pasted into the editor form. The tool still prefers the full Markdown CodeMirror surface when writing because that is the most auditable path for exact source replacement.

Related references:

- Habr WYSIWYG editor docs: https://habr.com/en/docs/help/wysiwyg/
- Habr Flavored Markdown docs: https://habr.com/ru/docs/help/markdown/
- browser-commander: https://github.com/link-foundation/browser-commander
- CodeMirror guide: https://codemirror.net/docs/guide/
