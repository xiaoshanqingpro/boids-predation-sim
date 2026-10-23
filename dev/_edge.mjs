/* 定位 Edge 可执行文件：先看 EDGE_PATH 环境变量，再按 Windows 的 Program Files 环境变量拼标准安装路径。
 * 原先有 6 个脚本各自硬编码了 Edge 的整条本机安装路径（带盘符与用户名所在的系统目录），
 * 换机器就失效；这里统一成不写死本机路径的查找（找不到再退回 PATH 里的 msedge.exe）。 */
import fs from "node:fs";
import path from "node:path";

const CANDIDATES = [
  process.env.EDGE_PATH,
  process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft/Edge/Application/msedge.exe"),
].filter(Boolean);

export function findEdge() {
  for (const p of CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { /* 环境变量异常时继续试下一个 */ }
  }
  return "msedge.exe";   // 交给 PATH 解析；找不到时由 spawn 报 ENOENT
}

export const EDGE = findEdge();
