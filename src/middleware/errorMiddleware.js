import winston from 'winston';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log' })
  ]
});

/**
 * Middleware para tratar erros não capturados
 * @param {Error} err - Erro capturado
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Próxima função middleware
 */
export function errorHandler(err, req, res, next) {
  // Log do erro
  logger.error('Erro capturado:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Se a resposta já foi enviada, delegue para o handler padrão do Express
  if (res.headersSent) {
    return next(err);
  }

  // Determinar status code
  let statusCode = err.statusCode || err.status || 500;
  
  // Tratar tipos específicos de erro
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
  }

  // Resposta de erro padronizada
  const errorResponse = {
    error: {
      message: err.message || 'Erro interno do servidor',
      status: statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    }
  };

  // Em desenvolvimento, incluir stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Enviar resposta
  res.status(statusCode).json(errorResponse);
}

/**
 * Middleware para tratar rotas não encontradas
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Próxima função middleware
 */
export function notFoundHandler(req, res, next) {
  const error = new Error(`Rota não encontrada: ${req.method} ${req.url}`);
  error.status = 404;
  error.name = 'NotFoundError';
  
  logger.warn('Rota não encontrada:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next(error);
}

/**
 * Middleware para validação de entrada
 * @param {Object} schema - Schema de validação Joi
 * @returns {Function} Middleware de validação
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const validationError = new Error(`Dados de entrada inválidos: ${error.details.map(d => d.message).join(', ')}`);
      validationError.status = 400;
      validationError.name = 'ValidationError';
      return next(validationError);
    }
    
    next();
  };
}

/**
 * Middleware para validação de query parameters
 * @param {Object} schema - Schema de validação Joi
 * @returns {Function} Middleware de validação
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const validationError = new Error(`Parâmetros de query inválidos: ${error.details.map(d => d.message).join(', ')}`);
      validationError.status = 400;
      validationError.name = 'ValidationError';
      return next(validationError);
    }
    
    next();
  };
}

/**
 * Middleware para validação de parâmetros de rota
 * @param {Object} schema - Schema de validação Joi
 * @returns {Function} Middleware de validação
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      const validationError = new Error(`Parâmetros de rota inválidos: ${error.details.map(d => d.message).join(', ')}`);
      validationError.status = 400;
      validationError.name = 'ValidationError';
      return next(validationError);
    }
    
    next();
  };
}
