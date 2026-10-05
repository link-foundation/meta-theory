# Habr article sync

Use `npm run habr:sync -- <command>` to download the public article or its authenticated editor, review complete unified diffs, and prefill a selected Markdown draft. The tool uses **browser-commander 0.23.0** and Playwright. `apply` and `sync` are dry runs by default. `prefill` changes the browser buffer while blocking outgoing writes. Only `--write` enables remote draft autosaves.

## Setup and login

Use Node.js 22, which is supported by the repository's web-capture dependency:

```bash
npm ci
npx playwright install chromium
npm run habr:sync -- login \
  --url https://habr.com/ru/article/edit/1018142 --headed
```

Log in manually, then press Enter in the terminal. Authentication remains in the git-ignored `.browser/habr` profile. `login` allows authentication requests and performs no automated article edits. Subsequent commands reuse that profile. Use `--profile <directory>` for another account/profile.

The script explicitly selects browser-commander's `--launch engine` mode for bundled Chromium. To use installed Chrome, add `--launch real`; alternatively supply `--executable-path /path/to/chrome`. Use the same browser/profile for login and subsequent operations.

In a container where Chromium cannot initialize its sandbox, explicitly add `--no-sandbox`. Normal browser sessions retain the sandbox by default.

## Choose and assemble the source

```bash
npm run habr:sync -- prepare --draft latest --output .browser/source.md
```

`--draft latest` chooses the highest numeric `major.minor.patch` version under `drafts/`. `--draft 0.0.3` selects that version. A sectioned article directory, or its `index.md`, assembles all numbered `NN-*.md` files in numeric order. In this repository, `index.md` is a table of contents; it is not the article body. The assembled source includes all ten sections of 0.0.3.

You can also use `--source drafts/0.0.3/article`, `--source drafts/0.0.3/article/index.md`, or an individual Markdown file such as `--source archive/0.0.2/article.md`. A standalone file retains its exact text. Choose either `--draft` or `--source`.

Assembled sections resolve relative image paths against their source files and replace them with public repository URLs under `https://raw.githubusercontent.com/link-foundation/meta-theory/main/`. This avoids broken images resolving against `habr.com`. Override the root with `--asset-base-url https://raw.githubusercontent.com/link-foundation/meta-theory/issue-57-bdfa795fee8c/` for assets on this branch. An explicit asset base also rewrites relative images in standalone files. Compare against the generated `source.md` to review these intentional URL changes.

## Download and review diffs

Download both current states without enabling outgoing writes:

```bash
npm run habr:sync -- download-readonly \
  --url https://habr.com/ru/articles/1018142/ --output .browser/readonly.md

npm run habr:sync -- download-edit \
  --url https://habr.com/ru/article/edit/1018142 --output .browser/edit.md \
  --draft latest --diff-output .browser/editor-source.diff --headed
```

`download-edit` prints the full editor-to-source unified diff and exports it when `--diff-output` is supplied. Omit `--draft`/`--source` to download a snapshot alone. Download commands exit successfully when extraction succeeds, including when the source differs.

Compare any two files offline:

```bash
npm run habr:sync -- compare \
  --left .browser/readonly.md --right .browser/edit.md \
  --diff-output .browser/viewer-editor.diff
```

`compare` prints a unified diff and an exact/normalized equality report with SHA-256 hashes. It returns 0 for byte-identical files and 1 for differences. Patches retain whitespace, line-ending differences, and missing final newlines. `--json` produces a JSON report containing diff strings instead of printing terminal patches.

Public snapshots contain the title and body by default, matching the scope of editor extraction. `download-readonly --include-metadata` restores the enriched public snapshot format with author/publication metadata. This optional format is useful for archival work but will usually differ from the editor buffer.

## Prefill for review without sending changes

```bash
npm run habr:sync -- prefill \
  --url https://habr.com/ru/article/edit/1018142 --draft latest \
  --headed --keep-open --allow-wysiwyg-paste \
  --diff-output .browser/prefill.diff
```

