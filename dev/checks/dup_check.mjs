import fs from "node:fs";
const html = fs.readFileSync("掠食竞赛-webgpu.html","utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const seen = new Map();
blocks.forEach((b, bi) => {
  b.split("\n").forEach((line, ln) => {
    const m = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (!m) return;
    const name = m[1];
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push(`block${bi+1}:${ln+1}`);
  });
});
const dup = [...seen.entries()].filter(([, v]) => new Set(v.map(x => x.split(":")[0])).size > 1);
console.log(dup.length ? dup.map(([k, v]) => `  ${k}  ->  ${v.join(", ")}`).join("\n") : "  无跨块重名");
console.log(`块数=${blocks.length}, 各块顶层声明数=${blocks.map(b=>b.split("\n").filter(l=>/^(?:const|let|var|function|class)\s/.test(l)).length).join("/")}`);
