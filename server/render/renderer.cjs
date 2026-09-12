"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/serverEntry.ts
var serverEntry_exports = {};
__export(serverEntry_exports, {
  VIDEO_EXPORT_FPS: () => VIDEO_EXPORT_FPS,
  buildTimeline: () => buildTimeline,
  computeSungChars: () => computeSungChars,
  formatSegmentTime: () => formatSegmentTime,
  getAllSkins: () => getAllSkins,
  getSkin: () => getSkin,
  renderFrameLayout: () => renderFrameLayout,
  resolveAccent: () => resolveAccent,
  resolveLyricState: () => resolveLyricState,
  resolveVideoSize: () => resolveVideoSize
});
module.exports = __toCommonJS(serverEntry_exports);

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/common.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seedFromString(text) {
  let seed = 2166136261;
  for (const ch of Array.from(text)) {
    seed ^= ch.codePointAt(0) || 0;
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}
function rgba(r, g, b, a = 1) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}
function withAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1], 16);
  return rgba(n >> 16 & 255, n >> 8 & 255, n & 255, alpha);
}
function resolveAccent(skin, dominant) {
  if (!skin.followCoverAccent || !dominant) return skin.accent;
  const max = Math.max(dominant.r, dominant.g, dominant.b);
  const factor = max < 120 ? 120 / Math.max(1, max) : max > 215 ? 215 / max : 1;
  return rgba(dominant.r * factor, dominant.g * factor, dominant.b * factor, 1);
}
function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function fillRoundRect(ctx, x, y, width, height, radius) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}
function fillVerticalGradient(ctx, width, height, stops) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") {
      if (current) lines.push(current);
      current = "";
      continue;
    }
    const probe = current + ch;
    if (ctx.measureText(probe).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = probe;
    }
  }
  if (current) lines.push(current);
  return lines;
}
function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}\u2026\u2026`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}\u2026\u2026`;
}
function drawSungLine(ctx, text, sungChars, colX, startY, maxWidth, lineHeight, align, sungColor, restColor) {
  const chars = Array.from(text);
  let row = 0;
  let offset = 0;
  while (offset < chars.length) {
    let end = offset;
    let width = 0;
    while (end < chars.length) {
      const w = ctx.measureText(chars[end]).width;
      if (width + w > maxWidth && end > offset) break;
      width += w;
      end++;
    }
    const rowChars = chars.slice(offset, end);
    const rowText = rowChars.join("");
    const y = startY + row * lineHeight;
    const sungInRow = Math.max(0, Math.min(rowChars.length, sungChars - offset));
    if (sungInRow <= 0) {
      ctx.fillStyle = restColor;
      ctx.textAlign = align;
      ctx.fillText(rowText, colX, y);
    } else if (sungInRow >= rowChars.length) {
      ctx.fillStyle = sungColor;
      ctx.textAlign = align;
      ctx.fillText(rowText, colX, y);
    } else {
      const sungText = rowChars.slice(0, sungInRow).join("");
      const restText = rowChars.slice(sungInRow).join("");
      const sungWidth = ctx.measureText(sungText).width;
      const restWidth = ctx.measureText(restText).width;
      const totalWidth = sungWidth + restWidth;
      const startX = align === "center" ? colX - totalWidth / 2 : align === "right" ? colX - totalWidth : colX;
      ctx.textAlign = "left";
      ctx.fillStyle = sungColor;
      ctx.fillText(sungText, startX, y);
      ctx.fillStyle = restColor;
      ctx.fillText(restText, startX + sungWidth, y);
    }
    offset = end;
    row++;
  }
  return Math.max(1, row);
}
function drawCoverFill(ctx, image, x, y, width, height) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const sourceRatio = iw / ih;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (sourceRatio > targetRatio) {
    sw = ih * targetRatio;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetRatio;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}
