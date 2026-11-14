const test = require('node:test');
const assert = require('node:assert/strict');
test('prediction provider follows the selected engine and never falls back to another', async () => {
  const m = await import('../src/predict.js');
  for (const id of ['google','bing','duckduckgo','brave','startpage','ecosia']) assert.equal(m.providerOf(id), id);
  for (const id of ['browser','kagi','unknown']) { assert.equal(m.providerOf(id), null); assert.equal(await m.hasAccess(id), false); assert.equal(await m.fetchPredictions(id, 'example'), null); }
});
