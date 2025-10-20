/**
 * Configurações da aplicação SMTR Rio
 */

export const config = {
    // Configurações do servidor
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        apiUrl: process.env.API_URL || 'http://localhost:3000'
    },

    // Configurações de CORS
    cors: {
        origins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
        credentials: true
    },

    // Configurações de Cache
    cache: {
        ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutos
        maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000,
        checkPeriod: 120 // 2 minutos
    },

    // Configurações de Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
    },

    // Configurações de Log
    log: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log'
    },

    // Configurações da API SPPO
    sppo: {
        apiUrl: process.env.SPPO_API_URL || 'https://dados.mobilidade.rio/gps/sppo',
        timeout: parseInt(process.env.SPPO_TIMEOUT) || 30000,
        retryAttempts: parseInt(process.env.SPPO_RETRY_ATTEMPTS) || 3
    }
};

export default config;
