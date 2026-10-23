/**
 * EtherFluid — 孔乙己 PV 间奏流体求解器的实时移植（源自 D:\kongyiji-pv\scripts\ether\index.html）。
 *
 * Stam 稳定流体（WebGL2）：速度场 320×180 半浮点 ping-pong、染料 640×360、
 * 22 次 Jacobi 压力迭代、涡量约束；显示层不读染料，密度由速度场 × 烘焙湍流纹理
 * 塑形出墨烟，墨色完全由 display 的颜色 uniform 决定（原版固定暖墨，移植后
 * 可随歌曲主题色注入）。确定性：帧内随机走种子化 LCG，同输入序列同画面。
 *
 * 抽帧跳变（hold/stutter）由调用方驱动：冻结 tick 不调 frame()，
 * preserveDrawingBuffer 让画布保持上一帧——这是原实现「狂躁」的来源。
 */

/* ==================== 抽帧保持表（纯函数，可单测） ==================== */

export const HOLD_PATTERNS = {
  /** 安静记账：慢而近乎机械的滴答 */
  tally: [3, 1, 2, 1, 4, 1, 2, 2],
  /** 中段：逐渐不耐烦的口吃 */
  hui: [2, 1, 2, 1, 3, 1, 1, 1],
  /** 最响段：硬切快跳，最短保持只有 1 帧 */
  storm: [1, 1, 2, 1, 1, 2, 1, 3]
} as const;

export type HoldPatternKey = keyof typeof HOLD_PATTERNS;

/** 按实时能量分档选保持表 */
export function selectHoldPattern(energy: number): HoldPatternKey {
  if (energy < 0.35) return 'tally';
  if (energy < 0.68) return 'hui';
  return 'storm';
}

/**
 * 抽帧推进器：每个源帧节拍（30fps）调一次，返回本拍是否推进模拟。
 * 模式表的第 i 项 = 第 i 个源帧要被保持的拍数；推进永远发生在每组的第 1 拍。
 */
export function createHoldWalker(): (energy: number) => boolean {
  let patternPos = 0;
  let holdIdx = 0;
  return (energy: number) => {
    const pattern = HOLD_PATTERNS[selectHoldPattern(energy)];
    const hold = pattern[patternPos % pattern.length];
    const advance = holdIdx === 0;
    holdIdx += 1;
    if (holdIdx >= hold) {
      holdIdx = 0;
      patternPos += 1;
    }
    return advance;
  };
}

/* ==================== 主题色 ==================== */

export interface EtherTheme {
  /** 低密度暗墨（原版暗红褐） */
  inkDark: [number, number, number];
  /** 高密度亮墨（原版羊皮纸白） */
  inkLight: [number, number, number];
  /** 炽峰色（撕裂最快处的亮脉） */
  inkHot: [number, number, number];
  /** 底色（原版暖黑 0.063,0.051,0.039） */
  bg: [number, number, number];
  /** 拍点频闪颜色 */
  flash: [number, number, number];
}

/** 孔乙己原版暖墨配色（主题色缺失/近灰时的回退） */
export const ETHER_DEFAULT_THEME: EtherTheme = {
  inkDark: [0.55, 0.12, 0.085],
  inkLight: [0.88, 0.84, 0.75],
  inkHot: [0.93, 0.77, 0.5],
  bg: [0.063, 0.051, 0.039],
  flash: [0.52, 0.4, 0.3]
};

export interface EtherFrameParams {
  /** 0~1 平滑响度 */
  energy: number;
  /** 短时能量残差（鼓点冲击），量级 0~0.5 */
  punch: number;
  low: number;
  mid: number;
  high: number;
  /** 0~1 拍点频闪 */
  flash: number;
  rough?: number;
  /** 主奏带活跃度 0~1（leadDetector） */
  leadLevel?: number;
  /** 主奏起音脉冲 0~1（触发后衰减） */
  leadOnset?: number;
  /** 主导带 0=低频 1=中低 2=中高 3=高：决定起音喷丝的形态 */
  leadBand?: number;
  /** 求解时间（秒）——只在推进帧前进，冻结期噪声同步凝固 */
  time: number;
}

