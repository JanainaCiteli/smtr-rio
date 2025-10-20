import express from 'express';
import sppoController from '../controllers/sppoController.js';
import { validateParams, validateQuery } from '../middleware/errorMiddleware.js';
import Joi from 'joi';

const router = express.Router();

// Schema de validação para parâmetros de linha
const linhaSchema = Joi.object({
  linha: Joi.string().min(1).max(20).required()
});

// Schema de validação para parâmetros de posição
const positionSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required(),
  raio: Joi.number().min(0.1).max(50).default(1)
});

/**
 * @swagger
 * tags:
 *   name: SPPO
 *   description: API para consulta de dados de GPS do SPPO do Rio de Janeiro
 */

// Rota para obter todos os ônibus
router.get('/', sppoController.getAllBuses);

// Rota para obter estatísticas
router.get('/stats', sppoController.getStats);

// Rota para filtrar por linha
router.get('/linha/:linha', 
  validateParams(linhaSchema),
  sppoController.getBusesByLine
);

// Rota para filtrar por posição geográfica
router.get('/posicao', 
  validateQuery(positionSchema),
  sppoController.getBusesByPosition
);

// Rota para limpar cache (apenas para administração)
router.post('/cache/clear', sppoController.clearCache);

export default router;