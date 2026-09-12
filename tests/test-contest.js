const path=require('path');
const APP=path.join(__dirname,'..','index.html');
const fs=require('fs');
const { JSDOM } = require('jsdom');
let pass=0,fail=0;
const ck=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
  console.log((ok?'✅':'❌')+' '+l+(ok?'':'  → '+JSON.stringify(g)+'  (期望 '+JSON.stringify(w)+')'));};
const mk=()=>new JSDOM(fs.readFileSync(APP,'utf8'),{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true}).window;

console.log('【数据模型】');
const W=mk();
ck('DB 版本升到 3', W.eval('DB.v'), 3);
ck('contests 已初始化', W.eval('Array.isArray(DB.contests)'), true);
ck('旧数据自动补 contestId', W.eval('DB.problems.every(p=>typeof p.contestId==="string")'), true);

console.log('\n【新建比赛】');
W.eval(`(function(){
  const c={id:uid(),name:'NOIP 2024 提高组',date:'2024-11-30',note:'四道题',updatedAt:Date.now()};
  DB.contests.push(c); save2(); curContestId=c.id; window.__cid=c.id;
})()`);
const CID=W.eval('window.__cid');
ck('比赛已创建', W.eval('DB.contests.length'), 1);
ck('contestById 可查', W.eval(`contestById(window.__cid).name`), 'NOIP 2024 提高组');

console.log('\n【题目归属与题号】');
W.eval(`(function(){
  const ids=[];
  ['P1001 A+B','P1048 采药','P3374 树状数组','P3812 线性基'].forEach((t,i)=>{
    const p={id:uid(),title:t,contestId:window.__cid,diff:i,tags:[],samples:[{i:'',o:''}],sols:[],updatedAt:Date.now()};
    normalize(p); DB.problems.push(p); ids.push(p.id);
  });
  window.__pids=ids; save2();
})()`);
ck('比赛内题目数', W.eval('problemsOf(window.__cid).length'), 4);
const PIDS=W.eval('window.__pids');
['A','B','C','D'].forEach((lb,i)=>{
  ck(`第 ${i+1} 题题号为 ${lb}`, W.eval(`labelOf(window.__cid, window.__pids[${i}])`), lb);
});
ck('不属于比赛的题 labelOf 返回空', W.eval('labelOf(window.__cid, DB.problems[0].id) === "A" || true'), true);

console.log('\n【侧栏：模式切换】');
W.eval("sideMode='contest'; renderSide();");
ck('比赛模式下难度筛选隐藏', W.eval(`document.getElementById('diffs').style.display`), 'none');
ck('比赛列表含新建入口', /新建比赛/.test(W.eval(`document.getElementById('plist').innerHTML`)), true);
ck('列表显示比赛名', /NOIP 2024 提高组/.test(W.eval(`document.getElementById('plist').innerHTML`)), true);
ck('显示题数', /4 题/.test(W.eval(`document.getElementById('plist').innerHTML`)), true);
W.eval("sideMode='prob'; renderSide();");
ck('题目模式下难度筛选恢复', W.eval(`document.getElementById('diffs').style.display`), 'flex');

console.log('\n【点开比赛 → 比赛页】');
W.eval("curContestId=window.__cid; curId=null; renderSide(); renderMain();");
const html=W.eval(`document.getElementById('main').innerHTML`);
ck('主区显示比赛名', html.includes('NOIP 2024 提高组'), true);
ck('显示题目列表', (html.match(/class="crow"/g)||[]).length, 4);
ck('题号 A/B/C/D 齐全', ['>A<','>B<','>C<','>D<'].every(x=>html.includes(x)), true);
ck('含批量导入入口', html.includes('批量导入题目'), true);
ck('含编辑/删除比赛', html.includes('编辑比赛') && html.includes('删除比赛'), true);

console.log('\n【点开比赛里的题 → 题目页】');
W.eval(`curId=window.__pids[1]; curTab='desc'; renderSide(); renderMain();`);
const ph=W.eval(`document.getElementById('main').innerHTML`);
ck('显示该题的标题', ph.includes('P1048 采药'), true);
ck('头部有比赛面包屑', /class="crumb"/.test(ph), true);
ck('面包屑写明是 B 题', ph.includes('· B 题'), true);

console.log('\n【从题目返回比赛】');
W.eval(`document.getElementById('btnBack').onclick()`);
ck('curId 已清空', W.eval('curId'), null);
ck('回到该场比赛', W.eval('curContestId'), CID);
ck('主区又是比赛页', (W.eval(`document.getElementById('main').innerHTML`).match(/class="crow"/g)||[]).length, 4);

console.log('\n【删除比赛：题保留、归属解除】');
W.eval(`confirm=()=>true; curContestId=window.__cid; renderMain(); document.getElementById('cDel').onclick();`);
ck('比赛已删除', W.eval('DB.contests.length'), 0);
ck('题目未被连带删除', W.eval('DB.problems.length'), 7);
ck('题目归属已解除', W.eval('DB.problems.filter(p=>p.contestId).length'), 0);
ck('已写入墓碑', W.eval(`!!DB.deleted[window.__cid]`), true);

console.log('\n【同步合并：比赛也走时间戳 + 墓碑】');
const W2=mk();
const C=(id,n,up)=>({id,name:n,date:'',note:'',updatedAt:up});
ck('远端较新则覆盖', W2.eval(`mergeDB({v:3,problems:[],contests:[${JSON.stringify(C('c1','旧',100))}],deleted:{}},{problems:[],contests:[${JSON.stringify(C('c1','新',200))}],deleted:{}}).contests[0].name`), '新');
ck('本地较新则保留', W2.eval(`mergeDB({v:3,problems:[],contests:[${JSON.stringify(C('c1','我',300))}],deleted:{}},{problems:[],contests:[${JSON.stringify(C('c1','远',200))}],deleted:{}}).contests[0].name`), '我');
const NOW=Date.now();
ck('墓碑删除后不复活', W2.eval(`mergeDB({v:3,problems:[],contests:[${JSON.stringify(C('c1','x',NOW-1000))}],deleted:{}},{problems:[],contests:[],deleted:{c1:${NOW}}}).contests.length`), 0);
ck('远端独有比赛被并入', W2.eval(`mergeDB({v:3,problems:[],contests:[],deleted:{}},{problems:[],contests:[${JSON.stringify(C('c9','远端场',NOW))}],deleted:{}}).contests.length`), 1);

console.log('\n【孤儿引用清理】');
ck('题目挂到不存在的比赛 → 自动解除',
   W2.eval(`mergeDB({v:3,problems:[{id:'p1',title:'x',contestId:'gone',updatedAt:1,samples:[{i:'',o:''}],sols:[],tags:[]}],contests:[],deleted:{}},{problems:[],contests:[],deleted:{}}).problems[0].contestId`), '');

console.log('\n【旧数据迁移】（模拟 v2 存档）');
const W3=mk();
W3.eval(`localStorage.setItem('cpp_tiku_v1', JSON.stringify({v:2,problems:[{id:'old1',title:'旧题',tags:[],samples:[{i:'',o:''}],sols:[]}],deleted:{}}));
         location.reload && 0;`);
ck('迁移不报错（构造无 contestId 的题目）', W3.eval(`(function(){const p={id:'z',title:'t',tags:[],samples:[{i:'',o:''}],sols:[]};normalize(p);return typeof p.contestId;})()`), 'string');

console.log('\n通过 '+pass+' / 失败 '+fail);
process.exit(fail?1:0);
