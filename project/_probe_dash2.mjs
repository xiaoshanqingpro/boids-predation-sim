/* 诊断: 冲刺实际持续帧数 + 是否被边界预测(boundPredOut/dashT=min(dashT,1))掐断 */
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_dash2"); fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "d.html"); fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/") + (process.argv[2] || "");
const PORT = 9511;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760", "--enable-unsafe-webgpu", url], { stdio: "ignore" });
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
  console.log(await ev(`(() => {
    // 同步跑 1800 帧(=30 秒), 逐帧记录隼的冲刺时长与各闸门
    const dur = []; let prevDash = [0,0,0,0], cur = [0,0,0,0], starts = 0, maxD = 0;
    const energyAtStart = [], lockAtStart = [];
    let minE = 999, cirPositive = 0, lockCount = 0, frames = 0;
    for (let t = 0; t < 1800; t++) {
      SIM.step(); frames++;
      const n = SIM.raptorCount.total;
      for (let k = 0; k < n; k++) {
        const h = SIM.hunterDetail(k);
        if (h.kind !== "falcon") continue;
        if (h.dashT > 0) { cur[k]++; if (cur[k] > maxD) maxD = cur[k]; if (!prevDash[k]) { starts++; energyAtStart.push(Math.round(h.energy)); lockAtStart.push(h.lockIdx); } prevDash[k] = 1; }
        else { if (prevDash[k]) { dur.push(cur[k]); cur[k] = 0; } prevDash[k] = 0; }
        if (h.energy !== undefined && h.energy < minE) minE = h.energy;
        if (h.circleT > 0) cirPositive++;
        if (h.lockIdx >= 0) lockCount++;
      }
    }
    dur.sort((a,b)=>a-b);
    return JSON.stringify({
      帧数: frames, 隼冲刺发起次数: starts, 冲刺时长_最小: dur[0], 中位: dur[Math.floor(dur.length/2)], 最大: dur[dur.length-1],
      冲刺时长分布: dur.slice(0,20), 冲刺起始能量: energyAtStart.slice(0,12), 冲刺起始lock: lockAtStart.slice(0,12),
      隼最低能量: minE, 冲刺中lock帧数: lockCount, circleT为正的帧数: cirPositive,
      stats: { lockedDashes: SIM.stats.lockedDashes, missFalcon: SIM.stats.missFalcon, noLockAborts: SIM.stats.noLockAborts, mobInterrupts: SIM.stats.mobInterrupts, kills: SIM.stats.kills, dashEnds: SIM.stats.dashEnds }
    });
  })()`));
  ws.close();
} catch (e) { console.error("诊断出错:", e.message); } finally { child.kill(); }
