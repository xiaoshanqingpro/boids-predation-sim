/* W7: 真机截图(Edge headless + CDP) —— 抓"隼正在猎雁"的那一帧。
 * 做法: 打开主文件(复制到 ASCII 临时路径) -> 暂停 -> 逐帧 SIM.step() 直到某只隼
 *       lockGoose>=0 且 dashT>0(即正在对雁做制导冲刺) -> 把相机钉到"隼-雁"中点 ->
 *       等几帧渲染 -> Page.captureScreenshot。
 * 用法: node _wip/w7_shot.mjs [html] [输出png]
 * ========================================================================== */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const src = process.argv[2] || "掠食竞赛.html";
const outPng = path.resolve(process.argv[3] || "_wip/w7_shot_falcon_goose.png");
const work = path.join(os.tmpdir(), "w7shot");
fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "p.html");
fs.copyFileSync(src, page);
const url = "file:///" + page.replace(/\\/g, "/");
const PORT = 9477;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad",
  "--user-data-dir=" + path.join(work, "ud2"), "--remote-debugging-port=" + PORT,
  "--window-size=1280,1020", url], { stdio: "ignore" });
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
try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(400);
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = j.find(t => t.type === "page" && t.url.includes("p.html")); } catch { }
  }
  if (!target) throw new Error("没找到调试目标");
  await sleep(2500);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async (expression) => {
    const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("页面异常: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  await call("Runtime.enable"); await call("Page.enable");
  // 把视口调高一点: 决策日志框(decLine)在"控制"按钮组下面, 默认 878px 视口刚好被裁掉
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1290, deviceScaleFactor: 1, mobile: false });
  await sleep(600);

  const hasSim = await ev("typeof SIM !== 'undefined' && !!SIM.step");
  if (!hasSim) throw new Error("window.SIM 未就绪");
  await ev("document.getElementById('btnPause').click()");     // 暂停自动步进(渲染循环继续)
  await ev("SIM.setView3D(true)");

  const scen = await ev(`(() => {
    const rc = SIM.raptorCount.total, fal = [];
    for (let k = 0; k < rc; k++) if (SIM.hunterDetail(k).kind === "falcon") fal.push(k);
    for (let i = 0; i < 15000; i++) {
      SIM.step();
      for (const k of fal) {
        const h = SIM.hunterDetail(k);
        if ((h.lockGoose | 0) >= 0 && (h.dashT || 0) > 0) {
          // #decLine 固定 42px = 约 2.9 行 -> 第 3 行会被裁掉。这里继续逐帧推进到
          // "猎雁那条正好落在最后 3 条里最旧的一条"(= 面板第 1 行), 保证日志截图里真的看得见。
          let extra = 0, inTail = 0;
          while (extra < 14) {
            const tail = SIM.logTail(3);
            inTail = tail.findIndex(e => e.msg.indexOf("猎雁") >= 0);
            if (inTail === 0 && tail.length === 3) break;
            if (inTail < 0) break;
            SIM.step(); extra++;
          }
          const hh = SIM.hunterDetail(k), li = hh.lockGoose, gg = SIM.goose(li);
          return JSON.stringify({ found: i, extra, inTail, k, falcon: hh.label, dashT: hh.dashT, lockGoose: li,
            fx: hh.x, fy: hh.y, fz: hh.z, gx: gg.x, gy: gg.y, gz: gg.z, gooseAlive: gg.alive,
            gooseKills: SIM.stats.falconGooseKills, log: SIM.logTail(3) });
        }
      }
    }
    return "NOT_FOUND";
  })()`);
  console.log("场景:", scen);
  const s = JSON.parse(scen);
  if (s === "NOT_FOUND") { console.log("本次没抓到猎雁帧"); }
  else {
    // 相机钉在"隼-雁"中点(渲染循环每帧会把 cam.tx 朝群体质心拉 4%, 这里连续钉 30 帧)
    await ev(`(async () => {
      const mx = (${s.fx} + ${s.gx}) / 2, my = (${s.fy} + ${s.gy}) / 2, mz = (${s.fz} + ${s.gz}) / 2;
      for (let i = 0; i < 30; i++) {
        SIM.cam.tx = mx; SIM.cam.ty = my; SIM.cam.tz = mz; SIM.cam.dist = 300;
        SIM.cam.yaw = 0.7; SIM.cam.pitch = 0.34; SIM.cam.auto = false;
        await new Promise(r => requestAnimationFrame(r));
      }
      return "cam ok";
    })()`);
  }
  await sleep(400);
  const shot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(outPng, Buffer.from(shot.data, "base64"));
  console.log("截图:", outPng, fs.statSync(outPng).size, "bytes");
  const tail = await ev("JSON.stringify(SIM.logTail(8))");
  console.log("日志尾:", tail);
  ws.close();
} finally {
  try { child.kill(); } catch { }
}
