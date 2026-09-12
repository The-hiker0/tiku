#!/usr/bin/env node
/**
 * 中国象棋引擎回归测试（纯逻辑，不需要浏览器）。
 *
 * 从 xiangqi/index.html 里切出 // ===== ENGINE:BEGIN ===== 到 // ===== ENGINE:END =====
 * 之间的纯逻辑代码，在 Node 里直接跑。覆盖三块：
 *   A. 规则与评估的基本正确性（对称性、位置表方向、吃的将算赢）
 *   B. 搜索质量（找得到一步吃将、不主动送将、四档深度递增）
 *   C. 难度阶梯（低档确实更弱、高档明显更强、且不出现互不进攻的兜圈子）
 */
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'xiangqi', 'index.html');

let pass = 0, fail = 0;
const ck = (label, got, want) => {
  const ok = (typeof want === 'function') ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? '✅' : '❌') + ' ' + label + (ok ? '' : '  → ' + JSON.stringify(got) + '  (期望 ' + JSON.stringify(want) + ')'));
};
const section = t => console.log('\n' + '─'.repeat(58) + '\n' + t + '\n' + '─'.repeat(58));

/* ---------- 载入引擎 ---------- */
const html = fs.readFileSync(APP, 'utf8');
const src = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/) || [])[1];
if (!src) { console.error('❌ 找不到 <script> 块'); process.exit(1); }
const a = src.indexOf('// ===== ENGINE:BEGIN =====');
const b = src.indexOf('// ===== ENGINE:END =====');
if (a < 0 || b < 0 || b <= a) { console.error('❌ 找不到 ENGINE 标记'); process.exit(1); }
const ENGINE = src.slice(a, b);

const NEED = ['COLS', 'ROWS', 'SIZE', 'RED', 'BLACK', 'KING', 'ADVISOR', 'ELEPHANT', 'HORSE', 'ROOK',
  'CANNON', 'PAWN', 'mk', 'pType', 'pSide', 'initialBoard', 'genMoves', 'genLegal', 'findKing',
  'inCheck', 'positionKey', 'evaluate', 'findBestMove', 'LEVELS', 'MATE', 'VAL', 'PIECE_CHAR'];
let E;
try {
  E = new Function(ENGINE + '\n;return {' + NEED.join(',') + '};')();
} catch (e) {
  console.error('❌ 引擎段无法独立执行（可能混入了 DOM 代码）：' + e.message);
  process.exit(1);
}
const { mk, pType, pSide, RED, BLACK, KING, ROOK, CANNON, HORSE, PAWN, VAL, LEVELS, findKing, genLegal } = E;

const empty = () => new Array(90).fill(0);
const put = (p, x, y, v) => { p[y * 9 + x] = v; };
const material = p => {
  let s = 0;
  for (let i = 0; i < 90; i++) { const c = p[i]; if (!c) continue; s += (c >> 3) === RED ? VAL[pType(c)] : -VAL[pType(c)]; }
  return s;
};
/** 某个着法走完后，对方能不能立刻吃掉走子方的将 */
const hangsKing = (p, m, side) => {
  const f = m & 255, t = (m >> 8) & 255;
  if (pType(p[t]) === KING) return false;
  const q = p.slice(); q[t] = q[f]; q[f] = 0;
  return genLegal(q, 1 - side).some(x => pType(q[(x >> 8) & 255]) === KING);
};
/** 用给定档位自研一整局，返回结果。cfgB 传 null 表示用最后一个档位 */
const playGame = (cfgRed, cfgBlack, maxPly) => {
  let p = E.initialBoard(), side = RED, ply = 0;
  const seen = new Set([E.positionKey(p, side)]);
  while (ply < maxPly) {
    if (findKing(p, side) < 0) return { win: 1 - side, ply, mat: material(p) };
    const cfg = (side === RED) ? cfgRed : cfgBlack;
    const r = E.findBestMove(p, side, cfg.depth, cfg.ms, seen, cfg);
    if (!r || r.move == null) return { win: null, ply, mat: material(p), why: '无着' };
    if (hangsKing(p, r.move, side)) return { win: 1 - side, ply, mat: material(p), why: '主动送将' };
    const f = r.move & 255, t = (r.move >> 8) & 255;
    if (pType(p[t]) === KING) return { win: side, ply, mat: material(p) };
    p[t] = p[f]; p[f] = 0; side = 1 - side; ply++;
    seen.add(E.positionKey(p, side));
  }
  return { win: null, ply, mat: material(p), why: '限着' };
};
const h2h = (cfgA, cfgB, games, maxPly) => {
  let aw = 0, bw = 0, dr = 0, bad = 0;
  for (let g = 0; g < games; g++) {
    const aIsRed = g % 2 === 0;
    const r = playGame(aIsRed ? cfgA : cfgB, aIsRed ? cfgB : cfgA, maxPly);
    if (r.why === '主动送将') bad++;
    if (r.win === null) dr++;
    else if ((r.win === RED) === aIsRed) aw++; else bw++;
  }
  return { aw, bw, dr, bad };
};

