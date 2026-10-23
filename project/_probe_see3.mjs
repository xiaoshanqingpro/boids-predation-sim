/* 诊断3: 叠加层的变换/透明度/像素直方图 + 用已知绘制点验证 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_see4"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "s.html"); fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/");
const PORT = 9491;
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
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "异常: " + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
  console.log(await ev(`(() => {
    const a = document.getElementById("cv"), g = a.getContext("2d");
    const tr = g.getTransform();
    const st = { transform: {a:tr.a,b:tr.b,c:tr.c,d:tr.d,e:tr.e,f:tr.f}, globalAlpha: g.globalAlpha, op: g.globalCompositeOperation,
                 canvasH: g.canvas.height, canvasW: g.canvas.width };
    // 直接在左上角画一个测试矩形, 看像素是否落地(判断画布是否可写、坐标是否被变换)
    g.save(); g.setTransform(1,0,0,1,0,0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    g.fillStyle = "#ff00ff"; g.fillRect(4, 4, 20, 20); g.restore();
    const d = g.getImageData(6, 6, 1, 1).data;
    const hist = {}; const dd = g.getImageData(0,0,a.width,a.height).data;
    for (let i = 3; i < dd.length; i += 4 * 37) { const v = dd[i]; hist[v] = (hist[v]||0)+1; }
    return JSON.stringify({ ...st, 测试矩形像素: [d[0],d[1],d[2],d[3]], alpha直方图: hist });
  })()`));
  console.log("猛禽数量/位置:", await ev(`JSON.stringify(SIM.raptors ? SIM.raptors.length : SIM.raptorCount)`));
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
