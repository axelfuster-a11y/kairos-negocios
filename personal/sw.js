const CACHE='kairos-personal-shell-v4';
const FILES=['./','./index.html','./styles.css','./app.js','./app-core.js','./app-views-1.js','./app-views-2.js','./app-views-3.js','./app-views-4.js','./app-forms.js','./app-actions-1.js','./app-features-1.js','./app-features-2.js','./app-quality.js','./manifest.webmanifest','./domain.js','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cached=await caches.match(event.request);
  if(cached)return cached;
  try{
   const response=await fetch(event.request);
   if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}
   return response;
  }catch{
   if(event.request.mode==='navigate')return (await caches.match('./index.html'))||new Response('Sin conexión',{status:503,statusText:'Offline'});
   return new Response('',{status:503,statusText:'Offline'});
  }
 })());
});
