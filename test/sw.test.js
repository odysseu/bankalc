'use strict';

// Tests du service worker avec stubs de self / caches / fetch.
// Chaque fichier de test node tourne dans son propre process : pas de pollution.

const test = require('node:test');
const assert = require('node:assert');

const ORIGIN = 'https://odysseu.github.io';
const CACHE = 'bankalc-v3';
const listeners = {};

// --- Stubs ---
const store = new Map(); // cacheName -> Map(cleNormalisee -> reponse)
let modeFetch = 'ok';    // 'ok' | 'fail'  -> fetch réseau
let modeCaches = 'ok';   // 'ok' | 'fail'  -> caches.match rejette
let modeInstall = 'ok';  // 'ok' | 'fail'  -> cache.add rejette pendant l'install
let appelsFetch = 0;

function cle(req) {
    const u = typeof req === 'string' ? req : req.url;
    return u.replace(ORIGIN + '/bankalc/', '');
}

function resetFlags() {
    modeFetch = 'ok';
    modeCaches = 'ok';
    modeInstall = 'ok';
    appelsFetch = 0;
}

global.self = {
    addEventListener: (event, fn) => { listeners[event] = fn; },
    location: { origin: ORIGIN },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() }
};

global.caches = {
    open: async (name) => {
        if (!store.has(name)) {
            store.set(name, new Map());
        }
        const map = store.get(name);
        const cache = {
            add: async (asset) => {
                if (modeInstall === 'fail') {
                    throw new TypeError('Failed to fetch');
                }
                map.set(cle(asset), new Response('asset:' + cle(asset), { status: 200 }));
            },
            addAll: async (assets) => { for (const a of assets) { await cache.add(a); } },
            put: async (req, resp) => { map.set(cle(req), resp); },
            match: async (req) => map.get(cle(req))
        };
        return cache;
    },
    match: async (req) => {
        if (modeCaches === 'fail') {
            throw new TypeError('caches indisponible');
        }
        for (const map of store.values()) {
            const r = map.get(cle(req));
            if (r) {
                return r;
            }
        }
        return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name)
};

global.fetch = async () => {
    appelsFetch += 1;
    if (modeFetch === 'fail') {
        throw new TypeError('Failed to fetch'); // le cas qui faisait planter respondWith
    }
    return new Response('contenu-reseau', { status: 200 });
};

require('../sw.js');

function makeEvent(request) {
    return {
        request,
        respondWith(p) { this.response = p; }
    };
}

async function installer() {
    let p;
    listeners['install']({ waitUntil: (promise) => { p = promise; } });
    await p;
}

test('install — précache tous les assets statiques', async () => {
    resetFlags();
    await installer();
    const cache = store.get(CACHE);
    assert.ok(cache, `cache ${CACHE} créé`);
    for (const asset of ['index.html', 'styles.css', 'calculs.js', 'script.js', 'dark-mode.js', 'webmanifest.json']) {
        assert.ok(cache.has(asset), `asset ${asset} en cache`);
    }
});

test('install — réseau coupé pendant l’install : waitUntil RÉSOLU (allSettled), jamais de promesse rejetée', async () => {
    resetFlags();
    modeInstall = 'fail';
    let rejete = false;
    let p;
    listeners['install']({ waitUntil: (promise) => { p = promise.catch(() => { rejete = true; }); } });
    await p; // ne doit pas rejeter
    assert.strictEqual(rejete, false, 'install ne doit jamais rejeter, même offline');
    resetFlags();
});

test('activate — supprime tous les anciens caches (v1, v2)', async () => {
    resetFlags();
    await installer();
    store.set('bankalc-v1', new Map());
    store.set('bankalc-v2', new Map());
    let p;
    listeners['activate']({ waitUntil: (promise) => { p = promise; } });
    await p;
    assert.ok(!store.has('bankalc-v1'), 'v1 supprimé');
    assert.ok(!store.has('bankalc-v2'), 'v2 supprimé (purge de l’ancien contenu servi)');
    assert.ok(store.has(CACHE), 'cache courant conservé');
});

