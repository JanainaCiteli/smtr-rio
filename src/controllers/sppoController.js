import Joi from 'joi';
import winston from 'winston';
import sppoService from '../services/sppoService.js';

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
 * Controlador modernizado para gerenciar as requisições relacionadas aos dados de GPS do SPPO
 */
class SppoController {
  /**
   * @swagger
   * /api/sppo:
   *   get:
   *     summary: Obtém todos os dados de GPS dos ônibus
   *     tags: [SPPO]
   *     responses:
   *       200:
   *         description: Lista de todos os ônibus com dados de GPS
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   ordem:
   *                     type: string
   *                     description: Número de ordem do ônibus
   *                   latitude:
   *                     type: number
   *                     description: Latitude da posição do ônibus
   *                   longitude:
   *                     type: number
   *                     description: Longitude da posição do ônibus
   *                   velocidade:
   *                     type: number
   *                     description: Velocidade do ônibus em km/h
   *                   linha:
   *                     type: string
   *                     description: Número da linha do ônibus
   *                   dataHora:
   *                     type: string
   *                     format: date-time
   *                     description: Data e hora da última atualização
   *       500:
   *         description: Erro interno do servidor
   */
  async getAllBuses(req, res, next) {
    try {
      const startTime = Date.now();
      const data = await sppoService.getAllBusData();
      const duration = Date.now() - startTime;
      
      logger.info(`GET /api/sppo - ${data.length} ônibus em ${duration}ms`);
      
      res.json({
        data,
        meta: {
          total: data.length,
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      });
    } catch (error) {
      logger.error('Erro em getAllBuses:', error);
      next(error);
    }
  }

  /**
   * @swagger
   * /api/sppo/linha/{linha}:
   *   get:
   *     summary: Filtra os ônibus por linha
   *     tags: [SPPO]
   *     parameters:
   *       - in: path
   *         name: linha
   *         required: true
   *         schema:
   *           type: string
   *         description: Número ou código da linha de ônibus
   *     responses:
   *       200:
   *         description: Lista de ônibus da linha especificada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                 meta:
   *                   type: object
   *                   properties:
   *                     linha:
   *                       type: string
   *                     total:
   *                       type: number
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                     duration:
   *                       type: string
   *       400:
   *         description: Parâmetro de linha inválido
   *       404:
   *         description: Nenhum ônibus encontrado para a linha especificada
   *       500:
   *         description: Erro interno do servidor
   */
  async getBusesByLine(req, res, next) {
    try {
      const { linha } = req.params;
      const startTime = Date.now();
      
      // Validação do parâmetro
      const linhaSchema = Joi.string().min(1).max(20).required();
      const { error } = linhaSchema.validate(linha);
      
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Parâmetro de linha inválido',
            details: error.details[0].message,
            status: 400
          }
        });
      }
      
      const data = await sppoService.getBusByLine(linha);
      const duration = Date.now() - startTime;
      
      logger.info(`GET /api/sppo/linha/${linha} - ${data.length} ônibus em ${duration}ms`);
      
      if (data.length === 0) {
        return res.status(404).json({
          error: {
            message: `Nenhum ônibus encontrado para a linha ${linha}`,
            status: 404
          }
        });
      }
      
      res.json({
        data,
        meta: {
          linha,
          total: data.length,
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      });
    } catch (error) {
      logger.error(`Erro em getBusesByLine para linha ${req.params.linha}:`, error);
      next(error);
    }
  }

  /**
   * @swagger
   * /api/sppo/posicao:
   *   get:
   *     summary: Filtra os ônibus por proximidade geográfica
   *     tags: [SPPO]
   *     parameters:
   *       - in: query
   *         name: lat
   *         required: true
   *         schema:
   *           type: number
   *           minimum: -90
   *           maximum: 90
   *         description: Latitude do ponto central
   *       - in: query
   *         name: lon
   *         required: true
   *         schema:
   *           type: number
   *           minimum: -180
   *           maximum: 180
   *         description: Longitude do ponto central
   *       - in: query
   *         name: raio
   *         required: false
   *         schema:
   *           type: number
   *           minimum: 0.1
   *           maximum: 50
   *           default: 1
   *         description: Raio de busca em quilômetros
   *     responses:
   *       200:
   *         description: Lista de ônibus dentro do raio especificado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                 meta:
   *                   type: object
   *                   properties:
   *                     lat:
   *                       type: number
   *                     lon:
   *                       type: number
   *                     raio:
   *                       type: number
   *                     total:
   *                       type: number
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                     duration:
   *                       type: string
   *       400:
   *         description: Parâmetros de posição inválidos
   *       404:
   *         description: Nenhum ônibus encontrado na área especificada
   *       500:
   *         description: Erro interno do servidor
   */
  async getBusesByPosition(req, res, next) {
    try {
      const { lat, lon, raio } = req.query;
      const startTime = Date.now();
      
      // Validação dos parâmetros
      const positionSchema = Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lon: Joi.number().min(-180).max(180).required(),
        raio: Joi.number().min(0.1).max(50).default(1)
      });
      
      const { error, value } = positionSchema.validate({
        lat: parseFloat(lat?.replace(',', '.')),
        lon: parseFloat(lon?.replace(',', '.')),
        raio: parseFloat(raio)
      });
      
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Parâmetros de posição inválidos',
            details: error.details[0].message,
            status: 400
          }
        });
      }
      
      const data = await sppoService.getBusByPosition(value.lat, value.lon, value.raio);
      const duration = Date.now() - startTime;
      
      logger.info(`GET /api/sppo/posicao - ${data.length} ônibus em ${duration}ms`);
      
      if (data.length === 0) {
        return res.status(404).json({
          error: {
            message: `Nenhum ônibus encontrado em um raio de ${value.raio}km da posição (${value.lat}, ${value.lon})`,
            status: 404
          }
        });
      }
      
      res.json({
        data,
        meta: {
          lat: value.lat,
          lon: value.lon,
          raio: value.raio,
          total: data.length,
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      });
    } catch (error) {
      logger.error('Erro em getBusesByPosition:', error);
      next(error);
    }
  }

  /**
   * @swagger
   * /api/sppo/stats:
   *   get:
   *     summary: Obtém estatísticas dos dados de GPS
   *     tags: [SPPO]
   *     responses:
   *       200:
   *         description: Estatísticas dos dados de GPS
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                     byLine:
   *                       type: object
   *                     avgSpeed:
   *                       type: number
   *                     lastUpdate:
   *                       type: string
   *                       format: date-time
   *                 meta:
   *                   type: object
   *       500:
   *         description: Erro interno do servidor
   */
  async getStats(req, res, next) {
    try {
      const startTime = Date.now();
      const stats = await sppoService.getStats();
      const duration = Date.now() - startTime;
      
      logger.info(`GET /api/sppo/stats - estatísticas obtidas em ${duration}ms`);
      
      res.json({
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      });
    } catch (error) {
      logger.error('Erro em getStats:', error);
      next(error);
    }
  }

  /**
   * @swagger
   * /api/sppo/cache/clear:
   *   post:
   *     summary: Limpa os caches da API
   *     tags: [SPPO]
   *     responses:
   *       200:
   *         description: Caches limpos com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *       500:
   *         description: Erro interno do servidor
   */
  async clearCache(req, res, next) {
    try {
      sppoService.clearCaches();
      
      logger.info('Caches SPPO limpos via API');
      
      res.json({
        message: 'Caches limpos com sucesso',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Erro ao limpar caches:', error);
      next(error);
    }
  }
}

export default new SppoController();