/** 主导带 → 起音喷丝形态：低频大墨团慢卷，中高频细丝撕裂 */
const LEAD_SPLAT_PROFILES: Record<number, { radius: [number, number]; curlBonus: number; dyeMul: number; speedMul: number }> = {
  0: { radius: [0.045, 0.03], curlBonus: 0, dyeMul: 1.7, speedMul: 0.7 },
  1: { radius: [0.028, 0.018], curlBonus: 1.5, dyeMul: 1.2, speedMul: 1.0 },
  2: { radius: [0.012, 0.012], curlBonus: 3, dyeMul: 1.0, speedMul: 1.4 },
  3: { radius: [0.009, 0.01], curlBonus: 3.6, dyeMul: 0.9, speedMul: 1.7 }
};

/* ==================== 着色器 ==================== */

const VS = `#version 300 es
const vec2 c[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
out vec2 vUv;
void main(){ vUv = c[gl_VertexID]*.5+.5; gl_Position = vec4(c[gl_VertexID],0.,1.); }`;

const HEAD = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o; uniform vec2 uTexel;`;

const splatFrag = `${HEAD}
uniform sampler2D uTarget; uniform vec2 uPoint; uniform vec3 uValue;
uniform float uRadius; uniform float uAspect;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  float g = exp(-dot(p,p)/uRadius);
  vec3 base = texture(uTarget, vUv).xyz;
  o = vec4(base + uValue*g, 1.);
}`;

const advectFrag = `${HEAD}
uniform sampler2D uVelocity, uSource;
uniform float uDt, uDissipation;
void main(){
  vec2 v = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * v;
  vec4 src = texture(uSource, clamp(coord, vec2(0.0005), vec2(0.9995)));
  o = src / (1.0 + uDissipation * uDt);
}`;

const divergenceFrag = `${HEAD}
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x,0.)).x;
  float R = texture(uVelocity, vUv + vec2(uTexel.x,0.)).x;
  float B = texture(uVelocity, vUv - vec2(0.,uTexel.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.,uTexel.y)).y;
  o = vec4(0.5*(R-L+T-B), 0., 0., 1.);
}`;

const pressureFrag = `${HEAD}
uniform sampler2D uPressure, uDivergence;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x,0.)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x,0.)).x;
  float B = texture(uPressure, vUv - vec2(0.,uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.,uTexel.y)).x;
  float d = texture(uDivergence, vUv).x;
  o = vec4((L+R+B+T-d)*0.25, 0., 0., 1.);
}`;

const gradientFrag = `${HEAD}
uniform sampler2D uPressure, uVelocity;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x,0.)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x,0.)).x;
  float B = texture(uPressure, vUv - vec2(0.,uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.,uTexel.y)).x;
  vec2 v = texture(uVelocity, vUv).xy - 0.5*vec2(R-L, T-B);
  o = vec4(v, 0., 1.);
}`;

const curlFrag = `${HEAD}
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x,0.)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x,0.)).y;
  float B = texture(uVelocity, vUv - vec2(0.,uTexel.y)).x;
  float T = texture(uVelocity, vUv + vec2(0.,uTexel.y)).x;
  o = vec4(0.5*(R-L-T+B), 0., 0., 1.);
}`;

const vorticityFrag = `${HEAD}
uniform sampler2D uVelocity, uCurl; uniform float uCurlStrength, uDt;
void main(){
  float L = abs(texture(uCurl, vUv - vec2(uTexel.x,0.)).x);
  float R = abs(texture(uCurl, vUv + vec2(uTexel.x,0.)).x);
  float B = abs(texture(uCurl, vUv - vec2(0.,uTexel.y)).x);
  float T = abs(texture(uCurl, vUv + vec2(0.,uTexel.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5*vec2(T-B, R-L);
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * uDt;
  o = vec4(clamp(v, -12., 12.), 0., 1.);
}`;

const seedFrag = `${HEAD}
uniform float uScale, uContrast, uSeed;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.07; a*=0.5; } return v; }
void main(){
  vec2 p = vUv * vec2(uScale, uScale*0.56) + uSeed;
  float n = fbm(p);
  float m = fbm(p*2.6 + 17.0);
  float v = clamp((n*0.7 + m*0.3 - 0.5) * uContrast + 0.42, 0.0, 1.0);
  vec2 e = smoothstep(vec2(0.0), vec2(0.08), vUv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - vUv);
  o = vec4(vec3(v * e.x * e.y), 1.0);
}`;

const displayFrag = `${HEAD}
uniform sampler2D uVelocity, uTurb, uGrain;
uniform float uFlash;
uniform float uExposure;
uniform float uRough;
uniform float uSeed;
uniform float uGain;
uniform float uTime;
uniform vec3 uBg;
uniform vec3 uInkDark;
uniform vec3 uInkLight;
uniform vec3 uInkHot;
uniform vec3 uFlashColor;

vec2 velAt(vec2 uv){
  vec2 t = vec2(1.0/320.0, 1.0/180.0);
  vec2 acc = vec2(0.0);
  float wsum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)) * t * 1.6;
      float w = exp(-(float(x*x + y*y)) * 0.55);
      acc += texture(uVelocity, clamp(uv + o, t, vec2(1.0)-t)).xy * w;
      wsum += w;
    }
  }
  return acc / wsum;
}

