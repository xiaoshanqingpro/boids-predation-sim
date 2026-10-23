/* ============================================================================
 * accept_falcon.mjs —— W3 验收: 隼的冲刺行为(多轮固定种子, 给中位数 + 观测范围)
 * 用法: node _checks\accept_falcon.mjs [html] [frames] [rounds]
 *      (SIM_HTML / SIM_FRAMES / SIM_ROUNDS 亦可; 默认 掠食竞赛.html / 5000 / 5)
 * 判据:
 *   F1  每次冲刺捕获数(分母 = 全部冲刺)      >= 1.2   [多轮中位数]
 *   F1L 每次冲刺捕获数(分母 = 曾锁定的冲刺)  >= 1.2   [多轮中位数]
 *   F2  空冲刺率(dashEats 未增)              <= 0.7   [多轮中位数]
 *   F3  冲刺判据夹角 dashAng <= 60°(严格口径, 汇总所有轮次)
 *   F4  巡航高度标准差 >= 5px(只判"不是一个平面", 报告为主)
 *   F5  连续冲刺间隔变异系数 CV >= 0.2(报告为主)
 * 单次读数会随种子摇摆(实测 F1 在 [0.75, 2.12]), 因此**结论一律用多轮中位数**。
 * 钩子: SIM.hunterDetail(k)(kind/cool/dashAng/dashTX..), 回退 SIM.hunter(k)。
 * ==========================================================================*/
import { cliHtml, cliFrames, cliFloat, loadSim, worldOf, makeReporter, setup, setSeed, readHtml, mean, stdev, cv, quantile, f1, f2 } from "./accept_lib.mjs";

const HTML = cliHtml();
const FRAMES = cliFrames(5000);
const ROUNDS = Math.round(cliFloat(4, 5));
const SEEDS = [101, 202, 303, 404, 505, 606, 707];
const { html: HTML_SRC, hash: HTML_HASH, bytes: HTML_BYTES } = readHtml(HTML);

const R = makeReporter(`accept_falcon  html=${HTML}  frames=${FRAMES}  rounds=${ROUNDS}(固定种子)`);
R.info("被测文件版本(钉扎)", `sha256:${HTML_HASH}… (${HTML_BYTES} 字节)`, "所有轮次使用同一份内容, 不受测量期间他人写入影响");

