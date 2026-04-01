const testCases = [
  { input: '**Figure 11.**In this image you can see', expected: '**Figure 11.** In this image you can see' },
  { input: '**Figure 12. **Link blueprint designer', expected: '**Figure 12.** Link blueprint designer' },
  { input: 'of length**n** (or an n-dimensional', expected: 'of length **n** (or an n-dimensional' },
  { input: 'of length** n** (or an n-dimensional', expected: 'of length **n** (or an n-dimensional' },
  { input: '**Author:** [text]', expected: '**Author:** [text]' },
  { input: '**Bold text** normal text **more bold**', expected: '**Bold text** normal text **more bold**' },
  { input: 'word**bold**word', expected: 'word **bold** word' },
  { input: '**Tags:** metatheory, links', expected: '**Tags:** metatheory, links' },
];

function postProcess(result) {
  // 1. Remove empty bold markers
  result = result.replace(/(\S)\*\*[^\S\n]*\*\*(\S)/g, '$1 $2');
  result = result.replace(/\*\*[^\S\n]*\*\*/g, '');

  // 2. First pass: trim whitespace inside bold pairs
  result = result.replace(/\*\*(.+?)\*\*/g, (match, inner) => `**${inner.trim()}**`);

  // Second pass: space after closing **
  result = result.replace(/\*\*([a-zA-Zа-яА-ЯёЁ\[(])/g, (match, after, offset, str) => {
    if (offset >= 2) {
      const charBefore = str[offset - 1];
      if (charBefore !== '*' && charBefore !== ' ' && charBefore !== '\n') {
        return `** ${after}`;
      }
    }
    return match;
  });

  // Third pass: space before opening **
  result = result.replace(/([a-zA-Zа-яА-ЯёЁ0-9).])\*\*([^\s*])/g, (match, before, after, offset, str) => {
    const rest = str.substring(offset + match.length - 1);
    if (rest.includes('**')) {
      return `${before} **${after}`;
    }
    return match;
  });

  return result;
}

let allPassed = true;
for (const tc of testCases) {
  const result = postProcess(tc.input);
  const status = result === tc.expected ? '✅' : '❌';
  if (result !== tc.expected) allPassed = false;
  console.log(`${status} Input:    "${tc.input}"`);
  if (result !== tc.expected) {
    console.log(`   Expected: "${tc.expected}"`);
    console.log(`   Got:      "${result}"`);
  } else {
    console.log(`   Output:   "${result}"`);
  }
}
console.log(allPassed ? '\n✅ All tests passed!' : '\n❌ Some tests failed!');
