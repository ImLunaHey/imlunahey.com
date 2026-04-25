import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

type Preset = { name: string; code: string };

const PRESETS: Preset[] = [
  {
    name: 'plasma',
    code: `fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let t = u.time;
  let v = sin(p.x * 6.0 + t)
        + sin(p.y * 6.0 + t * 1.3)
        + sin((p.x + p.y) * 4.0 + t * 0.7)
        + sin(length(p) * 8.0 - t * 2.0);
  let r = 0.5 + 0.5 * sin(v + 0.0);
  let g = 0.5 + 0.5 * sin(v + 2.094);
  let b = 0.5 + 0.5 * sin(v + 4.188);
  return vec4f(r, g, b, 1.0);
}`,
  },
  {
    name: 'rays',
    code: `// raymarched sphere with simple lambert lighting
fn sdf(p: vec3f) -> f32 {
  return length(p) - 1.0;
}

fn march(ro: vec3f, rd: vec3f) -> f32 {
  var t = 0.0;
  for (var i = 0; i < 80; i = i + 1) {
    let d = sdf(ro + rd * t);
    if (d < 0.001 || t > 20.0) { break; }
    t = t + d;
  }
  return t;
}

fn normal(p: vec3f) -> vec3f {
  let e = vec2f(0.001, 0.0);
  return normalize(vec3f(
    sdf(p + e.xyy) - sdf(p - e.xyy),
    sdf(p + e.yxy) - sdf(p - e.yxy),
    sdf(p + e.yyx) - sdf(p - e.yyx)
  ));
}

fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let ang = u.time * 0.4;
  let ro = vec3f(sin(ang) * 3.0, 1.2, cos(ang) * 3.0);
  let fwd = normalize(-ro);
  let rgt = normalize(cross(fwd, vec3f(0.0, 1.0, 0.0)));
  let upv = cross(rgt, fwd);
  let rd = normalize(fwd + p.x * rgt + p.y * upv);
  let t = march(ro, rd);
  if (t > 19.0) {
    let bg = 0.5 + 0.5 * vec3f(p.y, p.y * 0.6, p.y * 0.8);
    return vec4f(bg * 0.2, 1.0);
  }
  let n = normal(ro + rd * t);
  let lit = max(0.1, dot(n, normalize(vec3f(0.7, 1.0, 0.4))));
  return vec4f(vec3f(0.4, 1.0, 0.6) * lit, 1.0);
}`,
  },
  {
    name: 'mandelbrot',
    code: `// mandelbrot — drag mouse to pan the centre
fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let cx = (u.mouse.x - 0.5) * 2.0;
  let cy = (u.mouse.y - 0.5) * 2.0;
  let zoom = 1.6;
  let c = vec2f(p.x * zoom + cx, p.y * zoom + cy);
  var z = vec2f(0.0, 0.0);
  var i = 0;
  let max_iter = 200;
  loop {
    if (i >= max_iter) { break; }
    let zx = z.x * z.x - z.y * z.y + c.x;
    let zy = 2.0 * z.x * z.y + c.y;
    z = vec2f(zx, zy);
    if (dot(z, z) > 4.0) { break; }
    i = i + 1;
  }
  if (i == max_iter) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  let f = f32(i) / f32(max_iter);
  let r = 0.5 + 0.5 * sin(f * 9.0);
  let g = 0.5 + 0.5 * sin(f * 7.0 + 1.0);
  let b = 0.5 + 0.5 * sin(f * 5.0 + 2.0);
  return vec4f(r, g, b, 1.0);
}`,
  },
  {
    name: 'voronoi',
    code: `fn hash22(p: vec2f) -> vec2f {
  let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}

fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let n = p * 4.0;
  let i = floor(n);
  let f = fract(n);
  var min_dist = 1e9;
  var closest = vec2f(0.0);
  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let g = vec2f(f32(dx), f32(dy));
      let o = hash22(i + g);
      let pos = g + 0.5 + 0.5 * sin(u.time + 6.28 * o);
      let d = length(pos - f);
      if (d < min_dist) {
        min_dist = d;
        closest = i + g;
      }
    }
  }
  let h = hash22(closest);
  let col = 0.5 + 0.5 * sin(vec3f(h.x, h.y, h.x * h.y) * 6.28 + u.time);
  return vec4f(col * (1.0 - min_dist * 0.7), 1.0);
}`,
  },
  {
    name: 'kaleidoscope',
    code: `fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let r = length(p);
  var a = atan2(p.y, p.x);
  let segments = 8.0;
  let seg = 6.2831853 / segments;
  a = abs((a + u.time * 0.2) % seg - seg * 0.5);
  let q = vec2f(cos(a), sin(a)) * r;
  let v = sin(q.x * 8.0 + u.time) + cos(q.y * 8.0 - u.time);
  let col = 0.5 + 0.5 * sin(vec3f(v, v + 2.0, v + 4.0) + r * 4.0);
  return vec4f(col, 1.0);
}`,
  },
  {
    name: 'fbm',
    code: `// fractal brownian motion clouds
fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2f(0.0, 0.0)), hash(i + vec2f(1.0, 0.0)), u.x),
    mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x),
    u.y
  );
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 6; i = i + 1) {
    v = v + a * noise(q);
    q = q * 2.02;
    a = a * 0.5;
  }
  return v;
}

fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let t = u.time * 0.15;
  let q = p * 2.0 + vec2f(t, -t);
  let n = fbm(q + fbm(q + fbm(q)));
  let col = mix(vec3f(0.05, 0.1, 0.2), vec3f(1.0, 0.85, 0.6), n);
  return vec4f(col, 1.0);
}`,
  },
  {
    name: 'tunnel',
    code: `fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let r = length(p);
  let a = atan2(p.y, p.x);
  let z = 0.5 / r + u.time * 0.4;
  let band = a / 6.2831853 * 12.0 + u.time;
  let pat = sin(z * 6.0) * 0.5 + 0.5;
  let stripes = sin(band) * 0.5 + 0.5;
  let col = vec3f(pat, stripes, 0.5 + 0.5 * sin(z + a)) * smoothstep(0.0, 0.3, r);
  return vec4f(col, 1.0);
}`,
  },
  {
    name: 'truchet',
    code: `// truchet tiles with rotating arcs
fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn mainImage(uv: vec2f, p: vec2f) -> vec4f {
  let scale = 6.0;
  let q = p * scale + vec2f(u.time * 0.3, 0.0);
  let i = floor(q);
  var f = fract(q) - 0.5;
  let h = hash(i);
  if (h > 0.5) { f.x = -f.x; }
  let r1 = abs(length(f - vec2f(0.5, -0.5)) - 0.5);
  let r2 = abs(length(f - vec2f(-0.5, 0.5)) - 0.5);
  let d = min(r1, r2);
  let m = smoothstep(0.08, 0.06, d);
  let col = mix(vec3f(0.05, 0.05, 0.08), vec3f(0.4, 1.0, 0.6), m);
  return vec4f(col, 1.0);
}`,
  },
];