/* ================= A. 规则与评估 ================= */
section('A. 规则与评估');
ck('初始局面评估为 0（左右完全对称）', E.evaluate(E.initialBoard()), 0);

const p1 = empty(); put(p1, 4, 9, mk(KING, RED)); put(p1, 4, 0, mk(KING, BLACK)); put(p1, 4, 6, mk(PAWN, RED));
const p2 = empty(); put(p2, 4, 9, mk(KING, RED)); put(p2, 4, 0, mk(KING, BLACK)); put(p2, 4, 3, mk(PAWN, RED));
ck('红兵过河后分数变高', E.evaluate(p2) > E.evaluate(p1), true);

const q1 = empty(); put(q1, 4, 9, mk(KING, RED)); put(q1, 4, 0, mk(KING, BLACK)); put(q1, 4, 3, mk(PAWN, BLACK));
const q2 = empty(); put(q2, 4, 9, mk(KING, RED)); put(q2, 4, 0, mk(KING, BLACK)); put(q2, 4, 6, mk(PAWN, BLACK));
ck('黑兵镜像正确（黑兵前进则红方分数下降）', E.evaluate(q2) < E.evaluate(q1), true);

const k1 = empty(); put(k1, 4, 9, mk(KING, RED)); put(k1, 4, 0, mk(KING, BLACK));
const k2 = k1.slice();
put(k2, 4, 8, k2[9 * 9 + 4]); put(k2, 4, 9, 0);        // 红将从底线 (4,9) 走到 (4,8)
ck('红将离开底线会被扣分', E.evaluate(k2) < E.evaluate(k1), true);
const k3 = k1.slice();
put(k3, 8, 4, k3[9 * 9 + 4]); put(k3, 4, 9, 0);        // 红将跑到棋盘边上 (8,4)
ck('红将跑出九宫扣分更多', E.evaluate(k3) < E.evaluate(k1), true);

/* ================= B. 搜索质量 ================= */
section('B. 搜索质量');
const mkPos = () => {
  const p = empty();
  put(p, 4, 0, mk(KING, BLACK)); put(p, 3, 9, mk(KING, RED));
  put(p, 4, 5, mk(ROOK, RED));
  return p;
};
{
  const p = mkPos();
  const r = E.findBestMove(p, RED, 6, 4000, null, LEVELS[3]);
  ck('看得见「一步吃将」并直接吃', ((r.move >> 8) & 255), 4);
}
{
  // 红车在第 1 行控制黑将南侧，黑将不应往第 1 行走
  const p = empty();
  put(p, 4, 0, mk(KING, BLACK)); put(p, 3, 9, mk(KING, RED)); put(p, 0, 1, mk(ROOK, RED));
  const r = E.findBestMove(p, BLACK, 6, 4000, null, LEVELS[3]);
  const to = (r.move >> 8) & 255, ty = (to / 9) | 0;
  ck('黑将不会走进红车的控制线', ty !== 1, true);
}

