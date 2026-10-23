/* ============================================================================
 * accept_boundary.mjs —— W1 验收: 世界/视窗解耦 + 边界厌恶
 * 用法: node _checks\accept_boundary.mjs [html] [frames]
 *      (也认 SIM_HTML / SIM_FRAMES 环境变量; 默认 掠食竞赛.html / 5000 帧)
 * 判据:
 *   B1 世界尺寸与视窗尺寸独立: worldW/worldH 不随风 innerWidth/innerHeight 变化,
 *      且 worldW/worldH != 旧视口口径 (1280x720 / 视口±缓冲带)
 *   B2 稳定期(第 300 帧起)所有存活个体到四边最小距离 >= 40px
 *   B3 夹取/贴边次数 == 0: SIM.worldInfo().clampCount == 0 且 稳定期无个体 minEdge < 40px
 *   B4 出生帧(f1)单独统计并给出最小复现帧号(出生点越界 vs 飞行中越界分开报)
 * 不改主文件; 只读钩子。缺钩子时打印 NOT IMPLEMENTED 而不是崩溃。
 * ==========================================================================*/
import { cliHtml, cliFrames, loadSim, worldOf, edgeDist, makeReporter, setup, readHtml, f1 } from "./accept_lib.mjs";

const HTML = cliHtml();
const FRAMES = cliFrames(5000);
const STABLE_FROM = 300;                 // "稳定期"起点(出生点问题只影响头几帧)
const MIN_EDGE = 40;                     // 要求的边界厌恶最小距离(px)
const { html: HTML_SRC, hash: HTML_HASH, bytes: HTML_BYTES } = readHtml(HTML);

const R = makeReporter(`accept_boundary  html=${HTML}  frames=${FRAMES}`);
R.info("被测文件版本(钉扎)", `sha256:${HTML_HASH}… (${HTML_BYTES} 字节)`, "本脚本所有实例使用同一份内容");

/* ---------------- 加载 ---------------- */
let SIM, WI;
try {
  ({ SIM } = loadSim(HTML, HTML_SRC));
} catch (e) {
  R.say("  加载失败: " + e.message);
  R.finish();
  process.exit(2);
}
R.info("可用钩子 worldInfo", typeof SIM.worldInfo === "function" ? "yes" : "NO(缺钩子)");

/* ---------------- B1 世界/视窗解耦 ---------------- */
// 视口尺寸只影响 innerWidth/devicePixelRatio 这类渲染侧量; 世界尺寸必须是常量。
// 独立实例 + 非默认视口(1920x1080) 跑同一份代码, 看世界是否跟着变。
let WI2 = null;
try {
  const s2 = loadSim(HTML, HTML_SRC);
  const sb2 = s2.sb;
  sb2.innerWidth = 1920; sb2.innerHeight = 1080; sb2.devicePixelRatio = 2;
  const w2 = worldOf(s2.SIM);
  WI2 = w2;
} catch (e) { WI2 = { err: e.message }; }

setup(SIM, { n: 2000, gravity: true, refill: false });
WI = worldOf(SIM);
R.info("worldInfo()", JSON.stringify({ worldW: WI.worldW, worldH: WI.worldH, viewW: WI.viewW,
  viewH: WI.viewH, boundR: WI.boundR, torus: WI.torus, hasHook: WI.hasHook }));
if (!WI.hasHook) {
  R.skip("B1 世界/视窗解耦", "缺 SIM.worldInfo() 钩子(只有 gw/gh 可推算), 无法直接读世界尺寸");
} else {
  const viewportOld = 1280 + 2 * 170;      // 旧口径的世界宽(视口 + 2*PAD_OPEN)
  R.check("B1a worldW != 旧视口口径", WI.worldW === viewportOld ? 1 : 0, "==", 0,
    `worldW=${WI.worldW}, 旧口径=${viewportOld}`);
  const sameAsDefault = WI2 && !WI2.err && WI2.worldW === WI.worldW && WI2.worldH === WI.worldH;
  R.check("B1b 改变视口(1280x720 -> 1920x1080, dpr 2)后世界尺寸不变",
    sameAsDefault ? 0 : 1, "==", 0,
    WI2 && !WI2.err ? `1920 视口下 worldW=${WI2.worldW}x${WI2.worldH}` : `副实例失败: ${WI2 && WI2.err}`);
  R.check("B1c 视口尺寸被独立记录", (WI.viewW === 1280 && WI.viewH === 720) ? 0 : 1, "==", 0,
    `viewW=${WI.viewW}x${WI.viewH}`);
}

