import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const base=new URL('./',import.meta.url);
const sw=await readFile(new URL('./sw.js',base),'utf8');
const html=await readFile(new URL('./index.html',base),'utf8');
const features=await readFile(new URL('./app-features-2.js',base),'utf8');
const list=sw.match(/const FILES=\[([^\]]+)\]/);
assert.ok(list,'No se encontró la lista de recursos offline');
const assets=[...list[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);

test('la PWA almacena en caché los módulos necesarios y puede instalarlos',async()=>{
 assert.ok(assets.includes('./index.html'));
 assert.ok(assets.includes('./domain.js'));
 assert.ok(assets.includes('./app-quality.js'));
 assert.ok(assets.includes('./styles.css'));
 assert.ok(assets.includes('./manifest.webmanifest'));
 for(const asset of assets.filter(path=>path!=='./'))await access(new URL(asset.slice(2),base));
 assert.match(html,/manifest\.webmanifest/);
 assert.match(features,/navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
});

test('la PWA versiona el shell y limpia cachés anteriores',()=>{
 assert.match(sw,/const CACHE='kairos-personal-shell-v\d+'/);
 assert.match(sw,/keys\.filter\(key=>key!==CACHE\)/);
 assert.match(sw,/event\.request\.mode==='navigate'/);
});
