/* ============================================================================
 * W4 本地复刻 _checks/accept_ghunter.mjs 的采样, 用来隔离验收脚本里的两个索引缺陷:
 *   缺陷① rc = SIM.raptorCount 在 addGhunter() 之前取, 帧循环用 k < rc.total
 *          -> 新加的 ghunter(索引 3) 根本没被采样 (G2/G3 恒为 0 / n/a)
 *   缺陷② windows.push(...) 写在 if (isGh) 之外 -> G1 数的是"所有猛禽"的冲刺起始
 * 用法: node _wip/gh_accept_local.mjs [html] [frames]
 * 输出三种口径:
 *   [原样]       = 完全照抄 accept_ghunter 的采样 (应复现 FAIL)
 *   [只修①]      = 采样含 ghunter, 但 G1 仍数所有猛禽
 *   [①②都修]    = 只数 ghunter 的攻击起始, 采样含 ghunter (预期 PASS)
 * ==========================================================================*/
import { cliHtml, cliFrames, loadSim, setup, mean, f1, f2 } from "../_checks/accept_lib.mjs";

const HTML = cliHtml("_wip/掠食竞赛-goosehunter.html");
const FRAMES = cliFrames(5000);
const TEN = 600, MULT = 1.5;
const patches = [];
const P = (name, pass, line) => { patches.push({ name, pass, line }); console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}: ${line}`); };

function run(mode) {                          // mode: "orig" | "fixIdx" | "fixBoth"
  const { SIM } = loadSim(HTML);
  setup(SIM, { n: 2000, gravity: true, refill: false });
  const rcBefore = SIM.raptorCount;
  SIM.addGhunter();
  const total = SIM.raptorCount.total;
  const kindOf = k => { const h = SIM.hunter(k); return h && h.kind; };
  const gh = [], fk = [];
  for (let k = 0; k < total; k++) { const kd = kindOf(k); if (kd === "ghunter") gh.push(k); if (kd === "falcon") fk.push(k); }
  const scanN = mode === "orig" ? rcBefore.total : total;      // 缺陷①
  let ghPeak = 0, fPeak = 0, ghTS = 0, ghTN = 0, fTS = 0, fTN = 0, ghStarts = 0, allStarts = 0;
  const ghFrames = [], eatsIn = [];
  const prevInDash = new Array(total).fill(false), prevVel = new Array(total).fill(null), prevEats = new Array(total).fill(0);
  const winsAll = new Map(), winsGh = new Map();
  const speedOf = h => Math.hypot(h.vx, h.vy, h.vz || 0);
  const turnDeg = (h, pv) => {
    if (!pv) return null; const sp = speedOf(h), pn = Math.hypot(pv[0], pv[1]);
    if (sp < 1e-6 || pn < 1e-6) return null;
    let d = Math.abs(Math.atan2(h.vy, h.vx) - Math.atan2(pv[1], pv[0])) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d * 180 / Math.PI;
  };
  for (let f = 1; f <= FRAMES; f++) {
    SIM.step();
    for (let k = 0; k < scanN; k++) {
      const h = SIM.hunter(k);
      const sp = speedOf(h), isGh = gh.includes(k), isF = fk.includes(k);
      if (isGh && sp > ghPeak) ghPeak = sp;
      if (isF && sp > fPeak) fPeak = sp;
      const inDash = (h.dashT || 0) > 0, td = turnDeg(h, prevVel[k]);
      if (inDash && td !== null) { if (isGh) { ghTS += td; ghTN++; } if (isF) { fTS += td; fTN++; } }
      if (inDash && !prevInDash[k]) {
        const win = Math.floor((f - 1) / TEN);
        if (isGh) { ghStarts++; ghFrames.push(f); winsGh.set(win, (winsGh.get(win) || 0) + 1); }
        allStarts++;
        if (mode !== "fixBoth") winsAll.set(win, (winsAll.get(win) || 0) + 1);   // 缺陷②
      }
      if (h.dashEats !== undefined && (h.dashEats || 0) > prevEats[k]) eatsIn.push({ f, k, eats: h.dashEats });
      prevEats[k] = h.dashEats || 0;
      prevInDash[k] = inDash; prevVel[k] = [h.vx, h.vy];
    }
  }
  const maxW = m => (m.size ? Math.max(...m.values()) : 0);
  const ghTurn = ghTN ? ghTS / ghTN : NaN, fTurn = fTN ? fTS / fTN : NaN;
  const kills = SIM.kills;
  // G5: 攻击起始间隔 / 冷却区间内的撞鸟
  const gaps = []; for (let i = 1; i < ghFrames.length; i++) gaps.push(ghFrames[i] - ghFrames[i - 1]);
  const ghEats = eatsIn.filter(e => gh.includes(e.k));
  const inCd = ghEats.filter(e => {
    let p = -1, n = Infinity;
    for (const d of ghFrames) { if (d <= e.f && d > p) p = d; if (d > e.f && d < n) n = d; }
    return p >= 0 && n < Infinity;
  });
  return { gh, fk, scanN, total, ghStarts, allStarts, ghPeak, fPeak, ghTurn, fTurn, ghTN, fTN,
           maxWAll: maxW(mode === "fixBoth" ? winsGh : winsAll), winsAll: [...winsAll.entries()], winsGh: [...winsGh.entries()],
           ghFrames, minGap: gaps.length ? Math.min(...gaps) : NaN, inCd: inCd.length, ghEats: ghEats.length, kills };
}

for (const mode of ["orig", "fixIdx", "fixBoth"]) {  console.log(`\n=== 口径 ${mode} ===`);
  const r = run(mode);
  console.log(`  采样到 raptors[0,${r.scanN}) (总 ${r.total}); ghunter 索引 ${r.gh.join(",")}; 隼索引 ${r.fk.join(",")}`);
  console.log(`  ghunter 攻击起始 ${r.ghStarts} 次, 帧号[${r.ghFrames.slice(0, 16).join(",")}]`);
  console.log(`  全猛禽攻击起始 ${r.allStarts} 次; 10 秒窗口计数(全猛禽)=${JSON.stringify(r.winsAll)}`);
  console.log(`  ghunter 10 秒窗口计数=${JSON.stringify(r.winsGh)}`);
  console.log(`  峰值速度 ghunter ${f2(r.ghPeak)} / 隼 ${f2(r.fPeak)} = ${f2(r.ghPeak / Math.max(1e-9, r.fPeak))}×`);
  console.log(`  冲刺中平均转艏 ghunter ${f2(r.ghTurn)}(n=${r.ghTN}) / 隼 ${f2(r.fTurn)}(n=${r.fTN}) = ${f2(r.ghTurn / r.fTurn)}×`);
  console.log(`  kills=${r.kills.join("/")} (长度 ${r.kills.length}); 冷却区内撞鸟事件 ${r.inCd}/${r.ghEats}; 最小攻击间隔 ${r.minGap}`);
  if (mode !== "orig") {
    P("G1 10 秒窗口 <= 2", r.maxWAll <= 2, `max=${r.maxWAll}`);
    P("G2 速度峰值 >= 1.5×", r.ghPeak / Math.max(1e-9, r.fPeak) >= MULT, `${f2(r.ghPeak / Math.max(1e-9, r.fPeak))}×`);
    P("G3 冲刺中转艏 >= 1.5×", r.ghTurn / r.fTurn >= MULT, `${f2(r.ghTurn / r.fTurn)}×`);
    P("G4 kills[3] > 0", r.kills.length >= 4 && r.kills[3] > 0, `kills=${r.kills.join("/")}`);
    P("G5a 最小间隔 >= 60", r.minGap >= 60, `${r.minGap}`);
    P("G5b 冷却区内撞鸟有取证", r.inCd > 0, `${r.inCd} 次`);
  }
}
console.log(`\n本地复刻小结: ${patches.filter(p => p.pass).length}/${patches.length} 项通过`);

/* ---- 重复 N 次只跑 fixBoth, 打印 ASCII 摘要(看 G2/G3 的稳定性) ---- */
const REP = Number(process.env.GH_REPEAT || 0);
if (REP > 0) {
  for (let i = 1; i <= REP; i++) {
    const r = run("fixBoth");
    const g2 = r.ghPeak / Math.max(1e-9, r.fPeak);
    const g3 = r.ghTurn / r.fTurn;
    const ok = r.maxWAll <= 2 && g2 >= MULT && g3 >= MULT && r.kills[3] > 0 && r.minGap >= 60 && r.inCd > 0;
    console.log(`REPEAT ${i}: ok=${ok ? 1 : 0} G1max=${r.maxWAll} G2=${g2.toFixed(2)}x G3=${g3.toFixed(2)}x` +
                ` ghTurn=${r.ghTurn.toFixed(2)} fTurn=${r.fTurn.toFixed(2)} starts=${r.ghStarts} dashFrames=${r.ghTN}/${r.fTN}` +
                ` peakGh=${r.ghPeak.toFixed(1)} peakF=${r.fPeak.toFixed(1)}` +
                ` kills=${r.kills.join("/")} minGap=${r.minGap} cdEats=${r.inCd}`);
  }
}
