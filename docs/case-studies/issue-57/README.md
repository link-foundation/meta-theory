# Case Study: Issue #57 - Article uploader using browser-commander

## Issue Summary

**Issue:** [#57](https://github.com/link-foundation/meta-theory/issues/57)
**Type:** Browser automation / publishing workflow
**Status:** Implemented in PR [#58](https://github.com/link-foundation/meta-theory/pull/58)

The repository needed a repeatable way to move the local Habr draft markdown into the Habr article editor while avoiding accidental overwrites. The required workflow is:

1. Download the current public read-only article state.
2. Download the current edit-form article state.
3. Compare both states exactly.
4. Apply the local source markdown only after the current states are known and reviewed.
5. Store issue research data and document the workflow.

## Collected Data

The issue data collected for this case study is stored in `docs/case-studies/issue-57/data`:

| File | Purpose |
|------|---------|
| `issue-57.json` | GitHub issue metadata and full issue body |
| `pr-58.json` | Initial prepared PR metadata |
| `browser-commander-repo.json` | GitHub repository metadata for `link-foundation/browser-commander` |
| `browser-commander-npm.json` | npm package metadata for `browser-commander` |
| `habr-article-editor-page.html` | Captured editor HTML from the issue-provided gist |
| `editor-dom-summary.json` | DOM summary extracted from the captured Habr editor HTML |

## Requirements Matrix

| Requirement | Implementation |
|-------------|----------------|
| Use `browser-commander` | `scripts/habr-article-sync.mjs` launches a persistent Playwright browser through `browser-commander`. |
| Download read-only article state | `download-readonly` converts the public Habr article page to markdown using the existing Habr conversion helpers. |
| Download edit-form article state | `download-edit` extracts markdown from the Habr editor page. |
| Compare states exactly | `compare` and `sync` report byte-exact SHA-256 comparisons and first differing lines. |
| Apply source markdown | `apply` and `sync --write` paste local markdown into the editor. Without `--write`, both commands are dry-run only. |
| Keep the workflow safe | `sync` blocks when read-only and edit-form snapshots are not byte-identical unless `--force` is passed. |
| Document usage | The full workflow is documented in [`../../habr-article-sync.md`](../../habr-article-sync.md). |
| Collect case-study data | Raw issue, PR, browser-commander, and Habr editor evidence is stored in this directory. |

## Editor Findings

The issue-provided Habr editor HTML was inspected locally. The captured page was in WYSIWYG mode:

| Signal | Finding |
|--------|---------|
| Page title | Habr edit page |
| `.editor__content` | 1 |
| `.ProseMirror` | 1 |
| `.cm-content` | 2 |
| Full markdown editor | Not present in the captured HTML |
| CodeMirror fields present | Embedded formula/code widgets, not the full article source |
| Sidebar note | Habr editor can switch between WYSIWYG and Markdown modes |

This matters because the safe write path needs to avoid embedded CodeMirror widgets. The tool therefore ignores CodeMirror nodes inside formula, code, embed, abbreviation, and editor menu containers. It only treats a CodeMirror surface as a full markdown editor when it passes a configurable minimum content length threshold.

When Habr is in WYSIWYG mode, extraction falls back to converting the `.editor__content`/`.ProseMirror` HTML to markdown. Writing to WYSIWYG is disabled by default because it is less exact than replacing a full markdown editor buffer.

## Existing Components

| Component | Role |
|-----------|------|
| `browser-commander` | Persistent browser launch and navigation wrapper over Playwright/Puppeteer. |
| Playwright | Low-level DOM, keyboard, and browser automation used for editor-specific interactions. |
| `@link-assistant/web-capture` | Existing HTML-to-markdown conversion pipeline used by the repository. |
| Existing `download-article.mjs` helpers | Reused for Habr article document construction and markdown assembly. |
| CodeMirror | Habr markdown/editor code surfaces are represented with `.cm-content` elements. |
| ProseMirror/Tiptap | Habr visual editor body is represented with `.ProseMirror`. |

`browser-commander` was already present transitively through `@link-assistant/web-capture`; this PR adds it as a direct dependency because the new script imports it directly.

## Solution Options Considered

| Option | Result |
|--------|--------|
| Use the existing public article downloader only | Useful for read-only snapshots, but it cannot inspect or update authenticated edit forms. |
| Paste into WYSIWYG mode | Works as a last resort, but it is not byte-exact and can be affected by editor normalization. Kept behind `--allow-wysiwyg-paste`. |
| Use full-page markdown mode | Best match for exact source replacement. Implemented as the default write path. |
| Use a private Habr API | No stable API was identified in the issue context. Browser automation is more transparent and auditable. |

## Implemented Workflow

Dry-run the full synchronization:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 \
  --source drafts/0.0.3/article/index.md \
  --headed
```

Apply after reviewing the dry-run result:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 \
  --source drafts/0.0.3/article/index.md \
  --headed \
  --write
```

The sync command writes these current-state snapshots by default:

```text
docs/case-studies/issue-57/runs/readonly.md
docs/case-studies/issue-57/runs/edit.md
```

Those generated run files are intentionally not committed by this case study because they depend on the authenticated browser session and the current Habr article state.

## Safety Behavior

The tool has three deliberate stop points:

1. It does not write unless `--write` is passed.
2. `sync` refuses to apply source markdown if read-only and edit-form snapshots differ exactly.
3. After a markdown-mode write, the tool re-reads the editor and reports `postWriteComparison` so the caller can verify the pasted buffer matches the source.

## Verification

The focused automated test covers:

- edit URL to read-only URL derivation;
- exact and normalized markdown comparison reporting;
- ignoring embedded CodeMirror formula fields;
- WYSIWYG extraction fallback;
- dry-run and write behavior for the markdown editor path.

Run it with:

```bash
npm run test:habr-sync
```

## References

- Habr WYSIWYG editor docs: https://habr.com/en/docs/help/wysiwyg/
- Habr Flavored Markdown docs: https://habr.com/ru/docs/help/markdown/
- browser-commander repository: https://github.com/link-foundation/browser-commander
- CodeMirror guide: https://codemirror.net/docs/guide/
