/* 诊断: 猛禽在三维视角下看不见 —— 取坐标/相机/投影关系 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_see2"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "s.html"); fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/") + (process.argv[2] || "");
const PORT = 9471;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0;
const connect = ws => (m, p = {}) => new Promise((res, rej) => { const i = ++id;
  const on = e => { const x = JSON.parse(e.data); if (x.id === i) { ws.removeEventListener("message", on); x.error ? rej(new Error(x.error.message)) : res(x.result); } };
  ws.addEventListener("message", on); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t = null;
  for (let i = 0; i < 30 && !t; i++) { await sleep(400); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t = j.find(x => x.type === "page" && x.url.includes("s.html")); } catch {} }
  if (!t) throw new Error("无调试目标");
  await sleep(3000);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "页面异常"); return r.result.value; };
  console.log("视角:", JSON.stringify(await ev("SIM.scene")));
  console.log("世界:", JSON.stringify(await ev("SIM.worldInfo()")));
  console.log(await ev(`(() => {
    let sx=0, sy=0, sz=0, c=0;
    for (let i=0;i<SIM.N;i++){ const s=SIM.starling(i); if(s.alive){ sx+=s.x; sy+=s.y; sz+=s.z; c++; } }
    sx/=c; sy/=c; sz/=c;
    const out = ["鸟群质心 (" + sx.toFixed(0) + "," + sy.toFixed(0) + "," + sz.toFixed(0) + ")"];
    for (let k=0;k<SIM.raptorCount.total;k++){
      const h = SIM.hunterDetail ? SIM.hunterDetail(k) : SIM.hunter(k);
      out.push("  #" + k + " " + (h.kind||"?") + " label=" + h.label + " xyz=(" + h.x.toFixed(0) + "," + h.y.toFixed(0) + "," + (h.z||0).toFixed(0) + ")"
        + " 水平距质心=" + Math.hypot(h.x-sx, h.y-sy).toFixed(0) + " 高度差=" + ((h.z||0)-sz).toFixed(0)
        + " dashT=" + h.dashT + " vz=" + (h.vz||0).toFixed(2));
    }
    return out.join("\\n");
  })()`));
  // 叠加层是否画了猛禽: 统计画布上猛禽标签颜色的像素? 改为读 renderOverlay 的可见性判定
  console.log("绘制判定:", await ev(`(() => {
    const g = window.SIM; const r = [];
    for (let k=0;k<SIM.raptorCount.total;k++){ const h = SIM.hunter(k); r.push({k, kind:h.kind, x:h.x, y:h.y, z:h.z}); }
    return JSON.stringify({ n: r.length, camAuto: SIM.scene.camAuto, camDist: SIM.scene.camDist, camYaw: +SIM.scene.camYaw.toFixed(3), camPitch: +SIM.scene.camPitch.toFixed(3) });
  })()`));
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