/* ---------------- 跑帧: 独立量 minEdge / 逐帧统计 ---------------- */
let minEdgeStable = Infinity, minEdgeSpawn = Infinity, minEdgeAll = Infinity;
let spawnFrameNo = -1, spawnWho = "", spawnPos = "";
let stableViolFrames = 0, spawnViolFrames = 0, firstStableViol = -1, firstStableViolWho = "", firstStableViolPos = "";
const edgeHist = { gt200: 0, r100_200: 0, r40_100: 0, lt40: 0 };  // 全体个体帧数分布
let individuals = 0;
let minEdgeBySpecies = { starling: Infinity, goose: Infinity, raptor: Infinity };
let raptorSpawn = [];

function scan(step) {
  const pts = [];
  for (let i = 0; i < SIM.N; i++) { const s = SIM.starling(i); if (s.alive) pts.push(["starling", i, s.x, s.y]); }
  for (let i = 0; i < SIM.M; i++) { const g = SIM.goose(i); if (g.alive) pts.push(["goose", i, g.x, g.y]); }
  for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunter(k); pts.push(["raptor", k, h.x, h.y]); }
  let frameMin = Infinity, who = "", pos = "";
  for (const [sp, i, x, y] of pts) {
    const e = edgeDist(x, y, WI.worldW, WI.worldH);
    individuals++;
    if (e < minEdgeBySpecies[sp]) minEdgeBySpecies[sp] = e;
    if (e < frameMin) { frameMin = e; who = sp + "#" + i; pos = `(${x.toFixed(0)},${y.toFixed(0)})`; }
    if (e > 200) edgeHist.gt200++; else if (e > 100) edgeHist.r100_200++; else if (e >= MIN_EDGE) edgeHist.r40_100++; else edgeHist.lt40++;
  }
  if (frameMin < minEdgeAll) minEdgeAll = frameMin;
  if (step === 1) {
    spawnFrameNo = 1; minEdgeSpawn = frameMin; spawnWho = who; spawnPos = pos;
    for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunter(k); raptorSpawn.push(`r${k}=(${h.x.toFixed(0)},${h.y.toFixed(0)})`); }
  }
  if (step >= STABLE_FROM) {
    if (frameMin < minEdgeStable) minEdgeStable = frameMin;
    if (frameMin < MIN_EDGE) {
      stableViolFrames++;
      if (firstStableViol < 0) { firstStableViol = step; firstStableViolWho = who; firstStableViolPos = pos; }
    }
  } else if (frameMin < MIN_EDGE) spawnViolFrames++;
  return frameMin;
}

let err = null;
try {
  for (let f = 1; f <= FRAMES; f++) {
    SIM.step();
    scan(f);
    if (f % 1000 === 0) {
      const w = worldOf(SIM);
      R.info(`f${f} 快照`, `我方 minEdge=${f1(minEdgeAll)} | SIM minEdgeDist=${w.minEdgeDist === null ? "null" : f1(w.minEdgeDist)} | clampCount=${w.clampCount} | peakPen=${w.peakPenetration === null ? "n/a" : f1(w.peakPenetration)}`);
    }
  }
} catch (e) { err = e.message + "\n" + e.stack; }
if (err) { R.say("  ✗ 跑帧异常: " + err); }

const WEND = worldOf(SIM);

