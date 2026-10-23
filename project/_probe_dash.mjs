/* 诊断: 隼为什么不出击 —— 连续采样冲刺相关状态与各闸门 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_dash"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "d.html"); fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/") + (process.argv[2] || "");
const PORT = 9501;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0;
const connect = ws => (m, p = {}) => new Promise((res, rej) => { const i = ++id;
  const on = e => { const x = JSON.parse(e.data); if (x.id === i) { ws.removeEventListener("message", on); x.error ? rej(new Error(x.error.message)) : res(x.result); } };
  ws.addEventListener("message", on); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t = null;
  for (let i = 0; i < 30 && !t; i++) { await sleep(400); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t = j.find(x => x.type === "page" && x.url.includes("d.html")); } catch {} }
  if (!t) throw new Error("无调试目标");
  await sleep(2500);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "异常:" + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
  console.log("常量/闸门:", await ev(`JSON.stringify({
      dashMin: SIM.dashInfo ? SIM.dashInfo() : null,
      stats: { lockedDashes: SIM.stats.lockedDashes, missFalcon: SIM.stats.missFalcon, noLockAborts: SIM.stats.noLockAborts, mobInterrupts: SIM.stats.mobInterrupts, kills: SIM.stats.kills },
      raptors: SIM.raptorCount })`));
  console.log("t(s)  冲刺累计 | 隼① dashT/energy/circleT/cool | 隼② ...");
  let prev = null;
  for (let i = 0; i < 14; i++) {
    const s = await ev(`(() => {
      const f = [];
      for (let k = 0; k < SIM.raptorCount.total; k++) { const h = SIM.hunterDetail(k); f.push(h.kind + ":dash=" + h.dashT + ",E=" + Math.round(h.energy) + ",circle=" + h.circleT + ",cool=" + (h.cool||0) + ",lock=" + h.lockIdx + ",mob=" + h.mob); }
      return JSON.stringify({ dashes: SIM.stats.lockedDashes, miss: SIM.stats.missFalcon, aborts: SIM.stats.noLockAborts, mob: SIM.stats.mobInterrupts, fps: SIM.scene ? 0 : 0, f });
    })()`);
    const o = JSON.parse(s);
    const line = `  ${(i * 1.5).toFixed(1).padStart(4)}  ${String(o.dashes).padStart(4)} (空${o.miss}/无目标放弃${o.aborts}/围攻打断${o.mob}) | ${o.f.join(" | ")}`;
    console.log(line);
    prev = o;
    await sleep(1500);
  }
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
