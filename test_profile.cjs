const fs = require('fs');

const ps = fs.readFileSync('artifacts/msge-lite/data/profileStorage.js', 'utf8');
console.log(ps);
