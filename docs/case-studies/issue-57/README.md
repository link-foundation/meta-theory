# Case study: Habr article synchronization, issue #57

[Issue #57](https://github.com/link-foundation/meta-theory/issues/57) requests browser automation for downloading and comparing the public article and authenticated editor, then applying local Markdown. [PR #58](https://github.com/link-foundation/meta-theory/pull/58) implements that workflow. The [October 5 review](https://github.com/link-foundation/meta-theory/pull/58#issuecomment-5995102556) additionally requires the latest browser-commander, complete terminal/exported diffs, selected/latest draft prefill, and explicit CLI authorization before sending changes.

## Evidence and scope

Research combines the issue's captured editor, current package documentation, the live public article, and local browser experiments. No authenticated live article changes were made during verification.

| Collected file in `data/` | Purpose |
| --- | --- |
| `issue-57.json` | Full issue body and comments, refreshed during the continuation |
| `pr-58.json` | Original prepared PR metadata, retained as historical evidence |
| `review-2026-10-05.json` | Additional review requirements and comment URL |
| `browser-commander-repo.json` | Upstream repository metadata |
| `browser-commander-npm.json` | Latest npm version, tarball integrity, and supported engines |
| `habr-article-editor-page.html` | Original editor HTML supplied through the issue's authenticated gist |
| `editor-dom-summary.json` | Original inspection of the captured editor's structure |
| `validation-2026-10-05.json` | Reproduction results, verification counts, and public-download fingerprint |

The capture has one `.ProseMirror`, one `.editor__content`, and two `.cm-content` fields. It is a visual editor; those CodeMirror fields belong to embedded widgets. It also contains 61 rendered formulas whose original TeX is unavailable in the static HTML. The public article currently exposes formula sources. These representations must not be treated as byte-identical without comparison.

## Root causes and reproduction

Seven additional regression tests failed against the previous implementation while its original five tests passed:

| Reproduction | Previous behavior | Correction |
| --- | --- | --- |
| A real CodeMirror document with 300 lines and trailing whitespace | Read only visible `.cm-line` elements, applied a minimum-size heuristic, or trimmed content | Read the complete `EditorView.state.doc` without trimming; support current and older DOM back-references |
| An empty editor followed by a short draft | Rejected the article editor below the default size threshold | Recognize live document state even when empty |
| The supplied Habr visual-editor capture | Removed non-editable figures/code/formulas along with controls | Preserve semantic node views; remove known editor controls only |
| A long code widget nested in `.ProseMirror` | Selected embedded code as the article Markdown | Exclude all nested article widgets from full-buffer selection |
| Two files differing in a paragraph | Printed only a first-difference summary | Print/export a complete unified patch, preserving whitespace and final-newline differences |
| `--draft latest`, or the article's `index.md` | No draft selector; the index supplied only a table of contents | Select the highest numeric draft version and assemble numbered article sections |
| `--write=false` | Parsed a truthy string that could enable a write | Reject values on boolean flags before opening the browser |

Reproduce and verify these cases with `npm run test:habr-sync`. The new tests live in `tests/habr-regressions.test.mjs`; command-level browser tests live in `tests/habr-cli.test.mjs`.

## Research and implementation choices

The latest npm release found on October 5 was **browser-commander 0.23.0**. Its [JavaScript API](https://github.com/link-foundation/browser-commander/blob/main/js/README.md) distinguishes installed Chrome (`launch: real`, the upstream default) from bundled Playwright browsers (`launch: engine`). The script explicitly selects engine mode to retain a reproducible Playwright setup, supports installed Chrome and custom executables, and keeps a persistent login profile.

The [CodeMirror guide](https://codemirror.net/docs/guide/) explains that document state and rendered DOM are different: long documents are virtualized. Reading `state.doc.toString()` therefore supplies the complete source, while collecting rendered lines cannot generally do so. If state is inaccessible and visible DOM gaps indicate virtualization, extraction fails instead of claiming a complete snapshot. Multiple candidate article editors also fail as an ambiguous target.

[Habr's visual-editor help](https://habr.com/en/docs/help/wysiwyg/) documents Markdown clipboard import. Visual-editor writes use a clipboard event and require `--allow-wysiwyg-paste`; an unhandled event is an error. The tool does not insert raw Markdown through a plain-text keyboard operation in that mode. Markdown buffers are replaced through a CodeMirror document transaction.

For formulas, extraction checks TeX annotations, live ProseMirror node attributes, and [MathJax's tracked items](https://docs.mathjax.org/en/latest/web/typeset.html). A formula without source is retained as rendered HTML with a warning. The static capture test verifies that all 61 formulas survive conversion. Visual-editor conversion can still normalize Markdown and cannot reconstruct the author's exact formatting.

| Alternative | Decision |
| --- | --- |
| Existing public downloader alone | Reuse its conversion helpers, but add authenticated editor access |
| Direct private Habr API | No stable API contract was provided; use browser-visible editor interactions |
| Rendered CodeMirror DOM alone | Keep a guarded static fallback; use complete live document state first |
| Always switch to Markdown mode | The capture disables switching for a nonempty article; support visual-editor clipboard parsing explicitly |
| Keyboard insertion into the visual editor | Replace with Markdown clipboard parsing and post-write extraction |
| Automated save/publish button clicks | Keep these manual; `--write` only authorizes buffer changes and the site's draft autosave traffic |

## Requirements mapped to behavior

| Requirement | Behavior |
| --- | --- |
| Read public and editor states | `download-readonly` and `download-edit` save actual page-derived Markdown |
| Compare viewer/editor exactly | `sync` exports `readonly-edit.diff`, hashes, byte counts, and exact/normalized equality separately |
| Compare editor against local source | `download-edit --draft latest --diff-output …` and `sync` print/export full patches |
| Prefill the selected/latest draft | `prepare`, `apply`, `prefill`, and `sync` accept `--draft latest`, a version, or `--source` |
| Avoid accidental remote changes | Install the HTTP/WebSocket guard before navigation; `prefill` changes the local buffer with outgoing writes blocked |
| Authorize sending through explicit CLI options | Only `--write` allows editor autosave traffic; `apply`/`sync` otherwise remain dry runs |
| Minimize manual changes | Assemble all ten sections and rewrite relative image links to public repository URLs |
| Verify resulting content | Re-read the editor after replacement; export remaining differences and exit 1 on mismatch |
| Diagnose browser behavior | `--verbose` enables navigation/blocked-request tracing; retain a local autosave probe in `experiments/` |

`sync` retains the original exact-equality gate between published content and the editor. An unpublished draft or conversion difference blocks application unless acknowledged with `--force`. That option never enables writes by itself.

## Workflow

The complete setup and options are in [Habr article sync](../../habr-article-sync.md). Use Node.js 22, install the package lock and Chromium, then log in manually with the persistent browser profile.

```bash
npm ci
npx playwright install chromium
npm run habr:sync -- login --url https://habr.com/ru/article/edit/1018142 --headed
npm run habr:sync -- prepare --draft latest --output .browser/source.md
npm run habr:sync -- download-edit \
  --url https://habr.com/ru/article/edit/1018142 --draft latest \
  --output .browser/edit.md --diff-output .browser/edit-source.diff --headed
```

Prefill for manual inspection with outgoing writes blocked:

```bash
npm run habr:sync -- prefill \
  --url https://habr.com/ru/article/edit/1018142 --draft latest \
  --headed --keep-open --allow-wysiwyg-paste
```

Inspect both existing states before allowing draft autosaves:

```bash
npm run habr:sync -- sync \
  --edit-url https://habr.com/ru/article/edit/1018142 --draft latest \
  --headed --diff-output .browser/edit-source.diff
```

Run the same command with `--write` only when remote changes are intended. Add `--force` after reviewing a public/editor mismatch and `--allow-wysiwyg-paste` when the editor uses visual mode. `--keep-open` allows inspection and manual adjustment before closing. The tool never clicks settings, save, submit, or publish controls.

Generated content is stored in git-ignored `.browser/habr-sync/runs`, or an explicitly chosen `--work-dir`. Before/after snapshots and patches are available for review. Post-write equality describes the editor buffer, not confirmation of durable server storage; the default three-second autosave wait and manual saved-status inspection address a separate concern.

## Verification and investigation results

- The original implementation passed five tests and failed all seven new reproductions before the changes.
- All **16 Habr tests** pass after the changes, using bundled Chromium and Node.js 22. Coverage includes complete CodeMirror state, captured HTML, full diffs, draft assembly, CLI downloads/sync, clipboard parsing, and write authorization.
- The local autosaving editor received no changes during default prefill; explicit `apply --write` delivered exactly the new source in one POST request.
- The guard test blocks POST, PUT, DELETE, beacon traffic, and WebSocket connections. The guard is installed before page navigation and service workers are bypassed.
- All **19 web-capture integration checks** pass. `npm test` verifies all three archived articles against their live versions, and the repository file-size check passes.
- A live CLI public download of article 1018142 succeeded: 54,384 UTF-8 bytes, SHA-256 `505d8848946be94c715e0b60a3a380733f8cd2fe3e035a322daf1b3c58c481c7`.
- A dedicated GitHub Actions workflow runs both browser and web-capture regression suites under Node.js 22, with a ten-minute job limit.

The autosave investigation exposed two environment problems in the test setup. Mismatched CodeMirror state versions suppressed the update listener; aligning the fixture's state dependency with the view dependency restored the POST. Bundled Chromium could not initialize its sandbox in this container; `--no-sandbox` is an explicit container option, while normal sessions retain their sandbox. The reusable `experiments/habr-sync-autosave-probe.mjs` logs document events, page errors, requests, and browser-commander navigation. Set `HABR_PROBE_NO_SANDBOX=1` where necessary, or `HABR_PROBE_EXECUTABLE` for an installed browser.

Authenticated live prefill and remote draft persistence remain manual checks requiring a local Habr account/profile. The captured-page and synthetic clipboard tests verify extraction and dispatch behavior, but do not claim to prove every live Habr parser normalization rule or successful server persistence.
