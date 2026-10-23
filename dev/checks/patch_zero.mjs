/* 允许"隼减到 0"所需的守卫(第 8 轮修正④) —— 用文件承载补丁, 避免 shell/引号转义问题 */
import fs from "node:fs";
const p = "掠食竞赛.html";
let t = fs.readFileSync(p, "utf8");
const NL = "\n";
let n = 0;
const reps = [
  // 1) 允许隼减到 0 + activeId 夹取
  ['  if (kind === "falcon" && falcons.length > 1) {' + NL +
   '    const g = falcons.pop();' + NL +
   '    const at = raptors.indexOf(g); if (at >= 0) raptors.splice(at, 1);' + NL +
   '    activeId = activeId % falcons.length;',
   '  if (kind === "falcon" && falcons.length > 0) {        // 【第 8 轮修正④】允许减到 0 只(纯鸟群观察)' + NL +
   '    const g = falcons.pop();' + NL +
   '    const at = raptors.indexOf(g); if (at >= 0) raptors.splice(at, 1);' + NL +
   '    activeId = falcons.length ? (activeId % falcons.length) : 0;'],
  // 2) resetPredators: 缺员时重建默认编制(隼可减到 0 之后必须)
  ['    const f0 = falcons[0], f1 = falcons[1];' + NL +
   '    f0.x = W / 2; f0.y = inOpen ? -40 : H * 0.15; f0.vx = 0; f0.vy = CIRCLE_SPEED; f0.circleT = 30;' + NL +
   '    f1.x = W / 2; f1.y = inOpen ? H + 40 : H * 0.85; f1.vx = 0; f1.vy = -CIRCLE_SPEED; f1.circleT = 200;',
   '    // 【第 8 轮修正④】"重置猛禽" = 回到默认编制: 被减掉的隼/鹰重建回来' + NL +
   '    let kAdd = falcons.length;' + NL +
   '    while (falcons.length < 2) {' + NL +
   '      const k = falcons.length;' + NL +
   '      const nf = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],' + NL +
   '        "隼" + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON" + (k > 0 ? "-" + (k + 1) : ""),' + NL +
   '        W / 2, inOpen ? (k ? H + 40 : -40) : H * (k ? 0.85 : 0.15),' + NL +
   '        0, k ? -CIRCLE_SPEED : CIRCLE_SPEED, k ? 200 : 30);' + NL +
   '      falcons.push(nf); raptors.push(nf);' + NL +
   '    }' + NL +
   '    while (eagles.length < 1) { const ne = makeEagle(W * 0.7, H * 0.7, "鹰① EAGLE"); eagles.push(ne); raptors.push(ne); }' + NL +
   '    const f0 = falcons[0], f1 = falcons[1];' + NL +
   '    f0.x = W / 2; f0.y = inOpen ? -40 : H * 0.15; f0.vx = 0; f0.vy = CIRCLE_SPEED; f0.circleT = 30;' + NL +
   '    f1.x = W / 2; f1.y = inOpen ? H + 40 : H * 0.85; f1.vx = 0; f1.vy = -CIRCLE_SPEED; f1.circleT = 200;'],
  // 3) SIM.scores/kills 守卫 falcons[0]
  ['get scores() { return [falcons[0].score, falcons[1] ? falcons[1].score : 0, eagles[0] ? eagles[0].score : 0]; },',
   'get scores() { return [falcons[0] ? falcons[0].score : 0, falcons[1] ? falcons[1].score : 0, eagles[0] ? eagles[0].score : 0]; },'],
  ['get kills() { return [falcons[0].kills, falcons[1] ? falcons[1].kills : 0, eagles[0] ? eagles[0].kills : 0]; },',
   'get kills() { return [falcons[0] ? falcons[0].kills : 0, falcons[1] ? falcons[1].kills : 0, eagles[0] ? eagles[0].kills : 0]; },'],
];
for (const [a, b] of reps) {
  if (t.includes(a)) { t = t.split(a).join(b); n++; }
  else console.log("miss: " + a.split(NL)[0].slice(0, 60));
}
fs.writeFileSync(p, t);
console.log("guards patched: " + n + "/" + reps.length);
