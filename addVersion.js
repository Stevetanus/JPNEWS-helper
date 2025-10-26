// node addVersion.js [newVersion]
const fs = require('fs');
const path = require('path');

// file paths
const manifestPath = path.join(__dirname, 'manifest.json');
const popupPath = path.join(__dirname, 'popup.html');

const newVersion = process.argv[2] || '0.1.7';

// 1. update manifest.json
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
manifest.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`✅ manifest.json updated to version ${newVersion}`);

// 2. update popup.html
let popupHtml = fs.readFileSync(popupPath, 'utf-8');
popupHtml = popupHtml.replace(
  /(<span id="version">)(.*?)(<\/span>)/,
  `$1${newVersion}$3`
);

fs.writeFileSync(popupPath, popupHtml, 'utf-8');
console.log(`✅ popup.html updated with version ${newVersion}`);
console.log('All done!');
