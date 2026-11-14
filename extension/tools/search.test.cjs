const test = require('node:test');
const assert = require('node:assert/strict');

test('Omarchy plugin searches open marketplace results with the encoded query', async t => {
  const oldChrome = globalThis.chrome, oldDocument = globalThis.document, oldWindow = globalThis.window;
  t.after(() => { globalThis.chrome = oldChrome; globalThis.document = oldDocument; globalThis.window = oldWindow; });
  const opened = [];
  globalThis.chrome = {
    storage: { local: { QUOTA_BYTES: 10485760 }, onChanged: { addListener() {} } },
    tabs: { create: async options => { opened.push(options); } },
  };
  globalThis.document = { addEventListener() {} };
  globalThis.window = { addEventListener() {} };
  const { runSearch } = await import('../src/search.js');
  runSearch('weather & clocks', 'plugins', true);
  assert.deepEqual(opened, [{ url: 'https://plugins.omarchy.org/?q=weather%20%26%20clocks#catalog', active: false }]);
});
