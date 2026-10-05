// Render the released-format PDF itself for visual review, using PDF.js.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

await mkdir('docs/case-studies/issue-59/screenshots', { recursive: true });
for (const [version, pages] of [['0.0.2', [1]], ['0.0.3', [1, 3]]]) {
  const task = getDocument({ data: new Uint8Array(await readFile(`dist/pdf/meta-theory-${version}.pdf`)), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    for (const number of pages) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const path = `docs/case-studies/issue-59/screenshots/${version}-page-${number}.png`;
      await writeFile(path, canvas.toBuffer('image/png'));
      console.log(path);
    }
  } finally { await task.destroy(); }
}
