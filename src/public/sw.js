/**
 * Service Worker para cache offline da aplicação SMTR Rio
 */

const CACHE_NAME = 'smtr-rio-v2.0.0';
const STATIC_CACHE = 'smtr-rio-static-v2.0.0';
const DYNAMIC_CACHE = 'smtr-rio-dynamic-v2.0.0';

// Arquivos para cache estático
const STATIC_FILES = [
    '/',
    '/css/style.css',
    '/js/app.js',
    '/api-docs',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// URLs da API para cache dinâmico
const API_PATTERNS = [
    '/api/sppo',
    '/api/sppo/stats',
    '/health'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Service Worker: Cache estático criado');
                return cache.addAll(STATIC_FILES);
            })
            .catch(error => {
                console.error('Service Worker: Erro ao criar cache estático:', error);
            })
    );
    
    self.skipWaiting();
});

// Ativar Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker: Ativando...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Service Worker: Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    );
    
    self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Estratégia para arquivos estáticos
    if (STATIC_FILES.includes(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(request);
                })
        );
        return;
    }
    
    // Estratégia para API
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            caches.open(DYNAMIC_CACHE)
                .then(cache => {
                    return cache.match(request)
                        .then(response => {
                            if (response) {
                                // Retornar dados do cache e atualizar em background
                                fetch(request)
                                    .then(fetchResponse => {
                                        if (fetchResponse.ok) {
                                            cache.put(request, fetchResponse.clone());
                                        }
                                    })
                                    .catch(error => {
                                        console.log('Service Worker: Erro ao atualizar cache:', error);
                                    });
                                
                                return response;
                            }
                            
                            // Se não há cache, buscar da rede
                            return fetch(request)
                                .then(fetchResponse => {
                                    if (fetchResponse.ok) {
                                        cache.put(request, fetchResponse.clone());
                                    }
                                    return fetchResponse;
                                });
                        });
                })
        );
        return;
    }
    
    // Estratégia padrão: network first
    event.respondWith(
        fetch(request)
            .then(response => {
                // Se a resposta é válida, armazenar no cache
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => {
                            cache.put(request, responseClone);
                        });
                }
                return response;
            })
            .catch(error => {
                // Se a rede falhar, tentar buscar do cache
                return caches.match(request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        
                        // Se não há cache e a rede falhou, retornar página offline
                        if (request.destination === 'document') {
                            return caches.match('/');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Limpar cache antigo periodicamente
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(DYNAMIC_CACHE)
            .then(() => {
                console.log('Service Worker: Cache dinâmico limpo');
                event.ports[0].postMessage({ success: true });
            })
            .catch(error => {
                console.error('Service Worker: Erro ao limpar cache:', error);
                event.ports[0].postMessage({ success: false, error: error.message });
            });
    }
});

// Sincronização em background
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            fetch('/api/sppo')
                .then(response => {
                    if (response.ok) {
                        return caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                return cache.put('/api/sppo', response.clone());
                            });
                    }
                })
                .catch(error => {
                    console.log('Service Worker: Erro na sincronização:', error);
                })
        );
    }
});

// Notificações push (para futuras funcionalidades)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: data.primaryKey
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Ver no Mapa',
                    icon: '/favicon.ico'
                },
                {
                    action: 'close',
                    title: 'Fechar',
                    icon: '/favicon.ico'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
