// Test the bold trim logic directly
const testCases = [
  '**Figure 11. **In this image you can see',
  '**Figure 12. **Link blueprint designer',
  'of length**n** (or an n-dimensional',
  'of length** n** (or an n-dimensional',
];

function postProcess(result) {
  // Remove empty bold markers
  result = result.replace(/(\S)\*\*[^\S\n]*\*\*(\S)/g, '$1 $2');
  result = result.replace(/\*\*[^\S\n]*\*\*/g, '');

  // Fix bold marker spacing using paired matching
  result = result.replace(/\*\*(.+?)\*\*/g, (match, inner) => {
    return `**${inner.trim()}**`;
  });
  // Ensure space before opening ** when preceded by word character
  result = result.replace(/([a-zA-Zа-яА-ЯёЁ0-9).])\*\*([^\s*])/g, '$1 **$2');
  // Ensure space after closing ** when followed by word character
  result = result.replace(/([^\s*])\*\*([a-zA-Zа-яА-ЯёЁ\[(])/g, '$1** $2');

  return result;
}

for (const tc of testCases) {
  console.log('Input: ', tc);
  console.log('Output:', postProcess(tc));
  console.log('---');
}
