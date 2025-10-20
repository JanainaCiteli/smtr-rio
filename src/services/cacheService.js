import NodeCache from 'node-cache';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Configuração do cache
const cacheConfig = {
  stdTTL: 300, // 5 minutos por padrão
  checkperiod: 120, // Verificar expiração a cada 2 minutos
  useClones: false, // Para melhor performance
  maxKeys: 1000 // Máximo de 1000 chaves no cache
};

// Cache para dados gerais
const generalCache = new NodeCache(cacheConfig);

// Cache para dados por linha (TTL menor para dados mais dinâmicos)
const lineCache = new NodeCache({
  ...cacheConfig,
  stdTTL: 180 // 3 minutos para dados de linha
});

// Cache para dados por posição (TTL menor)
const positionCache = new NodeCache({
  ...cacheConfig,
  stdTTL: 120 // 2 minutos para dados de posição
});

/**
 * Serviço de cache para otimizar performance da API
 */
class CacheService {
  constructor() {
    this.setupCacheEvents();
  }

  /**
   * Configura eventos do cache para monitoramento
   */
  setupCacheEvents() {
    generalCache.on('set', (key, value) => {
      logger.info(`Cache geral: chave ${key} definida`);
    });

    generalCache.on('del', (key, value) => {
      logger.info(`Cache geral: chave ${key} removida`);
    });

    lineCache.on('set', (key, value) => {
      logger.info(`Cache linha: chave ${key} definida`);
    });

    positionCache.on('set', (key, value) => {
      logger.info(`Cache posição: chave ${key} definida`);
    });
  }

  /**
   * Obtém dados do cache geral
   * @param {string} key - Chave do cache
   * @returns {*} Dados do cache ou undefined se não encontrado
   */
  getGeneral(key) {
    const data = generalCache.get(key);
    if (data) {
      logger.info(`Cache hit geral: ${key}`);
    } else {
      logger.info(`Cache miss geral: ${key}`);
    }
    return data;
  }

  /**
   * Define dados no cache geral
   * @param {string} key - Chave do cache
   * @param {*} data - Dados para armazenar
   * @param {number} ttl - TTL em segundos (opcional)
   */
  setGeneral(key, data, ttl = null) {
    if (ttl) {
      generalCache.set(key, data, ttl);
    } else {
      generalCache.set(key, data);
    }
  }

  /**
   * Obtém dados do cache de linha
   * @param {string} key - Chave do cache
   * @returns {*} Dados do cache ou undefined se não encontrado
   */
  getLine(key) {
    const data = lineCache.get(key);
    if (data) {
      logger.info(`Cache hit linha: ${key}`);
    } else {
      logger.info(`Cache miss linha: ${key}`);
    }
    return data;
  }

  /**
   * Define dados no cache de linha
   * @param {string} key - Chave do cache
   * @param {*} data - Dados para armazenar
   * @param {number} ttl - TTL em segundos (opcional)
   */
  setLine(key, data, ttl = null) {
    if (ttl) {
      lineCache.set(key, data, ttl);
    } else {
      lineCache.set(key, data);
    }
  }

  /**
   * Obtém dados do cache de posição
   * @param {string} key - Chave do cache
   * @returns {*} Dados do cache ou undefined se não encontrado
   */
  getPosition(key) {
    const data = positionCache.get(key);
    if (data) {
      logger.info(`Cache hit posição: ${key}`);
    } else {
      logger.info(`Cache miss posição: ${key}`);
    }
    return data;
  }

  /**
   * Define dados no cache de posição
   * @param {string} key - Chave do cache
   * @param {*} data - Dados para armazenar
   * @param {number} ttl - TTL em segundos (opcional)
   */
  setPosition(key, data, ttl = null) {
    if (ttl) {
      positionCache.set(key, data, ttl);
    } else {
      positionCache.set(key, data);
    }
  }

  /**
   * Limpa todo o cache
   */
  clearAll() {
    generalCache.flushAll();
    lineCache.flushAll();
    positionCache.flushAll();
    logger.info('Todos os caches foram limpos');
  }

  /**
   * Obtém estatísticas do cache
   * @returns {Object} Estatísticas dos caches
   */
  getStats() {
    return {
      general: {
        keys: generalCache.keys().length,
        stats: generalCache.getStats()
      },
      line: {
        keys: lineCache.keys().length,
        stats: lineCache.getStats()
      },
      position: {
        keys: positionCache.keys().length,
        stats: positionCache.getStats()
      }
    };
  }

  /**
   * Remove uma chave específica do cache geral
   * @param {string} key - Chave para remover
   */
  deleteGeneral(key) {
    generalCache.del(key);
    logger.info(`Chave removida do cache geral: ${key}`);
  }

  /**
   * Remove uma chave específica do cache de linha
   * @param {string} key - Chave para remover
   */
  deleteLine(key) {
    lineCache.del(key);
    logger.info(`Chave removida do cache linha: ${key}`);
  }

  /**
   * Remove uma chave específica do cache de posição
   * @param {string} key - Chave para remover
   */
  deletePosition(key) {
    positionCache.del(key);
    logger.info(`Chave removida do cache posição: ${key}`);
  }
}

// Instância singleton do serviço de cache
const cacheService = new CacheService();

/**
 * Configura o cache no servidor
 */
export function setupCache() {
  logger.info('Cache configurado com sucesso');
  return cacheService;
}

export default cacheService;
