/* W7 参数扫描: 从任意 html 生成"常量被覆盖"的变体文件(只改 `const NAME = 数值;` 这一行)。
 * 用法: node _wip/w7_variant.mjs <src.html> <out.html> "NAME=VAL,NAME2=VAL2"
 * 目的: 主文件受 _wip/main.lock 保护, 参数扫描一律在 _wip 副本上做, 不动主文件。 */
import fs from "node:fs";
const [src, out, spec] = process.argv.slice(2);
if (!src || !out || !spec) { console.error("用法: node _wip/w7_variant.mjs <src> <out> \"A=1,B=2\""); process.exit(2); }
let t = fs.readFileSync(src, "utf8");
const applied = [];
for (const kv of spec.split(",")) {
  const [name, val] = kv.split("=");
  const re = new RegExp("const " + name + " = ([-+0-9.eE]+);");
  if (!re.test(t)) { console.error(`锚点未命中: const ${name} = <number>;`); process.exit(3); }
  t = t.replace(new RegExp("(const " + name + " = )([-+0-9.eE]+)(;)", "g"), (_m, a, _old, c) => a + val + c);
  applied.push(`${name}=${val}`);
}
fs.writeFileSync(out, t, "utf8");
console.log(`variant ${out} <- ${src} [${applied.join(" ")}] bytes=${t.length}`);
