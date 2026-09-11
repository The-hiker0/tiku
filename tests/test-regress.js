const path=require('path');
const APP=path.join(__dirname,'..','index.html');
const FIXTURE=path.join(__dirname,'fixtures','luogu-p1001.html');
const fs=require('fs'), cp=require('child_process');
const { JSDOM } = require('jsdom');
const html=fs.readFileSync(APP,'utf8');
let pass=0,fail=0;
const ck=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
  console.log((ok?'✅':'❌')+' '+l+(ok?'':'  → '+JSON.stringify(g)+'  (期望 '+JSON.stringify(w)+')'));};
const mkdom=()=>new JSDOM(html,{runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true});

/* ================= A. C++ 高亮 ================= */
console.log('【A. C++ 语法高亮：无损还原 + 转义】');
const W=mkdom().window;
const strip=s=>s.replace(/<span class="c-[a-z]+">/g,'').replace(/<\/span>/g,'')
   .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const cases=[
 ['基础','#include <bits/stdc++.h>\nint main(){ return 0; }'],
 ['尖括号','vector<int> v; if(a<b && c>d) x=y;'],
 ['字符串含//','cout << "http://x.com//y";'],
 ['注释含引号','// 他说 "你好"\nint x;'],
 ['块注释跨行','/* a\n <tag> b */\nint a;'],
 ['字符转义',"char c = '\\n'; char d = '\\\\';"],
 ['与号','int *p = &a; a &= b;'],
 ['预处理器','#define MAX(a,b) ((a)>(b)?(a):(b))'],
 ['数字后缀','long long x = 1e18; double d = 3.14f; int y = 0x1F;'],
 ['HTML注入','cout << "<script>alert(1)</script>";'],
 ['空',''],['仅注释','// nothing']
];
let hb=[];
cases.forEach(([n,src])=>{
  const o=W.hlCpp(src);
  if(strip(o)!==src) hb.push(n+' 还原不一致');
  const outside=o.replace(/<span class="c-[a-z]+">|<\/span>/g,'');
  if(/[<>]/.test(outside)) hb.push(n+' 未转义尖括号');
});
ck('12 组用例', hb.length?hb.join('; '):'全部通过', '全部通过');
ck('HTML 注入被转义', /<script>/.test(W.hlCpp('cout<<"<script>x</script>";').replace(/<span class="c-[a-z]+">|<\/span>/g,''))?'未转义':'已转义','已转义');

/* ================= B. 合并算法 ================= */
console.log('\n【B. 同步合并算法】');
const Wb=mkdom().window;
const NOW=Date.now(), DAY=86400000;
const P=(id,t,up)=>({id,title:t,updatedAt:up,samples:[{i:'',o:''}],sols:[],tags:[]});
const L={v:2,problems:[P('a','A',NOW-1000),P('b','B',NOW-1000)],deleted:{}};
ck('远端较新则覆盖', Wb.mergeDB(L,{problems:[P('a','A2',NOW)],deleted:{}}).problems.find(p=>p.id==='a').title,'A2');
ck('本地较新则保留', Wb.mergeDB(L,{problems:[P('a','A0',NOW-5000)],deleted:{}}).problems.find(p=>p.id==='a').title,'A');
ck('远端独有题目被并入', Wb.mergeDB(L,{problems:[P('c','C',NOW)],deleted:{}}).problems.length,3);
ck('本地顺序优先', Wb.mergeDB(L,{problems:[P('c','C',NOW)],deleted:{}}).problems.map(p=>p.id).join(''),'abc');
ck('墓碑删除后不复活', Wb.mergeDB(L,{problems:[],deleted:{a:NOW}}).problems.map(p=>p.id).join(''),'b');
ck('墓碑早于修改则保留', Wb.mergeDB(L,{problems:[],deleted:{a:NOW-5000}}).problems.map(p=>p.id).join(''),'ab');
ck('无墓碑不会误删(updatedAt=0)', Wb.mergeDB({v:2,problems:[P('z','Z',0)],deleted:{}},{problems:[],deleted:{}}).problems.length,1);
ck('400天前的墓碑被剪枝', 'old' in Wb.mergeDB({v:2,problems:[],deleted:{old:NOW-400*DAY}},{problems:[],deleted:{}}).deleted,false);
ck('100天前的墓碑仍保留(防离线设备复活)', 'k' in Wb.mergeDB({v:2,problems:[],deleted:{k:NOW-100*DAY}},{problems:[],deleted:{}}).deleted,true);
ck('幂等：合并两次结果一致',
   JSON.stringify(Wb.mergeDB(Wb.mergeDB(L,{problems:[P('c','C',NOW)],deleted:{}}),{problems:[P('c','C',NOW)],deleted:{}}).problems.map(p=>p.id)),
   JSON.stringify(Wb.mergeDB(L,{problems:[P('c','C',NOW)],deleted:{}}).problems.map(p=>p.id)));

