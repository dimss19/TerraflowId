const fs = require('fs');

const files = [
  'd:/laragon/www/Terraflow/compile_commands.json',
  'd:/laragon/www/Terraflow/firmware/compile_commands.json'
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/-mlongcalls/g, '-mlong-calls -D__XTENSA__=1');
  content = content.replace(/-fstrict-volatile-bitfields/g, '');
  content = content.replace(/-fno-tree-switch-conversion/g, '');
  content = content.replace(/-freorder-blocks/g, '');
  content = content.replace(/-fno-jump-tables/g, '');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Sanitized compile_commands.json: ' + filePath);
});
