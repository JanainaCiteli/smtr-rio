const express = require('express');
const cors = require('cors');
const path = require('path');
const sppoRoutes = require('./routes/sppoRoutes');

// Inicializa o app Express
const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/sppo', sppoRoutes);

// Rota raiz para a interface web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para documentação da API
app.get('/api', (req, res) => {
  res.json({
    message: 'API de consulta aos dados de GPS do SPPO do Rio de Janeiro',
    endpoints: {
      todos: '/api/sppo',
      filtrarPorLinha: '/api/sppo/linha/:linha',
      filtrarPorPosicao: '/api/sppo/posicao?lat=XX.XXXXX&lon=XX.XXXXX&raio=X'
    }
  });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

module.exports = app;