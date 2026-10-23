/* 精测: 每帧 mob 的真实分布 + 冲刺被 mob 打断的比例 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_mob"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "m.html"); fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/");
const PORT = 9521;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0;
const connect = ws => (m, p = {}) => new Promise((res, rej) => { const i = ++id;
  const on = e => { const x = JSON.parse(e.data); if (x.id === i) { ws.removeEventListener("message", on); x.error ? rej(new Error(x.error.message)) : res(x.result); } };
  ws.addEventListener("message", on); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t = null;
  for (let i = 0; i < 30 && !t; i++) { await sleep(400); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t = j.find(x => x.type === "page" && x.url.includes("m.html")); } catch {} }
  if (!t) throw new Error("无调试目标");
  await sleep(2500);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async e => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "异常:" + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
  console.log(await ev(`(() => {
    // 每帧 step 后立刻读 mob(此时就是本帧统计值), 统计分布 + 冲刺被 mob 打断的比例
    const mobs = [], dashLens = [], interrupted = [];
    const prev = []; let duringDash = 0, mobHighDuringDash = 0;
    const cur = [];
    for (let t = 0; t < 1200; t++) {
      SIM.step();
      const n = SIM.raptorCount.total;
      for (let k = 0; k < n; k++) {
        const h = SIM.hunterDetail(k);
        if (h.kind !== "falcon") continue;
        if (t % 3 === 0) mobs.push(h.mob);
        if (h.dashT > 0) { duringDash++; if (h.mob >= 25) mobHighDuringDash++; cur[k] = (cur[k]||0) + 1; if (prev[k]) {} prev[k] = 1; }
        else if (prev[k]) { dashLens.push(cur[k]||1); cur[k] = 0; prev[k] = 0; }
      }
    }
    mobs.sort((a,b)=>a-b);
    return JSON.stringify({
      隼mob分位: { min: mobs[0], p50: mobs[Math.floor(mobs.length*0.5)], p90: mobs[Math.floor(mobs.length*0.9)], max: mobs[mobs.length-1] },
      样本数: mobs.length,
      冲刺帧总数: duringDash, 其中mob超过阈值的帧: mobHighDuringDash,
      超过阈值占比: (100*mobHighDuringDash/Math.max(1,duringDash)).toFixed(1) + "%",
      冲刺时长样本: dashLens.slice(0,24),
      stats: { mobInterrupts: SIM.stats.mobInterrupts, lockedDashes: SIM.stats.lockedDashes, missFalcon: SIM.stats.missFalcon, kills: SIM.stats.kills }
    });
  })()`));
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
