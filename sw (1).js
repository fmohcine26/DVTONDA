// ═══════════════════════════════════════════════════════════
//  مخبزتي — Service Worker v5
//  يخزّن التطبيق كاملاً ويعمل 100% بدون انترنت بعد أول تحميل
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'makhbaza-v5';

// الموارد التي نخزّنها عند أول تثبيت
const CORE_ASSETS = [
  './',           // index.html
  './sw.js'
];

// ─── INSTALL: خزّن الموارد الأساسية ───────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()) // فعّل SW فوراً دون انتظار
  );
});

// ─── ACTIVATE: احذف الكاشات القديمة ──────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // تحكّم في الصفحات المفتوحة فوراً
  );
});

// ─── FETCH: استراتيجية "الشبكة أولاً، الكاش احتياط" ──────
self.addEventListener('fetch', event => {
  // تجاهل الطلبات غير GET
  if (event.request.method !== 'GET') return;

  // تجاهل طلبات Google OAuth (تحتاج شبكة دائماً)
  const url = event.request.url;
  if (url.includes('accounts.google.com') ||
      url.includes('googleapis.com') ||
      url.includes('oauth')) return;

  // طلبات التنقل (فتح الصفحة) — الكاش أولاً للسرعة
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./').then(cached => {
        // أرسل النسخة المخزّنة فوراً وحدّث في الخلفية
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./', clone));
          }
          return response;
        }).catch(() => null);

        return cached || networkFetch;
      })
    );
    return;
  }

  // باقي الطلبات — شبكة أولاً مع كاش احتياطي
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── MESSAGE: استقبل أوامر من الصفحة ─────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
