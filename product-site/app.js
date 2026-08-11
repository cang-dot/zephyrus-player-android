const header = document.querySelector('[data-header]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const syncHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
};

syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

const revealTargets = document.querySelectorAll('.reveal');

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealTargets.forEach((target) => target.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14 }
  );

  revealTargets.forEach((target) => observer.observe(target));
}

document.querySelectorAll('.specular').forEach((element) => {
  element.addEventListener('pointermove', (event) => {
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--specular-x', `${event.clientX - rect.left}px`);
    element.style.setProperty('--specular-y', `${event.clientY - rect.top}px`);
  });
});

const velocityTrack = document.querySelector('[data-velocity-track]');

if (velocityTrack && !reducedMotion) {
  let previousScroll = window.scrollY;
  let offset = -8;
  let velocity = 0;
  let animationFrame = 0;

  const updateTrack = () => {
    velocity *= 0.9;
    offset -= 0.42 + Math.abs(velocity) * 0.08;
    const loopWidth = velocityTrack.scrollWidth / 2;
    if (loopWidth > 0 && Math.abs(offset) >= loopWidth) offset += loopWidth;
    velocityTrack.style.setProperty('--ticker-x', `${offset}px`);

    if (Math.abs(velocity) > 0.05 || document.visibilityState === 'visible') {
      animationFrame = window.requestAnimationFrame(updateTrack);
    }
  };

  window.addEventListener(
    'scroll',
    () => {
      const currentScroll = window.scrollY;
      velocity += Math.max(-30, Math.min(30, currentScroll - previousScroll));
      previousScroll = currentScroll;
    },
    { passive: true }
  );

  animationFrame = window.requestAnimationFrame(updateTrack);
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationFrame), {
    once: true
  });
}

const canvas = document.querySelector('[data-thread-field]');

if (canvas instanceof HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: true });
  const pointer = { x: 0.68, y: 0.34, active: false };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;
  let startTime = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const draw = (time) => {
    if (!context) return;
    const elapsed = (time - startTime) * 0.00022;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#090b09';
    context.fillRect(0, 0, width, height);

    const targetX = pointer.active ? pointer.x * width : width * 0.7;
    const targetY = pointer.active ? pointer.y * height : height * 0.36;
    const lineCount = width < 720 ? 18 : 28;

    for (let index = 0; index < lineCount; index += 1) {
      const progress = index / Math.max(1, lineCount - 1);
      const baseY = height * (0.08 + progress * 0.84);
      const phase = elapsed * (0.7 + progress * 0.5) + index * 0.38;
      const attraction = (targetY - baseY) * 0.12;
      const amplitude = 20 + progress * 26;

      context.beginPath();
      context.moveTo(-40, baseY + Math.sin(phase) * amplitude * 0.25);
      context.bezierCurveTo(
        width * 0.28,
        baseY + Math.sin(phase + 1.1) * amplitude,
        targetX - width * 0.12,
        baseY + attraction + Math.cos(phase) * amplitude,
        targetX,
        targetY + (progress - 0.5) * height * 0.32
      );
      context.bezierCurveTo(
        targetX + width * 0.14,
        targetY + (progress - 0.5) * height * 0.42,
        width * 0.82,
        baseY + Math.sin(phase + 2.2) * amplitude,
        width + 40,
        baseY + Math.cos(phase) * amplitude * 0.3
      );

      if (index % 7 === 0) context.strokeStyle = 'rgba(255, 120, 92, 0.34)';
      else if (index % 5 === 0) context.strokeStyle = 'rgba(126, 219, 206, 0.28)';
      else context.strokeStyle = `rgba(185, 247, 139, ${0.05 + progress * 0.1})`;
      context.lineWidth = index % 7 === 0 ? 1.4 : 0.8;
      context.stroke();
    }

    if (!reducedMotion) frame = window.requestAnimationFrame(draw);
  };

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width;
    pointer.y = (event.clientY - rect.top) / rect.height;
    pointer.active = true;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.active = false;
  });

  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  draw(startTime);
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(frame), { once: true });
}
