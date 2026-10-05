#!/usr/bin/env node

// Publish a complete PDF set. CI serializes this operation on main.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
const runGh = async (args) => (await exec('gh', args, { maxBuffer: 16 * 1024 * 1024 })).stdout;

export function planRelease(version, releases, tags, sha) {
  if (!/^0\.0\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Invalid theory version: ${version}`);
  const matching = releases.filter((release) => release.tag_name.startsWith(`${version}.`) && /^0\.0\.\d+\.\d+$/.test(release.tag_name));
  const existing = matching.find((release) => release.target_commitish === sha);
  if (existing) return { tag: existing.tag_name, exists: true, published: !existing.draft };
  const revisions = [...tags, ...matching.map((release) => release.tag_name)]
    .filter((tag) => tag.startsWith(`${version}.`) && /^0\.0\.\d+\.\d+$/.test(tag))
    .map((tag) => Number(tag.split('.')[3]));
  return { tag: `${version}.${Math.max(-1, ...revisions) + 1}`, exists: false, published: false };
}

export async function publishRelease({ outputDir = 'dist/pdf', repository = process.env.GITHUB_REPOSITORY, sha = process.env.GITHUB_SHA, run = runGh, dryRun = false } = {}) {
  if (!repository || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) throw new Error('A GitHub owner/repository is required');
  if (!sha || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full source commit SHA is required');
  const manifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'));
  if (manifest.sourceCommit && manifest.sourceCommit !== sha) throw new Error('PDF manifest does not match the release commit');
  if (!manifest.documents?.length) throw new Error('No PDFs in manifest');
  const documents = [...manifest.documents].sort((a, b) => a.version.localeCompare(b.version, 'en', { numeric: true }));
  const filenames = documents.map((doc) => doc.filename);
  if (new Set(filenames).size !== filenames.length || documents.some((doc) => doc.filename !== `meta-theory-${doc.version}.pdf` || !/^0\.0\.\d+$/.test(doc.version))) throw new Error('Invalid or duplicate PDF asset names');
  if (manifest.bundle?.filename !== 'meta-theory-pdfs.zip') throw new Error('Missing PDF bundle');
  const checksumLines = (await readFile(join(outputDir, 'SHA256SUMS'), 'utf8')).trim().split('\n');
  const checksums = new Map(checksumLines.map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (meta-theory-0\.0\.\d+\.pdf|meta-theory-pdfs\.zip|manifest\.json)$/);
    if (!match) throw new Error(`Invalid checksum entry: ${line}`);
    return [match[2], match[1]];
  }));
  for (const filename of [...filenames, manifest.bundle.filename, 'manifest.json']) {
    const bytes = await readFile(join(outputDir, filename));
    if (filename.endsWith('.pdf') && bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error(`Invalid PDF: ${filename}`);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (checksums.get(filename) !== actual) throw new Error(`Checksum mismatch: ${filename}`);
    const document = documents.find((doc) => doc.filename === filename);
    if (document && document.sha256 !== actual) throw new Error(`Manifest hash mismatch: ${filename}`);
    if (filename === manifest.bundle.filename && manifest.bundle.sha256 !== actual) throw new Error('Bundle hash mismatch');
  }
  const releases = JSON.parse(await run(['api', `repos/${repository}/releases?per_page=100`, '--paginate', '--slurp'])).flat();
  const tags = JSON.parse(await run(['api', `repos/${repository}/tags?per_page=100`, '--paginate', '--slurp'])).flat().map((tag) => tag.name);
  const plan = planRelease(documents.at(-1).version, releases, tags, sha);
  if (plan.published) {
    console.log(`PDF release ${plan.tag} already published for ${sha}; no changes needed.`);
    return plan;
  }
  const notes = [
    `Printable PDFs built from Markdown at [${sha.slice(0, 7)}](https://github.com/${repository}/commit/${sha}).`,
    '',
    `[Download all PDFs in one ZIP](https://github.com/${repository}/releases/download/${plan.tag}/meta-theory-pdfs.zip).`,
    '',
    `Release format: \`0.0.x.r\`; \`x\` is the highest included theory version and \`r\` is its publication revision, starting at 0. Each release contains **all theory versions**. Draft PDFs are labeled inside the document.`,
    '',
    '| Theory | Status | Download |', '| --- | --- | --- |',
    ...documents.map((doc) => `| ${doc.version} | ${doc.draft ? 'Draft' : 'Archived article'} | [PDF](https://github.com/${repository}/releases/download/${plan.tag}/${doc.filename}) |`),
    '',
    'Download every PDF from the assets below. `manifest.json` records the source files and PDF hashes; verify downloads with `sha256sum -c SHA256SUMS`.',
    '',
  ].join('\n');
  const notesPath = join(outputDir, 'release-notes.md');
  await writeFile(notesPath, notes);
  if (dryRun) { console.log(`Would publish ${plan.tag} with ${filenames.join(', ')}`); return plan; }
  if (!plan.exists) await run(['release', 'create', plan.tag, '--repo', repository, '--target', sha, '--draft', '--title', `Meta-theory PDFs ${plan.tag}`, '--notes-file', notesPath]);
  // Upload before publication so /releases/latest never points at a partial set.
  await run(['release', 'upload', plan.tag, ...[...filenames, manifest.bundle.filename, 'manifest.json', 'SHA256SUMS'].map((name) => join(outputDir, name)), '--repo', repository, '--clobber']);
  await run(['release', 'edit', plan.tag, '--repo', repository, '--draft=false', '--latest', '--title', `Meta-theory PDFs ${plan.tag}`, '--notes-file', notesPath]);
  console.log(`Published https://github.com/${repository}/releases/tag/${plan.tag}`);
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--dry-run')) throw new Error('Usage: node scripts/release-pdfs.mjs [--dry-run]');
    if (!args.includes('--dry-run') && process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('PDF publication is restricted to the main branch');
    const latest = (await runGh(['api', `repos/${process.env.GITHUB_REPOSITORY}/commits/main`, '--jq', '.sha'])).trim();
    if (latest !== process.env.GITHUB_SHA) console.log('A newer main commit exists; its workflow will publish the current PDFs.');
    else await publishRelease({ dryRun: args.includes('--dry-run') });
  } catch (error) { console.error(error); process.exitCode = 1; }
}