void main(){
  float turb = texture(uTurb, vUv * 1.0 + vec2(uSeed*0.004, uTime*0.003)).r;
  float vein = texture(uTurb, vUv * 2.0 + vec2(uSeed*0.008, -uTime*0.005)).g;
  float warp = (texture(uTurb, vUv * 0.7 + vec2(0.13, 0.41)).b - 0.5);

  vec2 uv2 = clamp(vUv + warp * 0.06 + (vec2(turb, vein) - 0.5) * 0.012, vec2(0.002), vec2(0.998));
  vec2 v = velAt(uv2);
  float speed = length(v) * uGain;

  float smoke = texture(uTurb, vUv * 1.35 + vec2(uTime * 0.012, uTime * 0.006)).r;
  float smoke2 = texture(uTurb, vUv * 2.9 - vec2(uTime * 0.02, uTime * 0.011)).r;
  float body = mix(smoke, smoke2, 0.45);

  float dens = speed * (0.55 + body * 1.15);
  dens += (vein - 0.55) * uRough * 0.55 * smoothstep(0.02, 0.30, speed);
  dens = clamp(dens, 0.0, 1.7);

  float a = smoothstep(0.10, 0.78, dens) * uExposure;
  float grain = texture(uGrain, vUv * 3.0 + vec2(uSeed * 0.03)).r;
  a *= mix(0.72, 1.0, smoothstep(0.18, 0.65, dens + grain * 0.3));

  float hot = smoothstep(0.62, 1.30, dens);
  vec3 ink = mix(uInkDark, uInkLight, smoothstep(0.10, 0.82, dens));
  ink = mix(ink, uInkHot, hot * 0.72);
  ink *= 0.5 + 0.7 * clamp(dens, 0.0, 1.0);

  float crest = smoothstep(0.80, 1.25, dens) * smoothstep(0.30, 0.75, vein);
  ink += crest * vec3(0.16, 0.13, 0.09);

  vec3 col = ink + uFlash * uFlashColor;
  a = clamp(a + uFlash * 0.35, 0.0, 1.0);
  o = vec4(clamp(mix(uBg, col, a), 0.0, 1.0), 1.0);
}`;

/* ==================== 能力探测 ==================== */

let supportCache: boolean | null = null;

/** 同步探测 WebGL2 + 可渲染浮点 FBO（模块级缓存；探测用的上下文立即释放） */
export function probeEtherSupport(): boolean {
  if (supportCache !== null) return supportCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false
    });
    supportCache =
      !!gl &&
      !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    supportCache = false;
  }
  return supportCache;
}

/* ==================== 求解器 ==================== */

const SIM_W = 320;
const SIM_H = 180;
const DYE_W = 640;
const DYE_H = 360;
const PRESSURE_ITERS = 22;
const DT = 1 / 60;
const VEL_DISS = 1.1;
const DYE_DISS = 0.55;
const BASE_GAIN = 7.5;

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 不支持 WebGL2/浮点 FBO 时抛错；调用方先 probeEtherSupport 或捕获后回退 */
export class EtherFluid {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private programs: Record<string, Program> = {};
  private vel: Target[] = [];
  private dye: Target[] = [];
  private prs: Target[] = [];
  private div!: Target;
  private crl!: Target;
  private turbTex: WebGLTexture | null = null;
  private grainTex: WebGLTexture | null = null;
  private vi = 0;
  private di = 0;
  private pi = 0;
  private W = 720;
  private H = 1280;
  private rnd: () => number = lcg(7);
  private splatGain = 1;
  private theme: EtherTheme = ETHER_DEFAULT_THEME;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, seed = 7) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('[EtherFluid] WebGL2 不可用');
    const extFloat = gl.getExtension('EXT_color_buffer_float');
    const extHalf = gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    if (!extFloat && !extHalf) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw new Error('[EtherFluid] 浮点 FBO 扩展不可用');
    }
    this.gl = gl;
    this.canvas = canvas;
    this.rnd = lcg(seed);

    this.programs = {
      splat: this.program(splatFrag),
      advect: this.program(advectFrag),
      divergence: this.program(divergenceFrag),
      pressure: this.program(pressureFrag),
      gradient: this.program(gradientFrag),
      curl: this.program(curlFrag),
      vort: this.program(vorticityFrag),
      seed: this.program(seedFrag),
      display: this.program(displayFrag)
    };

    this.vel = [this.makeFloatTarget(SIM_W, SIM_H), this.makeFloatTarget(SIM_W, SIM_H)];
    this.dye = [this.makeFloatTarget(DYE_W, DYE_H), this.makeFloatTarget(DYE_W, DYE_H)];
    this.prs = [this.makeFloatTarget(SIM_W, SIM_H), this.makeFloatTarget(SIM_W, SIM_H)];
    this.div = this.makeFloatTarget(SIM_W, SIM_H);
    this.crl = this.makeFloatTarget(SIM_W, SIM_H);

    this.turbTex = this.blankTexture();
    this.grainTex = this.blankTexture();
    this.clearAll();
  }

  /* ---------- 资源 ---------- */

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`[EtherFluid] 着色器编译失败: ${gl.getShaderInfoLog(s)}`);
    }
    return s;
  }

  private program(frag: string): Program {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`[EtherFluid] 程序链接失败: ${gl.getProgramInfoLog(p)}`);
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  private makeFloatTarget(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  /** 占位 1×1 纹理（湍流/颗粒图加载完成前保证可渲染） */
  private blankTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([140, 90, 128, 255])
    );
    return tex;
  }

  /** 加载可平铺湍流（RGB=烟雾/细丝/扭曲）与颗粒纹理 */
  loadTextures(turbUrl: string, grainUrl: string): Promise<boolean> {
    const load = (which: 'turb' | 'grain', url: string) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (this.disposed) return resolve(false);
          const gl = this.gl;
          const tex = which === 'turb' ? this.turbTex : this.grainTex;
          if (!tex) return resolve(false);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = url;
      });
    return Promise.all([load('turb', turbUrl), load('grain', grainUrl)]).then(
      (ok) => ok.every(Boolean)
    );
  }

  /* ---------- 管线 ---------- */

  private drawTo(target: Target | null, prog: Program, setup: (u: Record<string, WebGLUniformLocation | null>) => void): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
    gl.useProgram(prog.p);
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bindTex(unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  private clearAll(): void {
    const gl = this.gl;
    [...this.vel, ...this.dye, ...this.prs, this.div, this.crl].forEach((t) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
  }

  private splat(x: number, y: number, vx: number, vy: number, radius: number, color: [number, number, number], dyeAmt: number): void {
    const aspect = this.W / this.H;
    this.drawTo(this.vel[1 - this.vi], this.programs.splat, (u) => {
      this.bindTex(0, this.vel[this.vi].tex, u.uTarget);
      this.gl.uniform2f(u.uPoint, x, y);
      this.gl.uniform3f(u.uValue, vx, vy, 0);
      this.gl.uniform1f(u.uRadius, radius);
      this.gl.uniform1f(u.uAspect, aspect);
    });
    this.vi = 1 - this.vi;
    this.drawTo(this.dye[1 - this.di], this.programs.splat, (u) => {
      this.bindTex(0, this.dye[this.di].tex, u.uTarget);
      this.gl.uniform2f(u.uPoint, x, y);
      this.gl.uniform3f(u.uValue, color[0] * dyeAmt, color[1] * dyeAmt, color[2] * dyeAmt);
      this.gl.uniform1f(u.uRadius, radius * 1.35);
      this.gl.uniform1f(u.uAspect, aspect);
    });
    this.di = 1 - this.di;
  }

  private step(dt: number, curlAmount: number): void {
    const sx = 1 / SIM_W;
    const sy = 1 / SIM_H;
    const dx = 1 / DYE_W;
    const dy = 1 / DYE_H;
    // 涡量
    this.drawTo(this.crl, this.programs.curl, (u) => {
      this.gl.uniform2f(u.uTexel, sx, sy);
      this.bindTex(0, this.vel[this.vi].tex, u.uVelocity);
    });
    this.drawTo(this.vel[1 - this.vi], this.programs.vort, (u) => {
      this.gl.uniform2f(u.uTexel, sx, sy);
      this.gl.uniform1f(u.uCurlStrength, curlAmount);
      this.gl.uniform1f(u.uDt, dt);
      this.bindTex(0, this.vel[this.vi].tex, u.uVelocity);
      this.bindTex(1, this.crl.tex, u.uCurl);
    });
    this.vi = 1 - this.vi;
    // 平流速度
    this.drawTo(this.vel[1 - this.vi], this.programs.advect, (u) => {
      this.gl.uniform2f(u.uTexel, sx, sy);
      this.gl.uniform1f(u.uDt, dt);
      this.gl.uniform1f(u.uDissipation, VEL_DISS);
      this.bindTex(0, this.vel[this.vi].tex, u.uVelocity);
      this.bindTex(1, this.vel[this.vi].tex, u.uSource);
    });
    this.vi = 1 - this.vi;
    // 散度 + 压力
    this.drawTo(this.div, this.programs.divergence, (u) => {
      this.gl.uniform2f(u.uTexel, sx, sy);
      this.bindTex(0, this.vel[this.vi].tex, u.uVelocity);
    });
    for (let i = 0; i < PRESSURE_ITERS; i++) {
      this.drawTo(this.prs[1 - this.pi], this.programs.pressure, (u) => {
        this.gl.uniform2f(u.uTexel, sx, sy);
        this.bindTex(0, this.prs[this.pi].tex, u.uPressure);
        this.bindTex(1, this.div.tex, u.uDivergence);
      });
      this.pi = 1 - this.pi;
    }
    // 减压力梯度
    this.drawTo(this.vel[1 - this.vi], this.programs.gradient, (u) => {
      this.gl.uniform2f(u.uTexel, sx, sy);
      this.bindTex(0, this.prs[this.pi].tex, u.uPressure);
      this.bindTex(1, this.vel[this.vi].tex, u.uVelocity);
    });
    this.vi = 1 - this.vi;
    // 平流染料
    this.drawTo(this.dye[1 - this.di], this.programs.advect, (u) => {
      this.gl.uniform2f(u.uTexel, dx, dy);
      this.gl.uniform1f(u.uDt, dt);
      this.gl.uniform1f(u.uDissipation, DYE_DISS);
      this.bindTex(0, this.vel[this.vi].tex, u.uVelocity);
      this.bindTex(1, this.dye[this.di].tex, u.uSource);
    });
    this.di = 1 - this.di;
  }

  private present(flash: number, exposure: number, rough: number, seedVal: number, time: number): void {
    const theme = this.theme;
    this.drawTo(null, this.programs.display, (u) => {
      this.gl.uniform2f(u.uTexel, 1 / DYE_W, 1 / DYE_H);
      this.gl.uniform1f(u.uFlash, flash);
      this.gl.uniform1f(u.uExposure, exposure);
      this.gl.uniform1f(u.uRough, rough);
      this.gl.uniform1f(u.uSeed, seedVal);
      this.gl.uniform1f(u.uGain, BASE_GAIN);
      this.gl.uniform1f(u.uTime, time);
      this.gl.uniform3f(u.uBg, theme.bg[0], theme.bg[1], theme.bg[2]);
      this.gl.uniform3f(u.uInkDark, theme.inkDark[0], theme.inkDark[1], theme.inkDark[2]);
      this.gl.uniform3f(u.uInkLight, theme.inkLight[0], theme.inkLight[1], theme.inkLight[2]);
      this.gl.uniform3f(u.uInkHot, theme.inkHot[0], theme.inkHot[1], theme.inkHot[2]);
      this.gl.uniform3f(u.uFlashColor, theme.flash[0], theme.flash[1], theme.flash[2]);
      this.bindTex(0, this.vel[this.vi].tex, u.uVelocity);
      this.bindTex(1, this.turbTex!, u.uTurb);
      this.bindTex(2, this.grainTex!, u.uGrain);
    });
  }

  /* ---------- 公开驱动（与原 __seed/__settle/__frame 对齐） ---------- */

  resize(w: number, h: number): void {
    if (this.disposed) return;
    this.W = Math.max(2, Math.round(w));
    this.H = Math.max(2, Math.round(h));
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.gl.viewport(0, 0, this.W, this.H);
  }

  /** 喷注增益（接错误样式的「流体力度」滑杆） */
  setSplatGain(gain: number): void {
    this.splatGain = Number.isFinite(gain) && gain > 0 ? gain : 1;
  }

  /** 注入墨色主题；null 回原版暖墨 */
  setTheme(theme: EtherTheme | null): void {
    this.theme = theme ?? ETHER_DEFAULT_THEME;
  }

  /** 用 fbm 噪声给染料播种（原 __seed） */
  seed(scale: number, contrast: number, seedVal: number): void {
    if (this.disposed) return;
    this.drawTo(this.dye[this.di], this.programs.seed, (u) => {
      this.gl.uniform2f(u.uTexel, 1 / DYE_W, 1 / DYE_H);
      this.gl.uniform1f(u.uScale, scale);
      this.gl.uniform1f(u.uContrast, contrast);
      this.gl.uniform1f(u.uSeed, seedVal);
    });
  }

  /** 注入环境涡量并让流场咀嚼染料（原 __settle） */
  settle(steps: number, speed: number): void {
    for (let k = 0; k < steps; k++) {
      for (let i = 0; i < 2; i++) {
        const x = this.rnd();
        const y = this.rnd();
        const ang = this.rnd() * Math.PI * 2;
        this.splat(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, 0.004 + this.rnd() * 0.008, [0, 0, 0], 0);
      }
      for (let s = 0; s < 2; s++) this.step(DT, 2.2);
    }
  }

  /** 推进一帧：按能量/冲击喷注 → 主奏起音喷丝 → 4 个子步 → 呈现（原 __frame 扩展） */
  frame(params: EtherFrameParams): void {
    if (this.disposed) return;
    const e = params.energy;
    const p = params.punch;
    const lo = params.low;
    const hi = params.high;
    const leadOnset = params.leadOnset ?? 0;
    const leadBand = params.leadBand ?? 2;
    const nSplats = Math.round(1 + p * 3);
    for (let i = 0; i < nSplats; i++) {
      const x = 0.04 + this.rnd() * 0.92;
      const y = 0.12 + this.rnd() * 0.86;
      const power = 0.012 + e * 0.045 + p * 0.1;
      const ang = this.rnd() * Math.PI * 2;
      const vx = Math.cos(ang) * power * (0.6 + hi * 1.2);
      const vy = Math.sin(ang) * power * (0.6 + lo * 1.2) - power * 0.35;
      const red = p > 0.42 && this.rnd() < 0.6;
      const col: [number, number, number] = red ? [1.0, 0.26, 0.19] : [0.95, 0.91, 0.83];
      const dyeAmt = (0.02 + e * 0.03 + p * 0.055) * this.splatGain;
      const radius = 0.012 + this.rnd() * 0.028 + p * 0.012;
      this.splat(x, y, vx, vy, radius, col, dyeAmt);
    }
    // 主奏起音喷丝：视觉打击点对齐主奏音符（形态随主导带音区变化）。
    // 喷注量与涡量抬升配响度门：归一化通量对绝对响度不敏感（自适应基线的
    // 代价），安静段（如前奏 solo）若满力度喷丝会反向「更吵」——视觉能量
    // 应与听感能量守恒：响度门 0.35+e×0.65，安静段保留约 1/3、正常响度满力
    const loudnessGate = 0.35 + e * 0.65;
    const profile = LEAD_SPLAT_PROFILES[leadBand] ?? LEAD_SPLAT_PROFILES[2];
    if (leadOnset > 0.6) {
      const strength = Math.min(1, leadOnset);
      // 单股：起音已由组件边沿武装保证一次起音只到这一帧，量级宁少勿吵
      const x = 0.08 + this.rnd() * 0.84;
      const y = 0.1 + this.rnd() * 0.8;
      const ang = this.rnd() * Math.PI * 2;
      const power = 0.03 + e * 0.04 + strength * 0.05;
      const vx = Math.cos(ang) * power * profile.speedMul;
      const vy = Math.sin(ang) * power * profile.speedMul - power * 0.3;
      // 主奏丝用亮白染料（区别于低频喷注的暖白/朱红），带小半径=细丝感
      const dyeAmt = (0.035 + strength * 0.025) * profile.dyeMul * loudnessGate * this.splatGain;
      const radius = profile.radius[0] + this.rnd() * profile.radius[1];
      this.splat(x, y, vx, vy, radius, [0.97, 0.96, 0.9], dyeAmt);
    }
    const sub = 4;
    for (let s = 0; s < sub; s++) {
      this.step(DT * 0.9, 2.0 + p * 6.0 + leadOnset * profile.curlBonus * (0.5 + e * 0.5));
    }
    this.present(
      params.flash,
      1.0 + e * 0.45,
      params.rough ?? 0.5,
      (params.time * 37.0) % 97.0,
      params.time
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    const lose = gl.getExtension('WEBGL_lose_context');
    Object.values(this.programs).forEach((prog) => gl.deleteProgram(prog.p));
    [...this.vel, ...this.dye, ...this.prs, this.div, this.crl].forEach((t) => {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    });
    if (this.turbTex) gl.deleteTexture(this.turbTex);
    if (this.grainTex) gl.deleteTexture(this.grainTex);
    lose?.loseContext();
  }
}