const VERTEX_SHADER = /* wgsl */ `
@vertex
fn vs_main(@builtin(vertex_index) idx : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  return vec4f(pos[idx], 0.0, 1.0);
}
`;

const FRAGMENT_HEADER = /* wgsl */ `
struct Uniforms {
  resolution : vec2f,
  mouse      : vec2f,
  time       : f32,
  _pad       : f32,
};

@group(0) @binding(0) var<uniform> u : Uniforms;
`;

const FRAGMENT_FOOTER = /* wgsl */ `
@fragment
fn fs_main(@builtin(position) frag : vec4f) -> @location(0) vec4f {
  let pix = vec2f(frag.x, u.resolution.y - frag.y);
  let uv = pix / u.resolution;
  let p = (2.0 * pix - u.resolution) / min(u.resolution.x, u.resolution.y);
  return mainImage(uv, p);
}
`;

const buildFragmentShader = (userCode: string) =>
  `${FRAGMENT_HEADER}\n${userCode}\n${FRAGMENT_FOOTER}`;

type CompileMessage = { type: 'error' | 'warning' | 'info'; line: number; col: number; message: string };

export default function ShadersPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [code, setCode] = useState(PRESETS[0].code);
  const [running, setRunning] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [status, setStatus] = useState<{ kind: 'init' | 'ok' | 'unsupported' | 'error'; messages?: CompileMessage[]; detail?: string }>({ kind: 'init' });
  const [fps, setFps] = useState(0);

  // refs the render loop reads each frame
  const codeRef = useRef(code);
  const runningRef = useRef(running);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!('gpu' in navigator)) {
      setStatus({ kind: 'unsupported', detail: 'this browser has no navigator.gpu — try chrome, edge, or firefox 121+.' });
      return;
    }

    let cancelled = false;
    let device: GPUDevice | null = null;
    let context: GPUCanvasContext | null = null;
    let format: GPUTextureFormat = 'bgra8unorm';
    let pipeline: GPURenderPipeline | null = null;
    let uniformBuffer: GPUBuffer | null = null;
    let bindGroup: GPUBindGroup | null = null;
    let pipelineLayout: GPUPipelineLayout | null = null;
    let bindGroupLayout: GPUBindGroupLayout | null = null;
    let lastCompiledCode: string | null = null;
    let rafId = 0;
    const startTime = performance.now();
    const mouse = { x: 0.5, y: 0.5 };

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = 1 - (e.clientY - rect.top) / rect.height;
    };
    canvas.addEventListener('mousemove', onMouse);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const recompile = async (src: string) => {
      if (!device) return;
      const fragSrc = buildFragmentShader(src);
      device.pushErrorScope('validation');
      const fragModule = device.createShaderModule({ code: fragSrc });
      const vertModule = device.createShaderModule({ code: VERTEX_SHADER });

      const info = await fragModule.getCompilationInfo();
      const messages: CompileMessage[] = info.messages.map((m) => ({
        type: m.type as 'error' | 'warning' | 'info',
        line: Math.max(1, m.lineNum - FRAGMENT_HEADER.split('\n').length),
        col: m.linePos,
        message: m.message,
      }));

      let nextPipeline: GPURenderPipeline | null = null;
      try {
        nextPipeline = device.createRenderPipeline({
          layout: pipelineLayout!,
          vertex: { module: vertModule, entryPoint: 'vs_main' },
          fragment: { module: fragModule, entryPoint: 'fs_main', targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });
      } catch {
        // swallow — error scope below will report it
      }
      const err = await device.popErrorScope();

      if (cancelled) return;
      if (err || !nextPipeline || messages.some((m) => m.type === 'error')) {
        setStatus({ kind: 'error', messages: messages.filter((m) => m.type === 'error'), detail: err?.message });
        return;
      }
      pipeline = nextPipeline;
      lastCompiledCode = src;
      setStatus({ kind: 'ok', messages: messages.filter((m) => m.type === 'warning') });
    };

    (async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setStatus({ kind: 'unsupported', detail: 'no gpu adapter available — your browser knows about webgpu but the system refused to hand over a device.' });
          return;
        }
        device = await adapter.requestDevice();
        if (cancelled) { device.destroy(); return; }
        context = canvas.getContext('webgpu') as GPUCanvasContext;
        format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });

        bindGroupLayout = device.createBindGroupLayout({
          entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
        });
        pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        // resolution(2) + mouse(2) + time(1) + pad(1) = 6 floats = 24 bytes, round to 32
        uniformBuffer = device.createBuffer({
          size: 32,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });

        await recompile(codeRef.current);
        if (cancelled) return;

        const uniformData = new Float32Array(8);
        let frameCount = 0;
        let fpsAcc = 0;
        let fpsLast = performance.now();

        const loop = () => {
          rafId = requestAnimationFrame(loop);
          if (!device || !context || !pipeline || !uniformBuffer || !bindGroup) return;
          if (!runningRef.current) return;

          // hot-recompile if user edited the code
          if (codeRef.current !== lastCompiledCode) {
            const src = codeRef.current;
            recompile(src);
            // keep rendering with the previous pipeline until recompile resolves
          }

          const t = (performance.now() - startTime) / 1000;
          uniformData[0] = canvas.width;
          uniformData[1] = canvas.height;
          uniformData[2] = mouse.x;
          uniformData[3] = mouse.y;
          uniformData[4] = t;
          uniformData[5] = 0;
          device.queue.writeBuffer(uniformBuffer, 0, uniformData);

          const encoder = device.createCommandEncoder();
          const view = context.getCurrentTexture().createView();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view,
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
          });
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(3);
          pass.end();
          device.queue.submit([encoder.finish()]);

          frameCount += 1;
          const now = performance.now();
          if (now - fpsLast >= 500) {
            fpsAcc = (frameCount * 1000) / (now - fpsLast);
            frameCount = 0;
            fpsLast = now;
            setFps(Math.round(fpsAcc));
          }
        };
        rafId = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        setStatus({ kind: 'unsupported', detail: e instanceof Error ? e.message : 'failed to initialise webgpu.' });
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMouse);
      device?.destroy();
    };
  }, []);

  const pickPreset = (i: number) => {
    setPresetIdx(i);
    setCode(PRESETS[i].code);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-sh">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">shaders</span>
        </div>

        <div className="sh-stage">
          <canvas ref={canvasRef} className="sh-canvas" />

          {status.kind === 'unsupported' ? (
            <div className="sh-overlay">
              <div className="sh-overlay-card">
                <div className="sh-overlay-title">webgpu unsupported</div>
                <div className="sh-overlay-body">{status.detail}</div>
              </div>
            </div>
          ) : null}

          {showEditor && status.kind !== 'unsupported' ? (
            <aside className="sh-editor">
              <div className="sh-editor-hd">
                <span className="sh-editor-name">{PRESETS[presetIdx].name}.wgsl</span>
                <span className="sh-fps">{fps} fps</span>
              </div>
              <textarea
                className="sh-textarea"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
              {status.kind === 'error' && status.messages?.length ? (
                <div className="sh-errors">
                  {status.messages.map((m, i) => (
                    <div key={i} className="sh-err">
                      <span className="sh-err-pos">{m.line}:{m.col}</span> {m.message}
                    </div>
                  ))}
                  {status.detail && !status.messages.length ? <div className="sh-err">{status.detail}</div> : null}
                </div>
              ) : null}
              {status.kind === 'error' && !status.messages?.length && status.detail ? (
                <div className="sh-errors"><div className="sh-err">{status.detail}</div></div>
              ) : null}
            </aside>
          ) : null}

          <div className="sh-controls">
            <div className="sh-ctrl-group">
              <span className="sh-lbl">preset</span>
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  className={`sh-chip ${presetIdx === i ? 'on' : ''}`}
                  onClick={() => pickPreset(i)}
                >{p.name}</button>
              ))}
            </div>
            <button className="sh-btn" onClick={() => setShowEditor((s) => !s)}>
              {showEditor ? '✕ hide code' : '✎ edit'}
            </button>
            <button className="sh-btn" onClick={() => setRunning((r) => !r)}>
              {running ? '⏸ pause' : '▶ play'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const CSS = `
  .shell-sh {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 var(--sp-4);
    height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
  }

  .crumbs {
    padding: var(--sp-3) 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    flex-shrink: 0;
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .sh-stage {
    position: relative;
    flex: 1;
    border: 1px solid var(--color-border);
    background: #000;
    overflow: hidden;
    min-height: 400px;
  }
  .sh-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .sh-editor {
    position: absolute;
    top: var(--sp-3);
    right: var(--sp-3);
    width: min(440px, calc(100% - var(--sp-6)));
    max-height: calc(100% - 120px);
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-accent-dim);
    box-shadow: 0 0 20px color-mix(in oklch, var(--color-accent) 18%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .sh-editor-hd {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .sh-editor-name { color: var(--color-accent); }
  .sh-fps {
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
  }
  .sh-textarea {
    flex: 1;
    min-height: 240px;
    background: transparent;
    color: var(--color-fg);
    border: 0;
    outline: 0;
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1.5;
    resize: none;
    white-space: pre;
    tab-size: 2;
  }
  .sh-textarea::selection { background: color-mix(in oklch, var(--color-accent) 35%, transparent); }
  .sh-errors {
    border-top: 1px solid var(--color-border);
    padding: 6px 10px;
    max-height: 140px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 10px;
    color: #ff8888;
  }
  .sh-err { padding: 2px 0; line-height: 1.4; }
  .sh-err-pos { color: #ffbb55; margin-right: 6px; }

  .sh-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
  }
  .sh-overlay-card {
    max-width: 480px;
    padding: var(--sp-5);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-accent-dim);
    text-align: center;
  }
  .sh-overlay-title {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--color-accent);
    margin-bottom: var(--sp-3);
  }
  .sh-overlay-body {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    line-height: 1.5;
  }

  .sh-controls {
    position: absolute;
    bottom: var(--sp-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-accent-dim);
    box-shadow: 0 0 20px color-mix(in oklch, var(--color-accent) 18%, transparent);
    max-width: calc(100% - var(--sp-6));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .sh-ctrl-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .sh-lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 2px;
  }
  .sh-chip {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 2px 8px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .sh-chip:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .sh-chip.on {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }
  .sh-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 4px 12px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .sh-btn:hover { filter: brightness(1.1); }

  @media (max-width: 760px) {
    .sh-editor {
      top: auto;
      bottom: 80px;
      right: var(--sp-3);
      left: var(--sp-3);
      width: auto;
      max-height: 50%;
    }
    .sh-controls { gap: var(--sp-2); padding: var(--sp-2); }
  }
`;
