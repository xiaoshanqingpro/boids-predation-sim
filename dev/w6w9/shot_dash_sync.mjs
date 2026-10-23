/* 2D 版: 同事件循环内抓"鹰 + 隼同时冲刺"那一帧(?render=2d, 命中即 render+toDataURL, 不会错过) */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SRC = "C:/Users/LIHAOYANG/Desktop/资料库/鸟群掠食模拟/掠食竞赛_2D.html";
const OUT = "C:/Users/LIHAOYANG/Desktop/资料库/鸟群掠食模拟/_browser_tmp/";
const work = path.join(os.tmpdir(), "boids_shot2"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "s.html"); fs.copyFileSync(SRC, page);
const PORT = 9551;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", "file:///" + page.replace(/\\/g, "/") ], { stdio: "ignore" });   // 默认 WebGL 路径
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0;
const mk = ws => (m, p = {}) => new Promise((res, rej) => { const i = ++id;
  const on = e => { const x = JSON.parse(e.data); if (x.id === i) { ws.removeEventListener("message", on); x.error ? rej(new Error(x.error.message)) : res(x.result); } };
  ws.addEventListener("message", on); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t = null;
  for (let i = 0; i < 30 && !t; i++) { await sleep(400); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t = j.find(x => x.type === "page" && x.url.includes("s.html")); } catch {} }
  if (!t) throw new Error("无调试目标");
  await sleep(2500);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = mk(ws);
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("页面异常: " + (r.exceptionDetails.exception?.description || "").split("\n")[0]); return r.result.value; };
  console.log("模式:", await ev(`SIM.gpuMode ? SIM.gpuMode() : (location.search || "默认")`));
  console.log("准备:", await ev(`(() => { SIM.parkRaptors(1600, 1100); return "猛禽归中"; })()`));
  const res = await ev(`(() => {
    const H = k => SIM.hunterDetail(k) || {};
    const sep = (a, b) => Math.hypot((a.x||0)-(b.x||0), (a.y||0)-(b.y||0));
    let tries = 0, best = { n: -1 };
    for (let i = 0; i < 12000; i++) {
      const A = H(0), B = H(1), E = H(2);
      const d = [A.dashT||0, B.dashT||0, E.dashT||0];
      const falc = Math.max(d[0], d[1]);
      const apart = Math.min(sep(E,A), sep(E,B));
      const pn = SIM.scene;   // {panX, panY}
      const inView = o => { const sx = (o.x||0) - pn.panX, sy = (o.y||0) - pn.panY; return sx > 70 && sx < 900 && sy > 70 && sy < 680; };
      if (falc > 0 && d[2] > 0 && apart > 160 && inView(A) && inView(B) && inView(E)) {
        window.requestAnimationFrame = function () { return 0; };   // 冻住页面循环(不再 step)
        SIM.render();                                  // 手动渲染这一帧
        const cv = document.getElementById("cv");
        return { hit: true, frame: i, dashT: d, apart: Math.round(apart),
                 pos: [[Math.round(A.x),Math.round(A.y)],[Math.round(B.x),Math.round(B.y)],[Math.round(E.x),Math.round(E.y)]],
                 png: cv.toDataURL("image/png") };
      }
      if (falc > 0 && d[2] > 0 && apart > best.n) best = { n: apart, frame: i, dashT: d };
      SIM.step();
    }
    SIM.render();
    return { hit: false, best, png: document.getElementById("cv").toDataURL("image/png") };
  })()`);
  console.log("命中:", JSON.stringify({ hit: res.hit, frame: res.frame, dashT: res.dashT, apart: res.apart, pos: res.pos }));
  if (!res.hit) console.log("  未命中严格条件, 最佳:", JSON.stringify(res.best));
  const out = OUT + "w9_dash_eagle_falcon_webgl.png";
  const shot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("截图: " + out + " (" + Math.round(fs.statSync(out).size / 1024) + "KB)");
  ws.close();
} catch (e) { console.error("出错:", e.message); } finally { child.kill(); }


