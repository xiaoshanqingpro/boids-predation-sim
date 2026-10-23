import { spawn } from "node:child_process";
import { findEdge } from "../_edge.mjs";
const EDGE = findEdge();
const work = process.env.TEMP + "\\boids_browser_test";
const url = "file:///" + work.replace(/\\/g,"/") + "/t.html?compute=cpu";
const ud = work + "\\ud_cdp";
const child = spawn(EDGE, ["--headless=new","--no-sandbox","--disable-breakpad","--user-data-dir="+ud,
  "--remote-debugging-port=9333","--window-size=1280,760", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function evaluate(ws, id, expr) {
  return new Promise((res) => {
    const onMsg = ev => {
      const m = JSON.parse(ev.data);
      if (m.id === id) { ws.removeEventListener("message", onMsg); res(m.result && m.result.result && m.result.result.value); }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true, awaitPromise: true } }));
  });
}
try {
  let list = null;
  for (let i = 0; i < 25 && !list; i++) {
    await sleep(400);
    try { const r = await fetch("http://127.0.0.1:9333/json/list"); const j = await r.json();
      list = j.find(t => t.type === "page" && t.url.includes("t.html")); } catch {}
  }
  if (!list) throw new Error("没找到调试目标");
  await sleep(2500);                                    // 让仿真跑起来
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  const before = await evaluate(ws, 1, "JSON.stringify(SIM.raptorCount)+' | '+SIM.raidLine+' | backend='+SIM.compute.backend");
  const clicked = await evaluate(ws, 2, "document.getElementById('btnAddFalcon').click(); document.getElementById('btnAddEagle').click(); document.getElementById('btnAddEagle').click(); 'clicked'");
  await sleep(2500);
  const after = await evaluate(ws, 3, "JSON.stringify({count:SIM.raptorCount, raid:SIM.raidLine, kills:SIM.raidKills, alive:SIM.aliveCount, frame:SIM.frame, errs:(window.__errs||0)})");
  const frames = await evaluate(ws, 4, "SIM.frame");
  console.log("点击前:", before);
  console.log("点击后:", after);
  console.log("点击后总帧数:", frames, "(还在跑 = 增援个体已进入逐帧仿真)");
  ws.close();
} finally {
  child.kill();
}
