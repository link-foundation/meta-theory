#!/usr/bin/env node
/**
 * Step-by-step tracing of post-processing
 */

const testInput = `> $$1 \\to (1, 1)$$

> $$2 \\to (2, 2)$$

> $$\\mathbf{3 \\to (1, 2)}$$`;

let result = testInput;
console.log("STEP 0:", JSON.stringify(result));

// Pass 1: Add space after formula
result = result.replace(/(\$[^$\n]+\$)([a-zA-Zа-яА-ЯёЁ])/g, (match, formula, nextChar) => {
  console.log(`  Pass1 match: "${match}"`);
  return formula + ' ' + nextChar;
});
console.log("STEP 1:", JSON.stringify(result));

// Pass 2: Add space before formula
result = result.replace(/([a-zA-Zа-яА-ЯёЁ])(\$[^$\n]+\$)/g, (match, prevChar, formula) => {
  console.log(`  Pass2 match: "${match}"`);
  return prevChar + ' ' + formula;
});
console.log("STEP 2:", JSON.stringify(result));

// Fix multiple inline formulas
result = result.replace(/(\$[^$\n]+\$)\$([^$\n]+\$)/g, (match, formula1, formula2) => {
  console.log(`  Concat match: "${match}" -> f1="${formula1}", f2="$${formula2}"`);
  return formula1 + '\n\n$' + formula2;
});
console.log("STEP 3:", JSON.stringify(result));

// Trim whitespace inside formula delimiters
result = result.replace(/\$\s+([^$\n]+?)\s+\$/g, (match) => {
  console.log(`  Trim1 match: "${match}"`);
  const inner = match.slice(1, -1).trim();
  return `$${inner}$`;
});
console.log("STEP 4:", JSON.stringify(result));

result = result.replace(/\$\s+([^$\n]+?)\$/g, (match) => {
  console.log(`  Trim2 match: "${match}"`);
  const inner = match.slice(1, -1).trim();
  return `$${inner}$`;
});
console.log("STEP 5:", JSON.stringify(result));

result = result.replace(/\$([^$\n]+?)\s+\$/g, (match) => {
  if (match.startsWith('$$')) { console.log(`  Trim3 SKIP: "${match}"`); return match; }
  console.log(`  Trim3 match: "${match}"`);
  const inner = match.slice(1, -1).trim();
  return `$${inner}$`;
});
console.log("STEP 6:", JSON.stringify(result));

// Fix double spaces
result = result.replace(/([^\n`])  +/g, (match, char) => {
  console.log(`  DblSpace match: "${match}"`);
  return char + ' ';
});
console.log("STEP 7:", JSON.stringify(result));

// Clean up extra spaces around em-dashes
result = result.replace(/\s+—\s+/g, ' — ');
console.log("STEP 8:", JSON.stringify(result));

// Fix stray standalone $
result = result.replace(/^\$\s*$/gm, (match) => {
  console.log(`  Stray$ match: "${match}"`);
  return '';
});
console.log("STEP 9:", JSON.stringify(result));
