
"use strict";
/* ============================================================================
 * WebGPU 计算后端(第 6 轮 / WebGPU 迁移计划 Phase 1+2B 原型)
 * ----------------------------------------------------------------------------
 * 只把 step() 的 6.1(建网格) + 6.2(拓扑 K 邻居 + 求力) 搬到 GPU, 其余全部留 CPU:
 *   GPU: clearGrid(桶头清 -1) -> insertBirds(原子头插链表) -> neighborForces(K=topoK 插入排序 + 求力)
 *   CPU: 6.3 迁徙 / 6.4 积分与事件 / 6.5 雁 / 6.6 鹰 Q / 6.7 ES / 6.8 隼 / 6.10 互攻
 * 每帧数据流(第 1 步原型, 同步回读只为量上限; 异步双缓冲是下一步):
 *   上行 P、V(各 2N f32)、ALIVE(N u32)  ≈ 320KB @N=20000
 *   下行 ACC(2N f32)                    ≈ 160KB @N=20000
 * 桶用原子头插链表(array<atomic<i32>> head + array<i32> next), 因此**桶内顺序不确定**
 * (与 CPU 的"位级一致"哲学冲突, 这是计划里已接受的取舍: 验收走统计等价)。
 * 自检: 初始化时用同一份状态分别跑 CPU 版与 GPU 版, 逐只比较 ACC; 超差就自动退回 CPU —— 
 * 这样即使 WGSL 有问题, 页面也不会给出错误的物理, 只会退回旧路径。
 * ========================================================================== */
