// Service Worker de Food Loop
// Este archivo se encarga de cachear los recursos esenciales para que la aplicación
// funcione offline y cargue rápidamente en futuras visitas.

const CACHE_NAME = 'foodloop-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/galeria.html',
  '/features.html',
  '/testimonios.html',
  '/about.html',
  // Cacheamos las nuevas páginas para permitir su funcionamiento offline
  '/comenzar.html',
  '/login.html',
  '/registro-local.html',
  '/suscripcion.html',
  '/dashboard-usuario.html',
  '/dashboard-local.html',
  '/css/style.css',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/Foodloop.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js'
];

// Durante la instalación se abren los cachés y se añaden todos los recursos listados
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Al activar, se eliminan las versiones antiguas del caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de las peticiones de red: primero intenta responder desde el caché
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});