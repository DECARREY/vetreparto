// Service worker de VetReparto: permite abrir la app aunque decarrey.github.io no responda
// (senal debil / cortes de la red movil). Estrategia: red primero con tiempo limite y,
// si no llega a tiempo, la copia guardada. Asi las actualizaciones siguen llegando normal.
var CACHE='vetreparto-v1';
var ESPERA_MS=3500;
var SHELL=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
// Solo se guardan el SDK de Firebase y los archivos propios; mapas, geocodificacion y la base de datos van directo a la red
var SDK=/\/(firebase@9\.23\.0|firebasejs\/9\.23\.0)\//;

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

function claveCache(req){
  // ?chofer=xxx cambia por chofer; la copia guardada es la misma para todos
  var u=new URL(req.url);
  if(u.origin===self.location.origin) u.search='';
  return u.href;
}
function guardable(res){ return res&&(res.ok||res.type==='opaque'); }

function redConLimite(req,ms){
  return new Promise(function(ok,no){
    var t=setTimeout(function(){no(new Error('timeout'));},ms);
    fetch(req).then(function(r){clearTimeout(t);ok(r);},function(er){clearTimeout(t);no(er);});
  });
}

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET') return;
  var u=new URL(req.url);
  var propio=u.origin===self.location.origin;
  if(!propio&&!SDK.test(u.href)) return;
  e.respondWith(caches.open(CACHE).then(function(c){
    var clave=claveCache(req);
    return c.match(clave).then(function(copia){
      var red=fetch(req).then(function(res){
        if(guardable(res)) c.put(clave,res.clone());
        return res;
      });
      if(!copia) return red;
      // Hay copia: esperar a la red solo un rato y, si no responde, abrir la copia
      return Promise.race([
        red,
        new Promise(function(ok){setTimeout(function(){ok(copia);},ESPERA_MS);})
      ]).catch(function(){return copia;});
    });
  }));
});
