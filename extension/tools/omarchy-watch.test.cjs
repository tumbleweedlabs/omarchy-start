const test=require('node:test');
const assert=require('node:assert/strict');

test('selected Omarchy state folder supplies a validated home with a manual fallback', async()=>{
  const api=await import('../src/omarchy-watch.js');
  const state={getDirectoryHandle:async name=>{
    assert.equal(name,'theme-backgrounds');
    return {async *values(){
      yield {kind:'file',getFile:async()=>({size:91,text:async()=>'/home/alice/.local/state/omarchy/current/theme/backgrounds/wall.webp\n'})};
    }};
  }};
  assert.equal(await api.inferHomeFromStateFolder(state),'/home/alice');
  assert.equal(await api.inferHomeFromStateFolder({getDirectoryHandle:async()=>{throw new Error('missing');}}),'');
  assert.equal(await api.inferHomeFromStateFolder({getDirectoryHandle:async()=>({async *values(){
    yield {kind:'file',getFile:async()=>({size:20,text:async()=>'/etc/passwd'})};
  }})}), '');
});

test('Omarchy directory events refresh the wallpaper without periodic polling', async t=>{
  const names=['window','indexedDB','FileSystemObserver'];
  const saved=new Map(names.map(x=>[x,Object.getOwnPropertyDescriptor(globalThis,x)]));
  t.after(()=>{for(const [name,descriptor] of saved) descriptor?Object.defineProperty(globalThis,name,descriptor):delete globalThis[name];});
  let callback,disconnected=false;
  globalThis.window={FileSystemObserver:function(){}};
  globalThis.FileSystemObserver=class {constructor(fn){callback=fn;} async observe(handle){assert.equal(handle.name,'current');} disconnect(){disconnected=true;}};
  globalThis.indexedDB={open(){const r={};queueMicrotask(()=>{r.result={close(){},transaction(){return {objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result={name:'current',queryPermission:async()=> 'granted'};q.onsuccess();});return q;}};}};}};r.onsuccess();});return r;}};
  const api=await import('../src/omarchy-watch.js');
  let updates=0;
  assert.equal(await api.startOmarchyWatch(()=>updates++),true);
  assert.equal(api.isOmarchyWatching(),true);
  callback([{type:'modified',relativePathComponents:['other']}]);
  await new Promise(r=>setTimeout(r,150));
  assert.equal(updates,0);
  callback([{type:'modified',relativePathComponents:['background']}]);
  await new Promise(r=>setTimeout(r,150));
  assert.equal(updates,1);
  callback([{type:'modified',relativePathComponents:['theme.generation']}]);
  await new Promise(r=>setTimeout(r,150));
  assert.equal(updates,2);
  api.stopOmarchyWatch();assert.equal(disconnected,true);
  assert.equal(api.isOmarchyWatching(),false);
});
