/* Observe Omarchy's current-state directory for wallpaper and theme changes. */
const DB = 'omarchy-wallpaper-access';
let observer = null;
let refresh = null;
let debounce = null;

export const isOmarchyWatching = () => observer !== null;

function database() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('handles');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function handleAccess(mode, handle) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('handles',mode==='get'?'readonly':'readwrite');
    const request=mode==='get'?tx.objectStore('handles').get('current'):tx.objectStore('handles').put(handle,'current');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    tx.oncomplete=()=>db.close();
  });
}

export function stopOmarchyWatch() {
  clearTimeout(debounce); debounce=null;
  observer?.disconnect(); observer=null;
  refresh=null;
}

export async function startOmarchyWatch(onChange) {
  stopOmarchyWatch();
  if (!('FileSystemObserver' in window)) return false;
  const handle=await handleAccess('get');
  if (!handle || await handle.queryPermission({mode:'read'}) !== 'granted') return false;
  const next=new FileSystemObserver(records=>{
    if (!records.some(r=>r.type==='unknown' || r.type==='errored' ||
      ['background','theme.generation','theme.name'].includes(r.relativePathComponents?.[0]))) return;
    clearTimeout(debounce);
    debounce=setTimeout(()=>{if(refresh) void refresh();},120);
  });
  try { await next.observe(handle); }
  catch (_) { next.disconnect(); return false; }
  observer=next; refresh=onChange;
  return true;
}

export async function inferHomeFromStateFolder(handle) {
  let backgrounds;
  try { backgrounds=await handle.getDirectoryHandle('theme-backgrounds'); }
  catch (_) { return ''; }
  // Omarchy records an absolute image path for each theme here. The picker
  // exposes only a folder name, so use this validated path solely to identify
  // the Linux home directory. The actual wallpaper is read from current/background.
  let checked=0;
  for await (const entry of backgrounds.values()) {
    if (++checked > 40) break;
    if (entry.kind !== 'file') continue;
    try {
      const file=await entry.getFile();
      if (file.size > 512) continue;
      const path=(await file.text()).trim();
      const match=/^\/home\/([A-Za-z0-9_.-]+)\//.exec(path);
      if (match && match[1] !== '.' && match[1] !== '..') return `/home/${match[1]}`;
    } catch (_) { /* A stale theme entry does not block other entries. */ }
  }
  return '';
}

export async function selectOmarchyFolder() {
  if (!window.showDirectoryPicker) throw new Error('Folder selection is unavailable in this browser.');
  const state=await window.showDirectoryPicker({mode:'read',id:'omarchy-state'});
  let current;
  try {
    current=await state.getDirectoryHandle('current');
    await current.getFileHandle('theme.name');
  } catch (_) { throw new Error('Select /home/username/.local/state/omarchy.'); }
  const home=await inferHomeFromStateFolder(state);
  await handleAccess('put',current);
  return home;
}