`prefill` changes only the local browser buffer by default. Before navigation, the tool blocks non-read HTTP methods and WebSocket connections and bypasses service workers. Keep the browser open to inspect and adjust the draft; press Enter to close it. Closing this guarded session discards unsent changes. Start a separate command with `--write` when you want to enable Habr's remote autosaves.

CodeMirror writes replace the complete document state, including offscreen lines and final whitespace. Embedded code/formula editors are excluded. In Habr's visual editor, `--allow-wysiwyg-paste` dispatches a Markdown clipboard paste through the editor's own parser; it does not insert Markdown as plain text. This conversion can normalize formatting. The tool re-extracts the result and saves any remaining differences for manual review.

Habr's captured editor disables mode switching on a nonempty document, so switching to Markdown is not always available. The visual-editor paste path supports that case. A missing clipboard handler is an error rather than a successful prefill.

## Full sync and explicit remote writes

First review the public/editor and editor/source differences:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 --draft latest \
  --headed --diff-output .browser/editor-source.diff
```

`sync` downloads both snapshots and blocks application if they are not byte-identical. Both diffs are still generated when blocked. After reviewing `readonly-edit.diff`, use `--force` to acknowledge that mismatch, for example when the published article and an unpublished editor draft differ.

To enable changes and Habr draft autosaves explicitly:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 --draft latest \
  --headed --keep-open --allow-wysiwyg-paste --force --write
```

Omit `--force` when the existing snapshots match. `apply --url <edit-url> --draft latest --write` updates the editor without the public/editor gate. Without `--write`, `apply` and `sync` only compare and leave the buffer untouched. `--force` and `--allow-wysiwyg-paste` do not enable remote writes.

These commands never click save, settings, submit, or publish buttons. `--write` enables Habr's own autosave requests and waits three seconds before closing by default; change that using `--autosave-wait-ms <ms>`. Keep a headed browser open to confirm the site's saved status manually. Post-write comparison verifies the editor buffer, not durable server storage. A remaining post-write difference returns exit status 1 and leaves an `after-source.diff` report.

## Artifacts, options, and extraction limits

`apply`, `prefill`, and `sync` put snapshots and patches in git-ignored `.browser/habr-sync/runs`, or `--work-dir <directory>`. `sync` writes `readonly.md`, `edit.md`, `source.md`, `readonly-edit.diff`, and `edit-source.diff`. Applied changes additionally produce `edit-after.md` and `after-source.diff`; editor-only commands use `edit-before.md` for the initial state. These files contain article content, so choose a private output directory for private drafts.

Other options:

- `--readonly-url <url>`: override the public URL used by `sync`.
- `--wait-ms <ms>`: wait for editor readiness, default 30000.
- `--slow-mo <ms>`: slow browser operations.
- `--verbose`: enable browser-commander tracing and blocked-request diagnostics.
- `--min-markdown-chars <n>`: optional threshold for static CodeMirror DOM fallback; live document state supports short and empty drafts.
- `--keep-open`: requires `--headed` and an interactive terminal.

CodeMirror state extraction is byte-exact. Static DOM fallback reconstructs rendered lines and refuses visibly virtualized buffers without accessible state. Multiple article editors are treated as an ambiguous target and rejected. WYSIWYG HTML conversion cannot reconstruct every original Markdown formatting choice. Formula sources come from annotations, live ProseMirror nodes, or MathJax state when available; otherwise their rendered HTML is preserved and reported in `warnings`. Exact equality is never inferred from normalized equality.

Tests use the supplied Habr editor capture, real CodeMirror instances, and a local HTTP editor with autosaves. Public article extraction was also verified against the live article. Authenticated live editing requires the user's local login and remains a manual verification step.

```bash
npm run test:habr-sync
npm run test:web-capture
```

References: [browser-commander JavaScript API](https://github.com/link-foundation/browser-commander/blob/main/js/README.md), [Habr editor help](https://habr.com/en/docs/help/wysiwyg/), [Habr Markdown](https://habr.com/ru/docs/help/markdown/), [CodeMirror state and viewport](https://codemirror.net/docs/guide/).
