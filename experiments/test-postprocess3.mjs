#!/usr/bin/env node

const testInput = `In this example, the set $L$ contains only $2$ references to links, namely $1$ and $2$.`;

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

// Trim whitespace (FIXED version)
result = result.replace(/\$[^\S\n]+([^$\n]+?)[^\S\n]+\$/g, (match) => {
  if (match.startsWith('$$')) return match;
  console.log(`  Trim1 match: "${match}"`);
  const inner = match.slice(1, -1).trim();
  return `$${inner}$`;
});
console.log("STEP 3:", JSON.stringify(result));

result = result.replace(/\$[^\S\n]+([^$\n]+?)\$/g, (match) => {
  if (match.startsWith('$$')) return match;
  console.log(`  Trim2 match: "${match}"`);
  const inner = match.slice(1, -1).trim();
  return `$${inner}$`;
});
console.log("STEP 4:", JSON.stringify(result));

result = result.replace(/\$([^$\n]+?)[^\S\n]+\$/g, (match) => {
  if (match.startsWith('$$')) return match;
  console.log(`  Trim3 match: "${match}"`);
  const inner = match.slice(1, -1).trim();
  return `$${inner}$`;
});
console.log("STEP 5:", JSON.stringify(result));

// Also test the space-adding on problematic input:
console.log("\n--- Test 2: word$formula$ ---");
let t2 = `set $L$contains only`;
console.log("input:", JSON.stringify(t2));
t2 = t2.replace(/(\$[^$\n]+\$)([a-zA-Zа-яА-ЯёЁ])/g, '$1 $2');
console.log("after pass1:", JSON.stringify(t2));

// Test: i.e.,$formula$
console.log("\n--- Test 3: comma$formula$ ---");
let t3 = `i.e.,$L \\times L$.`;
console.log("input:", JSON.stringify(t3));
t3 = t3.replace(/(\$[^$\n]+\$)([a-zA-Zа-яА-ЯёЁ])/g, '$1 $2');
console.log("after pass1:", JSON.stringify(t3));
// $ followed by space should be trimmed
t3 = t3.replace(/\$[^\S\n]+([^$\n]+?)\$/g, (match) => {
  console.log(`  trim match: "${match}"`);
  return `$${match.slice(1, -1).trim()}$`;
});
console.log("after trim:", JSON.stringify(t3));