/* ---------------- 单轮测量 ---------------- */
function measure(seed, frames) {
  const { SIM, sb } = loadSim(HTML, HTML_SRC);
  setSeed(sb, seed);
  setup(SIM, { n: 2000, gravity: true, refill: false });
  const WI = worldOf(SIM);
  const rc = SIM.raptorCount;
  const hasDetail = typeof SIM.hunterDetail === "function";
  const getH = k => (hasDetail ? (SIM.hunterDetail(k) || SIM.hunter(k)) : SIM.hunter(k));
  const raw0 = SIM.hunter(0), hd0 = getH(0);
  const hasDashEats = !!raw0 && Object.prototype.hasOwnProperty.call(raw0, "dashEats");
  const hasDashAng = Object.prototype.hasOwnProperty.call(hd0, "dashAng");
  const kindOf = k => { const h = getH(k); return h && typeof h.kind === "string" ? h.kind : null; };
  let FIDX = []; for (let k = 0; k < rc.total; k++) if (kindOf(k) === "falcon") FIDX.push(k);
  if (!FIDX.length) FIDX = [0, 1];
  const eatsOf = k => { const raw = SIM.hunter(k); return raw && raw.dashEats !== undefined ? raw.dashEats : getH(k).dashEats; };

  const dashes = [], cruiseZ = [], headingMax = [], dashAngList = [];
  const prevInDash = new Array(rc.total).fill(false), prevVel = new Array(rc.total).fill(null);
  const prevKills = new Array(rc.total).fill(0), killsDuringDash = new Array(rc.total).fill(0);
  const cur = new Array(rc.total).fill(null);
  const speedOf = h => Math.hypot(h.vx, h.vy, h.vz || 0);
  let maxSpeedSeen = 0;

  for (let f = 1; f <= frames; f++) {
    SIM.step();
    for (let k = 0; k < rc.total; k++) {
      const h = getH(k);
      const sp = speedOf(h);
      if (sp > maxSpeedSeen) maxSpeedSeen = sp;
      const inDash = (h.dashT || 0) > 0;
      const kNow = SIM.kills[k] || 0;
      if (inDash) {
        if (!prevInDash[k]) {
          let ang = null, angSrc = null;
          if (hasDashAng && Number.isFinite(h.dashAng) && h.dashAng > 0) { ang = h.dashAng * 180 / Math.PI; angSrc = "dashAng"; }
          else if (prevVel[k] && Math.hypot(prevVel[k][0], prevVel[k][1]) > 1e-6 && sp > 1e-6) {
            const a = Math.atan2(h.vy, h.vx), b = Math.atan2(prevVel[k][1], prevVel[k][0]);
            let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d;
            ang = d * 180 / Math.PI; angSrc = "差分";
          }
          cur[k] = { k, start: f, lock0: h.lockIdx, eats0: eatsOf(k), angDeg: ang, angSrc, kills0: kNow,
                     dashFrames: 0, lockedFrames: 0, lockedAtAny: false };
          if (ang !== null) { headingMax.push(ang); if (angSrc === "dashAng") dashAngList.push(ang); }
        }
        cur[k].dashFrames++;
        if ((h.lockIdx | 0) >= 0) { cur[k].lockedFrames++; cur[k].lockedAtAny = true; }
        killsDuringDash[k] += Math.max(0, kNow - prevKills[k]);
      } else {
        if (prevInDash[k] && cur[k]) { cur[k].end = f; cur[k].eats1 = eatsOf(k); cur[k].kills1 = kNow; dashes.push(cur[k]); cur[k] = null; }
        if (Number.isFinite(h.z)) cruiseZ.push(h.z);
      }
      prevInDash[k] = inDash; prevVel[k] = [h.vx, h.vy]; prevKills[k] = kNow;
    }
  }
  for (let k = 0; k < rc.total; k++) if (cur[k]) { cur[k].end = frames; cur[k].eats1 = eatsOf(k); cur[k].kills1 = SIM.kills[k] || 0; dashes.push(cur[k]); }

  const fd = dashes.filter(d => FIDX.includes(d.k));
  const locked = fd.filter(d => d.lockedAtAny);
  const kills = FIDX.reduce((s, k) => s + (SIM.kills[k] || 0), 0);
  const empty = fd.filter(d => (d.eats1 || 0) - (d.eats0 || 0) <= 0).length;
  const gaps = [];
  for (const k of FIDX) {
    const ds = fd.filter(d => d.k === k).sort((a, b) => a.start - b.start);
    for (let i = 1; i < ds.length; i++) gaps.push(ds[i].start - ds[i - 1].start);
  }
  const perFalcon = FIDX.map(k => {
    const ds = fd.filter(d => d.k === k);
    const raw = SIM.hunter(k) || {};
    return { k, dashes: ds.length, kills: SIM.kills[k] || 0, ratio: (SIM.kills[k] || 0) / Math.max(1, ds.length),
             lockedFrac: ds.length ? ds.filter(d => d.lockedAtAny).length / ds.length : NaN,
             dietGoose: raw.dietGoose, dietStarling: raw.dietStarling,
             hitGoose: raw.hitGoose, hitStarling: raw.hitStarling };
  });
  return { seed, WI, FIDX, hasDashEats, hasDashAng, fd, locked, kills, empty, gaps, perFalcon, cruiseZ, headingMax, dashAngList, maxSpeedSeen,
           killsDuringDash: FIDX.reduce((s, k) => s + (killsDuringDash[k] || 0), 0) };
}

/* ---------------- 多轮 ---------------- */
const rows = [];
for (let i = 0; i < ROUNDS; i++) {
  try {
    const r = measure(SEEDS[i % SEEDS.length], FRAMES);
    rows.push(r);
    R.info(`第 ${i + 1} 轮(seed ${r.seed})`, `冲刺 ${r.fd.length} 次(锁定 ${r.locked.length}) / 捕获 ${r.kills} → `
      + `F1=${f2(r.kills / Math.max(1, r.fd.length))} F1L=${f2(r.kills / Math.max(1, r.locked.length))} `
      + `空冲刺率=${f2(r.empty / Math.max(1, r.fd.length))}`);
  } catch (e) { R.say(`  第 ${i + 1} 轮失败: ${e.message}`); }
}
if (!rows.length) { R.say("  所有轮次都失败, 无法给出结论"); R.finish(); process.exit(2); }

const vals = (f) => rows.map(f).filter(Number.isFinite);
const stat = (a) => ({ med: quantile(a, 0.5), lo: Math.min(...a), hi: Math.max(...a) });
const F1s = vals(r => r.kills / Math.max(1, r.fd.length));
const F1Ls = vals(r => r.kills / Math.max(1, r.locked.length));
const F2s = vals(r => r.empty / Math.max(1, r.fd.length));
const F3s = vals(r => quantile(r.dashAngList.length ? r.dashAngList : [NaN], 0.9));
const F4s = vals(r => stdev(r.cruiseZ));
const F5s = vals(r => cv(r.gaps));
const su = stat(F1s), sl = stat(F1Ls), s2 = stat(F2s), s3 = stat(F3s), s4 = stat(F4s), s5 = stat(F5s);

