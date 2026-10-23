/* W4 验收 G3a(冲刺中转向速率均值 / 隼)在 W7 bandit 开/关下的对照测量
 * 目的: 判定 G3a 在 (4) 上掉到 1.465 是 T2(bandit) 引入的, 还是 T1(falcon DASH_HOME_K) 引入的。
 * 用法: node _w6w9/t2_g3a.mjs [frames] [seed] [rounds] */
import { loadSim, setRandomSeedOverride } from "./jsdom_drive.mjs";
const FRAMES = Number(process.argv[2] || 8000);
const SEED = Number(process.argv[3] || 1);
const ROUNDS = Number(process.argv[4] || 3);
const speedOf = h => Math.hypot(h.vx, h.vy, h.vz || 0);
const turnDeg = (h, pv) => {
  if (!pv) return null;
  const sp = speedOf(h), pn = Math.hypot(pv[0], pv[1]);
  if (sp < 1e-6 || pn < 1e-6) return null;
  let d = Math.abs(Math.atan2(h.vy, h.vx) - Math.atan2(pv[1], pv[0])) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d * 180 / Math.PI;
};
async function one(bandit) {
  const { SIM, win } = await loadSim("掠食竞赛(4).html", "?grav=1");
  setRandomSeedOverride(win, SEED + (bandit ? 0 : 1000));
  SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true); SIM.resetPredators(); SIM.addGhunter();
  SIM.setBandit(bandit);
  const rc = SIM.raptorCount.total;
  const kind = [];
  for (let k = 0; k < rc; k++) kind.push(SIM.hunter(k).kind);
  const gh = kind.indexOf("ghunter"), fk = kind.map((k, i) => k === "falcon" ? i : -1).filter(i => i >= 0);
  let ghS = 0, ghN = 0, fS = 0, fN = 0;
  const pv = new Array(rc).fill(null), pin = new Array(rc).fill(false);
  for (let f = 0; f < FRAMES; f++) {
    SIM.step();
    for (let k = 0; k < rc; k++) {
      const h = SIM.hunter(k), inDash = (h.dashT || 0) > 0, td = turnDeg(h, pv[k]);
      if (inDash && td !== null) { if (k === gh) { ghS += td; ghN++; } if (fk.includes(k)) { fS += td; fN++; } }
      pv[k] = [h.vx, h.vy]; pin[k] = inDash;
    }
  }
  const ghT = ghN ? ghS / ghN : NaN, fT = fN ? fS / fN : NaN;
  return { bandit, ghT, fT, ratio: ghT / fT, ghN, fN, attacks: SIM.stats.ghunterAttacks,
           goose: SIM.stats.ghunterGoose, starling: SIM.stats.ghunterStarling };
}
const rows = { on: [], off: [] };
for (let r = 0; r < ROUNDS; r++) {
  rows.on.push(await one(true));
  rows.off.push(await one(false));
}
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
for (const mode of ["on", "off"]) {
  const rs = rows[mode];
  console.log(`bandit=${mode}: 冲刺中转向均值 ghunter=${rs.map(x => x.ghT.toFixed(2)).join("/")}deg/帧(n=${rs.map(x => x.ghN).join("/")})` +
              ` 隼=${rs.map(x => x.fT.toFixed(2)).join("/")}deg/帧(n=${rs.map(x => x.fN).join("/")})` +
              ` 比值=${rs.map(x => x.ratio.toFixed(2)).join("/")} 中位=${med(rs.map(x => x.ratio)).toFixed(3)}` +
              ` 攻击=${rs.map(x => x.attacks).join("/")} 雁${rs.map(x => x.goose).join("/")}/鸟${rs.map(x => x.starling).join("/")}`);
}
