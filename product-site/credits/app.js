/**
 * 致谢站引擎：Drift Wall（结构改编自 vue-bits DriftWall，MIT）
 * + 卡片本体 FLIP 3D 过渡（克隆真实卡片飞行，替代色块）+ 详情层。
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 720px)').matches;

const items = window.CREDITS || [];
const COLS = isMobile ? 2 : 4;
const COPIES = 4;

const viewport = document.getElementById('wall-viewport');
const plane = document.getElementById('wall-plane');
const detail = document.getElementById('detail');
const detailPanel = document.getElementById('detail-panel');

/* ── 构建卡片墙（每列 COPIES 份无缝循环） ─────────────────── */
const columns = [];
for (let c = 0; c < COLS; c += 1) {
  const track = document.createElement('div');
  track.className = 'dw-col';
  plane.appendChild(track);
  columns.push({ el: track, offset: Math.random() * 900, dir: c % 2 === 0 ? 1 : -1, speed: 0.6 + ((c * 0.618) % 1) * 0.5, wrap: 1 });
}

items.forEach((item, i) => {
  const col = columns[i % COLS];
  for (let k = 0; k < COPIES; k += 1) {
    const tile = tileEl(item);
    if (k > 0) {
      tile.setAttribute('aria-hidden', 'true');
      tile.tabIndex = -1;
    }
    col.el.appendChild(tile);
  }
});

function tileEl(item) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.dataset.id = item.id;
  tile.style.background = `linear-gradient(160deg, ${item.color}, ${shade(item.color, -0.28)})`;
  tile.setAttribute('role', 'button');
  tile.tabIndex = 0;

  const logo = document.createElement('span');
  logo.className = 'tile-logo';
  if (item.logo) {
    const img = document.createElement('img');
    img.src = item.logo;
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      img.remove();
      logo.textContent = (item.name[0] || '•').toUpperCase();
    });
    logo.appendChild(img);
  } else {
    logo.textContent = (item.name[0] || '•').toUpperCase();
  }

  const text = document.createElement('div');
  text.className = 'tile-text';
  const name = document.createElement('b');
  name.textContent = item.name;
  const tag = document.createElement('small');
  tag.textContent = item.tagline;
  text.append(name, tag);

  const lic = document.createElement('span');
  lic.className = 'tile-lic';
  lic.textContent = item.licenseType.toUpperCase();

  tile.append(logo, text, lic);
  tile.addEventListener('click', () => openDetail(item, tile));
  tile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openDetail(item, tile);
  });
  return tile;
}

