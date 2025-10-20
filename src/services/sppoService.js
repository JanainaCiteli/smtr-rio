import axios from 'axios';
import https from 'https';
import winston from 'winston';
import cacheService from './cacheService.js';

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

/**
 * Serviço modernizado para interagir com a API de GPS do SPPO
 */
class SppoService {
  constructor() {
    this.apiUrl = 'https://dados.mobilidade.rio/gps/sppo';
    this.cacheKey = 'sppo_all_buses';
    this.lastFetchTime = null;
    this.fetchInterval = 300000; // 5 minutos em ms
    
    // OTIMIZAÇÃO CRÍTICA: Índices para lookup O(1)
    this.lineIndex = new Map(); // Map<linha, Array<bus>>
    this.lastIndexUpdate = null;
    
    // Configuração otimizada do axios
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 30000 // 30 segundos de timeout
      }),
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'SMTR-Rio-API/2.0.0'
      }
    });

    // OTIMIZAÇÃO CRÍTICA: Interceptors condicionais (apenas em desenvolvimento)
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (isDevelopment) {
      this.axiosInstance.interceptors.request.use(
        (config) => {
          logger.info(`Requisição para API SPPO: ${config.url}`);
          return config;
        },
        (error) => {
          logger.error('Erro na requisição para API SPPO:', error);
          return Promise.reject(error);
        }
      );

      this.axiosInstance.interceptors.response.use(
        (response) => {
          logger.info(`Resposta da API SPPO: ${response.status} - ${response.data.length} ônibus`);
          return response;
        },
        (error) => {
          logger.error('Erro na resposta da API SPPO:', error);
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Busca todos os dados de GPS dos ônibus EM ROTA com cache inteligente
   * @returns {Promise<Array>} Lista de ônibus em rota com suas posições
   */
  async getAllBusData() {
    try {
      // Verificar cache primeiro
      const cachedData = cacheService.getGeneral(this.cacheKey);
      if (cachedData) {
        logger.info('Retornando dados do cache');
        return cachedData;
      }

      // Verificar se é necessário fazer nova requisição
      const now = Date.now();
      if (this.lastFetchTime && (now - this.lastFetchTime) < this.fetchInterval) {
        logger.info('Aguardando intervalo entre requisições');
        // Retornar dados mais antigos do cache se disponível
        const staleData = cacheService.getGeneral(`${this.cacheKey}_stale`);
        if (staleData) {
          return staleData;
        }
      }

      logger.info('Buscando novos dados da API SPPO');
      const response = await this.axiosInstance.get(this.apiUrl);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Dados inválidos recebidos da API');
      }

      // OTIMIZAÇÃO CRÍTICA: Unificar normalização + filtro em loop único (3N → 1N)
      const agora = new Date();
      const activeBuses = [];
      
      for (const bus of response.data) {
        // Normalizar dados
        const normalized = this.normalizeBusData(bus);
        
        // Filtrar veículos em rota
        const dataHoraBus = new Date(normalized.dataHora);
        const diferencaMinutos = (agora - dataHoraBus) / (1000 * 60);
        
        const emMovimento = parseFloat(normalized.velocidade) > 0;
        const dadosRecentes = diferencaMinutos <= 5; // Últimos 5 minutos
        
        if (emMovimento || dadosRecentes) {
          activeBuses.push(normalized);
        }
      }
      
      // Armazenar no cache
      cacheService.setGeneral(this.cacheKey, activeBuses, 300); // 5 minutos
      cacheService.setGeneral(`${this.cacheKey}_stale`, activeBuses, 1800); // 30 minutos
      
      this.lastFetchTime = now;
      
      // OTIMIZAÇÃO CRÍTICA: Atualizar índices para lookup O(1)
      this.updateLineIndex(activeBuses);
      
      logger.info(`Dados normalizados e armazenados no cache: ${activeBuses.length} ônibus EM ROTA (de ${response.data.length} total)`);
      return activeBuses;
      
    } catch (error) {
      logger.error('Erro ao buscar dados da API SPPO:', error);
      
      // Tentar retornar dados do cache em caso de erro
      const staleData = cacheService.getGeneral(`${this.cacheKey}_stale`);
      if (staleData) {
        logger.info('Retornando dados antigos do cache devido ao erro');
        return staleData;
      }
      
      throw new Error('Falha ao obter dados de GPS dos ônibus');
    }
  }

  /**
   * Normaliza os dados de um ônibus para formato compatível com o frontend
   * @param {Object} bus - Dados do ônibus da API
   * @returns {Object} Dados normalizados
   */
  normalizeBusData(bus) {
    try {
      // Criar um novo objeto sem as chaves originais que serão substituídas
      const { datahora, ...rest } = bus;
      
      return {
        ...rest,
        // Converter coordenadas de vírgula para ponto decimal
        latitude: parseFloat(bus.latitude?.replace(',', '.')) || 0,
        longitude: parseFloat(bus.longitude?.replace(',', '.')) || 0,
        // Converter timestamp Unix para formato ISO
        dataHora: new Date(parseInt(bus.datahora)).toISOString(),
        // Garantir que velocidade seja numérica
        velocidade: parseFloat(bus.velocidade) || 0
      };
    } catch (error) {
      logger.warn('Erro ao normalizar dados do ônibus:', error);
      return bus; // Retornar dados originais em caso de erro
    }
  }

  /**
   * Filtra os ônibus por linha com cache otimizado - APENAS VEÍCULOS EM ROTA
   * @param {string} linha - Número ou código da linha de ônibus
   * @returns {Promise<Array>} Lista de ônibus da linha especificada que estão em rota
   */
  async getBusByLine(linha) {
    try {
      // Verificar cache específico da linha
      const cacheKey = `line_active_${linha}`;
      const cachedData = cacheService.getLine(cacheKey);
      if (cachedData) {
        logger.info(`Retornando dados da linha ${linha} (veículos em rota) do cache`);
        return cachedData;
      }

      // Normalizar a linha para busca
      const linhaFormatada = linha.toString().trim().toLowerCase();
      
      // OTIMIZAÇÃO CRÍTICA: Usar índice para lookup O(1) em vez de O(N) filter
      let filteredData = [];
      
      // Tentar busca exata primeiro
      if (this.lineIndex.has(linhaFormatada)) {
        filteredData = this.lineIndex.get(linhaFormatada);
      } else {
        // Fallback: buscar por correspondência parcial
        for (const [linhaKey, buses] of this.lineIndex.entries()) {
          if (linhaKey.includes(linhaFormatada) || linhaFormatada.includes(linhaKey)) {
            filteredData = [...filteredData, ...buses];
          }
        }
        
        // Se ainda não encontrou, carregar dados e atualizar índice
        if (filteredData.length === 0) {
          await this.getAllBusData(); // Atualiza índice
          
          if (this.lineIndex.has(linhaFormatada)) {
            filteredData = this.lineIndex.get(linhaFormatada);
          } else {
            for (const [linhaKey, buses] of this.lineIndex.entries()) {
              if (linhaKey.includes(linhaFormatada) || linhaFormatada.includes(linhaKey)) {
                filteredData = [...filteredData, ...buses];
              }
            }
          }
        }
      }

      // Armazenar no cache específico da linha
      cacheService.setLine(cacheKey, filteredData, 120); // 2 minutos (cache menor para dados mais dinâmicos)
      
      logger.info(`Filtrados ${filteredData.length} ônibus EM ROTA da linha ${linha}`);
      return filteredData;
      
    } catch (error) {
      logger.error(`Erro ao filtrar ônibus da linha ${linha}:`, error);
      throw error;
    }
  }

  /**
   * Filtra os ônibus por proximidade geográfica com cache otimizado - APENAS VEÍCULOS EM ROTA
   * @param {number} lat - Latitude do ponto central
   * @param {number} lon - Longitude do ponto central
   * @param {number} raioKm - Raio de busca em quilômetros
   * @returns {Promise<Array>} Lista de ônibus em rota dentro do raio especificado
   */
  async getBusByPosition(lat, lon, raioKm = 1) {
    try {
      // Verificar cache específico da posição
      const cacheKey = `position_${lat.toFixed(4)}_${lon.toFixed(4)}_${raioKm}`;
      const cachedData = cacheService.getPosition(cacheKey);
      if (cachedData) {
        logger.info(`Retornando dados da posição do cache`);
        return cachedData;
      }

      // Obter todos os dados (com cache)
      const allData = await this.getAllBusData();
      
      // Filtrar ônibus dentro do raio especificado que estão EM ROTA
      const filteredData = allData.filter(bus => {
        if (!bus.latitude || !bus.longitude) {
          return false;
        }
        
        const distancia = this.calcularDistancia(lat, lon, bus.latitude, bus.longitude);
        const dentroDoRaio = distancia <= raioKm;
        
        if (!dentroDoRaio) return false;
        
        // FILTRO PRINCIPAL: Apenas veículos em rota
        // 1. Velocidade > 0 (em movimento)
        // 2. OU dados muito recentes (últimos 5 minutos)
        const agora = new Date();
        const dataHoraBus = new Date(bus.dataHora);
        const diferencaMinutos = (agora - dataHoraBus) / (1000 * 60);
        
        const emMovimento = parseFloat(bus.velocidade) > 0;
        const dadosRecentes = diferencaMinutos <= 5; // Últimos 5 minutos
        
        return emMovimento || dadosRecentes;
      });

      // Armazenar no cache específico da posição
      cacheService.setPosition(cacheKey, filteredData, 120); // 2 minutos
      
      logger.info(`Filtrados ${filteredData.length} ônibus EM ROTA em um raio de ${raioKm}km`);
      return filteredData;
      
    } catch (error) {
      logger.error('Erro ao filtrar ônibus por posição:', error);
      throw error;
    }
  }

  /**
   * OTIMIZAÇÃO CRÍTICA: Calcula distância com bounding box pré-filtro
   * @param {number} lat1 - Latitude do primeiro ponto
   * @param {number} lon1 - Longitude do primeiro ponto
   * @param {number} lat2 - Latitude do segundo ponto
   * @param {number} lon2 - Longitude do segundo ponto
   * @returns {number} Distância em quilômetros
   */
  calcularDistancia(lat1, lon1, lat2, lon2) {
    // OTIMIZAÇÃO: Bounding box rápido antes de Haversine
    const maxLatDiff = 0.1; // ~11km
    const maxLonDiff = 0.1; // ~11km
    
    if (Math.abs(lat2 - lat1) > maxLatDiff || Math.abs(lon2 - lon1) > maxLonDiff) {
      return Infinity; // Muito longe, pular Haversine
    }
    
    // Haversine otimizado
    const R = 6371;
    const dLat = (lat2 - lat1) * 0.017453292519943295; // deg2rad inline
    const dLon = (lon2 - lon1) * 0.017453292519943295;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * 0.017453292519943295) * Math.cos(lat2 * 0.017453292519943295) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  /**
   * Obtém estatísticas dos dados atuais
   * @returns {Promise<Object>} Estatísticas dos dados
   */
  async getStats() {
    try {
      const data = await this.getAllBusData();
      
      const stats = {
        total: data.length,
        byLine: {},
        avgSpeed: 0,
        lastUpdate: null
      };

      if (data.length > 0) {
        // Estatísticas por linha
        data.forEach(bus => {
          const linha = bus.linha || 'Desconhecida';
          stats.byLine[linha] = (stats.byLine[linha] || 0) + 1;
        });

        // Velocidade média
        const totalSpeed = data.reduce((sum, bus) => sum + (bus.velocidade || 0), 0);
        stats.avgSpeed = parseFloat((totalSpeed / data.length).toFixed(2));

        // Última atualização
        const timestamps = data.map(bus => new Date(bus.dataHora).getTime());
        stats.lastUpdate = new Date(Math.max(...timestamps)).toISOString();
      }

      return stats;
    } catch (error) {
      logger.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  /**
   * OTIMIZAÇÃO CRÍTICA: Atualiza índice por linha para lookup O(1)
   */
  updateLineIndex(buses) {
    this.lineIndex.clear();
    
    for (const bus of buses) {
      const linha = bus.linha?.toString().trim().toLowerCase() || 'unknown';
      
      if (!this.lineIndex.has(linha)) {
        this.lineIndex.set(linha, []);
      }
      this.lineIndex.get(linha).push(bus);
    }
    
    this.lastIndexUpdate = Date.now();
    logger.info(`Índice atualizado: ${this.lineIndex.size} linhas indexadas`);
  }

  /**
   * Limpa caches relacionados aos dados SPPO
   */
  clearCaches() {
    cacheService.deleteGeneral(this.cacheKey);
    cacheService.deleteGeneral(`${this.cacheKey}_stale`);
    this.lineIndex.clear();
    logger.info('Caches SPPO limpos');
  }
}

export default new SppoService();