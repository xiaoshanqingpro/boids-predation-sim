import fs from "node:fs";
let src = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const edits = [
  ["function chainRelockPick(f, r2) {",
   "function chainRelockPick(f, r2) {\n  globalThis.__D = { r2, chainR: PVV.chainR, chainR2: PVV.chainR2, p5: f.policy.p[5], plen: f.policy.p.length, evalP: f.policy.evalP ? f.policy.evalP.length : -1, mob: PVV.mobTol };"],
  ["        globalThis.__CRPCALL = (globalThis.__CRPCALL|0) + 1; globalThis.__CRPVAL = cand;",
   "        globalThis.__CRPCALL = (globalThis.__CRPCALL|0) + 1; globalThis.__CRPVAL = cand; globalThis.__CRPPROBE = __crpProbe(f, PV_.chainR2);"],
];
const inst = `
function __crpProbe(f, r2) {
  let nIn = 0, nCone = 0;
  const sp = Math.hypot(f.vx, f.vy);
  for (let j = 0; j < N; j++) {
    if (!alive[j]) continue;
    const ex = minImageX(P[2*j] - f.x), ey = minImageY(P[2*j+1] - f.y);
    const d2 = ex*ex + ey*ey;
    if (d2 > r2 || d2 <= 1e-9) continue;
    nIn++;
    if (sp > 1e-9 && (ex*f.vx + ey*f.vy)/(Math.sqrt(d2)*sp) >= F_CHAIN_COS) nCone++;
  }
  return { sp, r2, nIn, nCone };
}
`;
src = src.replace("function chainRelockPick(f, r2) {", inst + "function chainRelockPick(f, r2) {");
for (const [a, b] of edits) {
  if (src.split(a).length - 1 !== 1) console.log("WARN anchor", a.slice(0, 40));
  src = src.replace(a, b);
}
fs.writeFileSync("_w6w9/dbg5.html", src);
console.log("ok", src.length);
