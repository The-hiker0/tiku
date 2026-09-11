const path=require('path');
const APP=path.join(__dirname,'..','index.html');
const FIXTURE=path.join(__dirname,'fixtures','luogu-p1001.html');
const fs=require('fs');
const { JSDOM } = require('jsdom');

const html=fs.readFileSync(APP,'utf8');
const dom=new JSDOM(html,{ runScripts:'dangerously', url:'https://local.test/', pretendToBeVisual:true });
const W=dom.window;
let pass=0,fail=0;
const ck=(l,g,w)=>{ const ok=JSON.stringify(g)===JSON.stringify(w); ok?pass++:fail++;
  console.log((ok?'✅':'❌')+' '+l+(ok?'':'  → '+JSON.stringify(g)+'  (期望 '+JSON.stringify(w)+')')); };
const show=(label,p)=>{ if(!p){console.log('   '+label+': (null)');return;}
  console.log(`   ${label}: title="${p.title}" src="${p.source}" tl="${p.tl}" ml="${p.ml}" diff=${p.diff} 样例=${p.samples.length} desc=${p.desc.length}字 input=${p.input.length}字 output=${p.output.length}字 hint=${p.hint.length}字`); };

console.log('【页面在 jsdom 中初始化】');
ck('脚本无异常执行', typeof W.parseAny, 'function');
ck('题库已渲染', W.eval('DB.problems.length') > 0, true);

/* ================= 1. 洛谷：真实页面快照 ================= */
console.log('\n【洛谷 · 真实页面快照（43934 字节，非构造数据）】');
const lgHtml=fs.readFileSync(FIXTURE,'utf8');
const lg=W.parseLuogu(lgHtml,'https://www.luogu.com.cn/problem/P1001');
show('P1001', lg);
ck('识别题号+标题', lg.title, 'P1001 A+B Problem');
ck('来源', lg.source, '洛谷 P1001');
ck('难度 1(入门)→索引 0', lg.diff, 0);
ck('时间限制 1000ms→1s', lg.tl, '1s');
ck('内存 524288KB→512MB', lg.ml, '512MB');
ck('样例组数', lg.samples.length, 1);
ck('样例输入', lg.samples[0].i, '20 30');
ck('样例输出', lg.samples[0].o, '50');
ck('LaTeX 公式保留', /\$-?\{?10\}?\^9/.test(lg.hint) || lg.hint.includes('$'), true);
ck('描述含公式', lg.desc.includes('$a,b$'), true);
ck('输入格式非空', lg.input.length > 0, true);
ck('标签为数字ID待映射', Array.isArray(lg._luoguTags), true);
console.log('   hint 片段:', JSON.stringify(lg.hint.slice(0,70)));

/* ================= 2. 洛谷：难度映射全档 ================= */
console.log('\n【难度映射 difficulty-1】');
const mk=(d)=>{ const j={data:{problem:{pid:'P1',name:'X',difficulty:d,content:{description:'d'},
  samples:[['1','1']],limits:{time:[1000],memory:[262144]}}}};
  return W.parseLuogu('<script type="application/json">'+JSON.stringify(j)+'</script>','https://www.luogu.com.cn/problem/P1'); };
ck('difficulty=1 → 0(入门)', mk(1).diff, 0);
ck('difficulty=2 → 1(普及−)', mk(2).diff, 1);
ck('difficulty=4 → 3(普及+/提高)', mk(4).diff, 3);
ck('difficulty=5 → 4(提高+/省选−)', mk(5).diff, 4);
ck('difficulty=7 → 6(NOI/CTSC)', mk(7).diff, 6);
ck('difficulty=0(暂无评定) → 夹到 0', mk(0).diff, 0);
ck('difficulty=99 越界 → 夹到 6', mk(99).diff, 6);

