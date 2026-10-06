import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
import { discoverDocuments, renderDocument, buildPdfs } from './build-pdf.mjs';
import { planRelease, publishRelease } from './release-pdfs.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'meta-theory-pdf-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, content) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  };
  return { root, put };
}

test('discovers all archives and ordered draft sections, ignoring draft index', async (t) => {
  const { root, put } = await fixture(t);
  await put('archive/0.0.2/article.md', '# Archive');
  await put('archive/0.0.10/article.md', '# New archive');
  await put('drafts/0.0.3/article/02-end.md', '# End');
  await put('drafts/0.0.3/article/01-start.md', '# Start');
  await put('drafts/0.0.3/article/index.md', '# Navigation only');
  const docs = await discoverDocuments(root);
  assert.deepEqual(docs.map((doc) => doc.version), ['0.0.2', '0.0.3', '0.0.10']);
  assert.deepEqual(docs[1].sources, [
    'drafts/0.0.3/article/01-start.md', 'drafts/0.0.3/article/02-end.md',
  ]);
  assert.equal(docs[1].draft, true);
  assert.equal(docs[0].filename, 'meta-theory-0.0.2.pdf');
});

test('renders math, code, Cyrillic, embedded local figures, and section links', async (t) => {
  const { root, put } = await fixture(t);
  await put('drafts/0.0.3/article/01-start.md', '# Теория\n\n> $R \\to R^2$\n\n[End](02-end.md)\n\n![Figure](../images/figure.svg)\n\n```lean\ndef R := Nat\n```');
  await put('drafts/0.0.3/article/02-end.md', '# End\n\n$$\\mathbb{N}_0$$');
  await put('drafts/0.0.3/images/figure.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="15"/></svg>');
  const [doc] = await discoverDocuments(root);
  const html = await renderDocument(doc, { rootDir: root });
  assert.match(html, /lang="ru"/);
  assert.match(html, /Теория/);
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.match(html, /def R := Nat/);
  assert.match(html, /href="#section-02-end"/);
  assert.doesNotMatch(html, /https?:\/\/[^"\s]+\.(?:css|woff2)/);
});

test('fails rather than publishing missing figures or invalid math', async (t) => {
  const { root, put } = await fixture(t);
  await put('archive/0.0.2/article.md', '# Missing\n\n![Figure](images/missing.png)');
  const [doc] = await discoverDocuments(root);
  await assert.rejects(renderDocument(doc, { rootDir: root }), /missing\.png/);
  await put('archive/0.0.2/article.md', '# Bad math\n\n$\\unknownCommand{x}$');
  await assert.rejects(renderDocument(doc, { rootDir: root }), /unknownCommand/);
  await put('archive/0.0.2/article.md', '# Remote\n\n![Figure](https://example.com/image.png)');
  await assert.rejects(renderDocument(doc, { rootDir: root }), /local/i);
});

test('preserves the percent sign in scraped, double-escaped percentages', async (t) => {
  const { root, put } = await fixture(t);
  await put('archive/0.0.2/article.md', `# Percentage\n\n$100${'\\'.repeat(2)}%$`);
  const [doc] = await discoverDocuments(root);
  const html = await renderDocument(doc, { rootDir: root });
  assert.equal(html.match(/<annotation encoding="application\/x-tex">([^<]+)<\/annotation>/)?.[1], '100\\%');
});

test('rejects ambiguous duplicate versions and unknown requested versions', async (t) => {
  const { root, put } = await fixture(t);
  await put('archive/0.0.2/article.md', '# Archive');
  await assert.rejects(buildPdfs({ rootDir: root, outputDir: join(root, 'out'), versions: ['0.0.99'] }), /Unknown/);
  await put('drafts/0.0.2/article/01-start.md', '# Duplicate');
  await assert.rejects(discoverDocuments(root), /Duplicate/);
});

test('allocates numeric four-part revisions and resumes the same commit', () => {
  const releases = [
    { tag_name: '0.0.3.9', target_commitish: 'old', draft: false },
    { tag_name: '0.0.3.10', target_commitish: 'previous', draft: false },
  ];
  assert.deepEqual(planRelease('0.0.3', releases, ['0.0.3.12'], 'new'), { tag: '0.0.3.13', exists: false, published: false });
  assert.equal(planRelease('0.0.4', releases, [], 'new').tag, '0.0.4.0');
  assert.equal(planRelease('0.0.3', releases, [], 'previous').published, true);
  assert.equal(planRelease('0.0.3', [...releases, { tag_name: '0.0.3.11', target_commitish: 'new', draft: true }], [], 'new').tag, '0.0.3.11');
});

test('publishes all assets as a draft before making the complete release latest', async (t) => {
  const { root, put } = await fixture(t);
  await put('out/meta-theory-0.0.2.pdf', '%PDF-1.7\nfixture');
  await put('out/meta-theory-0.0.3.pdf', '%PDF-1.7\nfixture');
  const sha256 = createHash('sha256').update('%PDF-1.7\nfixture').digest('hex');
  const bundle = zipSync({ 'meta-theory-0.0.2.pdf': new Uint8Array(await readFile(join(root, 'out/meta-theory-0.0.2.pdf'))), 'meta-theory-0.0.3.pdf': new Uint8Array(await readFile(join(root, 'out/meta-theory-0.0.3.pdf'))) });
  const bundleHash = createHash('sha256').update(bundle).digest('hex');
  await put('out/meta-theory-pdfs.zip', bundle);
  const manifestText = JSON.stringify({ documents: [
    { version: '0.0.2', filename: 'meta-theory-0.0.2.pdf', draft: false, sha256 },
    { version: '0.0.3', filename: 'meta-theory-0.0.3.pdf', draft: true, sha256 },
  ], bundle: { filename: 'meta-theory-pdfs.zip', sha256: bundleHash } });
  await put('out/manifest.json', manifestText);
  await put('out/SHA256SUMS', `${sha256}  meta-theory-0.0.2.pdf\n${sha256}  meta-theory-0.0.3.pdf\n${bundleHash}  meta-theory-pdfs.zip\n${createHash('sha256').update(manifestText).digest('hex')}  manifest.json\n`);
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    if (args[0] === 'api') return '[]';
    return '';
  };
  await publishRelease({ outputDir: join(root, 'out'), repository: 'link-foundation/meta-theory', sha: 'a'.repeat(40), run });
  const create = calls.find((args) => args[1] === 'create');
  const upload = calls.find((args) => args[1] === 'upload');
  const edit = calls.find((args) => args[1] === 'edit');
  assert.ok(create.includes('--draft'));
  assert.ok(create.includes('0.0.3.0'));
  assert.ok(upload.some((arg) => arg.endsWith('meta-theory-0.0.2.pdf')));
  assert.ok(upload.some((arg) => arg.endsWith('meta-theory-0.0.3.pdf')));
  assert.ok(upload.some((arg) => arg.endsWith('meta-theory-pdfs.zip')));
  assert.ok(edit.includes('--draft=false'));
  assert.ok(edit.includes('--latest'));
  const notes = await readFile(join(root, 'out/release-notes.md'), 'utf8');
  assert.match(notes, /0\.0\.3.*draft/i);
  assert.match(notes, /releases\/download\/0\.0\.3\.0\/meta-theory-0\.0\.2\.pdf/);
  calls.length = 0;
  const published = await publishRelease({ outputDir: join(root, 'out'), repository: 'link-foundation/meta-theory', sha: 'a'.repeat(40), run: async (args) => {
    calls.push(args);
    return args[1].includes('/releases?') ? JSON.stringify([[{ tag_name: '0.0.3.0', target_commitish: 'a'.repeat(40), draft: false }]]) : '[]';
  } });
  assert.equal(published.published, true);
  assert.ok(calls.every((args) => args[0] === 'api'));
  calls.length = 0;
  await publishRelease({ outputDir: join(root, 'out'), repository: 'link-foundation/meta-theory', sha: 'a'.repeat(40), run: async (args) => {
    calls.push(args);
    if (args[0] === 'api') return args[1].includes('/releases?') ? JSON.stringify([[{ tag_name: '0.0.3.0', target_commitish: 'a'.repeat(40), draft: true }]]) : '[]';
    return '';
  } });
  assert.ok(!calls.some((args) => args[1] === 'create'));
  assert.ok(calls.some((args) => args[1] === 'edit'));
  calls.length = 0;
  await assert.rejects(publishRelease({ outputDir: join(root, 'out'), repository: 'link-foundation/meta-theory', sha: 'a'.repeat(40), run: async (args) => {
    calls.push(args);
    if (args[0] === 'api') return '[]';
    if (args[1] === 'upload') throw new Error('Upload failed');
    return '';
  } }), /Upload failed/);
  assert.ok(!calls.some((args) => args[1] === 'edit'));
  await put('out/meta-theory-0.0.2.pdf', '%PDF-corrupted');
  await assert.rejects(publishRelease({ outputDir: join(root, 'out'), repository: 'link-foundation/meta-theory', sha: 'a'.repeat(40), run }), /Checksum mismatch/);
});

test('real Chromium PDF retains searchable Cyrillic, links, math and multiple pages', { timeout: 90000 }, async (t) => {
  const { root, put } = await fixture(t);
  await put('archive/0.0.1/article.md', '# Теория связей\n\n[Reference](https://example.com/)\n\n$R \\to R^2$\n\n' + `$100${'\\'.repeat(2)}%$\n\n` + 'Проверка текста.\n\n'.repeat(160));
  const manifest = await buildPdfs({ rootDir: root, outputDir: join(root, 'out') });
  assert.equal(manifest.documents.length, 1);
  const bytes = await readFile(join(root, 'out/meta-theory-0.0.1.pdf'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  t.after(() => task.destroy());
  const pdf = await task.promise;
  assert.ok(pdf.numPages > 1);
  assert.ok((await pdf.getOutline()).length > 0);
  const page = await pdf.getPage(1);
  const text = (await page.getTextContent()).items.map((item) => item.str).join(' ');
  assert.match(text, /Теория связей/);
  assert.match(text, /Проверка текста/);
  assert.match(text, /100%/);
  assert.ok((await page.getAnnotations()).some((annotation) => annotation.url === 'https://example.com/'));
  const sums = await readFile(join(root, 'out/SHA256SUMS'), 'utf8');
  assert.match(sums, /^[a-f0-9]{64}  meta-theory-0\.0\.1\.pdf/m);
  const zipped = unzipSync(new Uint8Array(await readFile(join(root, 'out/meta-theory-pdfs.zip'))));
  assert.deepEqual(Object.keys(zipped), ['meta-theory-0.0.1.pdf']);
  assert.deepEqual(Buffer.from(zipped['meta-theory-0.0.1.pdf']), bytes);
});
