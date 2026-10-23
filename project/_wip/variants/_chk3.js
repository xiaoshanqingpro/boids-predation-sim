
"use strict";
/* ============================================================================
 * WebGPU 璁＄畻鍚庣(绗?6 杞?/ WebGPU 杩佺Щ璁″垝 Phase 1+2B 鍘熷瀷)
 * ----------------------------------------------------------------------------
 * 鍙妸 step() 鐨?6.1(寤虹綉鏍? + 6.2(鎷撴墤 K 閭诲眳 + 姹傚姏) 鎼埌 GPU, 鍏朵綑鍏ㄩ儴鐣?CPU:
 *   GPU: clearGrid(妗跺ご娓?-1) -> insertBirds(鍘熷瓙澶存彃閾捐〃) -> neighborForces(K=topoK 鎻掑叆鎺掑簭 + 姹傚姏)
 *   CPU: 6.3 杩佸緳 / 6.4 绉垎涓庝簨浠?/ 6.5 闆?/ 6.6 楣?Q / 6.7 ES / 6.8 闅?/ 6.10 浜掓敾
 * 姣忓抚鏁版嵁娴?绗?1 姝ュ師鍨? 鍚屾鍥炶鍙负閲忎笂闄? 寮傛鍙岀紦鍐叉槸涓嬩竴姝?:
 *   涓婅 P銆乂(鍚?2N f32)銆丄LIVE(N u32)  鈮?320KB @N=20000
 *   涓嬭 ACC(2N f32)                    鈮?160KB @N=20000
 * 妗剁敤鍘熷瓙澶存彃閾捐〃(array<atomic<i32>> head + array<i32> next), 鍥犳**妗跺唴椤哄簭涓嶇‘瀹?*
 * (涓?CPU 鐨?浣嶇骇涓€鑷?鍝插鍐茬獊, 杩欐槸璁″垝閲屽凡鎺ュ彈鐨勫彇鑸? 楠屾敹璧扮粺璁＄瓑浠?銆? * 鑷: 鍒濆鍖栨椂鐢ㄥ悓涓€浠界姸鎬佸垎鍒窇 CPU 鐗堜笌 GPU 鐗? 閫愬彧姣旇緝 ACC; 瓒呭樊灏辫嚜鍔ㄩ€€鍥?CPU 鈥斺€?
 * 杩欐牱鍗充娇 WGSL 鏈夐棶棰? 椤甸潰涔熶笉浼氱粰鍑洪敊璇殑鐗╃悊, 鍙細閫€鍥炴棫璺緞銆? * ========================================================================== */
