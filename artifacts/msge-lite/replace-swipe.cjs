const fs = require('fs');

let js = fs.readFileSync('artifacts/msge-lite/ui/swipeController.js', 'utf8');
js = js.replace(
  /export function attachSwipeController\(element, \{ onSwipeLeft, onTap \} \) \{/,
  'export function attachSwipeController(element, { onSwipeLeft, onTap }) {'
);
js = js.replace(
  /onSwipeLeft\?\.\(\);/,
  `const direction = dx < 0 ? 'left' : 'right';\n      onSwipeLeft?.(direction);`
);

fs.writeFileSync('artifacts/msge-lite/ui/swipeController.js', js);
console.log('SwipeController updated');