/* ================= 3. Codeforces ================= */
console.log('\n【Codeforces · 真实结构】');
const cfHtml=`<html><head><title>Problem - 1A - Codeforces</title></head><body>
<div class="problem-statement">
 <div class="header">
   <div class="title">A. Theatre Square</div>
   <div class="time-limit">time limit per test: 1 second</div>
   <div class="memory-limit">memory limit per test: 256 megabytes</div>
   <div class="input-file">input: standard input</div>
   <div class="output-file">output: standard output</div>
 </div>
 <div><p>Theatre Square in the capital city of Berland has a rectangular shape with the size <span class="tex-span">n × m</span> meters.</p></div>
 <div class="input-specification"><div class="section-title">Input</div><p>The input contains three positive integer numbers.</p></div>
 <div class="output-specification"><div class="section-title">Output</div><p>Write the required minimum number of flagstones.</p></div>
 <div class="sample-tests"><div class="section-title">Examples</div>
   <div class="sample-test">
     <div class="input"><div class="title">Input</div><pre>6 6 4
</pre></div>
     <div class="output"><div class="title">Output</div><pre>4
</pre></div>
   </div>
   <div class="sample-test">
     <div class="input"><div class="title">Input</div><pre>1 1 1
</pre></div>
     <div class="output"><div class="title">Output</div><pre>1
</pre></div>
   </div>
 </div>
 <div class="note"><div class="section-title">Note</div><p>The first test case is explained below.</p></div>
</div></body></html>`;
const cf=W.parseCodeforces(cfHtml,'https://codeforces.com/problemset/problem/1/A');
show('CF 1A', cf);
ck('标题去掉站点后缀', cf.title, 'A. Theatre Square');
ck('时间 1 second→1s', cf.tl, '1s');
ck('内存 256 megabytes→256MB', cf.ml, '256MB');
ck('样例两组', cf.samples.length, 2);
ck('样例1 输入', cf.samples[0].i, '6 6 4');
ck('样例1 输出', cf.samples[0].o, '4');
ck('样例2 输入', cf.samples[1].i, '1 1 1');
ck('描述非空', cf.desc.includes('Theatre Square'), true);
ck('Input 段', cf.input.includes('three positive'), true);
ck('Output 段', cf.output.includes('flagstones'), true);
ck('Note 段', cf.hint.includes('first test case'), true);
ck('来源', cf.source, 'Codeforces 1A');

/* ================= 4. AtCoder ================= */
console.log('\n【AtCoder · 真实结构】');
const atHtml=`<html><head><title>A - N-choice question</title></head><body>
<div id="task-statement"><span class="lang-en">
 <div class="part">
  <section><h3>Problem Statement</h3><div><p>Given are integers N and A.</p></div></section>
  <section><h3>Constraints</h3><div><ul><li>1 ≤ N ≤ 100</li><li>1 ≤ A ≤ 100</li></ul></div></section>
  <section><h3>Input</h3><div><p>Input is given from Standard Input in the following format:</p><pre>N A
B<sub>1</sub> ... B<sub>N</sub></pre></div></section>
  <section><h3>Output</h3><div><p>Print the answer.</p></div></section>
  <section><h3>Sample Input 1</h3><pre>3 2
1 3 2</pre></section>
  <section><h3>Sample Output 1</h3><pre>2</pre></section>
  <section><h3>Sample Input 2</h3><pre>4 4
1 1 1 1</pre></section>
  <section><h3>Sample Output 2</h3><pre>1</pre></section>
 </div>
</span></div></body></html>`;
const at=W.parseAtCoder(atHtml,'https://atcoder.jp/contests/abc300/tasks/abc300_a');
show('AtCoder', at);
ck('样例两组', at.samples.length, 2);
ck('样例1 输入', at.samples[0].i, '3 2\n1 3 2');
ck('样例1 输出', at.samples[0].o, '2');
ck('样例2 输出', at.samples[1].o, '1');
ck('描述', at.desc.includes('Given are integers'), true);
ck('Input 格式（含预格式块）', at.input.includes('B'), true);
ck('数据范围进 hint', at.hint.includes('100'), true);
ck('来源', at.source, 'AtCoder abc300_a');

/* ================= 5. 通用 h2 站点（LOJ / 牛客 风格）================= */
console.log('\n【通用 h2 分节（LOJ/牛客/自建 OJ 风格）】');
const genHtml=`<html><head><title>#100. 矩阵乘法 - LibreOJ</title></head><body>
<div class="md">
<h2>题目描述</h2><div><p>这是一道模板题。</p><p>给定矩阵 A 和 B，求 A×B。</p></div>
<h2>输入格式</h2><div><p>第一行三个整数 n, p, m。</p></div>
<h2>输出格式</h2><div><p>输出矩阵 C。</p></div>
<h2>样例输入</h2><pre>2 2 2
1 2
3 4
5 6
7 8</pre>
<h2>样例输出</h2><pre>19 22
43 50</pre>
<h2>数据范围与提示</h2><div><p>1 ≤ n, p, m ≤ 100</p></div>
<div>时间限制：1 s　　内存限制：256 MB</div>
</div></body></html>`;
const gen=W.parseAny(genHtml,'https://loj.ac/p/100');
show('LOJ', gen);
ck('标题去站点后缀', gen.title, '#100. 矩阵乘法');
ck('来源', gen.source, 'LibreOJ 100');
ck('样例输入行数', gen.samples[0].i.split('\n').length, 5);
ck('样例输入内容', gen.samples[0].i.startsWith('2 2 2'), true);
ck('样例输出', gen.samples[0].o, '19 22\n43 50');
ck('描述', gen.desc.includes('模板题'), true);
ck('输入格式', gen.input.includes('n, p, m'), true);
ck('数据范围进 hint', gen.hint.includes('100'), true);

