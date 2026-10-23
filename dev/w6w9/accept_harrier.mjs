/* ============================================================================
 * T3/W8 驱逐鸟验收: 4 种子 × 4000 帧, 对照组 = SIM.setHarrier(false)
 * 验收项(施工文档 T3):
 *   ① 目标命中率: 全群 ≥70% 的帧数里跟在最高分猛禽 250px 内;
 *   ② 领先者得分增速比对照组降 ≥30%, 且终值 CV 缩小;
 *   ③ stats.harrierDives ≥ 3/4000 帧;
 *   ④ 存活数任意时刻恒在 0~HARRIER_N(无负无超)。
 * 两臂同起点: 同一 HTML + 同一固定种子(LCG) + setGeometry 重建 + Q 表清零。
 * 用法: node _w6w9/accept_harrier.mjs ["掠食竞赛(4).html"] [帧数]
 * ========================================================================== */
import { loadSim, setRandomSeedOverride } from "./jsdom_drive.mjs";

const HTML = process.argv[2] || "掠食竞赛(4).html";
const FRAMES = Number(process.argv[3] || 4000);
const SEEDS = [11, 22, 33, 44];
const NEAR = 250, NEAR2 = NEAR * NEAR;

async function arm(seed, harrierOn) {
  const { SIM, win, sha256, errors } = await loadSim(HTML, "");
  SIM.setPaused(true);                       // 关掉 rAF 自动推进, 只手动 step
  setRandomSeedOverride(win, seed);          // 固定随机数 -> 两臂完全配对
  SIM.setGeometry(false); SIM.setN(2000); SIM.setGravity(true); SIM.setRefill(true);
  SIM.setHarrier(harrierOn);
  if (SIM.Q) SIM.Q.fill(0);                  // 清加载期可能发生的学习, 保证两臂同起点
  const k0 = SIM.kills.slice();
  let allNear = 0, anyNear = 0, frames = 0;
  let aliveMin = 99, aliveMax = -1, over = 0, diveSeen = 0;
  let curMax = 0;
  for (let f = 1; f <= FRAMES; f++) {
    SIM.step();
    const sc = SIM.scores;
    let top = 0;
    for (let i = 1; i < sc.length; i++) if (sc[i] > sc[top]) top = i;
    curMax = sc[top];
    const hi = SIM.harrierInfo;
    if (hi.alive > aliveMax) aliveMax = hi.alive;
    if (hi.alive < aliveMin) aliveMin = hi.alive;
    if (hi.alive < 0 || hi.alive > hi.roster) over++;
    diveSeen = hi.dives;
    if (harrierOn) {
      frames++;
      let all = true, any = false;
      const tk = ["F", "F2", "E", "G"][top] || ("#" + top);
      // 最高分猛禽坐标: hunter(i) 的前 3 个索引与 scores 前三元素一致
      const H = SIM.hunter(top);
      for (const h of hi.list) {
        if (h.dead > 0) continue;
        const dx = h.x - H.x, dy = h.y - H.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= NEAR2) any = true; else all = false;
      }
      if (all) allNear++;
      if (any) anyNear++;
    }
  }
  const k1 = SIM.kills.slice();
  const scores = SIM.scores.slice();
  const kills = k1.map((v, i) => v - k0[i]);
  return {
    seed, arm: harrierOn ? "treatment" : "control", sha256, errors: errors.length,
    frames, allNear, anyNear, aliveMin, aliveMax, over,
    scores, totalKill: kills.reduce((a, b) => a + b, 0), kills,
    topScore: Math.max(...scores), maxAlive: aliveMax,
    dives: diveSeen, burned: SIM.harrierInfo.burned, downs: SIM.harrierInfo.downs,
    bumps: SIM.harrierInfo.bumps, skua: SIM.harrierInfo.skuaHits,
    consts: SIM.harrierConst,
  };
}

const cv = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; if (!m) return 0; const v = a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length; return Math.sqrt(v) / Math.abs(m); };

