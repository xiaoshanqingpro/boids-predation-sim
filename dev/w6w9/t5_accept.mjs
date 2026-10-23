/* ============================================================================
 * T5/W9 验收: ① 500 帧 step+render(?render=2d) 无异常 ② SIM.bench(100,[2000,20000])
 * ③ SIM.compute 钩子存在 ④ 守恒线(见 t5_conserve.mjs)
 * 用法: node _w6w9/t5_accept.mjs [文件] [渲染帧数] [bench步数]
 * ========================================================================== */
import { loadSim, setRandomSeedOverride, median } from "./jsdom_drive.mjs";

const F = process.argv[2] || "掠食竞赛_2D.html";
const RF = Number(process.argv[3] || 500);
const BS = Number(process.argv[4] || 100);

/* ---- ① step + render 无异常 ---- */
{
  /* 这一节自己 new JSDOM: 需要 beforeParse 在脚本执行**之前**把 2D 上下文换成假 ctx,
   * 否则 `const ctx = cv.getContext("2d")` 在加载期就拿到 null, render 一进去就抛。 */
  const { readHtmlCached } = await import("./jsdom_drive.mjs");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const { raw, sha256 } = readHtmlCached(F, true);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(String(e && e.message)));
  vc.on("error", e => errors.push(String(e)));
  let drawCalls = 0;
  const grad = { addColorStop() { } };
  const fake = new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => grad;
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      return () => { drawCalls++; };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  const dom = new JSDOM(raw, {
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    url: "https://local.test/?render=2d",
    beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => fake; },
  });
  const win = dom.window, SIM = win.SIM;
  console.log(`① ${F} sha256=${sha256.slice(0, 16)} · ?render=2d · step+render ${RF} 帧`);
  SIM.setPaused(true);
  setRandomSeedOverride(win, 11);
  SIM.setGeometry(false); SIM.setN(2000); SIM.setRefill(true);
  const before = errors.length;
  let steps = 0, renders = 0, thrown = null;
  const t0 = Date.now();
  for (let i = 0; i < RF; i++) {
    try { SIM.step(); steps++; } catch (e) { thrown = "step: " + (e && e.message); break; }
    try { SIM.render(); renders++; } catch (e) { thrown = "render: " + (e && e.message); break; }
  }
  const ms = Date.now() - t0;
  const errs = errors.slice(before);
  console.log(`   step ${steps}/${RF} · render ${renders}/${RF} · 假 ctx 绘图调用 ${drawCalls} 次 · 用时 ${ms}ms (${(ms / Math.max(1, RF)).toFixed(2)} ms/帧 step+render)`);
  console.log(`   异常: ${thrown || "无"}  ${thrown ? "✗" : "✓"}`);
  console.log(`   VirtualConsole 捕获 ${errs.length} 条:`);
  const uniq = [...new Set(errs.map(e => String(e).slice(0, 150)))].slice(0, 8);
  uniq.forEach(e => console.log("     · " + e));
  console.log(`   SIM.frame=${SIM.frame} aliveCount=${SIM.aliveCount} 存活雁=${SIM.galiveCount} stats.steps=${SIM.stats.steps}`);
  console.log(`   钩子: SIM.compute=${typeof SIM.compute} · SIM.bench=${typeof SIM.bench} · SIM.view3D=${SIM.view3D} · SIM.gravity=${SIM.gravity} · SIM.trail3=${JSON.stringify(SIM.trail3)} · SIM.eat3D=${SIM.eat3D} · SIM.corpses=${SIM.corpses}`);
}

/* ---- ② bench ---- */
{
  const { SIM, win } = await loadSim(F, "", { fresh: true });
  SIM.setPaused(true);
  setRandomSeedOverride(win, 11);
  if (typeof SIM.bench !== "function") { console.log("② SIM.bench 不存在 —— 无法跑"); process.exit(1); }
  const r = SIM.bench(BS, [2000, 20000]);
  console.log(`② SIM.bench(${BS}, [2000, 20000]) = ${JSON.stringify(r)}`);
}
process.exit(0);   // jsdom 的 pretendToBeVisual 会留定时器, 必须显式退出
