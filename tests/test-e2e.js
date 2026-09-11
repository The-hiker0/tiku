const path=require('path');
const APP=path.join(__dirname,'..','index.html');
const FIXTURE=path.join(__dirname,'fixtures','luogu-p1001.html');
const fs=require('fs');
const { JSDOM } = require('jsdom');
const html=fs.readFileSync(APP,'utf8');
const LG=fs.readFileSync(FIXTURE,'utf8');          // 真实洛谷页面
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true});
const W=dom.window;

let pass=0,fail=0;
const ck=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
  console.log((ok?'✅':'❌')+' '+l+(ok?'':'  → '+JSON.stringify(g)+'  (期望 '+JSON.stringify(w)+')'));};

/* ---- mock fetch：模拟代理行为 ---- */
const calls=[];
function installMock(opts){
  opts=opts||{};
  W.fetch=(url,init)=>{
    url=String(url); calls.push(url);
    const mk=(status,body,delay)=>new Promise((res,rej)=>{
      const t=setTimeout(()=>{
        if(status===0) return rej(Object.assign(new Error('boom'),{name:'TypeError'}));
        res({ ok:status>=200&&status<300, status, text:async()=>body });
      }, delay||0);
      if(init&&init.signal) init.signal.addEventListener('abort',()=>{clearTimeout(t);
        rej(Object.assign(new Error('aborted'),{name:'AbortError'}));});
    });
    if(/_lfe(%2F|\/)tags/.test(url))      return mk(200, JSON.stringify({tags:[
        {id:1,name:'模拟'},{id:2,name:'字符串'},{id:3,name:'动态规划 DP'},{id:5,name:'数学'},{id:-2,name:'语言入门'}]}),5);
    if(/allorigins/.test(url))            return opts.allorigins===false ? mk(522,'error code: 522',5) : mk(200, LG, opts.delay||5);
    if(/codetabs/.test(url))              return mk(opts.codetabs===false?522:200, opts.codetabs===false?'err':LG, 30);
    if(/r\.jina\.ai/.test(url))           return mk(200, LG, 3000);         // 慢通道
    return mk(0,'');
  };
}

(async()=>{
console.log('【1) 代理链：快通道胜出，慢通道被掐掉】');
installMock({});
let r=await W.fetchProblem('https://www.luogu.com.cn/problem/P1001');
ck('选中最快的 allorigins', r.proxy, 'allorigins');
ck('解析出题目', r.prob.title, 'P1001 A+B Problem');
ck('样例正确', r.prob.samples[0].o, '50');
console.log('   实际发出的请求数:', calls.length, '（并发 4 通道）');

console.log('\n【2) 首选通道挂掉 → 自动降级】');
calls.length=0;
installMock({allorigins:false});
r=await W.fetchProblem('https://www.luogu.com.cn/problem/P1001');
ck('降级到 codetabs', r.proxy, 'codetabs');
ck('内容仍然正确', r.prob.title, 'P1001 A+B Problem');

console.log('\n【3) 全部通道失败 → 报聚合错误】');
installMock({allorigins:false,codetabs:false});
W.fetch=(url)=>Promise.resolve({ok:false,status:403,text:async()=>''});
let err=null;
try{ await W.fetchProblem('https://www.luogu.com.cn/problem/P1001'); }catch(e){ err=e; }
ck('抛出异常而不是静默失败', !!err, true);
console.log('   错误信息:', err && err.message);

console.log('\n【4) 填表：字段真的写进表单了吗】');
installMock({});
W.openEditor(null);
const p=(await W.fetchProblem('https://www.luogu.com.cn/problem/P1001')).prob;
const names=await W.luoguTagNames(p._luoguTags);
p.tags=names.length?names:p.tags;
W.applyImported(p);
const V=id=>W.document.getElementById(id).value;
ck('标题已填', V('f_title'), 'P1001 A+B Problem');
ck('来源已填', V('f_source'), '洛谷 P1001');
ck('难度已选(入门=0)', W.document.getElementById('f_diff').value, '0');
ck('时间限制已填', V('f_tl'), '1s');
ck('内存限制已填', V('f_ml'), '512MB');
ck('标签已由数字ID换成名称', V('f_tags'), '模拟');
ck('描述已填', V('f_desc').includes('$a,b$'), true);
ck('输入格式已填', V('f_in'), '输入两个以空格分隔的整数 $a,b$。');
ck('输出格式已填', V('f_out'), '输出一个整数，表示 $a+b$。');
ck('样例行已生成', W.document.querySelectorAll('#f_samples .soledit').length, 1);
const sIn=W.document.querySelector('#f_samples [data-k="i"]').value;
const sOut=W.document.querySelector('#f_samples [data-k="o"]').value;
ck('样例输入已填', sIn, '20 30');
ck('样例输出已填', sOut, '50');
ck('题解区为空（代码由用户自己贴）', W.document.querySelectorAll('#f_sols .soledit').length, 0);

console.log('\n【5) 粘贴兜底路径】');
W.document.getElementById('impUrl').value='https://www.luogu.com.cn/problem/P1048';
const md=`Title: P1048 [NOIP 2005 普及组] 采药\n\nMarkdown Content:\n## 题目描述\n\n辰辰是个天资聪颖的孩子。\n\n## 输入格式\n\n第一行两个整数。\n\n## 输出格式\n\n输出最大价值。\n\n## 输入输出样例\n\n**输入 #1**\n\n70 3\n\n**输出 #1**\n\n3\n\n## 说明/提示\n\n数据范围很水。\n`;
await W.doImportFrom(md, 'https://www.luogu.com.cn/problem/P1048', '粘贴内容');
ck('粘贴后标题更新', V('f_title'), 'P1048 [NOIP 2005 普及组] 采药');
ck('粘贴后样例更新', W.document.querySelector('#f_samples [data-k="o"]').value, '3');
ck('状态栏提示成功', /已填入/.test(W.document.getElementById('impStatus').innerHTML), true);

console.log('\n【6) 保存后进入题库】');
W.document.getElementById('edSave').onclick();
const n=W.eval('DB.problems.length');
ck('题库多了一条', n, 4);
const saved=W.eval('DB.problems[0].title');
ck('新题在最前面', saved, 'P1048 [NOIP 2005 普及组] 采药');
ck('题解数为 0（还没贴代码）', W.eval('DB.problems[0].sols.length'), 0);

console.log('\n通过 '+pass+' / 失败 '+fail);
process.exit(fail?1:0);
})().catch(e=>{ console.error('测试崩溃:', e); process.exit(1); });