console.log(`== T3/W8 驱逐鸟验收: ${HTML} · ${SEEDS.length} 种子 × ${FRAMES} 帧 ==`);
const T = [], C = [];
for (const s of SEEDS) {
  const t = await arm(s, true);
  const c = await arm(s, false);
  T.push(t); C.push(c);
  console.log(`种子 ${s}: 处理 领先者 ${t.topScore.toFixed(1)} 分 | 对照 领先者 ${c.topScore.toFixed(1)} 分 | ` +
              `treat 命中率 ${(t.allNear / t.frames * 100).toFixed(1)}% (任意一只 ${(t.anyNear / t.frames * 100).toFixed(1)}%) | ` +
              `俯冲 ${t.dives} · 蒸发 ${t.burned.toFixed(1)} · 撞落 ${t.downs} · 弹开 ${t.bumps} · 贼鸥 ${t.skua} | ` +
              `存活 ${t.aliveMin}~${t.aliveMax} | 捕获 处理 ${t.totalKill} vs 对照 ${c.totalKill}`);
  console.log(`          逐只终值: 处理 [${t.scores.map(v => v.toFixed(1)).join(", ")}]  对照 [${c.scores.map(v => v.toFixed(1)).join(", ")}]`);
}
const rev = { sha256: T[0].sha256, errors: T[0].errors, consts: T[0].consts };
const growth = a => a.map(x => x.topScore);   // 全部从 0 起分, 终值 = 增速×帧数
const gT = growth(T), gC = growth(C);
const mT = gT.reduce((a, b) => a + b, 0) / gT.length, mC = gC.reduce((a, b) => a + b, 0) / gC.length;
const drop = (mC - mT) / (mC || 1) * 100;
const hitRate = T.reduce((a, x) => a + x.allNear, 0) / T.reduce((a, x) => a + x.frames, 0) * 100;
const hitAny = T.reduce((a, x) => a + x.anyNear, 0) / T.reduce((a, x) => a + x.frames, 0) * 100;
const dives = T.map(x => x.dives), aliveOK = T.every(x => x.aliveMin >= 0 && x.aliveMax <= x.consts.n && x.over === 0) && C.every(x => x.aliveMin >= 0 && x.aliveMax <= x.consts.n);
const cvT = T.map(x => cv(x.scores)), cvC = C.map(x => cv(x.scores));
const cvSeedT = cv(gT), cvSeedC = cv(gC);
console.log("\n---- 汇总 ----");
console.log(`修订 sha256 = ${rev.sha256} (加载期报错 ${rev.errors} 条)`);
console.log(`① 目标命中率(全群都在 250px 内): ${hitRate.toFixed(1)}%  ${hitRate >= 70 ? "✓ ≥70%" : "✗ <70%"}  [任意一只口径 ${hitAny.toFixed(1)}%]`);
console.log(`② 领先者终值: 处理 ${gT.map(v => v.toFixed(1)).join("/")} 均值 ${mT.toFixed(1)} | 对照 ${gC.map(v => v.toFixed(1)).join("/")} 均值 ${mC.toFixed(1)}`);
console.log(`   增速降幅 ${drop.toFixed(1)}%  ${drop >= 30 ? "✓ ≥30%" : "✗ <30%"}`);
console.log(`   组内 CV(各猛禽终值): 处理 ${cvT.map(v => v.toFixed(3)).join("/")} 均值 ${(cvT.reduce((a, b) => a + b, 0) / cvT.length).toFixed(3)}  ` +
            `对照 ${cvC.map(v => v.toFixed(3)).join("/")} 均值 ${(cvC.reduce((a, b) => a + b, 0) / cvC.length).toFixed(3)}`);
console.log(`   跨种子 CV(领先者终值): 处理 ${cvSeedT.toFixed(3)} | 对照 ${cvSeedC.toFixed(3)}  ${cvSeedT < cvSeedC ? "✓ 缩小" : "✗ 未缩小"}`);
console.log(`③ harrierDives: ${dives.join("/")} (合计 ${dives.reduce((a, b) => a + b, 0)})  ${dives.every(d => d >= 3) ? "✓ 每个种子 ≥3" : "✗ 有种子 <3"}`);
console.log(`④ 存活数: ${T.map(x => x.aliveMin + "~" + x.aliveMax).join(" | ")}  越界帧 ${T.reduce((a, x) => a + x.over, 0) + C.reduce((a, x) => a + x.over, 0)}  ${aliveOK ? "✓ 恒 0~" + rev.consts.n : "✗"}`);
console.log(`   战果: 蒸发合计 ${T.reduce((a, x) => a + x.burned, 0).toFixed(1)} 分 · 撞落 ${T.reduce((a, x) => a + x.downs, 0)} · 弹开 ${T.reduce((a, x) => a + x.bumps, 0)} · 贼鸥 ${T.reduce((a, x) => a + x.skua, 0)}`);
console.log(`   生态副产物: 总捕获 处理均值 ${(T.reduce((a, x) => a + x.totalKill, 0) / T.length).toFixed(1)} vs 对照 ${(C.reduce((a, x) => a + x.totalKill, 0) / C.length).toFixed(1)}`);
console.log(`   常量: ${JSON.stringify(rev.consts)}`);
const pass = hitRate >= 70 && drop >= 30 && cvSeedT < cvSeedC && dives.every(d => d >= 3) && aliveOK;
console.log(pass ? "\n全部验收通过" : "\n有未达标项(见上)");
