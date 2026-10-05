#!/usr/bin/env node

// Read the actual PDFs, independently of the HTML renderer, before publishing.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { discoverDocuments, ROOT_DIR } from './build-pdf.mjs';
import { unzipSync } from 'fflate';

const normalize = (text) => text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

export async function validatePdfs(outputDir = join(ROOT_DIR, 'dist/pdf')) {
  const manifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'));
  const expected = await discoverDocuments();
  assert.deepEqual(manifest.documents.map((doc) => doc.version), expected.map((doc) => doc.version), 'Release must include every theory version');
  const bundle = await readFile(join(outputDir, 'meta-theory-pdfs.zip'));
  assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.bundle.sha256, 'Bundle hash mismatch');
  const bundled = unzipSync(new Uint8Array(bundle));
  assert.deepEqual(Object.keys(bundled).sort(), expected.map((doc) => doc.filename).sort(), 'ZIP must include every PDF');
  const results = [];
  for (const document of expected) {
    const bytes = await readFile(join(outputDir, document.filename));
    const entry = manifest.documents.find((doc) => doc.version === document.version);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${document.filename}: hash mismatch`);
    assert.deepEqual(Buffer.from(bundled[document.filename]), bytes, 'Bundled PDF must match the individual download');
    assert.deepEqual(entry.sources, document.sources, 'All source sections must be recorded');
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      let text = '';
      let images = 0;
      let links = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        text += (await page.getTextContent()).items.map((item) => item.str).join(' ');
        images += (await page.getOperatorList()).fnArray.filter((op) => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject).length;
        links += (await page.getAnnotations()).filter((annotation) => annotation.url || annotation.dest).length;
        page.cleanup();
      }
      assert.ok(normalize(text).includes(normalize(document.title)), `${document.filename}: title is not searchable`);
      let expectedImages = 0;
      for (const source of document.sources) {
        const markdown = await readFile(join(ROOT_DIR, source), 'utf8');
        const heading = markdown.match(/^#+\s+(.+)$/m)?.[1];
        if (heading) assert.ok(normalize(text).includes(normalize(heading)), `${document.filename}: missing heading from ${source}`);
        expectedImages += [...markdown.matchAll(/!\[[^\]]*\]\(/g)].length;
        if (markdown.includes('100\\\\%')) assert.ok(text.includes('100%'), `${document.filename}: missing percent sign`);
      }
      assert.ok(images >= expectedImages, `${document.filename}: ${images}/${expectedImages} figures present`);
      assert.ok(links > 0, `${document.filename}: no clickable references`);
      if (document.draft) assert.match(text, /Draft/);
      results.push({ version: document.version, pages: pdf.numPages, figures: images, links, bytes: bytes.length, sources: document.sources.length });
    } finally { await task.destroy(); }
  }
  console.log(JSON.stringify(results, null, 2));
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await validatePdfs(process.argv[2] ? resolve(process.argv[2]) : undefined); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
