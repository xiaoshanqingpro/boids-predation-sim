/* ============================================================================
 * §5 剩余验收(真机 Edge + CDP): #2 拖拽/滚轮/自动环绕 · #4 重力动力学 ·
 *   #5 编制减员(隼1/鹰0) · #7 SIM 钩子逐个
 * 用法: node _checks/cdp_accept.mjs [html路径]
 * 说明: 用 Node 内置 WebSocket 连 CDP; 页内用同步小循环采样, 结果结构化打印。
 * ========================================================================== */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findEdge } from "../_edge.mjs";

const EDGE = findEdge();
const src = process.argv[2] || "掠食竞赛.html";
const work = path.join(os.tmpdir(), "boids_cdp");
fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "acc.html");
fs.copyFileSync(src, page);
const url = "file:///" + page.replace(/\\/g, "/") + "?diag=1&log=1";
const PORT = 9451;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad",
  "--user-data-dir=" + path.join(work, "ud"), "--remote-debugging-port=" + PORT,
  "--window-size=1280,760", "--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let id = 0;
function connect(ws) {
  return (method, params = {}) => new Promise((res, rej) => {
    const myId = ++id;
    const on = ev => { const m = JSON.parse(ev.data); if (m.id === myId) { ws.removeEventListener("message", on); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
    ws.addEventListener("message", on);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}
const results = {};
try {
  let target = null;
  for (let i = 0; i < 30 && !target; i++) {
    await sleep(400);
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = j.find(t => t.type === "page" && t.url.includes("acc.html")); } catch {}
  }
  if (!target) throw new Error("没找到调试目标");
  await sleep(2500);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async (expr) => {
    const r = await call("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception && r.exceptionDetails.exception.description || "页面异常");
    return r.result.value;
  };
  await call("Runtime.enable"); await call("Page.enable");

  // ---------- #2 相机交互: 拖拽 / 滚轮 / 自动环绕 ----------
  const cam0 = await ev("JSON.stringify(SIM.scene)");
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: 520, y: 320, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 6; i++) await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 520 + i * 12, y: 320 + i * 6, button: "left", buttons: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: 592, y: 356, button: "left", buttons: 0 });
  const cam1 = await ev("JSON.stringify(SIM.scene)");
  await call("Input.dispatchMouseEvent", { type: "mouseWheel", x: 520, y: 320, deltaX: 0, deltaY: -300 });
  await sleep(120);
  const cam2 = await ev("JSON.stringify(SIM.scene)");
  await ev("(()=>{const cb=document.getElementById('cbAuto');cb.checked=true;cb.onchange({target:{checked:true}});return 1})()");
  const yawA = await ev("SIM.scene.camYaw"); await sleep(1200);
  const yawB = await ev("SIM.scene.camYaw");
  results["#2 相机交互"] = { before: JSON.parse(cam0), afterDrag: JSON.parse(cam1), afterWheel: JSON.parse(cam2),
    autoYawDelta: +(yawB - yawA).toFixed(4),
    dragChanged: JSON.parse(cam0).camYaw !== JSON.parse(cam1).camYaw || JSON.parse(cam0).camPitch !== JSON.parse(cam1).camPitch,
    wheelChangedDist: JSON.parse(cam1).camDist !== JSON.parse(cam2).camDist,
    autoOrbits: Math.abs(yawB - yawA) > 1e-4 };

  // ---------- #4 重力动力学 ----------
  results["#4 重力动力学"] = await ev(`(() => {
    SIM.setGravity(true); SIM.setRefill(false); SIM.resetFlocks(); SIM.resetPredators();
    let maxDash = 0, maxStoop = 0, maxCorpses = 0;
    let zLo = 1e9, zHi = -1e9;
    for (let i = 0; i < 1500; i++) {
      SIM.step();
      const zr = SIM.zRange;
      if (zr.starling) { if (zr.starling.lo < zLo) zLo = zr.starling.lo; if (zr.starling.hi > zHi) zHi = zr.starling.hi; }
      if (SIM.corpses > maxCorpses) maxCorpses = SIM.corpses;
      for (let k = 0; k < SIM.raptorCount.total; k++) {
        const h = SIM.hunter(k);
        if (h.dashT > 0) { const sp = Math.sqrt(h.vx*h.vx + h.vy*h.vy + (h.vz||0)*(h.vz||0)); if (sp > maxDash) maxDash = sp; }
        if (-(h.vz||0) > maxStoop) maxStoop = -(h.vz||0);
      }
    }
    const zr = SIM.zRange;
    // 之后停止捕食, 看尸体是否落地消散
    for (let i = 0; i < 900; i++) { SIM.parkRaptors(-9999, -9999); SIM.step(); }
    return { maxDashSpeed: +maxDash.toFixed(2), maxStoopVz: +maxStoop.toFixed(2),
             maxCorpses, corpsesAfterParked: SIM.corpses,
             starlingZmin: +zLo.toFixed(1), starlingZmax: +zHi.toFixed(1),
             starlingAloft: zLo > 10, gooseLayerAbove: (zr.goose && zr.starling) ? +(zr.goose.mean - zr.starling.mean).toFixed(1) : null,
             kills: SIM.kills.reduce((a,b)=>a+b,0), logCount: SIM.logCount };
  })()`);

  // ---------- #5 编制减员 ----------
  results["#5 编制减员"] = await ev(`(() => {
    SIM.setGravity(true);
    while (SIM.raptorCount.falcons > 1) SIM.removeFalcon();
    while (SIM.raptorCount.eagles > 0) SIM.removeEagle();
    for (let i = 0; i < 30; i++) SIM.step();
    SIM.refreshPanel();
    const g = id => (document.getElementById(id) || {}).textContent;
    return { count: SIM.raptorCount, scores: SIM.scores, kills: SIM.kills,
             dom: { s0: g("s0"), s1: g("s1"), s2: g("s2"), k0: g("k0"), k1: g("k1"), k2: g("k2"), raid: g("raidLine") },
             qLen: SIM.Q.length, eps: SIM.eps, diet: SIM.diet,
             noEagleOk: SIM.raptorCount.eagles === 0 };
  })()`);
  const shot = await call("Page.captureScreenshot", { format: "png" });
  const outPng = path.join("_browser_tmp", "round8_noeagle.png");
  fs.writeFileSync(outPng, Buffer.from(shot.data, "base64"));
  results["#5 截图"] = outPng;

  // ---------- #8 第 8 轮之三: 三维拖尾 + 动态计分板 ----------
  results["#8 拖尾与面板"] = await ev(`(() => {
    const gi = SIM.glInfo || {};
    const rows = document.getElementById("scoreBody");
    const cnt = rows && rows.children ? rows.children.length : -1;
    const s0 = document.getElementById("s0"), k2 = document.getElementById("k2");
    const before = SIM.trail3;
    const set = SIM.setTrail3(true, 9, 0.6, 0.5);
    const off = SIM.setTrail3(false);
    SIM.setTrail3(true);
    return { gl3dTrailProgram: !!gi.trail3, gl3dBirdProgram: !!gi.prog3,
             trailBefore: before, trailSet: set, trailOff: off.on, trailRestored: SIM.trail3.on,
             scoreRows: cnt, hasS0: !!s0, hasK2: !!k2,
             s0Text: s0 ? s0.textContent : null, k2Text: k2 ? k2.textContent : null,
             viewLine: (document.getElementById("viewLine") || {}).textContent,
             statsLine: (document.getElementById("fpsLine") || {}).textContent ? "ok" : "空" };
  })()`);

  // ---------- #7 SIM 钩子逐个 ----------
  results["#7 SIM 钩子"] = await ev(`(() => {
    const out = {};
    const t = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = "ERR: " + e.message; } };
    t("setGravity", () => { SIM.setGravity(false); const a = SIM.scene.gravity; SIM.setGravity(true); return { off: a, on: SIM.scene.gravity, hook: typeof SIM.setGravity }; });
    t("setView3D", () => { SIM.setView3D(false); const a = SIM.scene.view3D; SIM.setView3D(true); return { top: a, back: SIM.scene.view3D }; });
    t("removeFalcon", () => { const n0 = SIM.raptorCount.falcons; SIM.addFalcon(); const n1 = SIM.raptorCount.falcons; SIM.removeFalcon(); return { n0, afterAdd: n1, afterRemove: SIM.raptorCount.falcons }; });
    t("removeEagle", () => { const n0 = SIM.raptorCount.eagles; SIM.addEagle(); const n1 = SIM.raptorCount.eagles; SIM.removeEagle(); return { n0, afterAdd: n1, afterRemove: SIM.raptorCount.eagles }; });
    t("cam", () => ({ yaw: +SIM.scene.camYaw.toFixed(3), pitch: +SIM.scene.camPitch.toFixed(3), dist: +SIM.scene.camDist.toFixed(1), auto: SIM.scene.camAuto }));
    t("corpses", () => SIM.corpses);
    t("hunterZ", () => { const h = SIM.hunter(0); return { z: +h.z.toFixed(1), vz: +(h.vz||0).toFixed(2), hasKeys: Object.keys(h) }; });
    t("zRange", () => { const z = SIM.zRange; return { starlingMean: z.starling ? +z.starling.mean.toFixed(1) : null, gooseMean: z.goose ? +z.goose.mean.toFixed(1) : null }; });
    t("log", () => { const n = SIM.logCount; const tail = SIM.log(2); return { count: n, tail }; });
    t("setSize3D", () => { const a = SIM.size3D; const b = SIM.setSize3D(5); SIM.setSize3D(a); return { before: a, set5: b, restored: SIM.size3D }; });
    return out;
  })()`);

  ws.close();
} catch (e) {
  console.error("验收脚本出错:", e.message);
} finally {
  child.kill();
}
console.log(JSON.stringify(results, null, 1));
