const path=require('path');
const APP=path.join(__dirname,'..','index.html');
const FIXTURE=path.join(__dirname,'fixtures','luogu-p1001.html');
const fs=require('fs');
const { JSDOM } = require('jsdom');
const html=fs.readFileSync(APP,'utf8');
let pass=0,fail=0;
const ck=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
  console.log((ok?'✅':'❌')+' '+l+(ok?'':'  → '+JSON.stringify(g)+'  (期望 '+JSON.stringify(w)+')'));};

/* 模拟 GitHub Gist：内容为「电脑端」上传的题库 */
const REMOTE={ v:2, deleted:{}, problems:[
  { id:'pc-1', title:'P3374 树状数组（电脑上传）', source:'洛谷 P3374', diff:2, tags:['数据结构'],
    tl:'1s', ml:'125MB', desc:'电脑端写的题目', input:'', output:'', samples:[{i:'5 5',o:'14\n16'}],
    hint:'', note:'', sols:[{title:'树状数组',idea:'',cx:'O(log n)',code:'int main(){}'}], updatedAt:Date.now() }
]};
let sawAuthHeader=null, calls=[];
function mockFetch(url,init){
  init=init||{}; calls.push((init.method||'GET')+' '+String(url).slice(0,60));
  if(init.headers && init.headers.Authorization) sawAuthHeader=init.headers.Authorization;
  const gistId=String(url).match(/gists\/([^/?]+)/);
  if(gistId) return Promise.resolve({ ok:true, status:200,
    json:async()=>({ id:gistId[1], files:{ 'tiku.json':{ content:JSON.stringify(REMOTE) } } }),
    text:async()=>JSON.stringify(REMOTE) });
  return Promise.resolve({ ok:false, status:404, json:async()=>({}), text:async()=>'' });
}

function mkPhone(hash,label){
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://user.github.io/tiku/tiku.html'+hash,pretendToBeVisual:true});
  const w=dom.window; w.fetch=mockFetch;
  return w;
}
(async()=>{
console.log('【手机端：打开带 hash 的链接，零配置】');
const W=mkPhone('#sync=gist&id=abc123def456&ro=1','phone');
ck('自动识别为 gist 模式', W.eval('SYNC.mode'), 'gist');
ck('自动填入 Gist ID', W.eval('SYNC.gistId'), 'abc123def456');
ck('只读：不带令牌', W.eval('SYNC.token'), '');
ck('自动同步已开', W.eval('SYNC.auto'), true);

console.log('\n【手机端拉取：无令牌成功】');
await W.eval('doSync(true)');
ck('拉取后拿到电脑端的题', W.eval("DB.problems.some(p=>p.id==='pc-1')"), true);
ck('题目内容完整', W.eval("(byId('pc-1')||{}).title"), 'P3374 树状数组（电脑上传）');
ck('代码完整', W.eval("(byId('pc-1')||{sols:[]}).sols[0].code"), 'int main(){}');
ck('请求未携带 Authorization', sawAuthHeader, null);
ck('同步状态无错误', W.eval('SYNC.lastError'), '');

console.log('\n【只读：不产生任何写请求】');
calls.length=0;
await W.eval('schedulePush()');
await new Promise(r=>setTimeout(r,120));
ck('改动后不上传（无写请求）', calls.filter(c=>/PATCH|POST/.test(c)).length, 0);

console.log('\n【手机端也生成链接（应指向同一 Gist）】');
const link=W.eval('buildShareLink().url');
console.log('   ', link);
ck('链接含同一 Gist ID', /id=abc123def456/.test(link), true);
ck('链接标记只读', /ro=1/.test(link), true);
ck('链接不含令牌', !/token|ghp_/.test(link), true);

console.log('\n【只读链接模式（#sync=url）】');
const served={v:2,deleted:{},problems:[{id:'r9',title:'来自只读链接的题',updatedAt:1,tags:[],samples:[],sols:[]}]};
const W2=mkPhone('#sync=url&u='+encodeURIComponent('https://example.com/tiku.json'),'url');
W2.fetch=(u)=>Promise.resolve({ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(served)),text:async()=>JSON.stringify(served)});
ck('识别为 url 模式', W2.eval('SYNC.mode'), 'url');
ck('URL 已解码', W2.eval('SYNC.url'), 'https://example.com/tiku.json');
await W2.eval('doSync(true)');
ck('拉到远端题目', W2.eval("DB.problems.some(p=>p.id==='r9')"), true);

console.log('\n【电脑端（有令牌）仍可双向】');
const W3=mkPhone('#sync=gist&id=abc123def456&ro=1','pc');
W3.eval("SYNC.token='ghp_fake'");
await W3.eval('doSync(true)');
ck('带令牌时正常同步', W3.eval('SYNC.lastError'), '');
ck('带令牌时发出了 Authorization', sawAuthHeader, 'Bearer ghp_fake');

console.log('\n【边界】');
ck('无 hash 不影响原有本地使用', mkPhone('','none').eval("SYNC.mode"), 'off');
ck('file:// 下生成链接给出提示', mkPhone('#sync=gist&id=x&ro=1','f').eval("location.protocol"), 'https:');
console.log('\n通过 '+pass+' / 失败 '+fail);
process.exit(fail?1:0);
})().catch(e=>{console.error('崩溃:',e);process.exit(1);});