function drawCoverRound(ctx, image, x, y, size, radius) {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  drawCoverFill(ctx, image, x, y, size, size);
  ctx.restore();
}
function drawProgressBar(c, box, color, trackColor) {
  const { ctx } = c;
  const height = Math.max(3, Math.round(c.height * 5e-3));
  const y = box.y;
  ctx.save();
  ctx.fillStyle = trackColor;
  fillRoundRect(ctx, box.x, y, box.width, height, height / 2);
  ctx.fillStyle = color;
  const filled = Math.max(height, box.width * Math.min(1, Math.max(0, c.progress)));
  fillRoundRect(ctx, box.x, y, filled, height, height / 2);
  ctx.restore();
}
function drawWatermark(c) {
  const { ctx, width, height } = c;
  const pad = Math.round(height * 0.025);
  const fontPx = Math.max(12, Math.round(height * 0.022));
  ctx.save();
  ctx.font = `500 ${fontPx}px ${c.skin.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = c.skin.theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)";
  ctx.fillText("Zephyrus Player", pad, height - pad);
  ctx.restore();
  if (c.qrImage) {
    const size = Math.round(height * 0.11);
    const qx = width - size - pad;
    const qy = height - size - pad;
    const inset = Math.round(size * 0.06);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    fillRoundRect(ctx, qx - inset, qy - inset, size + inset * 2, size + inset * 2, inset * 1.6);
    ctx.restore();
    ctx.drawImage(c.qrImage, qx, qy, size, size);
  }
}
function drawScanlines(c, alpha, step, offset = 0) {
  if (alpha <= 0 || step <= 0) return;
  const { ctx, width, height } = c;
  const shift = (offset % step + step) % step;
  const barHeight = Math.max(1, Math.round(step * 0.35));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  for (let y = -step + shift; y < height; y += step) {
    if (y + barHeight < 0) continue;
    ctx.fillRect(0, y, width, barHeight);
  }
  ctx.restore();
}
function drawNoise(c, strength, cell = 3) {
  if (strength <= 0) return;
  const { ctx, width, height } = c;
  const frame = Math.floor(c.timeSec * 12);
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const rand = mulberry32(seedFromString(`noise:${c.skin.key}:${frame}`));
  ctx.save();
  ctx.globalAlpha = Math.min(1, strength);
  for (let i = 0; i < cols * rows; i++) {
    const v = rand();
    if (v > 0.5) continue;
    const x = i % cols * cell;
    const y = Math.floor(i / cols) * cell;
    ctx.fillStyle = v < 0.25 ? "#000" : "#fff";
    ctx.fillRect(x, y, cell, cell);
  }
  ctx.restore();
}

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/default.ts
var defaultSkin = {
  key: "default",
  label: "\u9ED8\u8BA4",
  theme: "light",
  layout: "stack",
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: "#0c0c11",
  accent: "#93a7c4",
  followCoverAccent: true,
  textPrimary: "rgba(255,255,255,0.95)",
  textSecondary: "rgba(255,255,255,0.58)",
  textActive: "#ffffff",
  showCover: true,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    ctx.fillStyle = "#0c0c11";
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      ctx.filter = `blur(${Math.round(height * 0.05)}px) brightness(0.42) saturate(1.15)`;
      const scale = 1.14 + 0.06 * (0.5 + 0.5 * Math.sin(timeSec * 0.22));
      const w = width * scale;
      const h = height * scale;
      const dx = Math.sin(timeSec * 0.16) * width * 0.03;
      const dy = Math.cos(timeSec * 0.13) * height * 0.03;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2 + dx, (height - h) / 2 + dy, w, h);
      ctx.restore();
    }
    fillVerticalGradient(ctx, width, height, [
      [0, "rgba(10,10,16,0.30)"],
      [0.52, "rgba(10,10,16,0.52)"],
      [1, "rgba(5,5,9,0.88)"]
    ]);
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/eerie.ts
var WISPS = 7;
function drawWisps(c) {
  const { ctx, width, height, timeSec, level } = c;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < WISPS; i++) {
    const rand = mulberry32(seedFromString(`eerie-wisp:${i}`));
    const radiusX = width * (0.18 + rand() * 0.24);
    const radiusY = height * (0.12 + rand() * 0.2);
    const cx = width * (0.2 + rand() * 0.6);
    const cy = height * (0.2 + rand() * 0.6);
    const speed = 0.14 + rand() * 0.22;
    const angle = timeSec * speed + rand() * Math.PI * 2;
    const x = cx + Math.cos(angle) * radiusX;
    const y = cy + Math.sin(angle * 0.7) * radiusY;
    const size = width * (0.22 + rand() * 0.3);
    const alpha = 0.07 + level * 0.11;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    grad.addColorStop(0, `rgba(150,170,200,${alpha.toFixed(3)})`);
    grad.addColorStop(1, "rgba(150,170,200,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
var eerieSkin = {
  key: "eerie",
  label: "\u8BE1\u8C32",
  theme: "dark",
  layout: "immersive",
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: "#050507",
  accent: "#9d8cff",
  textPrimary: "rgba(240,240,245,0.92)",
  textSecondary: "rgba(220,220,235,0.4)",
  textActive: "#ffffff",
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height } = c;
    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      ctx.filter = `blur(${Math.round(height * 0.09)}px) brightness(0.28) saturate(0.7)`;
      const w = width * 1.3;
      const h = height * 1.3;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2, (height - h) / 2, w, h);
      ctx.restore();
    }
    ctx.fillStyle = "rgba(3,3,6,0.55)";
    ctx.fillRect(0, 0, width, height);
  },
  drawAtmosphere: drawWisps,
  drawForeground(c) {
    const { ctx, width, height } = c;
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.12,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.66
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/error.ts
function drawTearLines(c) {
  const { ctx, width, height, timeSec } = c;
  const frame = Math.floor(timeSec * 30);
  const rand = mulberry32(seedFromString(`error-tear:${frame}`));
  const count = rand() < 0.35 ? 3 : 1;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const y = rand() * height;
    const h = Math.max(1, height * (1e-3 + rand() * 3e-3));
    ctx.fillStyle = rand() < 0.6 ? "rgba(62,200,184,0.5)" : "rgba(157,140,255,0.45)";
    ctx.fillRect(0, y, width, h);
  }
  ctx.restore();
}
var errorSkin = {
  key: "error",
  label: "\u9519\u8BEF",
  theme: "dark",
  layout: "terminal",
  // 等宽字体通常不含中文字形，显式追加中文字体兜底，避免歌词出现方块
  fontFamily: "'JetBrains Mono', 'Menlo', 'Noto Sans SC', 'PingFang SC', monospace",
  background: "#000000",
  accent: "#3ec8b8",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,255,255,0.34)",
  textActive: "#3ec8b8",
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height } = c;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width / 2,
      height * 0.45,
      0,
      width / 2,
      height * 0.45,
      Math.max(width, height) * 0.62
    );
    glow.addColorStop(0, "rgba(62,200,184,0.09)");
    glow.addColorStop(0.55, "rgba(62,200,184,0.03)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  },
  drawAtmosphere: drawTearLines,
  drawForeground(c) {
    drawScanlines(c, 0.14, Math.max(3, Math.round(c.height * 35e-4)));
    drawNoise(c, 0.04 + c.level * 0.05, Math.max(2, Math.round(c.width * 22e-4)));
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/frenzy.ts
function drawGlitchBands(c) {
  const { ctx, width, height, timeSec, level, beat } = c;
  const frame = Math.floor(timeSec * 30);
  const rand = mulberry32(seedFromString(`frenzy:${frame}`));
  const intensity = Math.min(1, 0.1 + level * 0.35 + (beat ? 0.3 : 0));
  const bands = Math.round(2 + intensity * 4);
  ctx.save();
  for (let i = 0; i < bands; i++) {
    if (rand() > intensity) continue;
    const y = rand() * height;
    const h = height * (4e-3 + rand() * 0.022);
    const w = width * (0.3 + rand() * 0.7);
    const x = (rand() - 0.5) * width * 0.1 * intensity;
    const tone = rand();
    ctx.fillStyle = tone < 0.4 ? "rgba(255,42,42,0.28)" : tone < 0.7 ? "rgba(62,200,184,0.22)" : "rgba(26,26,26,0.16)";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
var frenzySkin = {
  key: "frenzy",
  label: "\u72C2\u8E81",
  theme: "light",
  layout: "poster",
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  background: "#ffffff",
  accent: "#ff2a2a",
  textPrimary: "#1a1a1a",
  textSecondary: "rgba(26,26,26,0.42)",
  textActive: "#ff2a2a",
  showCover: false,
  drawBackground(c) {
    c.ctx.fillStyle = "#ffffff";
    c.ctx.fillRect(0, 0, c.width, c.height);
  },
  drawAtmosphere: drawGlitchBands,
  drawForeground(c) {
    drawScanlines(
      c,
      0.03 + c.level * 0.03,
      Math.max(3, Math.round(c.height * 6e-3)),
      c.timeSec * 90
    );
    if (c.beat || c.level > 0.72) {
      const strength = Math.min(0.22, c.level * 0.24);
      c.ctx.save();
      c.ctx.globalCompositeOperation = "overlay";
      c.ctx.fillStyle = `rgba(120,190,255,${strength.toFixed(3)})`;
      c.ctx.fillRect(0, 0, c.width, c.height);
      c.ctx.restore();
    }
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/neon.ts
function drawWallTexture(c) {
  const { ctx, width, height } = c;
  const cell = Math.max(2, Math.round(width * 4e-3));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const rand = mulberry32(seedFromString("neon-wall"));
  ctx.save();
  for (let i = 0; i < cols * rows; i++) {
    const v = rand();
    if (v > 0.42) continue;
    const x = i % cols * cell;
    const y = Math.floor(i / cols) * cell;
    const alpha = 0.2 + v * 0.55;
    ctx.fillStyle = v < 0.2 ? rgba(96, 84, 66, alpha) : rgba(26, 22, 18, alpha);
    ctx.fillRect(x, y, cell, cell);
  }
  ctx.restore();
}
var neonSkin = {
  key: "neon",
  label: "\u9648\u65E7",
  theme: "dark",
  layout: "stack",
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: "#2a2620",
  accent: "#c9a96e",
  textPrimary: "#e8d5a8",
  textSecondary: "rgba(201,169,110,0.5)",
  textActive: "#f6e6bf",
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    ctx.fillStyle = "#2a2620";
    ctx.fillRect(0, 0, width, height);
    drawWallTexture(c);
    const ax = width * (0.3 + Math.sin(timeSec * 0.25) * 0.08);
    const ay = height * (0.4 + Math.cos(timeSec * 0.19) * 0.07);
    const warmA = ctx.createRadialGradient(ax, ay, 0, ax, ay, Math.max(width, height) * 0.58);
    warmA.addColorStop(0, "rgba(201,169,110,0.11)");
    warmA.addColorStop(1, "rgba(201,169,110,0)");
    ctx.fillStyle = warmA;
    ctx.fillRect(0, 0, width, height);
    const bx = width * (0.72 + Math.sin(timeSec * 0.21 + 1.6) * 0.08);
    const by = height * (0.6 + Math.cos(timeSec * 0.17 + 0.8) * 0.07);
    const warmB = ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(width, height) * 0.5);
    warmB.addColorStop(0, "rgba(180,140,80,0.09)");
    warmB.addColorStop(1, "rgba(180,140,80,0)");
    ctx.fillStyle = warmB;
    ctx.fillRect(0, 0, width, height);
  },
  drawForeground(c) {
    const { ctx, width, height } = c;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.72, withAlpha("#5c4a2e", 0.55));
    grad.addColorStop(1, "#5c4a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/rain.ts
var DROPS = 260;
var ANGLE_DEG = 15;
var DROP_COLOR = "255,255,255";
var DROP_ALPHA = 0.6;
var DROP_LENGTH = 40;
var DROP_INTENSITY = 0.5;
function drawRain(c) {
  const { ctx, width, height, timeSec, level } = c;
  const rad = ANGLE_DEG * Math.PI / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const overhang = Math.abs(dx) * height;
  const count = Math.round(DROPS * (0.5 + DROP_INTENSITY));
  const len = height * (DROP_LENGTH / 100) * 0.42;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const rand = mulberry32(seedFromString(`rain:${i}`));
    const speed = 0.28 + rand() * 0.75;
    const phase = (timeSec * speed * 0.5 + rand()) % 1;
    const progress = phase;
    const startY = progress * (height + len) - len;
    const startX = rand() * (width + overhang) - overhang / 2 + dx * (progress * height);
    const wobble = Math.sin(timeSec * 2 + i) * width * 2e-3;
    const tailX = startX - dx * len + wobble;
    const tailY = startY - dy * len;
    const depth = 0.35 + rand() * 0.65;
    const alpha = DROP_ALPHA * depth * (0.7 + level * 0.3);
    ctx.strokeStyle = `rgba(${DROP_COLOR},${alpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(1, width * 14e-4 * depth);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }
  ctx.restore();
}
var rainSkin = {
  key: "rain",
  label: "\u96E8\u591C",
  theme: "dark",
  layout: "immersive",
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: "#0a0a0f",
  accent: "#8ab4d8",
  followCoverAccent: true,
  textPrimary: "rgba(255,255,255,0.95)",
  textSecondary: "rgba(255,255,255,0.5)",
  textActive: "#ffffff",
  showCover: false,
  drawBackground(c) {
    const { ctx, width, height } = c;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      ctx.filter = `blur(${Math.round(height * 0.07)}px) brightness(0.4) saturate(1.2)`;
      const w = width * 1.25;
      const h = height * 1.25;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2, (height - h) / 2, w, h);
      ctx.restore();
    }
    ctx.fillStyle = "rgba(6,8,14,0.45)";
    ctx.fillRect(0, 0, width, height);
  },
  drawAtmosphere: drawRain
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/smoke.ts
var PUFFS = 28;
function drawSmokeLayer(c) {
  const { ctx, width, height, timeSec, level } = c;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < PUFFS; i++) {
    const rand = mulberry32(seedFromString(`smoke:${i}`));
    const size = width * (0.2 + rand() * 0.4);
    const speed = 0.03 + rand() * 0.05;
    const phase = (timeSec * speed + rand()) % 1.4 - 0.2;
    const y = height * (1.08 - phase);
    const x = rand() * width + Math.sin(phase * Math.PI * 2 + i) * width * 0.05;
    const fade = Math.sin(Math.min(1, Math.max(0, phase / 1.3)) * Math.PI);
    const alpha = (0.14 + level * 0.18) * fade;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    grad.addColorStop(0, `rgba(200,205,215,${alpha})`);
    grad.addColorStop(1, "rgba(200,205,215,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
var smokeSkin = {
  key: "smoke",
  label: "\u70DF\u96FE",
  theme: "dark",
  layout: "stack",
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: "#07070a",
  accent: "#b8bcc6",
  textPrimary: "rgba(255,255,255,0.93)",
  textSecondary: "rgba(255,255,255,0.42)",
  textActive: "#ffffff",
  showCover: false,
  drawBackground(c) {
    fillVerticalGradient(c.ctx, c.width, c.height, [
      [0, "#050508"],
      [0.55, "#0a0a0f"],
      [1, "#040406"]
    ]);
  },
  drawAtmosphere: drawSmokeLayer,
  drawForeground(c) {
    const { ctx, width, height } = c;
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.18,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.68
    );
    grad.addColorStop(0, "rgba(8,8,12,0)");
    grad.addColorStop(1, "rgba(4,4,7,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/stage.ts
var SMOKE_PUFFS = 14;
function drawSmoke(c, alpha, color) {
  const { ctx, width, height, timeSec } = c;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const rand = mulberry32(seedFromString(`stage-smoke:${i}`));
    const baseX = rand() * width;
    const size = width * (0.16 + rand() * 0.26);
    const speed = 0.018 + rand() * 0.03;
    const drift = (rand() - 0.5) * width * 0.06;
    const phase = (timeSec * speed + rand()) % 1.35 - 0.18;
    const y = height * (1.1 - phase);
    const x = baseX + drift * phase;
    const fade = Math.sin(Math.min(1, Math.max(0, phase / 1.2)) * Math.PI);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    grad.addColorStop(0, color.replace("ALPHA", String(alpha * fade)));
    grad.addColorStop(1, color.replace("ALPHA", "0"));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
var stageSkin = {
  key: "stage",
  label: "\u821E\u53F0",
  theme: "light",
  layout: "stack",
  fontFamily: "'Noto Serif SC', 'Songti SC', serif",
  background: "#1a1510",
  accent: "#b49664",
  textPrimary: "rgba(255,255,255,0.95)",
  textSecondary: "rgba(255,255,255,0.55)",
  textActive: "#f4e3c0",
  showCover: true,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    ctx.fillStyle = "#1a1510";
    ctx.fillRect(0, 0, width, height);
    if (c.song.cover) {
      ctx.save();
      const brightness = 0.72 + c.level * 0.35;
      ctx.filter = `blur(${Math.round(height * 0.055)}px) brightness(${brightness.toFixed(2)}) saturate(1.5)`;
      const scale = 1.2 + 0.07 * (0.5 + 0.5 * Math.sin(timeSec * 0.19));
      const w = width * scale;
      const h = height * scale;
      const dx = Math.sin(timeSec * 0.15) * width * 0.04;
      const dy = Math.cos(timeSec * 0.12) * height * 0.04;
      drawCoverFill(ctx, c.song.cover, (width - w) / 2 + dx, (height - h) / 2 + dy, w, h);
      ctx.restore();
    }
    fillVerticalGradient(ctx, width, height, [
      [0, "rgba(26,21,16,0.42)"],
      [0.55, "rgba(22,17,12,0.58)"],
      [1, "rgba(12,9,6,0.9)"]
    ]);
  },
  drawAtmosphere(c) {
    drawSmoke(c, 0.1 + c.level * 0.08, "rgba(214,190,150,ALPHA)");
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/starChart.ts
var STARS = 170;
var starChartSkin = {
  key: "starChart",
  label: "\u661F\u76D8",
  theme: "dark",
  layout: "stack",
  fontFamily: "'Noto Serif SC', 'STSong', serif",
  background: "#050505",
  accent: "#9aa7c8",
  followCoverAccent: true,
  textPrimary: "#f7f7f5",
  textSecondary: "rgba(255,255,255,0.46)",
  textActive: "#ffffff",
  showCover: true,
  drawBackground(c) {
    const { ctx, width, height, timeSec } = c;
    fillVerticalGradient(ctx, width, height, [
      [0, "#050505"],
      [0.6, "#080810"],
      [1, "#04040a"]
    ]);
    const cx = width / 2;
    const cy = height * 0.42;
    const rot = timeSec * 0.12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = "rgba(200,210,235,0.18)";
    ctx.lineWidth = Math.max(1, width * 2e-3);
    for (let ring = 1; ring <= 3; ring++) {
      const radius = Math.min(width, height) * (0.16 + ring * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const inner = Math.min(width, height) * 0.16;
      const outer = Math.min(width, height) * 0.52;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    for (let i = 0; i < STARS; i++) {
      const rand = mulberry32(seedFromString(`star:${i}`));
      const x = rand() * width;
      const y = rand() * height;
      const base = 0.4 + rand() * 0.6;
      const twinkle = 0.5 + 0.5 * Math.sin(timeSec * (0.7 + rand() * 1.4) + i);
      const size = Math.max(1, width * (18e-4 + rand() * 34e-4));
      const alpha = Math.min(1, base * twinkle);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/skins/index.ts
var SKINS = {
  default: defaultSkin,
  stage: stageSkin,
  starChart: starChartSkin,
  frenzy: frenzySkin,
  eerie: eerieSkin,
  neon: neonSkin,
  rain: rainSkin,
  smoke: smokeSkin,
  error: errorSkin
};
function getSkin(key) {
  return SKINS[key] ?? defaultSkin;
}
function getAllSkins() {
  return Object.values(SKINS);
}

// ../../Desktop/zephyrus-player-android/src/renderer/types/shareVideo.ts
var VIDEO_ASPECT_OPTIONS = [
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "9:16", label: "9:16", ratio: 9 / 16 },
  { key: "3:4", label: "3:4", ratio: 3 / 4 },
  { key: "4:3", label: "4:3", ratio: 4 / 3 }
];
var VIDEO_QUALITY_TIERS = [
  { key: "720p", shortEdge: 720 },
  { key: "1080p", shortEdge: 1080 }
];
var VIDEO_EXPORT_FPS = 30;
function resolveVideoSize(ratio, quality) {
  const shortEdge = VIDEO_QUALITY_TIERS.find((t) => t.key === quality)?.shortEdge ?? 1080;
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  switch (ratio) {
    case "9:16":
      return { width: even(shortEdge), height: even(shortEdge * 16 / 9) };
    case "3:4":
      return { width: even(shortEdge), height: even(shortEdge * 4 / 3) };
    case "4:3":
      return { width: even(shortEdge * 4 / 3), height: even(shortEdge) };
    case "16:9":
    default:
      return { width: even(shortEdge * 16 / 9), height: even(shortEdge) };
  }
}
function formatSegmentTime(sec) {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoRenderers/layout.ts
function metricsOf(c) {
  const unit = Math.min(c.width, c.height);
  return { unit, vertical: c.height >= c.width, pad: unit * 0.07 };
}
function drawCoverWithShadow(c, x, y, size) {
  if (!c.song.cover) return;
  const { ctx } = c;
  const radius = size * 0.055;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.2;
  ctx.shadowOffsetY = size * 0.06;
  drawCoverRound(ctx, c.song.cover, x, y, size, radius);
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = Math.max(1, size * 6e-3);
  ctx.stroke();
  ctx.restore();
}
function drawTrackMeta(c, centerX, y, align, maxWidth, scale = 1) {
  const { ctx, skin } = c;
  const { unit } = metricsOf(c);
  const titlePx = Math.max(12, Math.round(unit * 0.05 * scale));
  const artistPx = Math.max(10, Math.round(unit * 0.03 * scale));
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.font = `600 ${titlePx}px ${skin.fontFamily}`;
  ctx.fillStyle = skin.textPrimary;
  if (skin.theme !== "light") {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = titlePx * 0.5;
  }
  ctx.fillText(ellipsize(ctx, c.song.title || "\u672A\u77E5\u6B4C\u66F2", maxWidth), centerX, y);
  let cursor = y + titlePx * 1.3;
  ctx.shadowBlur = 0;
  ctx.font = `500 ${artistPx}px ${skin.fontFamily}`;
  ctx.fillStyle = skin.textSecondary;
  ctx.fillText(ellipsize(ctx, c.song.artist || "\u672A\u77E5\u827A\u672F\u5BB6", maxWidth), centerX, cursor);
  cursor += artistPx * 1.6;
  ctx.restore();
  return cursor;
}
function fitFontSize(ctx, text, maxWidth, basePx, family, maxRows) {
  let size = Math.max(14, Math.round(basePx));
  for (let i = 0; i < 6; i++) {
    ctx.font = `600 ${size}px ${family}`;
    const rows = wrapText(ctx, text, maxWidth).length;
    if (rows <= maxRows) break;
    size = Math.max(12, Math.round(size * Math.sqrt(maxRows / rows) * 0.98));
  }
  return size;
}
function drawLyricBlock(c, opt) {
  const { ctx, skin } = c;
  const line = c.lyric.current;
  const currentText = line?.text?.trim() ?? "";
  const prevText = c.lyric.prev?.text?.trim() ?? "";
  const nextText = c.lyric.next?.text?.trim() ?? "";
  const trText = line?.trText?.trim() ?? "";
  const maxRows = opt.maxRows ?? 3;
  ctx.save();
  const fontPx = currentText ? fitFontSize(ctx, currentText, opt.maxWidth, opt.fontPx, skin.fontFamily, maxRows) : Math.max(14, Math.round(opt.fontPx));
  const contextPx = Math.max(12, Math.round(fontPx * 0.54));
  const trPx = Math.max(11, Math.round(fontPx * 0.4));
  const lineHeight = Math.round(fontPx * 1.32);
  const contextLine = Math.round(contextPx * 1.34);
  const gap = Math.round(fontPx * 0.6);
  ctx.font = `600 ${fontPx}px ${skin.fontFamily}`;
  const currentRows = currentText ? wrapText(ctx, currentText, opt.maxWidth) : [];
  ctx.font = `500 ${contextPx}px ${skin.fontFamily}`;
  const prevRows = prevText ? wrapText(ctx, prevText, opt.maxWidth * 0.88) : [];
  const nextRows = nextText ? wrapText(ctx, nextText, opt.maxWidth * 0.88) : [];
  ctx.font = `400 ${trPx}px ${skin.fontFamily}`;
  const trRows = trText ? wrapText(ctx, trText, opt.maxWidth * 0.92) : [];
  ctx.restore();
  const rows = Math.max(1, currentRows.length);
  const prevH = prevRows.length * contextLine;
  const currentH = rows * lineHeight;
  const trH = trRows.length ? trRows.length * Math.round(trPx * 1.4) + Math.round(gap * 0.35) : 0;
  const nextH = nextRows.length ? nextRows.length * contextLine + gap * 0.7 : 0;
  const totalH = prevH + (prevRows.length ? gap * 0.7 : 0) + currentH + trH + nextH;
  const boxX = opt.align === "center" ? opt.anchorX - opt.maxWidth / 2 : opt.align === "right" ? opt.anchorX - opt.maxWidth : opt.anchorX;
  const box = {
    x: boxX,
    y: opt.centerY - totalH / 2,
    width: opt.maxWidth,
    height: totalH
  };
  c.skin.drawLyricBackdrop?.(c, box);
  let y = box.y;
  if (prevRows.length) {
    ctx.save();
    ctx.font = `500 ${contextPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textSecondary;
    ctx.globalAlpha = 0.6;
    ctx.textAlign = opt.align;
    ctx.textBaseline = "top";
    for (const row of prevRows) {
      ctx.fillText(ellipsize(ctx, row, opt.maxWidth * 0.88), opt.anchorX, y);
      y += contextLine;
    }
    ctx.restore();
    y += gap * 0.7;
  }
  ctx.save();
  ctx.textBaseline = "top";
  if (currentText) {
    ctx.font = `600 ${fontPx}px ${skin.fontFamily}`;
    if (skin.theme !== "light") {
      ctx.shadowColor = withAlpha(skin.textActive === "#ffffff" ? "#ffffff" : skin.textActive, 0.25);
      ctx.shadowBlur = fontPx * 0.45;
    }
    const drawn = drawSungLine(
      ctx,
      currentText,
      c.lyric.sungChars,
      opt.anchorX,
      y,
      opt.maxWidth,
      lineHeight,
      opt.align,
      skin.textActive,
      skin.textPrimary
    );
    y += Math.max(rows, drawn) * lineHeight;
  } else {
    const breathe = 0.3 + 0.25 * Math.sin(c.timeSec * 2.4);
    ctx.globalAlpha = breathe;
    ctx.font = `600 ${fontPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textPrimary;
    ctx.textAlign = opt.align;
    ctx.fillText("\u266A", opt.anchorX, y);
    y += lineHeight;
  }
  ctx.restore();
  if (trRows.length) {
    y += Math.round(gap * 0.35);
    ctx.save();
    ctx.font = `400 ${trPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textSecondary;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = opt.align;
    ctx.textBaseline = "top";
    for (const row of trRows) {
      ctx.fillText(ellipsize(ctx, row, opt.maxWidth * 0.92), opt.anchorX, y);
      y += Math.round(trPx * 1.4);
    }
    ctx.restore();
  }
  if (nextRows.length) {
    y += gap * 0.7;
    ctx.save();
    ctx.font = `500 ${contextPx}px ${skin.fontFamily}`;
    ctx.fillStyle = skin.textSecondary;
    ctx.globalAlpha = 0.42;
    ctx.textAlign = opt.align;
    ctx.textBaseline = "top";
    for (const row of nextRows) {
      ctx.fillText(ellipsize(ctx, row, opt.maxWidth * 0.88), opt.anchorX, y);
      y += contextLine;
    }
    ctx.restore();
  }
  return box;
}
function drawBottomBar(c) {
  const m = metricsOf(c);
  const barY = c.height - m.pad * 1.5;
  const track = c.skin.theme === "light" ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.18)";
  drawProgressBar(c, { x: m.pad, y: barY, width: c.width - m.pad * 2, height: 0 }, c.accent, track);
  const { ctx, skin } = c;
  const timePx = Math.max(10, Math.round(m.unit * 0.022));
  ctx.save();
  ctx.font = `500 ${timePx}px ${skin.fontFamily}`;
  ctx.fillStyle = skin.textSecondary;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillText(formatSegmentTime(c.timeSec), m.pad, barY - timePx * 0.6);
  ctx.textAlign = "right";
  ctx.fillText(formatSegmentTime(c.totalSec), c.width - m.pad, barY - timePx * 0.6);
  ctx.restore();
}
function drawStackLayout(c) {
  const m = metricsOf(c);
  const hasCover = c.skin.showCover && !!c.song.cover;
  const bottomReserve = m.pad * 2.4;
  if (m.vertical) {
    if (hasCover) {
      let cursorY = c.height * 0.12;
      const size = Math.min(c.width * 0.46, c.height * 0.23);
      drawCoverWithShadow(c, (c.width - size) / 2, cursorY, size);
      cursorY += size + m.unit * 0.05;
      cursorY = drawTrackMeta(c, c.width / 2, cursorY, "center", c.width - m.pad * 2);
      const lyricsTop = cursorY + m.unit * 0.035;
      const lyricsBottom = c.height - bottomReserve;
      drawLyricBlock(c, {
        anchorX: c.width / 2,
        centerY: (lyricsTop + lyricsBottom) / 2,
        maxWidth: c.width - m.pad * 2,
        fontPx: m.unit * 0.062,
        align: "center"
      });
    } else {
      const box = drawLyricBlock(c, {
        anchorX: c.width / 2,
        centerY: c.height * 0.52,
        maxWidth: c.width - m.pad * 2,
        fontPx: m.unit * 0.062,
        align: "center"
      });
      const metaHeight = m.unit * 0.05 * 1.3 + m.unit * 0.03 * 1.6;
      drawTrackMeta(
        c,
        c.width / 2,
        box.y - metaHeight - m.unit * 0.06,
        "center",
        c.width - m.pad * 2
      );
    }
  } else {
    const coverSize = Math.min(c.height * 0.46, c.width * 0.26);
    const coverX = m.pad * 1.3;
    const coverY = c.height * 0.5 - coverSize * 0.62;
    if (hasCover) {
      drawCoverWithShadow(c, coverX, coverY, coverSize);
      drawTrackMeta(
        c,
        coverX + coverSize / 2,
        coverY + coverSize + m.unit * 0.045,
        "center",
        coverSize * 1.5,
        0.8
      );
    } else {
      drawTrackMeta(c, m.pad, c.height * 0.1, "left", c.width * 0.5, 0.9);
    }
    const lyricsX = hasCover ? coverX + coverSize + m.pad * 1.2 : m.pad;
    const lyricsW = c.width - lyricsX - m.pad;
    drawLyricBlock(c, {
      anchorX: lyricsX + lyricsW / 2,
      centerY: c.height * 0.47,
      maxWidth: lyricsW,
      fontPx: m.unit * 0.058,
      align: "center"
    });
  }
  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}
function drawImmersiveLayout(c) {
  const m = metricsOf(c);
  drawTrackMeta(c, c.width / 2, m.pad * 0.95, "center", c.width - m.pad * 2, 0.7);
  drawLyricBlock(c, {
    anchorX: c.width / 2,
    centerY: c.height * 0.5,
    maxWidth: c.width - m.pad * 2.2,
    fontPx: m.unit * 0.074,
    align: "center"
  });
  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}
function drawPosterLayout(c) {
  const m = metricsOf(c);
  drawTrackMeta(c, m.pad, m.pad * 0.9, "left", c.width - m.pad * 2, 0.66);
  drawLyricBlock(c, {
    anchorX: c.width / 2,
    centerY: c.height * 0.5,
    maxWidth: c.width - m.pad * 2,
    fontPx: m.unit * 0.1,
    align: "center",
    // 大字风格最多两行，超出自动收缩
    maxRows: 2
  });
  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}
function drawTerminalLayout(c) {
  const m = metricsOf(c);
  const { ctx, skin } = c;
  const statusPx = Math.max(11, Math.round(m.unit * 0.026));
  ctx.save();
  ctx.font = `500 ${statusPx}px ${skin.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = withAlpha(skin.accent, 0.85);
  const status = `> now_playing: ${c.song.title || "unknown"} \u2014 ${c.song.artist || "unknown"}`;
  ctx.fillText(ellipsize(ctx, status, c.width - m.pad * 2), m.pad, m.pad * 0.9);
  ctx.restore();
  const lyricsAnchor = m.pad * 1.6;
  const lyricsWidth = c.width - lyricsAnchor - m.pad * 1.6;
  drawLyricBlock(c, {
    anchorX: lyricsAnchor,
    centerY: c.height * 0.48,
    maxWidth: lyricsWidth,
    fontPx: m.unit * 0.056,
    align: "left"
  });
  drawBottomBar(c);
  if (c.watermark) drawWatermark(c);
}
function renderFrameLayout(c) {
  switch (c.skin.layout) {
    case "immersive":
      drawImmersiveLayout(c);
      break;
    case "poster":
      drawPosterLayout(c);
      break;
    case "terminal":
      drawTerminalLayout(c);
      break;
    case "stack":
    default:
      drawStackLayout(c);
      break;
  }
}

// ../../Desktop/zephyrus-player-android/src/renderer/utils/videoLyricTimeline.ts
var LAST_LINE_FALLBACK_SEC = 4;
var MIN_LINE_SEC = 0.8;
function buildTimeline(lyrics) {
  const valid = lyrics.filter(
    (line) => typeof line.startTime === "number" && Number.isFinite(line.startTime)
  );
  return valid.map((line, i) => {
    const startMs = line.startTime;
    const startSec = startMs / 1e3;
    const nextStartMs = i + 1 < valid.length ? valid[i + 1].startTime : null;
    const fallback = nextStartMs !== null ? (nextStartMs - startMs) / 1e3 : LAST_LINE_FALLBACK_SEC;
    const durationSec = typeof line.duration === "number" && line.duration > 0 ? line.duration / 1e3 : Math.max(MIN_LINE_SEC, fallback);
    const words = (line.words ?? []).filter((w) => Number.isFinite(w.startTime)).map((w) => {
      const wordStart = w.startTime / 1e3;
      return {
        text: w.text,
        startSec: wordStart,
        endSec: wordStart + Math.max(0.05, (w.duration || 0) / 1e3)
      };
    });
    return {
      text: line.text ?? "",
      trText: line.trText ?? "",
      startSec,
      endSec: startSec + durationSec,
      words
    };
  });
}
function computeSungChars(line, songTimeSec, lineProgress) {
  if (!line) return 0;
  const total = Array.from(line.text).length;
  if (!line.words.length) return lineProgress * total;
  let sung = 0;
  for (const word of line.words) {
    const wordChars = Array.from(word.text).length;
    if (songTimeSec >= word.endSec) {
      sung += wordChars;
    } else if (songTimeSec > word.startSec) {
      const span = Math.max(1e-3, word.endSec - word.startSec);
      sung += wordChars * ((songTimeSec - word.startSec) / span);
      break;
    } else {
      break;
    }
  }
  return Math.min(total, sung);
}
function resolveLyricState(timeline, songTimeSec) {
  let index = -1;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].startSec <= songTimeSec) index = i;
    else break;
  }
  const current = index >= 0 ? timeline[index] : null;
  const prev = index - 1 >= 0 ? timeline[index - 1] : null;
  const next = index + 1 < timeline.length ? timeline[index + 1] : null;
  const span = current ? Math.max(0.05, current.endSec - current.startSec) : 1;
  const lineProgress = current ? Math.min(1, Math.max(0, (songTimeSec - current.startSec) / span)) : 0;
  return {
    index,
    current,
    prev,
    next,
    lineProgress,
    sungChars: computeSungChars(current, songTimeSec, lineProgress)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VIDEO_EXPORT_FPS,
  buildTimeline,
  computeSungChars,
  formatSegmentTime,
  getAllSkins,
  getSkin,
  renderFrameLayout,
  resolveAccent,
  resolveLyricState,
  resolveVideoSize
});
