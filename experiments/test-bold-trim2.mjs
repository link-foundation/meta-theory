const input = '**Figure 11. **In this image you can see';
const regex = /\*\*(.+?)\*\*/g;

let match;
while ((match = regex.exec(input)) !== null) {
  console.log('Match:', JSON.stringify(match[0]));
  console.log('Inner:', JSON.stringify(match[1]));
  console.log('Trimmed:', JSON.stringify(match[1].trim()));
  console.log('Index:', match.index);
}

// Now test the replacement
const result = input.replace(/\*\*(.+?)\*\*/g, (match, inner) => {
  console.log('\nReplace callback:');
  console.log('  match:', JSON.stringify(match));
  console.log('  inner:', JSON.stringify(inner));
  console.log('  trimmed:', JSON.stringify(inner.trim()));
  return `**${inner.trim()}**`;
});
console.log('\nResult:', result);