(function () {
  const WGSL = `
struct Params {
  n: u32, gw: u32, gh: u32, topoK: u32,
  cell: f32, pad: f32, w: f32, h: f32,
  perceptionR2: f32, sepR2: f32, sepGain: f32, maxSpeed: f32,
  maxForce: f32, cohesionW: f32, alignmentW: f32, torus: u32,
};
@group(0) @binding(0) var<storage, read> P: array<f32>;        // 位置 x,y 交错
@group(0) @binding(1) var<storage, read> VV: array<f32>;        // 速度 x,y 交错
@group(0) @binding(2) var<storage, read> ALIVE: array<u32>;     // 1 = 活
@group(0) @binding(3) var<storage, read_write> ACC: array<f32>; // 出力: 每帧转向力
@group(0) @binding(4) var<storage, read_write> HEAD: array<atomic<i32>>;  // 桶链表头
@group(0) @binding(5) var<storage, read_write> NXT: array<i32>;          // 桶链表 next
@group(0) @binding(6) var<uniform> U: Params;

// 桶头清 -1: 每线程一个桶
@compute @workgroup_size(64)
fn clearGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= U.gw * U.gh) { return; }
  atomicStore(&HEAD[c], -1);
}

// 每鸟一个线程: 算桶号 -> 原子头插(next[i] = 旧 head)
@compute @workgroup_size(256)
fn insertBirds(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= U.n) { return; }
  if (ALIVE[i] == 0u) { return; }
  let x = P[2u * i];
  let y = P[2u * i + 1u];
  var cx = i32(floor((x + U.pad) / U.cell));
  var cy = i32(floor((y + U.pad) / U.cell));
  cx = clamp(cx, 0, i32(U.gw) - 1);
  cy = clamp(cy, 0, i32(U.gh) - 1);
  let c = u32(cy) * U.gw + u32(cx);
  let prev = atomicExchange(&HEAD[c], i32(i));   // 头插, 返回旧头
  NXT[i] = prev;
}

// 环面最小像(开阔世界 = 恒等映射, 与 JS 版 minImageX/Y 一致)
fn minIX(d: f32) -> f32 { if (U.torus == 1u) { return d - U.w * round(d / U.w); } return d; }
fn minIY(d: f32) -> f32 { if (U.torus == 1u) { return d - U.h * round(d / U.h); } return d; }

// 每鸟一个线程: 扫 3x3 桶的链, 取最近 topoK 只(升序槽位冒泡插入), 再按 CPU 同款公式求力
@compute @workgroup_size(256)
fn neighborForces(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= U.n) { return; }
  if (ALIVE[i] == 0u) { return; }
  let xi = P[2u * i];
  let yi = P[2u * i + 1u];
  let vxi = VV[2u * i];
  let vyi = VV[2u * i + 1u];
  var cx = i32(floor((xi + U.pad) / U.cell));
  var cy = i32(floor((yi + U.pad) / U.cell));
  cx = clamp(cx, 0, i32(U.gw) - 1);
  cy = clamp(cy, 0, i32(U.gh) - 1);

  // K 个槽位(按距离升序), 上限 16 —— 与 CPU 的 KD/KX/KY/KJ 同构
  var kd: array<f32, 16>;
  var kx: array<f32, 16>;
  var ky: array<f32, 16>;
  var kj: array<i32, 16>;
  var kn: i32 = 0;

  for (var ox = -1; ox <= 1; ox = ox + 1) {
    for (var oy = -1; oy <= 1; oy = oy + 1) {
      var gx = cx + ox;
      var gy = cy + oy;
      if (U.torus == 1u) {
        gx = ((gx % i32(U.gw)) + i32(U.gw)) % i32(U.gw);
        gy = ((gy % i32(U.gh)) + i32(U.gh)) % i32(U.gh);
      } else {
        if (gx < 0 || gx >= i32(U.gw) || gy < 0 || gy >= i32(U.gh)) { continue; }
      }
      let c = u32(gy) * U.gw + u32(gx);
      var j = atomicLoad(&HEAD[c]);
      loop {
        if (j < 0) { break; }
        let jj = u32(j);
        if (jj != i) {
          let dx = minIX(P[2u * jj] - xi);
          let dy = minIY(P[2u * jj + 1u] - yi);
          let d2 = dx * dx + dy * dy;
          if (d2 <= U.perceptionR2) {
            var p: i32 = -1;
            if (kn < i32(U.topoK)) { p = kn; kn = kn + 1; }
            else if (d2 < kd[u32(kn) - 1u]) { p = kn - 1; }
            if (p >= 0) {
              loop {                                  // 冒泡到升序位置
                if (p <= 0) { break; }
                if (kd[u32(p) - 1u] <= d2) { break; }
                kd[u32(p)] = kd[u32(p) - 1u];
                kx[u32(p)] = kx[u32(p) - 1u];
                ky[u32(p)] = ky[u32(p) - 1u];
                kj[u32(p)] = kj[u32(p) - 1u];
                p = p - 1;
              }
              kd[u32(p)] = d2; kx[u32(p)] = dx; ky[u32(p)] = dy; kj[u32(p)] = i32(jj);
            }
          }
        }
        j = NXT[jj];
      }
    }
  }

  var ax: f32 = 0.0;
  var ay: f32 = 0.0;
  if (kn > 0) {
    var psx: f32 = 0.0; var psy: f32 = 0.0;
    var vsx: f32 = 0.0; var vsy: f32 = 0.0;
    var sepx: f32 = 0.0; var sepy: f32 = 0.0;
    for (var m = 0; m < kn; m = m + 1) {
      psx = psx + kx[m];
      psy = psy + ky[m];
      let jm = u32(kj[m]);
      vsx = vsx + VV[2u * jm];
      vsy = vsy + VV[2u * jm + 1u];
      if (kd[m] < U.sepR2) {                        // 距离加权分离: 越近推得越狠
        let wgt = 1.0 / max(kd[m], 1.0);
        sepx = sepx - kx[m] * wgt;
        sepy = sepy - ky[m] * wgt;
      }
    }
    let knf = f32(kn);
    let mx = U.cohesionW * psx / knf + U.alignmentW * vsx / knf;
    let my = U.cohesionW * psy / knf + U.alignmentW * vsy / knf;
    let nn = sqrt(mx * mx + my * my);
    if (nn > 1e-9) {
      ax = ax + clamp(mx / nn * U.maxSpeed - vxi, -U.maxForce, U.maxForce);
      ay = ay + clamp(my / nn * U.maxSpeed - vyi, -U.maxForce, U.maxForce);
    }
    ax = ax + clamp(sepx * U.sepGain, -2.0 * U.maxForce, 2.0 * U.maxForce);
    ay = ay + clamp(sepy * U.sepGain, -2.0 * U.maxForce, 2.0 * U.maxForce);
  }
  ACC[2u * i] = ax;
  ACC[2u * i + 1u] = ay;
}
`;

  let device = null, adapter = null, scene = null;
  let bufP = null, bufV = null, bufAlive = null, bufACC = null, bufHead = null, bufNxt = null;
  let bufU = null, stage = null;
  let pipeClear = null, pipeInsert = null, pipeForces = null, bindGroup = null;
  let aliveU32 = null, paramsBuf = null, paramsF32 = null, paramsU32 = null;
  let maxN = 0, gwgh = 0;
  let gpuDeviceLost = false;
  let lastInfo = { ok: false, reason: "" };

  function makeBuf(size, usage) { return device.createBuffer({ size: Math.max(16, size), usage }); }

  window.ComputeBackend = {
    /* 初始化: adapter/device -> buffer -> pipeline -> 自检(与 CPU 对拍) */
    async init(s, force) {
      scene = s;
      lastInfo = { ok: false, reason: "" };
      if (typeof navigator === "undefined" || !navigator.gpu) {
        lastInfo.reason = "navigator.gpu 不存在(浏览器不支持或非安全上下文)";
        return false;
      }
      try {
        adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { lastInfo.reason = "requestAdapter() 返回 null"; return false; }
        device = await adapter.requestDevice();
        if (!device) { lastInfo.reason = "requestDevice() 失败"; return false; }
      } catch (e) {
        lastInfo.reason = "初始化异常: " + (e && e.message);
        return false;
      }
      maxN = s.maxN || 20000;
      const GW = s.grid.gw, GH = s.grid.gh;
      gwgh = GW * GH;
      const U = GPUBufferUsage;
      const SHADER_STAGE = (typeof GPUShaderStage !== "undefined") ? GPUShaderStage.COMPUTE : 4;
      try {
        bufP = makeBuf(2 * maxN * 4, U.STORAGE | U.COPY_DST);
        bufV = makeBuf(2 * maxN * 4, U.STORAGE | U.COPY_DST);
        bufAlive = makeBuf(maxN * 4, U.STORAGE | U.COPY_DST);
        bufACC = makeBuf(2 * maxN * 4, U.STORAGE | U.COPY_SRC);
        bufHead = makeBuf(gwgh * 4, U.STORAGE);
        bufNxt = makeBuf(maxN * 4, U.STORAGE);
        bufU = makeBuf(64, U.UNIFORM | U.COPY_DST);
        stage = makeBuf(2 * maxN * 4, U.MAP_READ | U.COPY_DST);
        aliveU32 = new Uint32Array(maxN);
        paramsBuf = new ArrayBuffer(64);
        paramsF32 = new Float32Array(paramsBuf);
        paramsU32 = new Uint32Array(paramsBuf);

        const module = device.createShaderModule({ code: WGSL, label: "boids-compute" });

        // WGSL 编译错误要显式捞出来: createShaderModule 不抛异常, 否则只会看到黑屏/无输出
        if (module.getCompilationInfo) {
          try {
            const ci = await module.getCompilationInfo();
            const errs = (ci.messages || []).filter(m => m.type === "error");
            if (errs.length) {
              lastInfo.reason = "WGSL 编译错误: " + errs.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join(" | ");
              return false;
            }
          } catch (e) { /* 某些实现没有 getCompilationInfo, 忽略 */ }
        }
        // 未捕获的 WebGPU 错误(校验失败等)打到控制台, 便于定位
        if (device.addEventListener) {
          device.addEventListener("uncapturederror", ev => {
            console.warn("WebGPU 未捕获错误:", ev.error && ev.error.message ? ev.error.message : ev.error);
          });
        }
        if (device.lost && device.lost.then) {
          device.lost.then(info => {
            if (info && info.reason !== "destroyed") {
              console.warn("WebGPU device 丢失(" + info.reason + "), 计算将退回 CPU 路径");
              gpuDeviceLost = true;
            }
          });
        }

        // 显式绑定布局 + 管线布局: 三趟 pass 共用一个 bind group。
        // (不能用 layout:"auto" —— 各 pass 静态用到的 binding 不同, 自动布局会不一样,
        //  同一个 bind group 在别的 pass 上会直接校验失败。)
        const bgl = device.createBindGroupLayout({
          label: "boids-bgl",
          entries: [
            { binding: 0, visibility: SHADER_STAGE, buffer: { type: "read-only-storage" } }, // P
            { binding: 1, visibility: SHADER_STAGE, buffer: { type: "read-only-storage" } }, // V
            { binding: 2, visibility: SHADER_STAGE, buffer: { type: "read-only-storage" } }, // ALIVE
            { binding: 3, visibility: SHADER_STAGE, buffer: { type: "storage" } },            // ACC
            { binding: 4, visibility: SHADER_STAGE, buffer: { type: "storage" } },            // HEAD(原子)
            { binding: 5, visibility: SHADER_STAGE, buffer: { type: "storage" } },            // NXT
            { binding: 6, visibility: SHADER_STAGE, buffer: { type: "uniform", minBindingSize: 64 } }, // Params
          ],
        });
        const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });

        const mk = (entryPoint, label) => device.createComputePipeline({
          label, layout: pipelineLayout,
          compute: { module, entryPoint },
        });
        pipeClear = mk("clearGrid", "clearGrid");
        pipeInsert = mk("insertBirds", "insertBirds");
        pipeForces = mk("neighborForces", "neighborForces");
        bindGroup = device.createBindGroup({
          layout: bgl,
          entries: [
            { binding: 0, resource: { buffer: bufP } },
            { binding: 1, resource: { buffer: bufV } },
            { binding: 2, resource: { buffer: bufAlive } },
            { binding: 3, resource: { buffer: bufACC } },
            { binding: 4, resource: { buffer: bufHead } },
            { binding: 5, resource: { buffer: bufNxt } },
            { binding: 6, resource: { buffer: bufU } },
          ],
        });
      } catch (e) {
        lastInfo.reason = "资源创建异常: " + (e && e.message);
        return false;
      }
      lastInfo = { ok: true, reason: "", adapter: adapter.info ? (adapter.info.vendor + " " + adapter.info.architecture) : "n/a",
                   maxN, gwgh, workgroups: { clear: Math.ceil(gwgh / 64), bird: Math.ceil(maxN / 256) } };
      return true;
    },

    info() { return lastInfo; },
    ready() { return !!(device && pipeForces && !gpuDeviceLost); },
    dispose() { try { if (device) device.destroy(); } catch (e) {} device = null; },

    /* 把 CPU 侧状态写进 uniform(P/V/ALIVE 由 frame() 上传) */
    updateParams(s) {
      const c = s.counts();
      paramsU32[0] = c.n; paramsU32[1] = s.grid.gw; paramsU32[2] = s.grid.gh; paramsU32[3] = s.grid.topoK;
      paramsF32[4] = s.grid.cell; paramsF32[5] = s.grid.pad;
  paramsF32[6] = s.worldW || s.W; paramsF32[7] = s.worldH || s.H;   // 计算端的网格必须按**世界**尺寸建
      paramsF32[8] = s.grid.perceptionR2; paramsF32[9] = s.grid.sepR2; paramsF32[10] = s.grid.sepGain;
      paramsF32[11] = s.grid.maxSpeed; paramsF32[12] = s.grid.maxForce;
      paramsF32[13] = s.grid.cohesionW; paramsF32[14] = s.grid.alignmentW;
      paramsU32[15] = s.grid.torus ? 1 : 0;
      device.queue.writeBuffer(bufU, 0, paramsBuf, 0, 64);
    },

    /* 一帧: 上传 -> 3 个 pass + 回读 -> 写进 scene.ACC
     * 返回 { uploadMs, gpuMs, readbackMs } */
    async frame(s) {
      const c = s.counts();
      const n = c.n;
      const t0 = performance.now();
      device.queue.writeBuffer(bufP, 0, s.P, 0, 2 * n);
      device.queue.writeBuffer(bufV, 0, s.V, 0, 2 * n);
      const alive = s.alive;
      for (let i = 0; i < n; i++) aliveU32[i] = alive[i] ? 1 : 0;
      device.queue.writeBuffer(bufAlive, 0, aliveU32, 0, n);
      this.updateParams(s);
      const tUp = performance.now();

      const enc = device.createCommandEncoder();
      const wgClear = Math.ceil(s.grid.gw * s.grid.gh / 64);
      const wgBird = Math.ceil(n / 256);
      let cp = enc.beginComputePass(); cp.setPipeline(pipeClear); cp.setBindGroup(0, bindGroup);
      cp.dispatchWorkgroups(wgClear); cp.end();
      cp = enc.beginComputePass(); cp.setPipeline(pipeInsert); cp.setBindGroup(0, bindGroup);
      cp.dispatchWorkgroups(wgBird); cp.end();
      cp = enc.beginComputePass(); cp.setPipeline(pipeForces); cp.setBindGroup(0, bindGroup);
      cp.dispatchWorkgroups(wgBird); cp.end();
      enc.copyBufferToBuffer(bufACC, 0, stage, 0, 8 * n);
      device.queue.submit([enc.finish()]);

      await stage.mapAsync(GPUMapMode.READ, 0, 8 * n);
      const tGpu = performance.now();
      s.ACC.set(new Float32Array(stage.getMappedRange(0, 8 * n)));   // 回读到 CPU 的 ACC
      stage.unmap();
      const tEnd = performance.now();
      return { uploadMs: tUp - t0, gpuMs: tGpu - tUp, readbackMs: tEnd - tGpu };
    },

    /* 自检: 同一状态分别跑 CPU 版与 GPU 版 6.1+6.2, 逐只比较 ACC。
     * 只比**活着的鸟**(死鸟的 ACC 两边都不写, 槽位里可能是上一次的残留/NaN, 不参与比较)。
     * 超差 -> 主脚本退回 CPU(宁可慢也不能算错)。 */
    async selfCheck(s, cpuForcesRef) {
      const n = s.counts().n;
      const aliveArr = s.alive;
      const cpuACC = new Float32Array(2 * n);
      cpuForcesRef(cpuACC);                       // 主脚本: 跑 cpuGridAndForces 并把 ACC 拷进 cpuACC
      const gpuACC = new Float32Array(2 * n);
      await this.frame(s);
      gpuACC.set(s.ACC.subarray(0, 2 * n));
      cpuForcesRef(cpuACC);                       // 再跑一次, 把 CPU 状态复原(ACC 归位)
      let maxAbs = 0, maxRel = 0, bad = 0, worst = -1, checked = 0;
      for (let i = 0; i < n; i++) {
        if (!aliveArr[i]) continue;               // 死鸟不参与
        for (let k = 0; k < 2; k++) {
          const idx = 2 * i + k;
          const a = cpuACC[idx], b = gpuACC[idx];
          checked++;
          if (!Number.isFinite(b)) { bad++; continue; }
          const d = Math.abs(a - b);
          const r = d / Math.max(1e-6, Math.abs(a));
          if (d > maxAbs) { maxAbs = d; worst = i; }
          if (r > maxRel && Math.abs(a) > 1e-6) maxRel = r;
          if (d > 1e-4 && r > 1e-3) bad++;
        }
      }
      const passed = bad === 0 && maxAbs < 1e-4;
      return { passed, maxAbs, maxRel, bad, n, checked, worst };
    },
  };
})();
