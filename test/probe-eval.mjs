import { Innertube, Utils } from 'youtubei.js';
import vm from 'node:vm';

Utils.Platform.shim.eval = async (data, _env) => {
  const stub = new Proxy(
    function () { return stub; },
    { get: (_, k) => k === Symbol.toPrimitive ? undefined : stub, apply: () => stub, construct: () => stub }
  );
  const ctx = vm.createContext({
    globalThis: stub, window: stub, self: stub, document: stub,
    navigator: stub, location: stub, IDBKeyRange: stub, crypto: stub,
    setTimeout: () => 0, clearTimeout: () => {}, performance: stub, console,
  });
  return vm.runInContext(`(function(){\n${data.output}\n})()`, ctx, { timeout: 5000 });
};

const yt = await Innertube.create();
const info = await yt.getBasicInfo('dQw4w9WgXcQ');

// Try to decipher adaptive formats and note which ones work.
const allFmts = info.streaming_data?.adaptive_formats || [];
console.log('Total adaptive formats:', allFmts.length);

let ok = 0, blocked = 0, errors = 0;
for (const f of allFmts) {
  try {
    const url = await f.decipher(yt.session.player);
    const rqh = url.includes('rqh=1');
    if (rqh) { blocked++; }
    else {
      ok++;
      console.log(`OK itag=${f.itag} ${f.mime_type?.split(';')[0].replace('video/','v:').replace('audio/','a:')} url=${url.slice(0,80)}`);
    }
  } catch(e) {
    errors++;
    if (errors <= 3) console.log(`ERR itag=${f.itag} err=${e.message.slice(0,60)}`);
  }
}
console.log(`\nSummary: ${ok} accessible, ${blocked} rqh-blocked, ${errors} errors`);
