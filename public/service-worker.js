const CACHE_NAME = 'mcastro-v65';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './enhanced.js',
  './online.js', './reviews.js', './service-worker.js', './qrcode.min.js', './manifest.webmanifest',
  './assets/store-hero-v1.webp', './assets/mcastro-solutions-logo.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  // Dados privados e rotas Tech sempre exigem rede; nunca caem no HTML da Store.
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/tech' || requestUrl.pathname.startsWith('/tech/') || requestUrl.searchParams.get('modo') === 'admin' || event.request.headers.has('x-admin-password')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
  }
});