/* ---------------- B2/B3/B4 判定 ---------------- */
R.info("世界尺寸", `${WI.worldW}x${WI.worldH}, 视口 ${WI.viewW}x${WI.viewH}, 厌恶半径 ${WI.boundR}px`);
R.info("采样个体帧数", individuals);
R.info("出生帧(f1)最小边界距离", minEdgeSpawn, `${spawnWho} ${spawnPos} | 猛禽出生点 ${raptorSpawn.join(" ")}`);
R.info("稳定期(f>=300)最小边界距离", minEdgeStable);
R.info("全程最小边界距离", minEdgeAll);
R.info("各物种全程最小边界距离", `椋鸟 ${f1(minEdgeBySpecies.starling)} / 雁 ${f1(minEdgeBySpecies.goose)} / 猛禽 ${f1(minEdgeBySpecies.raptor)}`);
R.info("边界距离分布(个体帧)", `>200px ${edgeHist.gt200} | 100~200 ${edgeHist.r100_200} | 40~100 ${edgeHist.r40_100} | <40 ${edgeHist.lt40}`);
R.info("SIM 侧统计", `clampCount=${WEND.clampCount} peakPenetration=${WEND.peakPenetration === null ? "n/a" : f1(WEND.peakPenetration)} minEdgeDist=${WEND.minEdgeDist === null ? "null" : f1(WEND.minEdgeDist)}`);

if (!WI.hasHook) {
  R.skip("B2 稳定期最小边界距离", "缺 worldInfo() 钩子, 无法取世界尺寸(仅有 gw/gh 推算)");
  R.skip("B3 夹取/贴边次数", "缺 worldInfo() 钩子, 无法读 clampCount");
} else {
  R.check("B2 稳定期(f>=" + STABLE_FROM + ")最小边界距离", minEdgeStable, ">=", MIN_EDGE,
    `违规帧 ${stableViolFrames}/${FRAMES - STABLE_FROM + 1}` + (firstStableViol > 0 ? `; 首次 f${firstStableViol} ${firstStableViolWho} ${firstStableViolPos}` : ""));
  R.check("B3a clampCount(硬夹取次数)", WEND.clampCount === null ? NaN : WEND.clampCount, "<=", 0,
    "主文件 applyBoundary 的数值兜底计数");
  R.check("B3b 稳定期贴边(个体帧 minEdge<" + MIN_EDGE + "px)帧数", stableViolFrames, "<=", 0,
    `占稳定期 ${((100 * stableViolFrames) / (FRAMES - STABLE_FROM + 1)).toFixed(2)}%`);
  // B4: 出生帧是独立缺陷类别, 分开给出(不混进 B2/B3)
  R.check("B4 出生帧(f1)边界距离(出生点越界 = 独立缺陷)", minEdgeSpawn, ">=", MIN_EDGE,
    spawnWho + " " + spawnPos + (minEdgeSpawn < MIN_EDGE ? "  <-- 出生点在世界外, 见最小复现" : ""));
}

/* ---------------- 最小复现 ---------------- */
if (minEdgeSpawn < MIN_EDGE || minEdgeStable < MIN_EDGE || (WEND.clampCount || 0) > 0) {
  R.say("  ---- 最小复现 ----");
  R.say(`  文件: ${HTML}`);
  R.say(`  复现: node _checks\\accept_boundary.mjs ${HTML} ${FRAMES}`);
  if (minEdgeSpawn < MIN_EDGE) R.say(`  症状① 出生帧越界: f1 ${spawnWho} 在 ${spawnPos}, 到最近世界边 ${f1(minEdgeSpawn)}px  (猛禽出生点 ${raptorSpawn.join(" ")})`);
  if (firstStableViol > 0) R.say(`  症状② 稳定期越界: f${firstStableViol} ${firstStableViolWho} 在 ${firstStableViolPos}, 到最近世界边 ${f1(minEdgeStable)}px`);
  if ((WEND.clampCount || 0) > 0) R.say(`  症状③ 硬夹取被触发 ${WEND.clampCount} 次`);
}
R.finish();