(function () {
  const WGSL = `
struct Params {
  n: u32, gw: u32, gh: u32, topoK: u32,
  cell: f32, pad: f32, w: f32, h: f32,
  perceptionR2: f32, sepR2: f32, sepGain: f32, maxSpeed: f32,
  maxForce: f32, cohesionW: f32, alignmentW: f32, torus: u32,
};
@group(0) @binding(0) var<storage, read> P: array<f32>;        // 浣嶇疆 x,y 浜ら敊
@group(0) @binding(1) var<storage, read> VV: array<f32>;        // 閫熷害 x,y 浜ら敊
@group(0) @binding(2) var<storage, read> ALIVE: array<u32>;     // 1 = 娲?@group(0) @binding(3) var<storage, read_write> ACC: array<f32>; // 鍑哄姏: 姣忓抚杞悜鍔?@group(0) @binding(4) var<storage, read_write> HEAD: array<atomic<i32>>;  // 妗堕摼琛ㄥご
@group(0) @binding(5) var<storage, read_write> NXT: array<i32>;          // 妗堕摼琛?next
@group(0) @binding(6) var<uniform> U: Params;

// 妗跺ご娓?-1: 姣忕嚎绋嬩竴涓《
@compute @workgroup_size(64)
fn clearGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= U.gw * U.gh) { return; }
  atomicStore(&HEAD[c], -1);
}

// 姣忛笩涓€涓嚎绋? 绠楁《鍙?-> 鍘熷瓙澶存彃(next[i] = 鏃?head)
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
  let prev = atomicExchange(&HEAD[c], i32(i));   // 澶存彃, 杩斿洖鏃уご
  NXT[i] = prev;
}

// 鐜潰鏈€灏忓儚(寮€闃斾笘鐣?= 鎭掔瓑鏄犲皠, 涓?JS 鐗?minImageX/Y 涓€鑷?
fn minIX(d: f32) -> f32 { if (U.torus == 1u) { return d - U.w * round(d / U.w); } return d; }
fn minIY(d: f32) -> f32 { if (U.torus == 1u) { return d - U.h * round(d / U.h); } return d; }

// 姣忛笩涓€涓嚎绋? 鎵?3x3 妗剁殑閾? 鍙栨渶杩?topoK 鍙?鍗囧簭妲戒綅鍐掓场鎻掑叆), 鍐嶆寜 CPU 鍚屾鍏紡姹傚姏
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

  // K 涓Ы浣?鎸夎窛绂诲崌搴?, 涓婇檺 16 鈥斺€?涓?CPU 鐨?KD/KX/KY/KJ 鍚屾瀯
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
              loop {                                  // 鍐掓场鍒板崌搴忎綅缃?                if (p <= 0) { break; }
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
      if (kd[m] < U.sepR2) {                        // 璺濈鍔犳潈鍒嗙: 瓒婅繎鎺ㄥ緱瓒婄嫚
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
    /* 鍒濆鍖? adapter/device -> buffer -> pipeline -> 鑷(涓?CPU 瀵规媿) */
    async init(s, force) {
      scene = s;
      lastInfo = { ok: false, reason: "" };
      if (typeof navigator === "undefined" || !navigator.gpu) {
        lastInfo.reason = "navigator.gpu 涓嶅瓨鍦?娴忚鍣ㄤ笉鏀寔鎴栭潪瀹夊叏涓婁笅鏂?";
        return false;
      }
      try {
        adapter = await navigator.gpu.requestAdapter();
        if (!adapter) { lastInfo.reason = "requestAdapter() 杩斿洖 null"; return false; }
        device = await adapter.requestDevice();
        if (!device) { lastInfo.reason = "requestDevice() 澶辫触"; return false; }
      } catch (e) {
        lastInfo.reason = "鍒濆鍖栧紓甯? " + (e && e.message);
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

        // WGSL 缂栬瘧閿欒瑕佹樉寮忔崬鍑烘潵: createShaderModule 涓嶆姏寮傚父, 鍚﹀垯鍙細鐪嬪埌榛戝睆/鏃犺緭鍑?        if (module.getCompilationInfo) {
          try {
            const ci = await module.getCompilationInfo();
            const errs = (ci.messages || []).filter(m => m.type === "error");
            if (errs.length) {
              lastInfo.reason = "WGSL 缂栬瘧閿欒: " + errs.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join(" | ");
              return false;
            }
          } catch (e) { /* 鏌愪簺瀹炵幇娌℃湁 getCompilationInfo, 蹇界暐 */ }
        }
        // 鏈崟鑾风殑 WebGPU 閿欒(鏍￠獙澶辫触绛?鎵撳埌鎺у埗鍙? 渚夸簬瀹氫綅
        if (device.addEventListener) {
          device.addEventListener("uncapturederror", ev => {
            console.warn("WebGPU 鏈崟鑾烽敊璇?", ev.error && ev.error.message ? ev.error.message : ev.error);
          });
        }
        if (device.lost && device.lost.then) {
          device.lost.then(info => {
            if (info && info.reason !== "destroyed") {
              console.warn("WebGPU device 涓㈠け(" + info.reason + "), 璁＄畻灏嗛€€鍥?CPU 璺緞");
              gpuDeviceLost = true;
            }
          });
        }

        // 鏄惧紡缁戝畾甯冨眬 + 绠＄嚎甯冨眬: 涓夎稛 pass 鍏辩敤涓€涓?bind group銆?        // (涓嶈兘鐢?layout:"auto" 鈥斺€?鍚?pass 闈欐€佺敤鍒扮殑 binding 涓嶅悓, 鑷姩甯冨眬浼氫笉涓€鏍?
        //  鍚屼竴涓?bind group 鍦ㄥ埆鐨?pass 涓婁細鐩存帴鏍￠獙澶辫触銆?
        const bgl = device.createBindGroupLayout({
          label: "boids-bgl",
          entries: [
            { binding: 0, visibility: SHADER_STAGE, buffer: { type: "read-only-storage" } }, // P
            { binding: 1, visibility: SHADER_STAGE, buffer: { type: "read-only-storage" } }, // V
            { binding: 2, visibility: SHADER_STAGE, buffer: { type: "read-only-storage" } }, // ALIVE
            { binding: 3, visibility: SHADER_STAGE, buffer: { type: "storage" } },            // ACC
            { binding: 4, visibility: SHADER_STAGE, buffer: { type: "storage" } },            // HEAD(鍘熷瓙)
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
        lastInfo.reason = "璧勬簮鍒涘缓寮傚父: " + (e && e.message);
        return false;
      }
      lastInfo = { ok: true, reason: "", adapter: adapter.info ? (adapter.info.vendor + " " + adapter.info.architecture) : "n/a",
                   maxN, gwgh, workgroups: { clear: Math.ceil(gwgh / 64), bird: Math.ceil(maxN / 256) } };
      return true;
    },

    info() { return lastInfo; },
    ready() { return !!(device && pipeForces && !gpuDeviceLost); },
    dispose() { try { if (device) device.destroy(); } catch (e) {} device = null; },

    /* 鎶?CPU 渚х姸鎬佸啓杩?uniform(P/V/ALIVE 鐢?frame() 涓婁紶) */
    updateParams(s) {
      const c = s.counts();
      paramsU32[0] = c.n; paramsU32[1] = s.grid.gw; paramsU32[2] = s.grid.gh; paramsU32[3] = s.grid.topoK;
      paramsF32[4] = s.grid.cell; paramsF32[5] = s.grid.pad;
  paramsF32[6] = s.worldW || s.W; paramsF32[7] = s.worldH || s.H;   // 璁＄畻绔殑缃戞牸蹇呴』鎸?*涓栫晫**灏哄寤?      paramsF32[8] = s.grid.perceptionR2; paramsF32[9] = s.grid.sepR2; paramsF32[10] = s.grid.sepGain;
      paramsF32[11] = s.grid.maxSpeed; paramsF32[12] = s.grid.maxForce;
      paramsF32[13] = s.grid.cohesionW; paramsF32[14] = s.grid.alignmentW;
      paramsU32[15] = s.grid.torus ? 1 : 0;
      device.queue.writeBuffer(bufU, 0, paramsBuf, 0, 64);
    },

    /* 涓€甯? 涓婁紶 -> 3 涓?pass + 鍥炶 -> 鍐欒繘 scene.ACC
     * 杩斿洖 { uploadMs, gpuMs, readbackMs } */
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
      s.ACC.set(new Float32Array(stage.getMappedRange(0, 8 * n)));   // 鍥炶鍒?CPU 鐨?ACC
      stage.unmap();
      const tEnd = performance.now();
      return { uploadMs: tUp - t0, gpuMs: tGpu - tUp, readbackMs: tEnd - tGpu };
    },

    /* 鑷: 鍚屼竴鐘舵€佸垎鍒窇 CPU 鐗堜笌 GPU 鐗?6.1+6.2, 閫愬彧姣旇緝 ACC銆?     * 鍙瘮**娲荤潃鐨勯笩**(姝婚笩鐨?ACC 涓よ竟閮戒笉鍐? 妲戒綅閲屽彲鑳芥槸涓婁竴娆＄殑娈嬬暀/NaN, 涓嶅弬涓庢瘮杈?銆?     * 瓒呭樊 -> 涓昏剼鏈€€鍥?CPU(瀹佸彲鎱篃涓嶈兘绠楅敊)銆?*/
    async selfCheck(s, cpuForcesRef) {
      const n = s.counts().n;
      const aliveArr = s.alive;
      const cpuACC = new Float32Array(2 * n);
      cpuForcesRef(cpuACC);                       // 涓昏剼鏈? 璺?cpuGridAndForces 骞舵妸 ACC 鎷疯繘 cpuACC
      const gpuACC = new Float32Array(2 * n);
      await this.frame(s);
      gpuACC.set(s.ACC.subarray(0, 2 * n));
      cpuForcesRef(cpuACC);                       // 鍐嶈窇涓€娆? 鎶?CPU 鐘舵€佸鍘?ACC 褰掍綅)
      let maxAbs = 0, maxRel = 0, bad = 0, worst = -1, checked = 0;
      for (let i = 0; i < n; i++) {
        if (!aliveArr[i]) continue;               // 姝婚笩涓嶅弬涓?        for (let k = 0; k < 2; k++) {
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

