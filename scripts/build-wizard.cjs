const electronInstaller = require('electron-winstaller');
const path = require('path');

async function build() {
  console.log('--- Generăm StudyX Premium Wizard (Setup.exe) ---');
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: path.join(__dirname, '../release/StudyX-win32-x64'),
      outputDirectory: path.join(__dirname, '../release/wizard'),
      authors: 'StudyX',
      exe: 'StudyX.exe',
      setupExe: 'StudyX-Setup-Premium.exe',
      noMsi: true,
      title: 'StudyX Medical'
    });
    console.log('✅ Wizard-ul a fost generat cu succes!');
  } catch (e) {
    console.error(`❌ Eroare la generarea Wizard-ului: ${e.message}`);
  }
}

build();
