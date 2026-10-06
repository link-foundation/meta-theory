# Case study: Habr article synchronization, issue #57

[Issue #57](https://github.com/link-foundation/meta-theory/issues/57) requests browser automation for downloading and comparing the public article and authenticated editor, then applying local Markdown. [PR #58](https://github.com/link-foundation/meta-theory/pull/58) implements that workflow. The [October 5 review](https://github.com/link-foundation/meta-theory/pull/58#issuecomment-5995102556) additionally requires the latest browser-commander, complete terminal/exported diffs, selected/latest draft prefill, and explicit CLI authorization before sending changes. The [subsequent review](https://github.com/link-foundation/meta-theory/pull/58#issuecomment-5998114580) asks for a complete audit covering every repository draft, including the latest.

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
| `pr-comments-2026-10-06.json` | All PR conversation comments, including the request to audit every draft |
| `browser-commander-npm-2026-10-06.json` | Updated npm release metadata and Node.js requirement |
| `draft-audit-2026-10-06.json` | Every revision's source files, hashes, bytes, figures, code blocks, formulas, and asset checks |
| `validation-2026-10-06.json` | Current test outcomes, safety probes, PDF compatibility, and remaining limits |
| `capture-quality-2026-10-06.txt` | Existing animation-test failure reproduced after the dependency upgrade |

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

The latest npm release found on October 5 was **browser-commander 0.23.0**; the October 6 audit upgrades to **0.25.0**, with its required Playwright 1.63.0 and Puppeteer 25.12.0 peers. The [package metadata](https://registry.npmjs.org/browser-commander/0.25.0) requires Node.js 22.12 or later. Its [JavaScript API](https://github.com/link-foundation/browser-commander/blob/main/js/README.md) distinguishes installed Chrome (`launch: real`, the upstream default) from bundled Playwright browsers (`launch: engine`). The script explicitly selects engine mode to retain a reproducible Playwright setup, supports installed Chrome and custom executables, and keeps a persistent login profile.

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

## October 5 verification and investigation results

- The original implementation passed five tests and failed all seven new reproductions before the changes.
- All **16 Habr tests** pass after the changes, using bundled Chromium and Node.js 22. Coverage includes complete CodeMirror state, captured HTML, full diffs, draft assembly, CLI downloads/sync, clipboard parsing, and write authorization.
- The local autosaving editor received no changes during default prefill; explicit `apply --write` delivered exactly the new source in one POST request.
- The guard test blocks POST, PUT, DELETE, beacon traffic, and WebSocket connections. The guard is installed before page navigation and service workers are bypassed.
- All **19 web-capture integration checks** pass. `npm test` verifies all three archived articles against their live versions, and the repository file-size check passes.
- A live CLI public download of article 1018142 succeeded: 54,384 UTF-8 bytes, SHA-256 `505d8848946be94c715e0b60a3a380733f8cd2fe3e035a322daf1b3c58c481c7`.
- A dedicated GitHub Actions workflow runs both browser and web-capture regression suites under Node.js 22, with a ten-minute job limit.

The autosave investigation exposed two environment problems in the test setup. Mismatched CodeMirror state versions suppressed the update listener; aligning the fixture's state dependency with the view dependency restored the POST. Bundled Chromium could not initialize its sandbox in this container; `--no-sandbox` is an explicit container option, while normal sessions retain their sandbox. The reusable `experiments/habr-sync-autosave-probe.mjs` logs document events, page errors, requests, and browser-commander navigation. Set `HABR_PROBE_NO_SANDBOX=1` where necessary, or `HABR_PROBE_EXECUTABLE` for an installed browser.

Authenticated live prefill and remote draft persistence remain manual checks requiring a local Habr account/profile. The captured-page and synthetic clipboard tests verify extraction and dispatch behavior, but do not claim to prove every live Habr parser normalization rule or successful server persistence.

## October 6 audit: every revision and guarded session

The continuation first merged current `main`, resolving the package manifest/lock conflicts while retaining the newly merged PDF scripts, dependencies, workflows, and release behavior. No animation, PDF, archived article, or draft content was removed. The latest review was then translated into concrete source and browser regressions, rather than assuming that a single short clipboard fixture proved support for the latest article.

### Source coverage

`node experiments/issue-57/audit-draft-sources.mjs` discovers repository revisions, prepares their actual upload source, hashes it, counts Markdown tokens, and checks that every repository image destination exists. The complete output is retained in `data/draft-audit-2026-10-06.json`.

| Version | Layout | Prepared UTF-8 bytes | Figures | Fenced code blocks | Formulas |
| --- | --- | ---: | ---: | ---: | ---: |
| 0.0.0 | Archived `article.md` | 8,962 | 12 | 2 | 0 |
| 0.0.1 | Archived `article.md` | 73,543 | 10 | 7 | 84 |
| 0.0.2 | Archived `article.md` | 60,643 | 13 | 7 | 83 |
| 0.0.3 / latest | Ten numbered sections | 153,542 | 13 | 26 | 159 |

All assets exist. Each revision, plus `latest`, is applied and read back byte-for-byte through a real CodeMirror editor with a viewport shorter than the document. A separate browser test renders each revision with MarkdownIt/KaTeX, extracts it through the visual-editor converter, and verifies all figure/code/formula counts with no opaque formulas. This local rendering exercises the entire current content; it does not reproduce Habr's proprietary clipboard parser. The original captured Habr editor separately verifies preservation of all 61 formulas whose sources are unavailable.

### Confirmed gaps and reproductions

| Confirmed gap | Before | Implementation and regression |
| --- | --- | --- |
| Flat drafts and archived versions | `--draft` assumed a section directory and could not select the three archived revisions | Resolve version directories to `article.md` or `article/`; test every actual revision and numeric version ordering |
| Version-directory `--source` | A path such as `drafts/0.0.3` was not an article input | Resolve both flat and sectioned version directories; compare their prepared output with `--draft` |
| Image rewriting | A regular expression rewrote image examples inside code and truncated destinations containing parentheses | Reuse MarkdownIt's image/destination parser, edit original spans, and test code, references, titles, spaces, parentheses, and exact standalone text |
| Static CodeMirror newline | Extraction invented a newline absent from the buffer | Join rendered lines exactly; retain complete live state as the preferred path |
| Local autosave survives guarded prefill | No POST occurred, but Habr-style localStorage caused the next session to load the unsent replacement | Copy the login profile for guarded commands and delete the copy on close; verify the next session still loads the original buffer |
| New tabs bypass guard | A second tab could POST because interception belonged only to the initial page | Install HTTP/WebSocket interception on the browser context; the finite two-tab probe now records zero writes |
| Service worker option ignored | `serviceWorkers: 'block'` was not forwarded by browser-commander's launcher | Exclude existing registrations from the copied profile, disable page registration before navigation, and retain initial-page CDP bypass |
| Recovery files missing after failed paste | Original/source snapshots were written only after editor code returned | Save snapshots first; test a visual editor with no clipboard handler |
| Verbose JSON output invalid | Upstream launch diagnostics preceded the JSON report on stdout | Send diagnostics to stderr in JSON mode; strengthen the real CLI download test to parse the report with tracing enabled |

The baseline source tests in `experiments/issue-57/draft-audit-before.tap` failed before implementation. `service-worker-before.tap` records the registration API remaining available, and `new-tab-guard-before.json` records a successful POST from the second tab. `json-verbose-before.tap` records the JSON parse error caused by launch diagnostics. `cli-before.tap` isolates the previous CLI's two failures: unsent localStorage changes leaking into another session, and missing `edit-before.md` after failed parsing. Reproduce those two baseline failures without modifying tracked files:

```bash
node experiments/issue-57/reproduce-cli-baseline.mjs
node experiments/issue-57/new-tab-guard-probe.mjs --baseline
node experiments/issue-57/new-tab-guard-probe.mjs
npm run test:habr-sync
```

The CLI baseline intentionally uses the old CLI and current extraction helpers so that these two reproductions isolate profile handling and snapshot ordering. Each browser probe uses finite local fixtures; none sends changes to Habr.

### Research and requirement execution

[Habr's Markdown help](https://habr.com/ru/docs/help/markdown/) says browser draft storage survives closing the page. This explains why HTTP interception alone did not fulfill the promise to discard a guarded prefill. A disposable profile retains existing login cookies/local drafts while isolating new browser storage; tests verify both authentication retention and discard behavior. [Playwright's routing documentation](https://playwright.dev/docs/api/class-browsercontext#browser-context-route) identifies service workers as an interception limitation. Inspecting the actual upstream launcher showed that its custom options do not automatically become Playwright context options, motivating explicit worker handling rather than an ineffective argument.

| Requirement from issue/reviews | Selected solution and execution | Evidence |
| --- | --- | --- |
| Automate precise article upload using browser-commander | Launch/navigate with the current upstream library; use CodeMirror transactions or opt-in Habr clipboard parsing | CLI and real-editor tests; pinned dependency metadata |
| Download public and edit-form states | Reuse public conversion helpers and select the complete article editor, excluding embedded widgets | Live public hash, original HTML capture, CLI downloads |
| Double-check exact matches before applying source | Keep byte equality, full patches, source hashes, and the public/editor gate; never infer exactness from normalization | Diff regressions and blocked/forced sync CLI tests |
| Handle any selected draft and latest | Support flat archives, version directories, standalone files, indexes, and all numbered sections; rewrite actual Markdown assets | All four revision audits and full-document round trips |
| Save time and minimize manual changes | Assemble the latest ten sections; preserve semantic figures, code, and formulas; export remaining normalization differences | Per-revision content counts and post-write patches |
| Read editor Markdown and provide useful diffs | Export snapshots and complete terminal/file patches; retain before/source recovery artifacts even on failed conversion | CLI download, compare, and failed-paste tests |
| Send changes only with explicit CLI authorization | Keep `apply`/`sync` dry by default and guarded `prefill`; only `--write` opens autosave traffic | Zero unauthorized requests, persistent-profile isolation, explicit POST test |
| Nice usage documentation | Update setup, all source layouts, guarded sessions, recovery artifacts, command examples, and extraction limits | `docs/habr-article-sync.md` |
| Deep case study with data, online facts, alternatives, and plans | Retain original/current metadata and captures; investigate each gap, compare existing components, reproduce before fixing, and map every requirement | This case study, linked primary sources, reusable experiments |
| Complete everything in one PR | Merge current main, preserve commit history, run local checks, update PR 58, and verify CI for the final head | PR history and GitHub Actions checks |

### Current validation and limits

- All **27 Habr tests**, **19 web-capture integration checks**, and **8 PDF tests** pass with Node.js 22.23.3 and the updated browser dependencies.
- `npm test` passes all live article checks: 35 for 0.0.0, 92 for 0.0.1, and 95 for 0.0.2. The file-size check also passes.
- Building and validating all four PDFs succeeds, including the latest 52-page article, after upgrading the shared browser dependencies.
- The live public CLI download remains 54,384 bytes with SHA-256 `505d8848946be94c715e0b60a3a380733f8cd2fe3e035a322daf1b3c58c481c7`.
- `npm run test:capture` reports 23 passing checks and one existing diagnostic-string failure at `scripts/test-capture-quality.mjs:355`. The capture succeeds, but the assertion expects the literal log phrase `using real capture timestamps`, which the unchanged script does not print. The same failure is already recorded in [issue 59's main-branch baseline](../issue-59/capture-baseline.txt). Current output is retained in `data/capture-quality-2026-10-06.txt`; this is not a newly introduced failure. Video checks were skipped because ffmpeg is unavailable locally.

Exact Markdown round trips are established for all repository revisions in CodeMirror. Visual-editor conversion preserves tested semantic content but may change Markdown formatting. Live authenticated prefill, Habr clipboard normalization for the full article, and durable remote autosave confirmation still require the user's local account/profile; no authenticated live writes were performed during this audit. Remaining differences always stay visible in the generated patch and return a nonzero post-write status.