test('fetch GET en cache — servi depuis le cache, réseau non appelé', async () => {
    resetFlags();
    await installer();
    const event = makeEvent({ method: 'GET', url: ORIGIN + '/bankalc/styles.css', mode: 'cors' });
    listeners['fetch'](event);
    const resp = await event.response;
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(await resp.text(), 'asset:styles.css');
    assert.strictEqual(appelsFetch, 0, 'pas d’appel réseau');
});

test('fetch GET absent du cache, réseau OK, même origine — mis en cache et servi', async () => {
    resetFlags();
    await installer();
    const event = makeEvent({ method: 'GET', url: ORIGIN + '/bankalc/nouveau-fichier.css', mode: 'cors' });
    listeners['fetch'](event);
    const resp = await event.response;
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(await resp.text(), 'contenu-reseau');
    await new Promise((r) => setTimeout(r, 10)); // laisse le put en cache se faire
    const enCache = await caches.match(ORIGIN + '/bankalc/nouveau-fichier.css');
    assert.ok(enCache, 'réponse mise en cache en arrière-plan');
});

test('fetch GET cross-origin (CDN), réseau OK — servi mais PAS mis en cache', async () => {
    resetFlags();
    await installer();
    const event = makeEvent({ method: 'GET', url: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.min.js', mode: 'cors' });
    listeners['fetch'](event);
    const resp = await event.response;
    assert.strictEqual(resp.status, 200);
    await new Promise((r) => setTimeout(r, 10));
    const enCache = await caches.match('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.min.js');
    assert.strictEqual(enCache, undefined, 'cross-origin non caché');
});

test('fetch GET navigation, réseau KO (Failed to fetch) — index.html du cache, promesse RÉSOLUE', async () => {
    resetFlags();
    await installer();
    modeFetch = 'fail';
    const event = makeEvent({ method: 'GET', url: ORIGIN + '/bankalc/', mode: 'navigate' });
    listeners['fetch'](event);
    const resp = await event.response; // ne doit PAS rejeter
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(await resp.text(), 'asset:index.html');
});

test('fetch GET navigation hors cache, réseau KO — 503 propre, promesse RÉSOLUE (le bug rapporté)', async () => {
    resetFlags();
    store.clear();
    modeFetch = 'fail';
    const event = makeEvent({ method: 'GET', url: ORIGIN + '/bankalc/page-inconnue', mode: 'navigate' });
    listeners['fetch'](event);
    const resp = await event.response; // avant le fix : Uncaught (in promise) TypeError: Failed to fetch
    assert.strictEqual(resp.status, 503);
    assert.ok((await resp.text()).includes('hors ligne'));
});

test('fetch GET ressource non-navigation, réseau KO — 503 « Offline », promesse RÉSOLUE', async () => {
    resetFlags();
    modeFetch = 'fail';
    const event = makeEvent({ method: 'GET', url: 'https://cdn.jsdelivr.net/x.js', mode: 'cors' });
    listeners['fetch'](event);
    const resp = await event.response;
    assert.strictEqual(resp.status, 503);
    assert.strictEqual(resp.statusText, 'Offline');
});

test('fetch — caches.match rejette ET réseau KO, navigation : promesse RÉSOLUE avec page hors ligne', async () => {
    resetFlags();
    modeCaches = 'fail';
    modeFetch = 'fail';
    const event = makeEvent({ method: 'GET', url: ORIGIN + '/bankalc/', mode: 'navigate' });
    listeners['fetch'](event);
    const resp = await event.response; // double protection : jamais de rejet
    assert.strictEqual(resp.status, 503);
    assert.ok((await resp.text()).includes('hors ligne'));
});

test('fetch — caches.match rejette ET réseau KO, ressource : promesse RÉSOLUE avec 503', async () => {
    resetFlags();
    modeCaches = 'fail';
    modeFetch = 'fail';
    const event = makeEvent({ method: 'GET', url: ORIGIN + '/bankalc/manquant.css', mode: 'cors' });
    listeners['fetch'](event);
    const resp = await event.response;
    assert.strictEqual(resp.status, 503);
    assert.strictEqual(resp.statusText, 'Offline');
});

test('fetch POST — respondWith non appelé (laisse le navigateur gérer)', () => {
    resetFlags();
    const event = makeEvent({ method: 'POST', url: ORIGIN + '/bankalc/', mode: 'navigate' });
    listeners['fetch'](event);
    assert.strictEqual(event.response, undefined);
});
