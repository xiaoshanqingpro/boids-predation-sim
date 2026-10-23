/* 真机复现: 2D 版点"雁隼 ＋"是否崩 + 崩溃后渲染是否停 + 计分板小数实况 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { findEdge } from "../_edge.mjs";
// 脚本在 dev/w6w9/ 下，上溯两级即仓库根；原来写死的是本机桌面副本目录。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EDGE = findEdge();
const work = path.join(os.tmpdir(), "boids_gh2"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "g.html"); fs.copyFileSync(path.join(ROOT, "掠食竞赛_2D.html"), page);
const url = "file:///" + page.replace(/\\/g, "/") + (process.argv[2] || "");
const PORT = 9531;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0;
const connect = ws => (m, p = {}) => new Promise((res, rej) => { const i = ++id;
  const on = e => { const x = JSON.parse(e.data); if (x.id === i) { ws.removeEventListener("message", on); x.error ? rej(new Error(x.error.message)) : res(x.result); } };
  ws.addEventListener("message", on); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t = null;
  for (let i = 0; i < 30 && !t; i++) { await sleep(400); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t = j.find(x => x.type === "page" && x.url.includes("g.html")); } catch {} }
  if (!t) throw new Error("无调试目标");
  await sleep(3000);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "页面异常: " + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
  // 装错误陷阱 + 取基线
  await ev(`window.__errs=[]; window.addEventListener('error', e => window.__errs.push(String(e.message))); window.addEventListener('unhandledrejection', e => window.__errs.push('rej: '+String(e.reason))); 1`);
  const f0 = await ev(`SIM.stats ? SIM.stats.steps : -1`);
  console.log("加雁隼前: steps=" + f0 + "  编制=" + JSON.stringify(await ev("SIM.raptorCount")));
  // 点按钮（真实的 DOM 点击路径）
  console.log("点击 btnGPlus:", await ev(`(() => { const b = document.getElementById("btnGPlus"); if (!b) return "按钮缺失"; b.onclick ? b.onclick() : b.click(); return "已点击"; })()`));
  await sleep(1500);
  console.log("点击后: 编制=" + JSON.stringify(await ev("SIM.raptorCount")) + "  steps=" + await ev("SIM.stats ? SIM.stats.steps : -1"));
  console.log("捕获到的错误:", JSON.stringify(await ev("window.__errs")));
  console.log("render 是否还活着: " + await ev(`(() => { const a=SIM.stats?SIM.stats.steps:-1; return new Promise(r=>setTimeout(()=>r((SIM.stats?SIM.stats.steps:-1)>a ? "是(帧在推进)" : "否(帧停了 ✗)"),1200)); })()`));
  console.log("计分板文本:", await ev(`(() => { const rows=[...document.querySelectorAll("#scoreBody tr")].map(tr=>[...tr.querySelectorAll("td")].map(td=>td.textContent).join("|")); return JSON.stringify({rows, total: document.getElementById("scoreTotal")?.textContent, rate: document.getElementById("rateTotal")?.textContent, scores: Array.from(SIM.scores)}); })()`));
  // 跑一会儿让分数出现小数，再看计分板
  await ev(`(() => { for (let i=0;i<1500;i++) SIM.step(); return 1; })()`);
  console.log("1500 帧后计分板:", await ev(`(() => { const rows=[...document.querySelectorAll("#scoreBody tr")].map(tr=>[...tr.querySelectorAll("td")].map(td=>td.textContent).join("|")); return JSON.stringify({rows, total: document.getElementById("scoreTotal")?.textContent, scores: Array.from(SIM.scores)}); })()`));
  const shot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ROOT, "project", "_browser_tmp", "w9_gh2.png"), Buffer.from(shot.data, "base64"));
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