function shade(hex, amount) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.replace(/./g, '$&$&') : n, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + Math.round(255 * amount)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + Math.round(255 * amount)));
  const b = Math.max(0, Math.min(255, (num & 255) + Math.round(255 * amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

/* ── 漂移引擎（rAF，逐列无限循环） ─────────────────────────── */
let paused = false;

function measure() {
  for (const col of columns) {
    const copy = col.el.scrollHeight / COPIES;
    col.wrap = Math.max(1, copy);
    if (col.offset >= col.wrap) col.offset %= col.wrap;
  }
}
measure();

let px = 0;
let py = 0;
let targetPx = 0;
let targetPy = 0;
let last = performance.now();

function applyTilt(dt) {
  px += (targetPx - px) * (1 - Math.exp(-dt / 0.12));
  py += (targetPy - py) * (1 - Math.exp(-dt / 0.12));
  plane.style.transform =
    `translate(-50%, -50%) scale(1.18) rotateX(${(16 + py * 8).toFixed(2)}deg) ` +
    `rotateY(${(-14 + px * 8).toFixed(2)}deg) translateZ(-120px)`;
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  applyTilt(dt);
  if (!paused && !document.hidden) {
    for (const col of columns) {
      col.offset = (col.offset + col.dir * col.speed * 42 * dt) % col.wrap;
      if (col.offset < 0) col.offset += col.wrap;
      col.el.style.transform = `translate3d(0, ${(-col.offset).toFixed(2)}px, 0)`;
    }
  }
  requestAnimationFrame(loop);
}

if (!reduced) {
  viewport.addEventListener('pointermove', (e) => {
    targetPx = (e.clientX / innerWidth) * 2 - 1;
    targetPy = -((e.clientY / innerHeight) * 2 - 1);
  });
  requestAnimationFrame(loop);
}

window.addEventListener('resize', measure);
document.fonts?.ready?.then(() => measure());

/* ── 悬浮标题：滚动视差 + 淡出 ─────────────────────────────── */
const heroFloat = document.querySelector('.hero-float');
if (!reduced && heroFloat) {
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      heroFloat.style.opacity = Math.max(0, 1 - y / 420).toFixed(3);
      heroFloat.style.transform = `translateX(-50%) translateY(${(-y * 0.16).toFixed(1)}px)`;
    },
    { passive: true }
  );
}

/* ── 详情层内容 ─────────────────────────────── */
function fillDetail(item) {
  const logo = document.getElementById('d-logo');
  logo.textContent = (item.name[0] || '•').toUpperCase();
  logo.querySelectorAll('img').forEach((img) => img.remove());
  if (item.logo) {
    const img = document.createElement('img');
    img.src = item.logo;
    img.alt = '';
    img.addEventListener('error', () => img.remove(), { once: true });
    logo.appendChild(img);
  }

  document.getElementById('d-name').textContent = item.name;
  document.getElementById('d-author').textContent = item.author;
  const lic = document.getElementById('d-license');
  lic.textContent = item.license;
  lic.style.display = item.licenseType === 'self' ? 'none' : '';
  document.getElementById('d-tagline').textContent = item.tagline;
  document.getElementById('d-desc').textContent = item.desc;
  const link = document.getElementById('d-link');
  if (item.url) {
    link.href = item.url;
    link.style.display = '';
  } else {
    link.style.display = 'none';
  }
}

/* ── 详情面板：同一对象 FLIP 3D 过渡（面板即飞行体） ─────── */
const FLY_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const CONTENT_SEL = '.detail-close, .detail-head, .detail-tagline, .detail-desc, .detail-link';
let currentItem = null;
let currentCard = null;
let transitioning = false;

function cardAlign(panelRect, cardRect) {
  const s = cardRect.width / panelRect.width;
  return {
    s,
    dx: cardRect.left + cardRect.width / 2 - (panelRect.left + panelRect.width / 2),
    dy: cardRect.top + cardRect.height / 2 - (panelRect.top + panelRect.height / 2)
  };
}

function openDetail(item, tile) {
  if (currentItem || transitioning) return;
  currentItem = item;
  currentCard = tile;
  transitioning = true;
  paused = true;
  viewport.classList.add('is-dimmed');
  document.body.style.overflow = 'hidden';

  fillDetail(item);
  // 面板背景 = 卡片同款渐变：飞行全程背景连续，落定无换体
  detailPanel.style.background = tile.style.background;

  if (reduced) {
    detail.hidden = false;
    detail.classList.add('is-open');
    transitioning = false;
    return;
  }

  detailPanel.classList.add('no-content');
  detail.hidden = false;
  detail.classList.add('clear');
  detail.classList.remove('is-open');
  const cardRect = tile.getBoundingClientRect();
  const panelRect = detailPanel.getBoundingClientRect();
  const { s, dx, dy } = cardAlign(panelRect, cardRect);

  const anim = detailPanel.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotateX(14deg) rotateY(-12deg)`, opacity: 0 },
      {
        transform: `translate(${dx * 0.42}px, ${dy * 0.42 - 44}px) scale(${s + (1 - s) * 0.42}) rotateX(5deg) rotateY(-4deg)`,
        opacity: 1,
        offset: 0.32
      },
      { transform: 'translate(0px, 0px) scale(1) rotateX(0deg) rotateY(0deg)', opacity: 1 }
    ],
    { duration: 700, easing: FLY_EASE, fill: 'both' }
  );
  setTimeout(() => detailPanel.classList.remove('no-content'), 260);
  anim.onfinish = () => {
    detail.classList.remove('clear');
    detail.classList.add('is-open');
    transitioning = false;
  };
}

function closeDetail() {
  if (!currentItem || transitioning) return;
  const card = currentCard;
  currentItem = null;
  currentCard = null;
  transitioning = true;
  document.body.style.overflow = '';

  const finish = () => {
    detail.hidden = true;
    detail.classList.remove('clear');
    detailPanel.getAnimations().forEach((a) => a.cancel());
    detailPanel.classList.remove('is-closing');
    viewport.classList.remove('is-dimmed');
    paused = false;
    transitioning = false;
  };

  if (reduced || !card) {
    detail.classList.remove('is-open');
    setTimeout(finish, 240);
    return;
  }

  detail.classList.remove('is-open');
  detail.classList.add('clear');
  detailPanel.classList.add('is-closing');
  const cardRect = card.getBoundingClientRect();
  const panelRect = detailPanel.getBoundingClientRect();
  const { s, dx, dy } = cardAlign(panelRect, cardRect);

  const anim = detailPanel.animate(
    [
      { transform: 'translate(0px, 0px) scale(1) rotateX(0deg) rotateY(0deg)', opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 + 42}px) scale(${s + (1 - s) * 0.5}) rotateX(7deg) rotateY(-6deg)`,
        opacity: 1,
        offset: 0.58
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotateX(14deg) rotateY(-12deg)`, opacity: 0 }
    ],
    { duration: 640, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' }
  );
  anim.onfinish = finish;
  anim.oncancel = finish;
}

document.getElementById('detail-close').addEventListener('click', closeDetail);
detail.addEventListener('click', (e) => {
  if (e.target === detail) closeDetail();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentItem) closeDetail();
});
