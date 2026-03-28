#!/usr/bin/env node
/**
 * Test the fixed post-processing
 */

// Import the actual function by running the script logic
function postProcessMarkdown(markdown) {
  let result = markdown;

  result = result.replace(/['']/g, "'");
  result = result.replace(/[""]/g, '"');
  result = result.replace(/—/g, ' — ');
  result = result.replace(/–/g, '-');
  result = result.replace(/…/g, '...');

  // Token-based formula processing
  result = result.split('\n').map(line => {
    const trimmedLine = line.replace(/^>\s*/, '');
    if (trimmedLine.startsWith('$$') && trimmedLine.endsWith('$$')) return line;

    const formulas = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
        if (line[i + 1] === '$') { i += 2; continue; }
        const start = i;
        i++;
        while (i < line.length && (line[i] !== '$' || line[i - 1] === '\\')) { i++; }
        if (i < line.length) {
          formulas.push({ start, end: i });
          i++;
        }
      } else {
        i++;
      }
    }

    if (formulas.length === 0) return line;

    let fixed = '';
    let pos = 0;
    for (const f of formulas) {
      fixed += line.substring(pos, f.start);
      const rawInner = line.substring(f.start + 1, f.end);
      const inner = rawInner.trim();
      if (fixed.length > 0 && /[a-zA-Zа-яА-ЯёЁ,]$/.test(fixed)) {
        fixed += ' ';
      }
      fixed += `$${inner}$`;
      const afterPos = f.end + 1;
      if (afterPos < line.length && /^[a-zA-Zа-яА-ЯёЁ]/.test(line[afterPos])) {
        fixed += ' ';
      }
      pos = f.end + 1;
    }
    fixed += line.substring(pos);
    return fixed;
  }).join('\n');

  result = result.replace(/([^\n`])  +/g, (match, char) => char + ' ');
  result = result.replace(/\s+—\s+/g, ' — ');
  result = result.replace(/^\$\s*$/gm, '');

  return result;
}

// Test cases
const tests = [
  {
    name: "Blockquote formulas should stay separate",
    input: `> $$1 \\to (1, 1)$$\n\n> $$2 \\to (2, 2)$$\n\n> $$\\mathbf{3 \\to (1, 2)}$$`,
    expected: `> $$1 \\to (1, 1)$$\n\n> $$2 \\to (2, 2)$$\n\n> $$\\mathbf{3 \\to (1, 2)}$$`
  },
  {
    name: "Inline formulas should have spaces",
    input: `In this example, the set $L$ contains only $2$ references to links.`,
    expected: `In this example, the set $L$ contains only $2$ references to links.`
  },
  {
    name: "Formula with trailing space should be trimmed",
    input: `the set $L $ with itself`,
    expected: `the set $L$ with itself`
  },
  {
    name: "Formula with leading space should be trimmed",
    input: `i.e.,$ L \\times L$.`,
    expected: `i.e., $L \\times L$.`
  },
  {
    name: "Formula adjacent to word should get space",
    input: `expression$\\mathbf{S_n}$ represents the`,
    expected: `expression $\\mathbf{S_n}$ represents the`
  },
  {
    name: "Formula after comma should not add extra space",
    input: `of $L$ with itself is used, i.e.,$L \\times L$.`,
    expected: `of $L$ with itself is used, i.e., $L \\times L$.`
  },
  {
    name: "Multiple formulas in line",
    input: `namely $1$ and $2$. In other words, $2$ links.`,
    expected: `namely $1$ and $2$. In other words, $2$ links.`
  }
];

let passed = 0;
for (const t of tests) {
  const result = postProcessMarkdown(t.input);
  const ok = result === t.expected;
  console.log(`${ok ? '✅' : '❌'} ${t.name}`);
  if (!ok) {
    console.log(`  input:    ${JSON.stringify(t.input)}`);
    console.log(`  expected: ${JSON.stringify(t.expected)}`);
    console.log(`  got:      ${JSON.stringify(result)}`);
  }
  if (ok) passed++;
}
console.log(`\n${passed}/${tests.length} tests passed`);
