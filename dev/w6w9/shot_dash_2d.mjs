/* 2D 版: 抓"鹰 + 隼同时冲刺"那一帧(带加强拖尾)
 * 手法: 高频轮询 SIM.hunterDetail(k).dashT; 命中 -> 冻结 SIM.step(渲染循环继续、画面定格) -> 截图 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { findEdge } from "../_edge.mjs";
// 脚本在 dev/w6w9/ 下，上溯两级即仓库根；原来写死的是本机桌面副本目录。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EDGE = findEdge();
const SRC = path.join(ROOT, "掠食竞赛_2D.html");
const OUT = path.join(ROOT, "project", "_browser_tmp") + path.sep;
const work = path.join(os.tmpdir(), "boids_shot"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "s.html"); fs.copyFileSync(SRC, page);
const PORT = 9541;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", "file:///" + page.replace(/\\/g, "/")], { stdio: "ignore" });
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
  // 让猛禽在鸟群里(更容易同时冲刺), 并保证雁隼存在以验证不崩
  console.log("准备:", await ev(`(() => { SIM.parkRaptors(1600, 1100); return "猛禽已归中"; })()`));
  // 高频轮询(在页面内做, 避免往返延迟)
  const found = await ev(`(async () => {
    const H = k => SIM.hunterDetail(k) || {};
    let best = { n: -1, frame: 0, info: null };
    for (let i = 0; i < 15000; i++) {
      const d0 = (H(0).dashT || 0), d1 = (H(1).dashT || 0), d2 = (H(2).dashT || 0);
      const falc = Math.max(d0, d1), eag = d2;
      const n = (d0 > 0 ? 1 : 0) + (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0);
      const H0 = H(0), H1 = H(1), H2 = H(2);
      const sep = (a, b) => Math.hypot((a.x||0)-(b.x||0), (a.y||0)-(b.y||0));
      const apartE = Math.min(sep(H2,H0), sep(H2,H1));   // 鹰 与 最近的隼 的屏幕距离
      if (falc > 0 && eag > 0 && apartE > 160) {   // 鹰 + 隼同时冲刺 且错开>160px
        SIM.hunter(0).dashT = Math.max(SIM.hunter(0).dashT, 150); SIM.hunter(2).dashT = Math.max(SIM.hunter(2).dashT, 150);  // 延长(非伪造: 二者本就在冲刺)
        return { hit: true, frame: i, dashT: [d0, d1, d2], extended: [SIM.hunter(0).dashT, SIM.hunter(1).dashT, SIM.hunter(2).dashT] };
      }
      if (n > best.n) best = { n, frame: i, info: [d0, d1, d2] };
      SIM.step();
      if (i % 400 === 0) await new Promise(r => requestAnimationFrame(r));   // 让渲染跟上
    }
    SIM.__origStep = SIM.step; SIM.step = function () { };
    return { hit: false, best };
  })()`);
  console.log("命中:", JSON.stringify(found));
  await sleep(180);                     // 只等 2~11 帧, dash 仍在
  const shot = await call("Page.captureScreenshot", { format: "png" });
  const out = OUT + (found.hit ? "w9_dash_eagle_falcon.png" : "w9_dash_best.png");
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("截图: " + out + " (" + Math.round(fs.statSync(out).size / 1024) + "KB)");
  console.log("定格时 dashT=" + JSON.stringify(await ev(`[SIM.hunterDetail(0).dashT, SIM.hunterDetail(1).dashT, SIM.hunterDetail(2).dashT]`)));
  console.log("拖尾常量:", await ev(`[RAPTOR_TRAIL_LEN, RAPTOR_TRAIL_LEN_DASH, RAPTOR_TRAIL_W, RAPTOR_TRAIL_W_DASH, RAPTOR_TRAIL_A, RAPTOR_TRAIL_A_DASH]`));
  ws.close();
} catch (e) { console.error("出错:", e.message); } finally { child.kill(); }


