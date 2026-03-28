#!/usr/bin/env node
/**
 * Test post-processing of markdown to debug formula issues
 */

// Simulate the postProcessMarkdown function from download-article.mjs
function postProcessMarkdown(markdown) {
  let result = markdown;

  result = result.replace(/['']/g, "'");
  result = result.replace(/[""]/g, '"');
  result = result.replace(/—/g, ' — ');
  result = result.replace(/–/g, '-');
  result = result.replace(/…/g, '...');

  // Pass 1: Add space after formula when followed by word character
  result = result.replace(/(\$[^$\n]+\$)([a-zA-Zа-яА-ЯёЁ])/g, (match, formula, nextChar) => {
    return formula + ' ' + nextChar;
  });

  // Pass 2: Add space before formula when preceded by word character
  result = result.replace(/([a-zA-Zа-яА-ЯёЁ])(\$[^$\n]+\$)/g, (match, prevChar, formula) => {
    return prevChar + ' ' + formula;
  });

  // Fix multiple inline formulas on the same line
  result = result.replace(/(\$[^$\n]+\$)\$([^$\n]+\$)/g, (match, formula1, formula2) => {
    return formula1 + '\n\n$' + formula2;
  });

  // Trim whitespace inside formula delimiters
  result = result.replace(/\$\s+([^$\n]+?)\s+\$/g, (match) => {
    const inner = match.slice(1, -1).trim();
    return `$${inner}$`;
  });
  result = result.replace(/\$\s+([^$\n]+?)\$/g, (match) => {
    const inner = match.slice(1, -1).trim();
    return `$${inner}$`;
  });
  result = result.replace(/\$([^$\n]+?)\s+\$/g, (match) => {
    if (match.startsWith('$$')) return match;
    const inner = match.slice(1, -1).trim();
    return `$${inner}$`;
  });

  result = result.replace(/([^\n`])  +/g, (match, char) => {
    return char + ' ';
  });

  result = result.replace(/\s+—\s+/g, ' — ');
  result = result.replace(/^\$\s*$/gm, '');

  return result;
}

// Test case: blockquote-math elements
const testInput = `**Example**:

> $$1 \\to (1, 1)$$

> $$2 \\to (2, 2)$$

> $$\\mathbf{3 \\to (1, 2)}$$

![Figure 6](images/figure-6.png)`;

console.log("=== INPUT ===");
console.log(testInput);
console.log("\n=== OUTPUT ===");
console.log(postProcessMarkdown(testInput));

// Test case 2: inline formulas with spacing
const testInput2 = `In this example, the set $L$ contains only $2$ references to links, namely $1$ and $2$.`;
console.log("\n=== INPUT 2 ===");
console.log(testInput2);
console.log("\n=== OUTPUT 2 ===");
console.log(postProcessMarkdown(testInput2));

// Test case 3: formula with leading space
const testInput3 = `of $L $ with itself is used, i.e.,$ L \\times L$.`;
console.log("\n=== INPUT 3 ===");
console.log(testInput3);
console.log("\n=== OUTPUT 3 ===");
console.log(postProcessMarkdown(testInput3));
