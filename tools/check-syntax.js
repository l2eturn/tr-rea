// Parses every source file and reports syntax errors. No dependencies.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dirs = ['src/shared', 'src/server', 'src/client', 'src', 'tools', 'tests'];

let failed = 0;
let checked = 0;

for (const dir of dirs) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const name of fs.readdirSync(full)) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(full, name);
    if (!fs.statSync(file).isFile()) continue;
    checked++;
    try {
      new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    } catch (e) {
      failed++;
      console.error('SYNTAX ' + path.relative(root, file) + ': ' + e.message);
    }
  }
}

console.log(`checked ${checked} files, ${failed} with errors`);
process.exit(failed ? 1 : 0);
