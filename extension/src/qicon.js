/* Custom quick-link icons: on-device validation, rasterisation and compact encoding.
   Nothing here touches the network; SVGs are only ever drawn as images. */

export const ICON_ACCEPT = ".png,.jpg,.jpeg,.webp,.ico,.svg,image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,image/svg+xml";
export const ICON_KEY_PREFIX = "qi:";
export const ICON_ITEM_MAX = 5120;          // bytes per sync item (key + JSON value), well under the 8,192 quota
const MAX_FILE = 10 * 1024 * 1024;
const MAX_SIDE = 8192;
const MAX_PIXELS = 16777216;
const SIZES = [96, 80, 64, 56, 48];
const QUALITIES = [0.92, 0.85, 0.75, 0.62, 0.5, 0.4];
const DATA_URL = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

export class IconError extends Error {}

const enc = new TextEncoder();
export const iconKey = (id) => ICON_KEY_PREFIX + id;
export function itemBytes(key, value) { return enc.encode(key).length + enc.encode(JSON.stringify(value)).length; }

/** Sniff the real format from the file's bytes rather than trusting its name or MIME type. */
export function sniff(bytes) {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b.length >= 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0 && (b[4] | b[5])) return "ico";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(0, 2048)).replace(/^\uFEFF/, "");
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(head)) return "svg";
  return null;
}

/** Returns a reason string if the SVG contains active or external content, else "". */
export function svgProblem(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) return "That SVG file couldn't be read.";
  if (/<script[\s>]/i.test(text) || doc.getElementsByTagName("script").length) return "SVGs containing scripts aren't supported.";
  if (doc.getElementsByTagName("foreignObject").length) return "SVGs containing embedded HTML aren't supported.";
  if (/<animate|<set[\s>]/i.test(text)) return "Animated SVGs aren't supported. Use a static image.";
  for (const node of doc.getElementsByTagName("*")) {
    for (const a of node.attributes) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on")) return "SVGs containing scripts aren't supported.";
      if ((n === "href" || n === "xlink:href" || n === "src") && !/^\s*(#|data:image\/)/i.test(a.value)) return "SVGs that load external files aren't supported.";
    }
  }
  if (/url\(\s*['"]?\s*(?!#|data:image\/)/i.test(text) || /@import/i.test(text)) return "SVGs that load external files aren't supported.";
  return "";
}

/** Give the SVG explicit pixel dimensions (2× the largest icon) so it rasterises predictably. */
function sizedSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  const num = (v) => { const m = /^\s*([\d.]+)\s*(px)?\s*$/.exec(v || ""); return m ? parseFloat(m[1]) : 0; };
  let w = num(root.getAttribute("width")), h = num(root.getAttribute("height"));
  const vb = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb[2] > 0 && vb[3] > 0;
  if (hasVb) {
    if (!w && !h) { w = vb[2]; h = vb[3]; }
    else if (!w) w = h * vb[2] / vb[3];
    else if (!h) h = w * vb[3] / vb[2];
  }
  if (!(w > 0 && h > 0)) { w = 1; h = 1; }
  if (!hasVb && num(root.getAttribute("width")) && num(root.getAttribute("height"))) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const out = fit(w, h, SIZES[0] * 2);
  root.setAttribute("width", String(out.w));
  root.setAttribute("height", String(out.h));
  return new XMLSerializer().serializeToString(doc);
}

function loadImage(src) {
  const url = src instanceof Blob ? URL.createObjectURL(src) : src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new IconError("That image couldn't be read. It may be damaged or in an unsupported format."));
    img.src = url;
  }).finally(() => { if (url !== src) URL.revokeObjectURL(url); });
}

function fit(w, h, long) {
  const s = long / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Draw with progressive halving so large downscales stay sharp. */
function draw(img, srcW, srcH, w, h) {
  let src = img, sw = srcW, sh = srcH;
  while (sw / 2 >= w * 1.5 && sh / 2 >= h * 1.5) {
    const c = new OffscreenCanvas(Math.round(sw / 2), Math.round(sh / 2));
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return canvas;
}

/**
 * Encode at the largest size (96 → 48 px long side) whose sync item fits ICON_ITEM_MAX.
 * Prefers lossless PNG, then WebP (keeps transparency) at decreasing quality.
 */
export function encodeToFit(img, srcW, srcH, keyLen = 12) {
  for (const long of SIZES) {
    const { w, h } = fit(srcW, srcH, long);
    const canvas = draw(img, srcW, srcH, w, h);
    const fits = (d) => itemBytes("x".repeat(keyLen), { r: "xxxxxxx", d }) <= ICON_ITEM_MAX;
    const png = canvas.toDataURL("image/png");
    if (fits(png)) return { data: png, w, h };
    for (const q of QUALITIES) {
      const webp = canvas.toDataURL("image/webp", q);
      if (webp.startsWith("data:image/webp") && fits(webp)) return { data: webp, w, h };
    }
  }
  throw new IconError("That image has too much detail to store as an icon, even at 48 pixels. Try a simpler image or logo.");
}

/** Validate and convert a user-chosen file into a compact data URL icon. */
export async function processIconFile(file) {
  if (!file) throw new IconError("No file selected.");
  if (file.size > MAX_FILE) throw new IconError("That file is larger than 10 MB. Choose a smaller image.");
  if (!file.size) throw new IconError("That file is empty.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new IconError("Choose a PNG, JPEG, WebP, ICO or SVG image.");
  let blob;
  if (kind === "svg") {
    const text = new TextDecoder().decode(bytes);
    const problem = svgProblem(text);
    if (problem) throw new IconError(problem);
    blob = new Blob([sizedSvg(text)], { type: "image/svg+xml" });
  } else {
    blob = new Blob([bytes], { type: kind === "ico" ? "image/x-icon" : `image/${kind}` });
  }
  const img = await loadImage(blob);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new IconError("That image couldn't be read.");
  if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) throw new IconError("That image is too large (over 8,192 pixels on a side or 16.7 megapixels). Choose a smaller image.");
  return encodeToFit(img, w, h);
}

/** Structural check for stored or imported icon data. */
export function validIconData(d) {
  return typeof d === "string" && d.length < ICON_ITEM_MAX && DATA_URL.test(d);
}

/** Confirm imported icon data actually decodes as an image. */
export async function decodes(d) {
  if (!validIconData(d)) return false;
  try { await loadImage(d); return true; } catch { return false; }
}
