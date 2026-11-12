'use strict';

// Service worker : cache-first sur les assets statiques, fallback réseau,
// et en dernier recours une réponse propre. AUCUNE promesse ne doit rejeter :
// un waitUntil/respondWith rejeté produit « Uncaught (in promise) TypeError: Failed to fetch ».

const CACHE = 'bankalc-v3';
const ASSETS = [
    './',
    'index.html',
    'styles.css',
    'calculs.js',
    'script.js',
    'dark-mode.js',
    'webmanifest.json',
    'logos/favicon-light.ico',
    'logos/favicon-dark.ico',
    'logos/home-logo-light.png',
    'logos/home-logo-dark.png',
    'logos/github-logo-light.png',
    'logos/github-logo-dark.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            // addAll est atomique : un seul asset qui échoue (réseau coupé) ferait rejeter
            // tout l'install. On met en cache ce qu'on peut, sans jamais rejeter.
            .then((cache) => Promise.allSettled(ASSETS.map((asset) => cache.add(asset))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Réseau indisponible et ressource absente du cache : on résout proprement.
function reponseHorsLigne(event) {
    if (event.request.mode === 'navigate') {
        // Pour une navigation, on sert la page d'accueil du cache si elle y est.
        return caches.match('index.html')
            .catch(() => null)
            .then((cached) => cached || new Response(
                '<h1>Bankalc est hors ligne</h1><p>Reconnectez-vous pour recharger la page.</p>',
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ));
    }
    return Promise.resolve(new Response('', { status: 503, statusText: 'Offline' }));
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }
    event.respondWith(
        caches.match(event.request)
            .catch(() => undefined) // caches.match lui-même peut rejeter : on traite comme « pas en cache »
            .then((cached) => {
                if (cached) {
                    return cached;
                }
                return fetch(event.request)
                    .then((response) => {
                        if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
                            const copy = response.clone();
                            caches.open(CACHE)
                                .then((cache) => cache.put(event.request, copy))
                                .catch(() => { /* stockage plein ou indisponible : on ignore */ });
                        }
                        return response;
                    })
                    .catch(() => reponseHorsLigne(event)); // « Failed to fetch » : réponse 503, promesse résolue
            })
            .catch(() => reponseHorsLigne(event)) // double protection : aucune voie ne rejette
    );
});
