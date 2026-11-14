/* Service worker: deja la app disponible sin conexión.
   Subir VERSION cada vez que cambian los archivos para que los celulares tomen la versión nueva. */
const VERSION = 'rfb-1';
const ARCHIVOS = [
  './', 'index.html', 'app.css', 'app.js', 'figuras.js', 'rutina.json', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'fotos/estacion-dominadas-fondos.jpg', 'fotos/maquina-curl-biceps.jpg', 'fotos/maquina-curl-femoral.jpg',
  'fotos/maquina-extension-cuadriceps.jpg', 'fotos/maquina-jalon.jpg', 'fotos/maquina-press-hombro.jpg',
  'fotos/maquina-press-pecho.jpg', 'fotos/maquina-triceps.jpg', 'fotos/polea.jpg', 'fotos/smith.jpg',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Primero la copia guardada, y en segundo plano se actualiza desde la red (también las tipografías). */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const guardado = await c.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => guardado);
    return guardado || red;
  }));
});
