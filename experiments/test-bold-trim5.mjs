const testCases = [
  { input: '**Figure 11.**In this image you can see', expected: '**Figure 11.** In this image you can see' },
  { input: '**Figure 12. **Link blueprint designer', expected: '**Figure 12.** Link blueprint designer' },
  { input: 'of length**n** (or an n-dimensional', expected: 'of length **n** (or an n-dimensional' },
  { input: 'of length** n** (or an n-dimensional', expected: 'of length **n** (or an n-dimensional' },
  { input: '**Author:** [text]', expected: '**Author:** [text]' },
  { input: '**Bold text** normal text **more bold**', expected: '**Bold text** normal text **more bold**' },
  { input: 'word**bold**word', expected: 'word **bold** word' },
  { input: '**Tags:** metatheory, links', expected: '**Tags:** metatheory, links' },
  { input: '**R** denotes a relation', expected: '**R** denotes a relation' },
  { input: 'relation**R**, which is', expected: 'relation **R**, which is' },
];

function fixBold(line) {
  const parts = [];
  let lastIndex = 0;
  const boldRegex = /\*\*(.+?)\*\*/g;
  let m;
  while ((m = boldRegex.exec(line)) !== null) {
    parts.push({ type: 'text', content: line.substring(lastIndex, m.index) });
    parts.push({ type: 'bold', content: m[1].trim() });
    lastIndex = m.index + m[0].length;
  }
  parts.push({ type: 'text', content: line.substring(lastIndex) });

  if (parts.filter(p => p.type === 'bold').length === 0) return line;

  let rebuilt = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'bold') {
      if (!part.content) continue;
      if (rebuilt.length > 0 && /[a-zA-Zа-яА-ЯёЁ0-9).]$/.test(rebuilt)) {
        rebuilt += ' ';
      }
      rebuilt += `**${part.content}**`;
      const nextPart = parts[i + 1];
      if (nextPart && nextPart.content && /^[a-zA-Zа-яА-ЯёЁ\[(]/.test(nextPart.content)) {
        rebuilt += ' ';
      }
    } else {
      rebuilt += part.content;
    }
  }
  return rebuilt;
}

function postProcess(result) {
  result = result.replace(/(\S)\*\*[^\S\n]*\*\*(\S)/g, '$1 $2');
  result = result.replace(/\*\*[^\S\n]*\*\*/g, '');
  result = result.split('\n').map(fixBold).join('\n');
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
