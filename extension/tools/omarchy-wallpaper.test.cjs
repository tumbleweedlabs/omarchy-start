const test = require('node:test');
const assert = require('node:assert/strict');

test('wallpaper URL uses only the configured home and detects changed image bytes', async t => {
  const oldChrome=globalThis.chrome,oldFetch=globalThis.fetch,oldCrypto=globalThis.crypto;
  t.after(()=>{globalThis.chrome=oldChrome;globalThis.fetch=oldFetch;globalThis.crypto=oldCrypto;});
  let saved={}, seen=[];
  let fileSchemeAllowed=true;
  globalThis.chrome={extension:{isAllowedFileSchemeAccess:async()=>fileSchemeAllowed},permissions:{contains:async()=>true,request:async()=>true},storage:{local:{async get(k){return {[k]:saved[k]};},async set(x){Object.assign(saved,x);}}}};
  globalThis.crypto=require('node:crypto').webcrypto;
  const bytes=Buffer.from('89504e470d0a1a0a01020304','hex');
  globalThis.fetch=async url=>{seen.push(url);return new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}});};
  const api=await import('../src/omarchy-wallpaper.js');
  await assert.rejects(api.connectWallpaper('/home/user/../other'),/home directory/);
  fileSchemeAllowed=false;
  await assert.rejects(api.connectWallpaper('user'),/Allow access to file URLs/);
  assert.equal(seen.length,0);
  fileSchemeAllowed=true;
  const one=await api.connectWallpaper('user');
  assert.equal(one.type,'image/png');
  assert.deepEqual(seen,['file:///home/user/.local/state/omarchy/current/background']);
  const two=await api.readWallpaper();
  assert.equal(two.lastModified,one.lastModified);
  globalThis.fetch=async url=>{seen.push(url);return new Response(Buffer.concat([bytes,Buffer.from('changed')]));};
  const three=await api.readWallpaper();
  assert.notEqual(three.lastModified,one.lastModified);
  globalThis.fetch=async()=>new Response('mode = \"dark\"\naccent = \"#7aa2f7\"\nbackground = \"#1a1b26\"\nforeground = \"#a9b1d6\"\n');
  assert.deepEqual(await api.readOmarchyPalette(),{mode:'dark',accent:'#7aa2f7',background:'#1a1b26',foreground:'#a9b1d6'});
});

test('first connection can recover from denied access and the browser file-URL toggle', async t => {
  const oldChrome=globalThis.chrome,oldFetch=globalThis.fetch,oldCrypto=globalThis.crypto;
  t.after(()=>{globalThis.chrome=oldChrome;globalThis.fetch=oldFetch;globalThis.crypto=oldCrypto;});
  const saved={};
  let filePermission=false,grant=false,fileSchemeAllowed=false,fetches=0;
  globalThis.chrome={
    extension:{isAllowedFileSchemeAccess:async()=>fileSchemeAllowed},
    permissions:{
      contains:async()=>filePermission,
      request:async()=>{filePermission=grant;return grant;},
    },
    storage:{local:{async get(key){return {[key]:saved[key]};},async set(value){Object.assign(saved,value);}}},
  };
  globalThis.crypto=require('node:crypto').webcrypto;
  globalThis.fetch=async()=>{fetches++;return new Response(Buffer.from('89504e470d0a1a0a01020304','hex'));};
  const api=await import('../src/omarchy-wallpaper.js');

  await assert.rejects(api.connectWallpaper('/home/alice'),/File access was not granted/);
  assert.equal(saved.omarchyWallpaperHome,'/home/alice');
  assert.equal(fetches,0);

  grant=true;
  await assert.rejects(api.connectWallpaper('/home/alice'),/Allow access to file URLs/);
  assert.equal(await api.hasWallpaperFileAccess(),false);
  assert.equal(fetches,0);

  fileSchemeAllowed=true;
  const image=await api.connectWallpaper('/home/alice');
  assert.equal(image.type,'image/png');
  assert.equal(fetches,1);
  assert.equal(await api.hasWallpaperFileAccess(),true);
});
