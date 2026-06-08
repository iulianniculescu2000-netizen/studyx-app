'use strict';

const fs = require('fs');
const path = require('path');
const rcedit = require('rcedit');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.appDir || context.packager?.projectDir || path.join(__dirname, '..');
  const appOutDir = context.appOutDir;
  const executableName = context.packager?.executableName || context.packager?.appInfo?.productFilename || 'StudyX';
  const exePath = path.join(appOutDir, `${executableName}.exe`);
  const iconPath = path.join(projectDir, 'public', 'icon.ico');
  const version = context.packager?.appInfo?.version || '1.0.0';
  const productName = context.packager?.appInfo?.productName || executableName;

  if (!fs.existsSync(exePath)) {
    throw new Error(`afterPack: executable not found at ${exePath}`);
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`afterPack: icon not found at ${iconPath}`);
  }

  await rcedit(exePath, {
    icon: iconPath,
    'file-version': version,
    'product-version': version,
    'version-string': {
      CompanyName: 'StudyX',
      FileDescription: productName,
      ProductName: productName,
      InternalName: executableName,
      OriginalFilename: `${executableName}.exe`,
    },
  });
};