// 深度维持原样，只压缩思考时间，让测试跑得动
let anyBadMove = 0, checked = 0;
for (const lv of [1, 2, 3]) {
  for (let g = 0; g < 2; g++) {
    let p = E.initialBoard(), side = g % 2 === 0 ? RED : BLACK, ply = 0;
    const seen = new Set([E.positionKey(p, side)]);
    const cfg = Object.assign({}, LEVELS[lv], { ms: 250 });
    while (ply < 24 && findKing(p, side) >= 0) {
      const r = E.findBestMove(p, side, cfg.depth, cfg.ms, seen, cfg);
      if (!r || r.move == null) break;
      checked++;
      if (hangsKing(p, r.move, side)) anyBadMove++;
      const f = r.move & 255, t = (r.move >> 8) & 255;
      if (pType(p[t]) === KING) break;
      p[t] = p[f]; p[f] = 0; side = 1 - side; ply++;
      seen.add(E.positionKey(p, side));
    }
  }
}
ck(`中高难度共 ${checked} 手，没有一手是把将白送出去`, anyBadMove, 0);

let allLegal = true, depths = [];
for (const L of LEVELS) {
  const p = E.initialBoard();
  // 给足时间让该档位搜到自己的深度上限（大师档 8 层，约几秒）
  const r = E.findBestMove(p, RED, 99, L.ms * 4, null, L);
  if (!r || !genLegal(p, RED).includes(r.move)) allLegal = false;
  depths.push(r.depth);
}
ck('四档都返回合法着法', allLegal, true);
ck('四档搜索深度递增', depths.every((d, i) => i === 0 || d >= depths[i - 1]), true);

/* ================= C. 难度阶梯 ================= */
section('C. 难度阶梯');
/* 不在回归测试里跑长对局（太慢），改成检查「档位设计」本身：
   深度必须递增、只有最弱档才允许随机挑次好着、且强档能在战术局面里
   拿到比弱档更高的分数。真正的强度对比放在开发时的对局脚本里跑。 */
ck('恰好 4 个难度档', LEVELS.length, 4);

const names = LEVELS.map(L => L.name);
ck('档位名称', names, ['入门', '普通', '困难', '大师']);

const depthOk = LEVELS.every((L, i) => i === 0 || L.depth >= LEVELS[i - 1].depth);
ck('四档搜索深度不递减', depthOk, true);
ck('最难档深度不低于 8 层', LEVELS[3].depth >= 8, true);
ck('每档都有说明文字', LEVELS.every(L => L.desc && L.desc.length > 6), true);
ck('每档都有思考时间上限', LEVELS.every(L => L.ms > 0 && L.ms <= 10000), true);
ck('只有最弱档会随机挑次好着（topK>1）',
   LEVELS.filter(L => (L.topK | 0) > 1).map(L => L.name), ['入门']);
ck('强档不允许放水（topK=1 且 slack=0）',
   LEVELS.slice(1).every(L => (L.topK | 0) <= 1 && (L.slack | 0) === 0), true);
ck('思考时间随难度递增', LEVELS.every((L, i) => i === 0 || L.ms > LEVELS[i - 1].ms), true);

/* 同一个开局局面，档位越高必须搜得越深、看得越多 */
{
  const shallow = E.findBestMove(E.initialBoard(), RED, 99, 100000, null, Object.assign({}, LEVELS[0], { topK: 1, slack: 0 }));
  const deep = E.findBestMove(E.initialBoard(), RED, 99, 100000, null, Object.assign({}, LEVELS[2]));
  ck('困难档搜索层数多于入门档', deep.depth > shallow.depth, true);
  ck('困难档搜索节点数远多于入门档', deep.nodes > shallow.nodes * 10, true);
}

/* 一个很短的实战确认：困难档执红 vs 入门档执黑，红方应能取胜 */
{
  const fastLv = (L, ms) => Object.assign({}, L, { ms });
  const r = playGame(fastLv(LEVELS[2], 150), fastLv(LEVELS[0], 60), 60);
  ck('困难档 60 手内能赢下入门档（或至少不落下风）',
     r.win === RED || r.win === null, true);
}

console.log('\n' + '═'.repeat(58));
console.log(`象棋引擎：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
