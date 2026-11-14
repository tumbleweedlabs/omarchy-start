/* The file URL permission is broad; this module constructs only Omarchy's wallpaper URL. */
const HOME_KEY = 'omarchyWallpaperHome';
const FILE_ORIGIN = {origins:['file:///*']};
const MAX_SIZE = 20_000_000;

export function validHome(value) {
  return typeof value === 'string' && /^\/home\/[A-Za-z0-9_.-]+\/?$/.test(value) &&
    !value.split('/').some(part => part === '..' || part === '.');
}

export async function savedWallpaperHome() {
  return (await chrome.storage.local.get(HOME_KEY))[HOME_KEY] || '';
}

export async function hasWallpaperFileAccess() {
  if (!await chrome.permissions.contains(FILE_ORIGIN)) return false;
  return chrome.extension?.isAllowedFileSchemeAccess
    ? chrome.extension.isAllowedFileSchemeAccess()
    : true;
}

export async function connectWallpaper(home) {
  home = String(home || '').trim().replace(/\/$/, '');
  if (/^[A-Za-z0-9_.-]+$/.test(home)) home = `/home/${home}`;
  if (!validHome(home)) throw new Error('Enter your Linux username or home directory.');
  await chrome.storage.local.set({[HOME_KEY]:home});
  if (!await chrome.permissions.contains(FILE_ORIGIN)) {
    const granted = await chrome.permissions.request(FILE_ORIGIN);
    if (!granted) throw new Error('File access was not granted.');
  }
  if (!await hasWallpaperFileAccess()) throw new Error('Enable “Allow access to file URLs” in this extension’s details, then retry.');
  return readWallpaper();
}

export async function readWallpaper() {
  const home = await savedWallpaperHome();
  if (!validHome(home)) throw new Error('Connect Omarchy wallpaper in Settings.');
  if (!await hasWallpaperFileAccess()) throw new Error('Enable “Allow access to file URLs” in this extension’s details.');
  const path = `${home.replace(/\/$/, '')}/.local/state/omarchy/current/background`;
  let response;
  try { response = await fetch(`file://${path}`, {cache:'no-store', credentials:'omit'}); }
  catch (_) { throw new Error('Cannot read Omarchy’s current wallpaper.'); }
  if (!response.ok) throw new Error('Cannot read Omarchy’s current wallpaper.');
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_SIZE) throw new Error('The current wallpaper exceeds 20 MB.');
  const blob = await response.blob();
  if (blob.size > MAX_SIZE) throw new Error('The current wallpaper exceeds 20 MB.');
  const b = new Uint8Array(await blob.slice(0,12).arrayBuffer());
  const type = b[0]===0xff && b[1]===0xd8 ? 'image/jpeg'
    : b[0]===0x89 && b[1]===0x50 && b[2]===0x4e && b[3]===0x47 ? 'image/png'
    : String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP' ? 'image/webp'
    : String.fromCharCode(...b.slice(0,3))==='GIF' ? 'image/gif' : '';
  if (!type) throw new Error('The current wallpaper is not a supported still image.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const stamp = digest.slice(0,6).reduce((n,x)=>n*256+x,0);
  return new File([blob], 'background', {type,lastModified:stamp});
}

export async function readOmarchyPalette() {
  const home=await savedWallpaperHome();
  if (!validHome(home) || !await hasWallpaperFileAccess()) return null;
  let response;
  try { response=await fetch(`file://${home.replace(/\/$/,'')}/.local/state/omarchy/current/theme/colors.toml`, {cache:'no-store',credentials:'omit'}); }
  catch (_) { return null; }
  if (!response.ok) return null;
  const text=await response.text();
  if (text.length>10000) return null;
  const palette={};
  for (const key of ['accent','background','foreground','lighter_background','light_foreground','mode']) {
    const match=text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'));
    if (match && (key==='mode' ? ['light','dark'].includes(match[1]) : /^#[0-9a-fA-F]{6}$/.test(match[1]))) palette[key]=match[1];
  }
  return palette.accent && palette.background && palette.foreground ? palette : null;
}
