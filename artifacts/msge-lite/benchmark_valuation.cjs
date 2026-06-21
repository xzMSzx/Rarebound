const fs = require('fs');

function setup() {
  const collectionValuationSrc = fs.readFileSync('data/collectionValuation.js', 'utf8');
  fs.writeFileSync('data/collectionValuation_orig.js', collectionValuationSrc);
}

setup();
