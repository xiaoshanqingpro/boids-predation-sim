import fs from "node:fs";
let src = fs.readFileSync("_w6w9/sandbox_T1.html", "utf8");
const a = "  PVV.chainR2 = PVV.chainR * PVV.chainR;";
if (src.split(a).length - 1 !== 1) throw new Error("anchor chainR2");
src = src.replace(a, a + "\n  globalThis.__D2 = { chainR: PVV.chainR, d: denorm(P_CHAIN_R, p[5]), base: P_CHAIN_R[0], p5: p[5], len: p.length, spec: P_CHAIN_R.slice() };");
fs.writeFileSync("_w6w9/dbg6.html", src);
console.log("ok");
