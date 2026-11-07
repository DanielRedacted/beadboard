// Photo -> per-cell color samples. The photo transform t = { x, y, scale } is in grid units
// (top-left corner of the image, grid units per image pixel).
import { averageBox } from './core.js';
import { geom } from './render.js';

const MAX_PX = 1024; // plenty for a 128-cell board, keeps design files small

export const imageFromUrl = url => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('Could not read that image'));
  img.src = url;
});

const readAsDataUrl = file => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(file);
});

// Loads a picked file, downscaled. PNGs stay PNG to keep transparency.
export async function loadImageFile(file) {
  let src;
  try { src = await imageFromUrl(await readAsDataUrl(file)); } catch (e) {
    // Windows' webview can't decode iPhone HEIC photos (macOS can).
    if (/\.hei[cf]$/i.test(file.name || '')) throw new Error('This is an iPhone HEIC photo. Export it as JPEG (in Photos: File > Export) and import that instead.');
    throw e;
  }
  const k = Math.min(1, MAX_PX / Math.max(src.width, src.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(src.width * k);
  cv.height = Math.round(src.height * k);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  const dataUrl = file.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
  return { img: await imageFromUrl(dataUrl), dataUrl };
}

// Draw the placed photo in grid units (k = pixels per grid unit). t.flip mirrors it left-right.
export function drawPhoto(ctx, img, t, k = 1) {
  const w = img.width * t.scale * k, h = img.height * t.scale * k;
  if (!t.flip) return ctx.drawImage(img, t.x * k, t.y * k, w, h);
  ctx.save();
  ctx.translate(t.x * k + w, t.y * k);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

// Initial placement: photo covers the whole board, centred.
export function coverFit(img, g) {
  const scale = Math.max(g.w / img.width, g.h / img.height);
  return { scale, x: (g.w - img.width * scale) / 2, y: (g.h - img.height * scale) / 2 };
}

// Rasterise the placed photo at K px per cell, then average the box under each cell.
const K = 6;
export function sampleGrid(d, img, t) {
  const g = geom(d), cv = document.createElement('canvas');
  cv.width = Math.ceil(g.w * K);
  cv.height = Math.ceil(g.h * K);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  drawPhoto(ctx, img, t, K);
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  return d.cells.map((row, r) => row.map((s, c) => s && averageBox(data, cv.width, cv.height, (g.x(r, c) + 0.5) * K, (g.y(r) + 0.5) * K, K / 2)));
}