/* ================= 6. Markdown 路径（粘贴 / jina 降级）================= */
console.log('\n【Markdown 路径】');
const md=`Title: P1048 [NOIP 2005 普及组] 采药

URL Source: https://www.luogu.com.cn/problem/P1048

Markdown Content:
复制 Markdown

 展开 进入 IDE 模式
## 题目描述

辰辰是个天资聪颖的孩子，他想拜附近最有威望的医师为师。

## 输入格式

第一行有两个整数 $T$ 和 $M$。

## 输出格式

输出最大总价值。

## 输入输出样例

**输入 #1**

70 3
71 100
69 1
1 2

**输出 #1**

3

## 说明/提示

**数据范围**

对于 $30\\%$ 的数据，$M \\le 10$。
时间限制 1s 内存限制 128MB
`;
const mdP=W.parseMarkdown(md,'https://www.luogu.com.cn/problem/P1048');
show('P1048 md', mdP);
ck('标题', mdP.title, 'P1048 [NOIP 2005 普及组] 采药');
ck('描述', mdP.desc.includes('天资聪颖'), true);
ck('输入格式', mdP.input.includes('$T$'), true);
ck('样例输入', mdP.samples[0].i, '70 3\n71 100\n69 1\n1 2');
ck('样例输出', mdP.samples[0].o, '3');
ck('提示保留公式', mdP.hint.includes('$M \\le 10$'), true);
ck('噪音行(复制Markdown)已剔除', mdP.desc.includes('复制 Markdown'), false);
ck('时间限制从正文提取', mdP.tl, '1s');
ck('内存限制从正文提取', mdP.ml, '128MB');

/* ================= 7. 边界与防御 ================= */
console.log('\n【边界情况】');
ck('空字符串不崩', !!W.parseAny('', 'https://x.com/p/1'), true);
ck('纯文本不崩', typeof W.parseAny('随便一段没有任何结构的文字', 'https://x.com/p/1'), 'object');
ck('坏 JSON 不崩', W.parseLuogu('<script type="application/json">{bad json</script>','https://www.luogu.com.cn/problem/P1'), null);
ck('无 problem 字段返回 null', W.parseLuogu('<script type="application/json">{"a":1}</script>','https://www.luogu.com.cn/problem/P1'), null);
ck('非 CF 页面返回 null', W.parseCodeforces('<html><body>nope</body></html>','https://codeforces.com/problemset/problem/1/A'), null);
ck('非 AtCoder 返回 null', W.parseAtCoder('<html><body>nope</body></html>','https://atcoder.jp/x'), null);
const weird=W.parseAny('<html><head><title>奇怪页面</title></head><body><p>没有标题结构</p></body></html>','https://x.com/p/1');
ck('无结构页面仍拿到标题', weird.title, '奇怪页面');
ck('URL 解析题号 洛谷', W.pidFromUrl('https://www.luogu.com.cn/problem/P1001'), 'P1001');
ck('URL 解析题号 CF(/problemset/problem/1/A → 1A)', W.pidFromUrl('https://codeforces.com/problemset/problem/1/A'), '1A');
ck('URL 解析题号 CF(/contest/1234/problem/B → 1234B)', W.pidFromUrl('https://codeforces.com/contest/1234/problem/B'), '1234B');
ck('URL 解析题号 AtCoder', W.pidFromUrl('https://atcoder.jp/contests/abc300/tasks/abc300_a'), 'abc300_a');
ck('站点名映射', W.hostName('https://www.luogu.com.cn/problem/P1'), '洛谷');

console.log('\n通过 '+pass+' / 失败 '+fail);
process.exit(fail?1:0);
