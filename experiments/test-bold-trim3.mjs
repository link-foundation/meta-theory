const input = '**Figure 11.**In this image you can see';
console.log('Input:', input);

// Step 1: Trim inside bold
let result = input.replace(/\*\*(.+?)\*\*/g, (match, inner) => `**${inner.trim()}**`);
console.log('After trim:', result);

// Step 2: Space before opening **
result = result.replace(/([a-zA-Zа-яА-ЯёЁ0-9).])\*\*([^\s*])/g, '$1 **$2');
console.log('After space-before:', result);

// Step 3: Space after closing **
result = result.replace(/([^\s*])\*\*([a-zA-Zа-яА-ЯёЁ\[(])/g, '$1** $2');
console.log('After space-after:', result);
