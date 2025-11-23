// node moveFiles.js [destFolderName]
const fs = require('fs');
const path = require('path');
const desktopDir = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'Desktop'
);

// 專案根目錄
const srcDir = __dirname;
const destDir = process.argv[2] || 'jpnews_extension_test';
const destDirDesktop = path.join(desktopDir, destDir);

// 要移動的項目
const itemsToMove = ['dist', 'manifest.json', 'popup.html', 'icons'];

// 確保目標資料夾存在
if (!fs.existsSync(destDirDesktop)) {
  fs.mkdirSync(destDirDesktop, { recursive: true });
  console.log(`📁 Created folder: ${destDirDesktop}`);
}

// 遞迴複製函式
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 主邏輯
for (const item of itemsToMove) {
  const srcPath = path.join(srcDir, item);
  const destPath = path.join(destDirDesktop, item);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️ Skip: ${item} (not found)`);
    continue;
  }

  console.log(`📦 Moving: ${item} → ${destPath}`);

  // 如果目標已存在，先刪掉舊的
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }

  copyRecursive(srcPath, destPath);
  if (item === 'manifest.json') {
    const manifest = JSON.parse(fs.readFileSync(destPath, 'utf-8'));
    manifest.name = 'JP News Helper';
    fs.writeFileSync(destPath, JSON.stringify(manifest, null, 2));
    console.log(`✏️  Remove "TEST" in ${item}`);
  }
}

console.log('✅ All files moved successfully!');
