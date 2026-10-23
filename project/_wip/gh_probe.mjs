/* ============================================================================
 * W4 雁隼(GooseHunter) 验收探针 —— 在副本上跑, 不改 _checks/
 * 用法: node _wip/gh_probe.mjs [文件]   (默认 _wip/掠食竞赛-goosehunter.html)
 * 目的: 逐条给出规格 1~8 的实测数字(攻击次数/命中构成/冲刺峰值/转向速率/
 *       冷却忽略接触的帧号序列/面板与 SIM 钩子/守恒线/性能)。
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.join(here, "掠食竞赛-goosehunter.html");
const raw = fs.readFileSync(file, "utf8");
const cut = raw.indexOf('<script type="text/plain"');
const code = [...(cut > 0 ? raw.slice(0, cut) : raw).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])[0];

/* ---------------- 假 DOM(够 block1 初始化与面板刷新用) ---------------- */
function makeSandbox(seed) {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctxStub = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : (p === "createRadialGradient" || p === "createLinearGradient") ? () => grad
      : (p === "measureText" ? () => ({ width: 10 }) : (p === "canvas" ? { width: 1280, height: 720 } : noop))),
    set: (t, p, v) => (t[p] = v, true),
  });
  const els = new Map();
  const list = [];
  function mkEl(id) {
    const el = {
      id, textContent: "", innerHTML: "", value: "2000", checked: false, children: [], style: {},
      className: "", width: 1280, height: 720, onclick: null, onchange: null, oninput: null,
      classList: { toggle: noop, add: noop, remove: noop },
      getContext: () => ctxStub, addEventListener: noop,
      appendChild(c) { list.push(c); this.children.push(c); return c; },
      removeChild(c) { const k = this.children.indexOf(c); if (k >= 0) this.children.splice(k, 1); return c; },
      getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }),
    };
    return el;
  }
  const document = {
    getElementById: id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
    createElement: tag => mkEl(tag), addEventListener: noop, body: mkEl("body"),
  };
  let s = seed >>> 0;
  const M = Object.create(Math);
  M.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const sandbox = {
    document,
    window: { addEventListener: noop, removeEventListener: noop, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
    Math: M, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, console,
    localStorage: { getItem: () => null, setItem: noop },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "sim.js" });
  return { SIM: sandbox.window.SIM, els, document };
}
function angDiff(a, b) { let d = (a - b + Math.PI) % (Math.PI * 2); if (d < 0) d += Math.PI * 2; return d - Math.PI; }
function hashXY(SIM) {
  let h = 0x811c9dc5;
  const mix = v => { h ^= (v >>> 0); h = Math.imul(h, 0x01000193) >>> 0; };
  const fv = v => Math.round(v * 4096) | 0;
  for (let i = 0; i < SIM.N; i++) { const st = SIM.starling(i); if (st.alive) { mix(fv(st.x)); mix(fv(st.y)); } }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); mix(g.alive ? 1 : 0); mix(fv(g.x)); mix(fv(g.y)); }
  const rc = SIM.raptorCount;
  for (let i = 0; i < rc.total; i++) { const u = SIM.hunter(i); mix(fv(u.x)); mix(fv(u.y)); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
const out = [];
const say = s => { out.push(s); console.log(s); };
let fails = 0;
const ok = (c, msg) => { if (!c) fails++; say(`  ${c ? "✓" : "✗"} ${msg}`); };

/* ================= 探针 A: 60 秒主场景(1 只雁隼 + 默认编制) ================= */
say("\n[A] grav=1, N=2000, 默认编制(隼×2+鹰×1) + 雁隼 ×1, 3600 帧(60 秒)");
const A = makeSandbox(20261015);
{
  const SIM = A.SIM;
  SIM.setGeometry(false); SIM.setGravity(true); SIM.setN(2000); SIM.setRefill(true);
  SIM.resetPredators();
  const before = SIM.raptorCount;
  ok(before.total === 3 && before.falcons === 2 && before.eagles === 1 && before.ghunters === 0,
     `默认编制仍为 隼×2 + 鹰×1 = 3 只, 雁隼 ×0 (不破坏 headless 的编制契约)`);
  const g0 = SIM.addGooseHunter();
  ok(g0 && g0.kind === "ghunter", `SIM.addGooseHunter() 返回 kind="${g0 && g0.kind}"`);
  ok(SIM.raptorCount.total === 4 && SIM.raptorCount.ghunters === 1, `raptorCount: ${JSON.stringify(SIM.raptorCount)}`);
  ok(SIM.scores.length === 4 && SIM.kills.length === 4,
     `SIM.scores/kills 在"有雁隼"时为 3+雁隼数 = 4 元素(默认编制下仍为 3, 见下)`);
  const gi = 3;                                    // raptors 尾部
  ok(SIM.hunter(gi).kind === "ghunter", `SIM.hunter(3) 能看到雁隼(kind=${SIM.hunter(gi).kind})`);
  const ghStart = SIM.hunter(gi);                  // 起点(净位移用)

  const FRAMES = 3600, GH_COOLDOWN = SIM.ghunterConst.cooldown;
  const launchFrames = [], contacts = [], scoreGains = [], coolUpJumps = [];
  const turnG = [], turnF = [];
  let maxDashSpeed = 0, prevA = 0, prevGA = NaN, prevGSp = 0, prevFalconSpeed = [0, 0], prevFalconAng = [0, 0];
  let badScoreFrame = 0, windowMax = 0, framesGooseInView = 0, framesTargetGoose = 0, preClashes = 0, clashGains = 0;
  let prevGA2 = NaN, cruiseSat = 0, cruiseFrames = 0, pathLen = 0, prevGX = null, prevGY = 0;
  let ghStartX = 0, ghStartY = 0;
  const dashTurn = [], dashTurnF = [];
  ghStartX = ghStart.x; ghStartY = ghStart.y;
  for (let f = 0; f < FRAMES; f++) {
    const pre = SIM.ghunterInfo[0];
    const preStat = SIM.stats.ghunterCooldownContacts;
    const preKills = SIM.stats.kills;
    const preF = [SIM.hunter(0), SIM.hunter(1)];
    SIM.step();
    const gi2 = SIM.ghunterInfo[0];
    const hu = SIM.hunter(3);
    // 攻击发起帧
    if (gi2.attacks > prevA) { for (let k = prevA; k < gi2.attacks; k++) launchFrames.push(f); prevA = gi2.attacks; }
    // 冲刺速度峰值(逐帧实测, dashT>0 时本帧速度)
    if (hu.dashT > 0) { const sp = Math.hypot(hu.vx, hu.vy); if (sp > maxDashSpeed) maxDashSpeed = sp; }
    // 冷却期忽略接触(记下本帧攻击状态, 便于区分"攻击命中后同帧其它鸟的顺带接触")
    if (SIM.stats.ghunterCooldownContacts > preStat) {
      contacts.push({ f, cool: gi2.cool, dashT: hu.dashT, atk: gi2.attack, dScore: gi2.score - pre.score, dKills: gi2.kills - pre.kills,
                      preDash: pre.dashT, preCool: pre.cool, preAttack: pre.attack, clash: SIM.stats.clashes - preClashes });
    }
    // 偏好雁取证: 只要视野内有雁, 目标就应该(几乎总是)是雁
    const cc = SIM.ghunterConst;
    let gooseInView = false;
    for (let j = 0; j < SIM.M; j++) {
      const gg = SIM.goose(j); if (!gg.alive) continue;
      const ddx = gg.x - hu.x, ddy = gg.y - hu.y;
      if (ddx * ddx + ddy * ddy < cc.gooseView * cc.gooseView) { gooseInView = true; break; }
    }
    if (gooseInView && gi2.dashT === 0) { framesGooseInView++; if (gi2.tgtGoose >= 0) framesTargetGoose++; }
    // 计分只应该发生在攻击窗口内(dashT>0 且 cool==0); 互攻抢分是另一条路径(统计里能看出)
    if (gi2.score > pre.score) {
      const clashJump = SIM.stats.clashes - preClashes;
      scoreGains.push({ f, d: gi2.score - pre.score, preDash: pre.dashT, preCool: pre.cool, preAttack: pre.attack, clash: clashJump });
      if (!(pre.dashT > 0 && pre.cool === 0 && pre.attack === 1) && clashJump === 0) badScoreFrame++;
      if (clashJump > 0) clashGains++;
    }
    preClashes = SIM.stats.clashes;
    // 冷却不能被重置: 唯一合法的"上升"是攻击结算(冷却被置 300, 同帧还可能先减 1 -> 299)
    if (gi2.cool > pre.cool && !(pre.cool === 0 && gi2.cool >= GH_COOLDOWN - 1)) {
      coolUpJumps.push({ f, from: pre.cool, to: gi2.cool, dScore: gi2.score - pre.score, atk: gi2.attacks });
    }
    // 转向速率: 雁隼巡航期 / 隼盘旋期(都排除速度跃变帧 = 互攻击退/冲刺跃变的污染)
    const gSp = Math.hypot(hu.vx, hu.vy);
    if (hu.dashT === 0 && hu.stun === 0 && !Number.isNaN(prevGA) && gSp > 1 && Math.abs(gSp - prevGSp) < 0.5) {
      const dd = Math.abs(angDiff(Math.atan2(hu.vy, hu.vx), prevGA));
      turnG.push(dd); cruiseFrames++;
      if (dd > 0.9 * SIM.ghunterConst.cruiseTurn) cruiseSat++;     // 打满巡航转向上限的帧(原地打转的代理指标)
    }
    if (hu.dashT > 0 && !Number.isNaN(prevGA2)) dashTurn.push(Math.abs(angDiff(Math.atan2(hu.vy, hu.vx), prevGA2)));
    prevGA2 = hu.dashT > 0 ? Math.atan2(hu.vy, hu.vx) : NaN;
    if (prevGX !== null && hu.dashT === 0) pathLen += Math.hypot(hu.x - prevGX, hu.y - prevGY);
    prevGX = hu.x; prevGY = hu.y;
    prevGA = (hu.dashT === 0 && hu.stun === 0) ? Math.atan2(hu.vy, hu.vx) : NaN;
    prevGSp = gSp;
    for (let k = 0; k < 2; k++) {
      const h = SIM.hunter(k), ph = preF[k];
      const sp = Math.hypot(h.vx, h.vy), psp = Math.hypot(ph.vx, ph.vy);
      const a = Math.atan2(h.vy, h.vx);
      // 干净的盘旋样本: 前后两帧速度都在 CIRCLE_SPEED≈5 附近 -> 不会被互攻击退/冲刺跃变污染
      if (h.dashT === 0 && h.stun === 0 && Math.abs(sp - 5) < 0.3 && Math.abs(psp - 5) < 0.3 && Math.abs(sp - psp) < 0.3) {
        turnF.push(Math.abs(angDiff(a, prevFalconAng[k])));
      }
      if (h.dashT > 0) dashTurnF.push(Math.abs(angDiff(a, prevFalconAng[k])));   // 验收 G3 的隼基准(冲刺中)
      prevFalconSpeed[k] = sp; prevFalconAng[k] = a;
    }
    // 任意 600 帧窗口内的攻击次数
    if (f >= 599) windowMax = Math.max(windowMax, launchFrames.filter(x => x > f - 600 && x <= f).length);
  }
  const st = SIM.stats;
  const c = SIM.ghunterConst;
  const pct = (arr, q) => { if (!arr.length) return 0; const a = Array.from(arr).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
  say(`  · 攻击发起帧号: [${launchFrames.join(", ")}]  (共 ${st.ghunterAttacks} 次)`);
  say(`  · 命中构成: 雁 ${st.ghunterGoose} / 路径椋鸟 ${st.ghunterStarling} / 落空 ${st.ghunterMiss} (命中合计 ${st.ghunterHits})`);
  say(`  · 冲刺速度峰值(实测逐帧) ${maxDashSpeed.toFixed(2)} px/帧 · stats.ghunterMaxDashSpeed=${st.ghunterMaxDashSpeed.toFixed(2)}`);
  say(`  · 冷却忽略接触 ${st.ghunterCooldownContacts} 次; 前若干帧号: [${contacts.slice(0, 12).map(c => c.f).join(", ")}]`);
  const inCool = contacts.filter(x => x.cool > 0);
  say(`    其中"真·冷却期(cool>0)"的忽略接触 ${inCool.length} 次, 例: ${inCool.slice(0, 8).map(x => `f${x.f}(cool=${x.cool},dScore=${x.dScore})`).join(" ")}`);
  say(`  · 雁隼得分事件 ${scoreGains.length} 次: ${scoreGains.slice(0, 10).map(s => `f${s.f}(+${s.d})`).join(" ")}`);
  say(`  · 雁隼巡航每帧转艏: max ${Math.max(0, ...turnG).toFixed(4)} / p99 ${pct(turnG, 0.99).toFixed(4)} rad (样本 ${turnG.length})`);
  say(`  · 隼盘旋期每帧转艏: max ${Math.max(0, ...turnF).toFixed(4)} / p99 ${pct(turnF, 0.99).toFixed(4)} rad (样本 ${turnF.length})`);
  say(`  · 雁隼冲刺(制导)中每帧转艏: 均值 ${(dashTurn.reduce((a, b) => a + b, 0) / Math.max(1, dashTurn.length)).toFixed(3)} / max ${Math.max(0, ...dashTurn).toFixed(3)} rad (样本 ${dashTurn.length})`);
  say(`  · 原地打转检查: 巡航打满上限的帧 ${cruiseSat}/${cruiseFrames} = ${(cruiseSat / Math.max(1, cruiseFrames) * 100).toFixed(1)}%` +
      ` · 60 秒净位移 ${Math.hypot(SIM.hunter(3).x - ghStartX, SIM.hunter(3).y - ghStartY).toFixed(0)}px / 路径长度 ${pathLen.toFixed(0)}px` +
      ` · 最小转弯半径 巡航 ${c.cruiseRadius.toFixed(1)}px / 攻击中 ${c.strikeRadius.toFixed(1)}px`);
  say(`  · 偏好雁: 视野内有雁且非攻击中的帧 ${framesGooseInView}, 其中目标是雁的帧 ${framesTargetGoose}`);
  say(`  · 常数比: 冲刺 ${c.dashSpeed.toFixed(2)}/${c.falconDashSpeed} = ${c.speedRatio.toFixed(2)}× · 转向上限 ${c.maxTurn.toFixed(4)}/${c.falconCircleTurn} = ${c.turnRatio.toFixed(2)}× · 爬升 ${c.climbRatio.toFixed(1)}× · 俯冲 ${c.diveRatio.toFixed(1)}× · 冷却 ${c.cooldown} 帧 · 雁权重 ${c.gooseW}`);

  ok(st.ghunterAttacks >= 3, `雁隼确实在猎杀(${st.ghunterAttacks} 次攻击/60 秒)`);
  ok(windowMax <= 2, `任意 10 秒(600 帧)窗口内攻击次数 ≤ 2 —— 实测最大 ${windowMax}`);
  ok(st.ghunterHits === st.ghunterGoose + st.ghunterStarling, `命中构成自洽: ${st.ghunterHits} = ${st.ghunterGoose} + ${st.ghunterStarling}`);
  ok(st.ghunterGoose >= 1, `首选雁确实被命中: 雁 ${st.ghunterGoose} 只 / 路径椋鸟 ${st.ghunterStarling} 只`);
  ok(c.speedRatio >= 1.5 && c.turnRatio >= 1.5, `冲刺 ${c.speedRatio.toFixed(2)}× ≥1.5 · 转向上限 ${c.turnRatio.toFixed(2)}× ≥1.5`);
  ok(Math.max(0, ...turnG) >= 1.5 * Math.max(1e-6, pct(turnF, 0.99)), `实测转艏: 雁隼 max ${Math.max(0, ...turnG).toFixed(4)} ≥ 1.5×隼 p99 ${pct(turnF, 0.99).toFixed(4)}`);
  ok(framesGooseInView > 0 && framesTargetGoose / framesGooseInView > 0.9,
     `偏好雁: 视野内有雁时 ${(framesTargetGoose / Math.max(1, framesGooseInView) * 100).toFixed(1)}% 的帧把雁选为目标(${framesTargetGoose}/${framesGooseInView})`);
  ok(maxDashSpeed >= 1.5 * 8.5, `实测冲刺峰值 ${maxDashSpeed.toFixed(2)} ≥ 1.5×隼冲速 8.5 = 12.75`);
  const netDisp = Math.hypot(SIM.hunter(3).x - ghStartX, SIM.hunter(3).y - ghStartY);
  ok(cruiseSat / Math.max(1, cruiseFrames) < 0.25 && pathLen > 10000,
     `不是"原地打转": 巡航打满转向上限 ${(cruiseSat / Math.max(1, cruiseFrames) * 100).toFixed(1)}% 的帧, 60 秒路径 ${pathLen.toFixed(0)}px` +
     `(净位移 ${netDisp.toFixed(0)}px, 一路在追雁群)`);
  ok(c.cruiseRadius >= 15 && c.strikeRadius >= 40,
     `最小转弯半径: 巡航 ${c.cruiseRadius.toFixed(1)}px(体型 ~7px) / 攻击中 ${c.strikeRadius.toFixed(1)}px`);
  ok(dashTurn.length > 0 && dashTurnF.length > 0 &&
     (dashTurn.reduce((a, b) => a + b, 0) / dashTurn.length) >= 1.5 * (dashTurnF.reduce((a, b) => a + b, 0) / dashTurnF.length),
     `冲刺中(验收 G3 口径)转艏: 雁隼 ${(dashTurn.reduce((a, b) => a + b, 0) / Math.max(1, dashTurn.length) * 180 / Math.PI).toFixed(2)}°/帧` +
     ` vs 隼 ${(dashTurnF.reduce((a, b) => a + b, 0) / Math.max(1, dashTurnF.length) * 180 / Math.PI).toFixed(2)}°/帧` +
     ` = ${((dashTurn.reduce((a, b) => a + b, 0) / Math.max(1, dashTurn.length)) / Math.max(1e-9, dashTurnF.reduce((a, b) => a + b, 0) / Math.max(1, dashTurnF.length))).toFixed(2)}×`);
  ok(badScoreFrame === 0, `所有 ${scoreGains.length} 次计分都发生在"攻击窗口内且不在冷却"(${badScoreFrame} 次例外; 另有 ${clashGains} 次来自互攻抢分, 与攻击无关)`);
  ok(coolUpJumps.length === 0, `冷却值从不被意外重置(${coolUpJumps.length} 次异常上升${coolUpJumps.length ? ": " + JSON.stringify(coolUpJumps.slice(0, 5)) : ""})`);
  ok(st.ghunterCooldownContacts > 0, `冷却/巡航期撞到鸟被忽略的接触 ${st.ghunterCooldownContacts} 次(均未计分, 见上表 dScore=0)`);
  ok(inCool.length > 0, `其中"真·冷却期(cool>0)撞到鸟未触发攻击"的取证 ${inCool.length} 次`);
  ok(contacts.every(x => x.dScore === 0 || x.clash > 0 || (x.preDash > 0 && x.preCool === 0 && x.preAttack === 1)),
     `被忽略的接触帧要么没计分, 要么本帧分数来自同一帧的攻击命中(不计分 ${contacts.filter(x => x.dScore === 0).length} / 攻击命中顺带 ${contacts.filter(x => x.dScore !== 0).length})`);
  const lg = SIM.logTail(400).filter(d => d.kind === "雁隼攻击");
  const hitG = lg.filter(d => d.msg.includes("命中雁")), hitS = lg.filter(d => d.msg.includes("撞到椋鸟"));
  say(`  · 决策日志(雁隼攻击类) ${lg.length} 条, 其中"命中雁" ${hitG.length} / "撞到椋鸟" ${hitS.length}`);
  say(`    例: ${lg.slice(0, 2).map(d => `f${d.frame} ${d.who}: ${d.msg}`).join(" | ")}`);
  say(`    例: ${lg.slice(-2).map(d => `f${d.frame} ${d.who}: ${d.msg}`).join(" | ")}`);
  ok(hitS.length > 0 || st.ghunterStarling === 0, `日志里能看出"这次攻击是否撞到椋鸟"(${hitS.length} 条)`);
  // 面板
  SIM.refreshPanel();
  say(`  · raidLine: ${SIM.raidLine}`);
  say(`  · scoreBody 行数: ${A.document.getElementById("scoreBody").children.length}`);
  ok(A.document.getElementById("scoreBody").children.length === 4, `计分板动态行数 = 4(隼×2 + 鹰×1 + 雁隼×1)`);
  ok(/雁隼 ×1/.test(SIM.raidLine), `编制行含"雁隼 ×1"`);
  const fpsHtml = A.document.getElementById("fpsLine").innerHTML;
  ok(/雁隼: 1 只/.test(fpsHtml) && /攻击 12/.test(fpsHtml) && /冷却忽略接触/.test(fpsHtml),
     `面板计数行暴露雁隼统计: "${(fpsHtml.match(/雁隼:[^<]*/) || [""])[0]}"`);
  // 减员回到默认编制
  SIM.removeGooseHunter();
  ok(SIM.raptorCount.total === 3 && SIM.raptorCount.ghunters === 0, `removeGooseHunter() 后回到默认编制 ${JSON.stringify(SIM.raptorCount)}`);
  SIM.resetPredators();
  ok(SIM.raptorCount.total === 3, `resetPredators() = 默认编制(雁隼作为增援被解散)`);
  ok(SIM.scores.length === 3 && SIM.kills.length === 3,
     `默认编制(雁隼 ×0)下 SIM.scores/kills 回到严格 3 元素 = headless 的 ${"length === 3"} 断言前提`);
}

/* ================= 探针 B: 10 秒窗口(规格 4 的正面取证) ================= */
say("\n[B] 10 秒(600 帧)窗口攻击次数: 多个起点连续复测");
{
  const B = makeSandbox(777);
  const SIM = B.SIM;
  SIM.setGeometry(false); SIM.setGravity(true); SIM.setN(2000); SIM.setRefill(true);
  SIM.resetPredators(); SIM.addGooseHunter();
  const launches = []; let prev = 0;
  for (let f = 0; f < 1800; f++) {
    SIM.step();
    const g = SIM.ghunterInfo[0];
    if (g.attacks > prev) { for (let k = prev; k < g.attacks; k++) launches.push(f); prev = g.attacks; }
  }
  const counts = [];
  for (let s0 = 0; s0 + 600 <= 1800; s0 += 100) counts.push(launches.filter(x => x >= s0 && x < s0 + 600).length);
  say(`  · 攻击帧号 [${launches.join(", ")}] · 各 600 帧窗口计数 [${counts.join(", ")}]`);
  ok(Math.max(0, ...counts) <= 2, `所有 600 帧窗口内 ≤2 次(最大 ${Math.max(0, ...counts)})`);
}

/* ================= 探针 C: 守恒线(?grav=0 纯 2D) ================= */
say("\n[C] 守恒线: grav=0 时雁隼的 z 不得影响 xy 轨迹");
{
  function run(zSet) {
    const S = makeSandbox(4242);
    const SIM = S.SIM;
    SIM.setGeometry(false); SIM.setGravity(false); SIM.setN(2000); SIM.setRefill(true);
    SIM.resetPredators(); SIM.addGooseHunter();
    if (zSet !== undefined) SIM.setGhunterZ(0, zSet);
    const zSeen = new Set(); let zChanged = false;
    for (let f = 0; f < 1200; f++) {
      SIM.step();
      const g = SIM.ghunterInfo[0];
      zSeen.add(g.z.toFixed(6));
      if (Math.abs(g.z - (zSet !== undefined ? zSet : g.z)) > 1e-9 && zSet !== undefined) zChanged = true;
    }
    return { hash: hashXY(SIM), z: Array.from(zSeen), zChanged, kills: SIM.stats.kills };
  }
  const a = run(370), b = run(2000);
  say(`  · z=370  -> xy hash ${a.hash} (z 取值 ${a.z.join(",")})`);
  say(`  · z=2000 -> xy hash ${b.hash} (z 取值 ${b.z.join(",")})`);
  ok(a.hash === b.hash, `把雁隼放在两个完全不同的高度, 1200 帧后 xy 轨迹 hash 相同 -> 关重力时 z 与 xy 完全解耦`);
  ok(!a.zChanged && !b.zChanged, `关重力时雁隼的 z 逐帧不变(无 z 动力学)`);
  ok(a.kills === b.kills, `捕获数也一致(${a.kills} = ${b.kills})`);
  if (typeof makeSandbox(1).SIM.setGhunterZ !== "function") say("  ! 缺少 setGhunterZ 钩子");
}

/* ================= 探针 E: 落空/打断路径 + 冷却不变式 ================= */
say("\n[E] 落空/打断路径: N=200(稀疏), 关闭自动补充, 雁隼 ×2, 6000 帧");
{
  const E = makeSandbox(555);
  const SIM = E.SIM;
  SIM.setGeometry(false); SIM.setGravity(true); SIM.setN(200); SIM.setRefill(false);
  SIM.resetPredators(); SIM.addGooseHunter(); SIM.addGooseHunter();
  const launches = [[], []]; let prev = [0, 0];
  for (let f = 0; f < 6000; f++) {
    SIM.step();
    const info = SIM.ghunterInfo;
    for (let k = 0; k < info.length; k++) {
      if (info[k].attacks > prev[k]) { for (let x = prev[k]; x < info[k].attacks; x++) launches[k].push(f); prev[k] = info[k].attacks; }
    }
  }
  const st = SIM.stats;
  let gapOK = true, worstGap = Infinity;
  for (const L of launches) for (let i = 1; i < L.length; i++) { const g = L[i] - L[i - 1]; if (g < 300) gapOK = false; if (g < worstGap) worstGap = g; }
  say(`  · 雁隼② 攻击帧号 [${launches[1].join(", ")}]`);
  say(`  · 总攻击 ${st.ghunterAttacks} = 命中 ${st.ghunterHits}(雁 ${st.ghunterGoose}/鸟 ${st.ghunterStarling}) + 落空/打断 ${st.ghunterMiss}`);
  ok(st.ghunterAttacks === st.ghunterHits + st.ghunterMiss,
     `不变式: 每次攻击要么命中要么落空/被打断 (${st.ghunterAttacks} = ${st.ghunterHits} + ${st.ghunterMiss})`);
  ok(gapOK, `两只雁隼的相邻攻击间隔都 ≥300 帧(最小 ${worstGap === Infinity ? "-" : worstGap})`);

  // E2(确定性): 抹掉全部雁 -> 只剩稀疏椋鸟捞勺, 攻击目标常常够不着 -> 必然走到"落空"分支
  const E2 = makeSandbox(4242);
  const S2 = E2.SIM;
  S2.setGeometry(false); S2.setGravity(true); S2.setN(100); S2.setRefill(false);
  S2.resetPredators(); S2.addGooseHunter();
  for (let i = 0; i < S2.M; i++) S2.killGoose(i);
  const L2 = []; let p2 = 0;
  for (let f = 0; f < 6000; f++) {
    S2.step();
    const g = S2.ghunterInfo[0];
    if (g.attacks > p2) { for (let x = p2; x < g.attacks; x++) L2.push(f); p2 = g.attacks; }
  }
  const s2 = S2.stats;
  let gap2 = true, worst2 = Infinity;
  for (let i = 1; i < L2.length; i++) { const g = L2[i] - L2[i - 1]; if (g < 300) gap2 = false; if (g < worst2) worst2 = g; }
  say(`  · E2(无雁 + 稀疏椋鸟): 攻击 ${s2.ghunterAttacks} = 命中 ${s2.ghunterHits}(椋鸟 ${s2.ghunterStarling}) + 落空 ${s2.ghunterMiss}`);
  ok(s2.ghunterMiss > 0, `落空分支确实可达(${s2.ghunterMiss} 次落空, 每次仍进入冷却)`);
  ok(gap2, `落空后相邻攻击间隔仍 ≥300 帧(最小 ${worst2 === Infinity ? "-" : worst2})`);
  ok(s2.ghunterAttacks === s2.ghunterHits + s2.ghunterMiss, `不变式在"只追椋鸟"模式也成立`);
}

/* ================= 探针 D: 性能(N=2000 单帧 step, 交替配对 5 轮) ================= */
say("\n[D] 性能: N=2000 单帧 step(0 只 vs 1 只雁隼, 交替各 5 轮 400 帧取中位数)");
{
  const S0 = makeSandbox(1234), S1 = makeSandbox(1234);       // 同种子 -> 同鸟群演化, 差别只有雁隼
  const setup = (S, gh) => {
    const SIM = S.SIM;
    SIM.setGeometry(false); SIM.setGravity(true); SIM.setN(2000); SIM.setRefill(false);
    if (gh) { SIM.resetPredators(); SIM.addGooseHunter(); }
    for (let i = 0; i < 100; i++) SIM.step();
    return SIM;
  };
  const A0 = setup(S0, false), A1 = setup(S1, true);
  const r0 = [], r1 = [];
  for (let r = 0; r < 5; r++) {
    let t0 = performance.now(); for (let i = 0; i < 400; i++) A0.step(); r0.push((performance.now() - t0) / 400);
    t0 = performance.now(); for (let i = 0; i < 400; i++) A1.step(); r1.push((performance.now() - t0) / 400);
  }
  const med = a => Array.from(a).sort((x, y) => x - y)[a.length >> 1];
  const m0 = med(r0), m1 = med(r1);
  const d = (m1 - m0) / m0 * 100;
  say(`  · 0 只: ${r0.map(x => x.toFixed(2)).join(" / ")} ms -> 中位 ${m0.toFixed(3)}`);
  say(`  · 1 只: ${r1.map(x => x.toFixed(2)).join(" / ")} ms -> 中位 ${m1.toFixed(3)}`);
  say(`  · 差 ${d >= 0 ? "+" : ""}${d.toFixed(1)}%`);
  ok(d <= 20, `N=2000 单帧 step 劣化 ${d.toFixed(1)}% ≤ 20%`);
}

say(`\n结果: ${fails === 0 ? "全部通过" : fails + " 项未通过"}`);
process.exit(fails ? 1 : 0);
