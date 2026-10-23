/* 诊断2: 叠加层是否抛错 + 画布尺寸是否被世界尺寸污染 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_see3"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "s.html"); fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/");
const PORT = 9481;
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
  await sleep(3500);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "页面异常: " + (r.exceptionDetails.exception?.description || ""); return r.result.value; };
  console.log("画布尺寸:", await ev(`(() => {
    const a = document.getElementById("cv"), b = document.getElementById("glcv"), st = document.getElementById("stage");
    return JSON.stringify({ cv: [a.width, a.height], glcv: [b.width, b.height],
      stage: st ? [st.clientWidth, st.clientHeight] : null,
      cvCSS: [a.clientWidth, a.clientHeight], world: SIM.worldInfo() });
  })()`));
  console.log("手动渲染:", await ev(`(() => { try { SIM.render(); return "ok (未抛错)"; } catch (e) { return "抛错: " + e.message + " | " + (e.stack||"").split("\\n")[1]; } })()`));
  console.log("叠加层像素抽样:", await ev(`(() => {
    const a = document.getElementById("cv"); const g = a.getContext("2d");
    const d = g.getImageData(0, 0, a.width, a.height).data;
    let nz = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    for (let y = 0; y < a.height; y += 2) for (let x = 0; x < a.width; x += 2) {
      if (d[(y * a.width + x) * 4 + 3] > 8) { nz++; if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y; }
    }
    return JSON.stringify({ 非透明采样点: nz, 包围盒: nz ? [minx, miny, maxx, maxy] : null, 画布: [a.width, a.height] });
  })()`));
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
