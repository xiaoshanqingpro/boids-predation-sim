/* 计分板稳定性验证: 连续采样表头/单元格的 x 坐标, 必须完全不变(否则就是"跳") */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const work = path.join(os.tmpdir(), "boids_panel");
fs.mkdirSync(work, { recursive: true });
const page = path.join(work, "p.html");
fs.copyFileSync("掠食竞赛.html", page);
const url = "file:///" + page.replace(/\\/g, "/") + "?diag=1";
const PORT = 9461;
const child = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-breakpad", "--user-data-dir=" + path.join(work, "ud"),
  "--remote-debugging-port=" + PORT, "--window-size=1280,760",
  "--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0;
const connect = ws => (method, params = {}) => new Promise((res, rej) => {
  const myId = ++id;
  const on = ev => { const m = JSON.parse(ev.data); if (m.id === myId) { ws.removeEventListener("message", on); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  ws.addEventListener("message", on);
  ws.send(JSON.stringify({ id: myId, method, params }));
});
try {
  let target = null;
  for (let i = 0; i < 30 && !target; i++) { await sleep(400); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = j.find(t => t.type === "page" && t.url.includes("p.html")); } catch {} }
  if (!target) throw new Error("没找到调试目标");
  await sleep(2500);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  const call = connect(ws);
  const ev = async expr => {
    const r = await call("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception && r.exceptionDetails.exception.description || "页面异常");
    return r.result.value;
  };
  const probe = `(() => {
    const ths = [...document.querySelectorAll('#scoreTable th')].map(e => +e.getBoundingClientRect().left.toFixed(2));
    const sts = [...document.querySelectorAll('#scoreTable td.st')].map(e => +e.getBoundingClientRect().left.toFixed(2));
    const p = document.getElementById('panel').getBoundingClientRect();
    return { ths, sts, panelW: +p.width.toFixed(2), rows: document.getElementById('scoreBody').children.length,
             decH: +document.getElementById('decLine').getBoundingClientRect().height.toFixed(2),
             stateTexts: [...document.querySelectorAll('#scoreTable td.st')].map(e => e.textContent) };
  })()`;
  const samples = [];
  for (let i = 0; i < 6; i++) { samples.push(await ev(probe)); await sleep(900); }
  const before = samples[0], after = samples[samples.length - 1];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  console.log("采样 1 表头 x:", JSON.stringify(before.ths), " 状态列 x:", JSON.stringify(before.sts));
  console.log("采样 6 表头 x:", JSON.stringify(after.ths), " 状态列 x:", JSON.stringify(after.sts));
  console.log("表头 x 全程不变:", samples.every(s => same(s.ths, before.ths)));
  console.log("状态列 x 全程不变:", samples.every(s => same(s.sts, before.sts)));
  console.log("面板宽度全程:", samples.map(s => s.panelW).join("/"), " 决策日志高度:", samples.map(s => s.decH).join("/"));
  console.log("状态文本长度:", samples.map(s => s.stateTexts.map(t => t.length).join(",")).join(" | "));
  console.log("状态文本示例:", JSON.stringify(samples[0].stateTexts), "->", JSON.stringify(samples[5].stateTexts));
  // 加一只隼/鹰(编制变化会重建表格)后, 列宽必须仍然一致
  await ev("(()=>{SIM.addFalcon();SIM.addEagle();return 1})()");
  await sleep(1200);
  const grown = await ev(probe);
  console.log("编制变化后表头 x:", JSON.stringify(grown.ths), " 行数:", grown.rows, " 与之前同宽:", same(grown.ths, before.ths));
  await ev("(()=>{SIM.removeFalcon();SIM.removeEagle();return 1})()");
  ws.close();
} catch (e) { console.error("面板验证出错:", e.message); } finally { child.kill(); }
