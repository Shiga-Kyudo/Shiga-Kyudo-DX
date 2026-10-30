const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
if (!scripts.length) throw new Error('Script not found');
for (const [index, match] of scripts.entries()) {
  new vm.Script(match[1], { filename: `index.html script ${index + 1}` });
}
console.log(`JavaScript構文チェック成功: ${scripts.length}個（実行・外部通信なし）`);
new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'feedback.js'), 'utf8'), { filename: 'feedback.js' });
console.log('feedback.js 構文チェック成功');
new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'late-join.js'), 'utf8'), { filename: 'late-join.js' });
console.log('late-join.js 構文チェック成功');
