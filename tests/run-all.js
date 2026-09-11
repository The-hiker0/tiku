#!/usr/bin/env node
/**
 * 依次运行全部测试，汇总结果。
 * 依赖：jsdom（npm install）。部分用例会调用 g++ 编译内置题解，无编译器时自动跳过。
 */
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  ['解析器 · 从链接导入', 'test-import.js'],
  ['端到端 · 导入流程',   'test-e2e.js'],
  ['回归 · 高亮/合并/编译', 'test-regress.js'],
  ['云端 · 同步与分享链接', 'test-cloud.js'],
];

let failed = 0;
const results = [];
for (const [name, file] of suites) {
  process.stdout.write(`\n${'─'.repeat(60)}\n▶ ${name}\n${'─'.repeat(60)}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push([name, ok]);
}

console.log(`\n${'═'.repeat(60)}\n汇总\n${'═'.repeat(60)}`);
for (const [name, ok] of results) console.log(`  ${ok ? '✅' : '❌'}  ${name}`);
console.log(`\n${results.length - failed} / ${results.length} 组通过`);
process.exit(failed ? 1 : 0);
