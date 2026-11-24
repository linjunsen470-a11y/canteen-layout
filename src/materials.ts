import * as T from 'three';
import { FloorMaterial, WallMaterial } from './model';

const cache = new Map<string, T.CanvasTexture>();

function createCanvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function cached(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeatX = 1, repeatY = 1) {
  const existing = cache.get(key);
  if (existing) return existing;
  const texture = createCanvasTexture(width, height, draw, repeatX, repeatY);
  cache.set(key, texture);
  return texture;
}

// Deterministic pseudo-random helper so procedural textures look natural and consistent across frames.
function rand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function woodGrainTexture() {
  return cached('wood-grain', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe2cc';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = Math.sin(y * 1.43) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(92, 58, 24, ${0.04 + v * 0.11})`;
      ctx.lineWidth = 0.6 + v * 0.9;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const py = y + Math.sin(x / 88 + y * 0.06) * 2.2 + Math.sin(x / 29 + y * 0.3) * 0.6;
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
    }
  });
}

export function brushedSteelTexture() {
  return cached('brushed-steel', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cfd7db';
    ctx.fillRect(0, 0, w, h);
    const r = rand(41);
    for (let y = 0; y < h; y++) {
      const alpha = 0.03 + r() * 0.07;
      ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(80,95,105,${alpha})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
}

export function marbleTexture() {
  return cached('marble', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f3f0ea';
    ctx.fillRect(0, 0, w, h);
    const r = rand(17);
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(155, 148, 138, ${0.07 + r() * 0.14})`;
      ctx.lineWidth = 0.8 + r() * 2.4;
      ctx.beginPath();
      let x = r() * w;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < h) {
        y += 18 + r() * 24;
        x += (r() - 0.42) * 44;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

export function fabricTexture() {
  return cached('fabric', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ebe6dd';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.045)';
      ctx.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(x, 0, 2, h);
    }
  }, 3, 3);
}

export function floorMaterialTexture(material: FloorMaterial, showGrid: boolean, gridSize: number): { map: T.CanvasTexture; roughness: number; tint: string } {
  const key = `floor:${material}:${showGrid}:${gridSize}`;
  if (material === 'oak-wood') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      const r = rand(101);
      const rows = 8;
      const rh = h / rows;
      const tones = ['#c9a476', '#c19969', '#d0ad80', '#ba9060', '#c7a072'];
      for (let row = 0; row < rows; row++) {
        const y = row * rh;
        const offset = (row % 3) * (w / 3) + (row % 2) * 40;
        const splits = [0, (offset % w), ((offset + w * 0.5) % w), w].sort((a, b) => a - b);
        for (let i = 0; i < splits.length - 1; i++) {
          const x0 = splits[i];
          const pw = splits[i + 1] - x0;
          if (pw < 2) continue;
          ctx.fillStyle = tones[Math.floor(r() * tones.length)];
          ctx.fillRect(x0, y, pw, rh);
          for (let g = 0; g < 16; g++) {
            const gy = y + (g / 16) * rh;
            ctx.strokeStyle = `rgba(92,56,22,${0.05 + r() * 0.08})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0, gy);
            ctx.bezierCurveTo(x0 + pw * 0.33, gy + (r() - 0.5) * 4, x0 + pw * 0.66, gy + (r() - 0.5) * 4, x0 + pw, gy);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(72,46,22,0.28)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x0, y, pw, rh);
        }
      }
      if (showGrid) drawOverlayGrid(ctx, w, h, gridSize, 'rgba(75,55,35,0.24)');
    }, 0.5, 0.5);
    return { map, roughness: 0.54, tint: '#ffffff' };
  }
  if (material === 'terrazzo') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#e7e3da';
      ctx.fillRect(0, 0, w, h);
      const r = rand(202);
      const chips = ['#c5bba8', '#989083', '#d5c1a1', '#6e726b', '#b88c66', '#f4f0e8'];
      for (let i = 0; i < 650; i++) {
        ctx.fillStyle = chips[Math.floor(r() * chips.length)];
        const cx = r() * w;
        const cy = r() * h;
        const rx = 2 + r() * 7;
        const ry = 2 + r() * 5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(r() * Math.PI);
        ctx.beginPath();
        ctx.moveTo(-rx, -ry * 0.5);
        ctx.lineTo(rx * 0.7, -ry);
        ctx.lineTo(rx, ry * 0.6);
        ctx.lineTo(-rx * 0.6, ry);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(130, 124, 114, 0.28)';
      ctx.lineWidth = 2;
      for (let n = 0; n <= 2; n++) {
        const p = (n * w) / 2;
        ctx.beginPath();
        ctx.moveTo(p, 0); ctx.lineTo(p, h);
        ctx.moveTo(0, p); ctx.lineTo(w, p);
        ctx.stroke();
      }
      if (showGrid) drawOverlayGrid(ctx, w, h, gridSize, 'rgba(95,112,100,0.25)');
    }, 0.5, 0.5);
    return { map, roughness: 0.48, tint: '#ffffff' };
  }
  if (material === 'warm-tile') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      const r = rand(303);
      const cells = 3;
      const step = w / cells;
      const palette = ['#ddd6c9', '#d7cfc1', '#e0d9cd', '#d3cbbd'];
      for (let gx = 0; gx < cells; gx++) {
        for (let gy = 0; gy < cells; gy++) {
          ctx.fillStyle = palette[Math.floor(r() * palette.length)];
          ctx.fillRect(gx * step, gy * step, step, step);
          for (let k = 0; k < 28; k++) {
            ctx.fillStyle = `rgba(120,108,90,${0.02 + r() * 0.035})`;
            ctx.beginPath();
            ctx.arc(gx * step + r() * step, gy * step + r() * step, 6 + r() * 20, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(132,122,108,0.42)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(gx * step, gy * step, step, step);
        }
      }
      if (showGrid) drawOverlayGrid(ctx, w, h, gridSize, 'rgba(92,106,96,0.25)');
    }, 0.5, 0.5);
    return { map, roughness: 0.42, tint: '#ffffff' };
  }
  if (material === 'concrete') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c8c6c1';
      ctx.fillRect(0, 0, w, h);
      const r = rand(404);
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.02 + r() * 0.05})` : `rgba(70,72,74,${0.02 + r() * 0.05})`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 14 + r() * 48, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(85,87,89,0.2)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, w, h);
      if (showGrid) drawOverlayGrid(ctx, w, h, gridSize, 'rgba(70,88,78,0.28)');
    }, 0.5, 0.5);
    return { map, roughness: 0.62, tint: '#ffffff' };
  }
  // checker (classic low-contrast planning floor)
  const map = cached(key, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e7e8e0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#dbe0d6';
    ctx.fillRect(w / 2, 0, w / 2, h / 2);
    ctx.fillRect(0, h / 2, w / 2, h / 2);
    if (showGrid) drawOverlayGrid(ctx, w, h, gridSize, '#9fb0a1');
  }, 0.5, 0.5);
  return { map, roughness: 0.88, tint: '#ffffff' };
}

function drawOverlayGrid(ctx: CanvasRenderingContext2D, w: number, h: number, gridSize: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const step = Math.max(16, (gridSize / 2000) * w);
  for (let v = 0; v <= w + 0.5; v += step) {
    ctx.beginPath();
    ctx.moveTo(v, 0); ctx.lineTo(v, h);
    ctx.moveTo(0, v); ctx.lineTo(w, v);
    ctx.stroke();
  }
}

export function wallMaterialTexture(material: WallMaterial): { map: T.CanvasTexture; roughness: number; tint: string } {
  const key = `wall:${material}`;
  if (material === 'wood-panel') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c8a173';
      ctx.fillRect(0, 0, w, h);
      const slats = 16;
      const sw = w / slats;
      const r = rand(505);
      for (let i = 0; i < slats; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,244,225,0.08)' : 'rgba(90,56,22,0.08)';
        ctx.fillRect(i * sw, 0, sw - 4, h);
        ctx.fillStyle = 'rgba(55,34,15,0.42)';
        ctx.fillRect((i + 1) * sw - 4, 0, 4, h);
        for (let k = 0; k < 6; k++) {
          ctx.strokeStyle = `rgba(92,58,24,${0.05 + r() * 0.06})`;
          ctx.beginPath();
          ctx.moveTo(i * sw + r() * (sw - 5), 0);
          ctx.lineTo(i * sw + r() * (sw - 5), h);
          ctx.stroke();
        }
      }
    }, 1, 1);
    return { map, roughness: 0.58, tint: '#ffffff' };
  }
  if (material === 'brick-white') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#edece7';
      ctx.fillRect(0, 0, w, h);
      const rows = 12;
      const cols = 4;
      const rh = h / rows;
      const cw = w / cols;
      const r = rand(606);
      for (let row = 0; row < rows; row++) {
        const shift = (row % 2) * (cw / 2);
        for (let col = -1; col <= cols; col++) {
          const x = col * cw + shift;
          const y = row * rh;
          const shade = 238 + Math.floor(r() * 14);
          ctx.fillStyle = `rgb(${shade},${shade - 1},${shade - 4})`;
          ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);
        }
      }
    }, 1, 1);
    return { map, roughness: 0.78, tint: '#ffffff' };
  }
  if (material === 'concrete') {
    const map = cached(key, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#d1d0cc';
      ctx.fillRect(0, 0, w, h);
      const r = rand(707);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(65,68,70,0.05)';
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 16 + r() * 44, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(95,95,95,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
    }, 1, 1);
    return { map, roughness: 0.76, tint: '#ffffff' };
  }
  if (material === 'plaster') {
    const map = cached(key, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f2f1ed';
      ctx.fillRect(0, 0, w, h);
      const r = rand(808);
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(140,136,128,0.035)';
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 8 + r() * 24, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1, 1);
    return { map, roughness: 0.86, tint: '#ffffff' };
  }
  // warm-cream
  const map = cached(key, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4eee4';
    ctx.fillRect(0, 0, w, h);
    const r = rand(909);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,252,245,0.07)' : 'rgba(176,158,132,0.045)';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 10 + r() * 28, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 1, 1);
  return { map, roughness: 0.84, tint: '#ffffff' };
}

export function menuBoardTexture() {
  return cached('menu-board-graphic', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1e2426';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9a45b';
    ctx.fillRect(16, 16, w - 32, 34);
    ctx.fillStyle = '#1d2224';
    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.fillText('招牌推荐 · SIGNATURE MENU', 30, 40);
    const cols = [
      { title: '主食精选', items: [['招牌牛肉面', '¥28'], ['鲜虾云吞面', '¥26'], ['卤肉套餐饭', '¥32'], ['酸汤肥牛饭', '¥34']] },
      { title: '现制饮品', items: [['美式 / 拿铁', '¥18'], ['冷萃桂花乌龙', '¥16'], ['鲜榨杨梅汁', '¥18'], ['手打柠檬茶', '¥15']] },
      { title: '人气小食', items: [['酥脆椒盐鸡排', '¥18'], ['黑松露薯条', '¥16'], ['时令蔬菜沙拉', '¥19'], ['现烤蛋挞(2只)', '¥12']] },
    ];
    cols.forEach((col, ci) => {
      const x = 22 + ci * 162;
      ctx.fillStyle = '#e7be7c';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText(col.title, x, 78);
      ctx.fillStyle = 'rgba(231,190,124,0.35)';
      ctx.fillRect(x, 86, 144, 1.5);
      col.items.forEach(([name, price], ri) => {
        const y = 114 + ri * 32;
        ctx.fillStyle = '#f2ede4';
        ctx.font = '13px "Microsoft YaHei", sans-serif';
        ctx.fillText(name, x, y);
        ctx.fillStyle = '#eab76a';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(price, x + 106, y);
      });
    });
  });
}

export function shopSignTexture(title = 'BISTRO · 品牌餐饮空间') {
  return createCanvasTexture(512, 160, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1e382f');
    grad.addColorStop(1, '#2a4a3f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d7ad6a';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#f8ecd4';
    ctx.font = 'bold 42px "Microsoft YaHei", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title.slice(0, 12), w / 2, h * 0.44);
    ctx.fillStyle = '#d7ad6a';
    ctx.font = '600 16px sans-serif';
    ctx.fillText('FRESH KITCHEN · CAFE & DINING', w / 2, h * 0.76);
  });
}

export function wallArtTexture() {
  return cached('wall-art-graphic', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f6f1e7';
    ctx.fillRect(0, 0, w, h);
    // Warm modern mid-century botanical/geometric diptych
    const panels = [
      { x: 18, y: 18, pw: 226, ph: 220 },
      { x: 268, y: 18, pw: 226, ph: 220 },
    ];
    panels.forEach((p, idx) => {
      ctx.fillStyle = idx === 0 ? '#efe4d4' : '#e5ebe4';
      ctx.fillRect(p.x, p.y, p.pw, p.ph);
      if (idx === 0) {
        ctx.fillStyle = '#c4724e';
        ctx.beginPath();
        ctx.arc(p.x + 115, p.y + 92, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2d4d3e';
        ctx.beginPath();
        ctx.arc(p.x + 115, p.y + 188, 72, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = '#3b5d4c';
        ctx.beginPath();
        ctx.ellipse(p.x + 113, p.y + 112, 46, 78, -0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d7ab66';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x + 113, p.y + 42);
        ctx.lineTo(p.x + 113, p.y + 190);
        ctx.stroke();
      }
    });
  });
}

export function tvScreenTexture() {
  return cached('tv-screen-graphic', 512, 288, (ctx, w, h) => {
    ctx.fillStyle = '#182126';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#295745';
    ctx.fillRect(0, 0, w, 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('取餐叫号屏 · NOW SERVING', 24, 35);
    ctx.fillStyle = '#243137';
    ctx.fillRect(20, 74, 224, 192);
    ctx.fillRect(268, 74, 224, 192);
    ctx.fillStyle = '#97b5a8';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.fillText('请取餐 / READY', 38, 104);
    ctx.fillText('制作中 / PREPARING', 286, 104);
    ctx.fillStyle = '#f2c16b';
    ctx.font = 'bold 42px monospace';
    ctx.fillText('A018', 46, 166);
    ctx.fillText('A019', 46, 226);
    ctx.fillStyle = '#d4e2dd';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('A020  A021', 288, 164);
    ctx.fillText('A022  A023', 288, 222);
  });
}