R.info("轮数汇总", `${rows.length} 轮 × ${FRAMES} 帧; 每轮冲刺 ${rows.map(r => r.fd.length).join("/")}; 捕获 ${rows.map(r => r.kills).join("/")}`);
R.check("F1 每次冲刺捕获数(捕获/全部冲刺) 中位数", su.med, ">=", 1.2, `观测范围 ${f2(su.lo)}~${f2(su.hi)}`);
R.check("F1L 每次冲刺捕获数(捕获/曾锁定冲刺) 中位数", sl.med, ">=", 1.2, `观测范围 ${f2(sl.lo)}~${f2(sl.hi)}; 未锁定冲刺占比 ${f1(100 * (1 - mean(rows.map(r => r.locked.length / Math.max(1, r.fd.length)))))}%`);
R.check("F2 空冲刺率 中位数", s2.med, "<=", 0.7, `观测范围 ${f2(s2.lo)}~${f2(s2.hi)}`);
R.info("F3 严格口径 dashAng 汇总", `n=${rows.reduce((s, r) => s + r.dashAngList.length, 0)}, P50=${f1(quantile(rows.flatMap(r => r.dashAngList), 0.5))}, P90=${f1(quantile(rows.flatMap(r => r.dashAngList), 0.9))}, max=${f1(Math.max(...rows.flatMap(r => r.dashAngList)))}`);
R.check("F3 冲刺判据夹角 dashAng > 60° 的样本数(汇总全部轮次)", rows.flatMap(r => r.dashAngList).filter(a => a > 60 + 1e-6).length, "==", 0,
  "dashAng 由 tryDash 通过判据后才写入, 越界即真 bug");
R.info("F4 巡航高度标准差(px) 中位数", f1(s4.med), `范围 ${f1(s4.lo)}~${f1(s4.hi)}; 方差中位 ${f1(s4.med * s4.med)}`);
R.check("F5 冲刺间隔变异系数 CV 中位数", s5.med, ">=", 0.2, `范围 ${f2(s5.lo)}~${f2(s5.hi)}; 间隔均值 ${f1(mean(rows.flatMap(r => r.gaps)))} 帧`);

/* 逐隼拆分(跨轮聚合) */
R.say("  ---- 逐隼拆分(多轮聚合) ----");
const allIdx = [...new Set(rows.flatMap(r => r.FIDX))];
for (const k of allIdx) {
  const rs = rows.map(r => r.perFalcon.find(p => p.k === k)).filter(Boolean);
  const dsum = rs.reduce((s, p) => s + p.dashes, 0), ksum = rs.reduce((s, p) => s + p.kills, 0);
  const ratios = rs.map(p => p.ratio).filter(Number.isFinite);
  const goose = rs.reduce((s, p) => s + (p.dietGoose || 0), 0);
  const star = rs.reduce((s, p) => s + (p.dietStarling || 0), 0);
  R.check(`隼#${k} 每次冲刺捕获数(跨轮合计)`, ksum / Math.max(1, dsum), ">=", 1.2,
    `${rs.length} 轮合计 捕获 ${ksum} / 冲刺 ${dsum}; 各轮比 ${ratios.map(f2).join("/")}; 中位 ${f2(quantile(ratios, 0.5))}`);
  R.info(`  隼#${k} 捕获目标构成(雁:椋鸟)`, goose + star > 0 ? `雁 ${goose} / 椋鸟 ${star}` : "不可测",
    goose + star > 0 ? "" : "缺钩子: 主文件只有 eagle/ghunter 维护 dietGoose/dietStarling, 隼的捕获不区分物种");
}
const kd = rows.map(r => r.killsDuringDash), kt = rows.map(r => r.kills);
R.info("捕获来源", `冲刺帧内捕获 ${kd.join("/")} vs 总捕获 ${kt.join("/")} —— 差值来自互攻/抢夺等非冲刺窗口`);
R.info("最大猛禽速度(各轮)", rows.map(r => f1(r.maxSpeedSeen)).join("/"), "含俯冲红利 DIVE_BOOST");
R.info("冲刺目标构成(雁:椋鸟)", "不可测(缺钩子): 主文件只有 eagle(diet*) 与 ghunter(hit*) 维护分物种食谱, "
  + "隼的捕获只累加 kills 不区分物种; 若要「冲刺目标构成」需主文件暴露 lockKind/dashTargetKind, 或给隼加 dietGoose/dietStarling");
if (!rows[0].hasDashEats) R.say("  [缺钩子] SIM.hunter(k).dashEats 缺失, 空冲刺率不可判(本轮有该字段, 见上)");
R.finish();