/* ================= C. 双设备 Gist 同步 ================= */
console.log('\n【C. 双设备 Gist 双向同步】');
const gists={}; let seq=0;
function mockFetchFactory(){ return (url,init)=>{ init=init||{};
  const method=(init.method||'GET').toUpperCase();
  const res=(s,j)=>Promise.resolve({ok:s>=200&&s<300,status:s,
    json:async()=>JSON.parse(JSON.stringify(j)),text:async()=>JSON.stringify(j)});
  if(method==='POST'&&url==='https://api.github.com/gists'){
    const id='g'+(++seq); gists[id]={files:JSON.parse(init.body).files}; return res(201,{id}); }
  const m=String(url).match(/api\.github\.com\/gists\/([^/?]+)/);
  if(m){ const g=gists[m[1]]; if(!g) return res(404,{message:'Not Found'});
    if(method==='PATCH'){ g.files=JSON.parse(init.body).files; return res(200,{id:m[1]}); }
    return res(200,{id:m[1],files:JSON.parse(JSON.stringify(g.files))}); }
  return res(404,{message:'bad'});
};}
function dev(){
  const w=mkdom().window;
  w.fetch=mockFetchFactory();
  return w;
}
(async()=>{
const A=dev(), B=dev();
const add=(w,t,code)=>w.eval(`(function(){const p={id:uid(),title:${JSON.stringify(t)},source:'',diff:1,tl:'1s',ml:'128MB',
  tags:['测试'],desc:'d',input:'i',output:'o',samples:[{i:'1',o:'1'}],hint:'',note:'',
  sols:[{title:'做法',idea:'',cx:'',code:${JSON.stringify(code)}}],star:false,updatedAt:Date.now()};
  normalize(p); DB.problems.unshift(p); save2(); return p.id;})()`);
A.eval("SYNC.mode='gist';SYNC.token='ghp_x';SYNC.auto=false;");
await A.doSync(false);
const GID=A.eval('SYNC.gistId');
ck('自动创建 Gist', !!GID, true);
ck('A 初始 3 题', A.eval('DB.problems.length'), 3);
const a1=add(A,'CF 1A 新题','// A的代码');
await A.doSync(false);
ck('A 上传后 4 题', A.eval('DB.problems.length'), 4);
B.eval(`SYNC.mode='gist';SYNC.token='ghp_x';SYNC.gistId=${JSON.stringify(GID)};SYNC.auto=false;`);
await B.doSync(false);
ck('B 拉到 A 的题', B.eval('DB.problems.length'), 4);
ck('B 代码内容正确', B.eval(`byId(${JSON.stringify(a1)}).sols[0].code`), '// A的代码');
await new Promise(r=>setTimeout(r,5));
B.eval(`(function(){const p=byId(${JSON.stringify(a1)});p.title='B改过';p.updatedAt=Date.now();save2();})()`);
await B.doSync(false); await A.doSync(false);
ck('A 收到 B 的修改', A.eval(`byId(${JSON.stringify(a1)}).title`), 'B改过');
B.eval(`(function(){DB.problems=DB.problems.filter(x=>x.id!==${JSON.stringify(a1)});DB.deleted[${JSON.stringify(a1)}]=Date.now();save2();})()`);
await B.doSync(false); await A.doSync(false); await A.doSync(false);
ck('删除后 A 不复活该题', A.eval(`!!byId(${JSON.stringify(a1)})`), false);
ck('A 题数 3', A.eval('DB.problems.length'), 3);
add(A,'A再加一题','// x'); await A.doSync(false); await B.doSync(false);
ck('B 收到新题', B.eval('DB.problems.length'), 4);
ck('A/B 题目集合一致',
   A.eval('DB.problems.map(p=>p.title).sort().join("|")'),
   B.eval('DB.problems.map(p=>p.title).sort().join("|")'));

/* ================= D. 只读链接模式 ================= */
console.log('\n【D. 只读链接模式】');
const C=mkdom().window;
let served={v:2,problems:[{id:'r1',title:'远端题',updatedAt:1000,tags:[],samples:[{i:'1',o:'2'}],sols:[]}],deleted:{}};
let gets=0;
C.fetch=(u)=>{gets++;return Promise.resolve({ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(served)),text:async()=>JSON.stringify(served)});};
C.eval("SYNC.mode='url';SYNC.url='https://example.com/t.json';SYNC.auto=false;");
await C.doSync(false);
ck('拉到远端题', C.eval('DB.problems.length'), 4);
ck('只读模式仅 GET', gets, 1);
C.eval("DB.problems=DB.problems.filter(x=>x.id!=='r1');DB.deleted['r1']=Date.now();save2();");
await C.doSync(false);
ck('本地删除不被拉回', C.eval("!!byId('r1')"), false);
C.fetch=()=>Promise.resolve({ok:false,status:500,json:async()=>({}),text:async()=>''});
await C.doSync(true);
ck('失败记录错误', /HTTP 500/.test(C.eval('SYNC.lastError')), true);
ck('数据未损坏', C.eval('DB.problems.length'), 3);

/* ================= E. 导出 / 导入 往返 ================= */
console.log('\n【E. 导出 / 导入 往返】');
const D=mkdom().window;
const before=D.eval('JSON.stringify(DB)');
const parsed=JSON.parse(before);
ck('JSON 往返题数', parsed.problems.length, 3);
ck('代码无损', parsed.problems[2].sols[1].code === D.eval('DB.problems[2].sols[1].code'), true);

/* ================= F. C++ 真实编译跑样例 ================= */
console.log('\n【F. 预置题解真实编译 + 跑样例】');
const hasGpp = cp.spawnSync('g++',['--version'],{encoding:'utf8'}).status===0;
if(!hasGpp){ console.log('  ⏭ 未检测到 g++，跳过编译测试（不影响其余结果）'); }
const seed=JSON.parse(D.eval('JSON.stringify(SEED)'));
if(hasGpp){
const os=require('os'); const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tiku-cpp-')); 
let cc=0,wa=0,tot=0;
seed.forEach(p=>{
  const s0=p.samples[0];
  p.sols.forEach((s,i)=>{
    tot++;
    const name=p.title.split(' ')[0]+'_s'+(i+1);
    const src=path.join(tmp,name+'.cpp'),bin=path.join(tmp,name);
    fs.writeFileSync(src,s.code);
    const c=cp.spawnSync('g++',['-O2','-std=c++17','-o',bin,src],{encoding:'utf8'});
    if(c.status!==0){cc++;console.log('❌ 编译失败 '+name);return;}
    const r=cp.spawnSync(bin,[],{input:s0.i,encoding:'utf8',timeout:5000});
    const got=(r.stdout||'').trim().replace(/\r/g,'');
    if(got!==s0.o.trim()){wa++;console.log('❌ 答案错 '+name+' 得到「'+got+'」');}
    else console.log('✅ '+name.padEnd(12)+' 编译通过 · 样例通过 →「'+got.replace(/\n/g,'\\n')+'」');
  });
});
ck(tot+' 份代码全部编译且样例正确', cc+wa, 0);
}

console.log('\n通过 '+pass+' / 失败 '+fail);
process.exit(fail?1:0);
})().catch(e=>{console.error('崩溃:',e);process.exit(1);});
