# 🚌 SMTR Rio - Monitoramento de Ônibus

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/smtr-rio/monitoramento)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Uma aplicação moderna e de alta performance para monitoramento em tempo real dos ônibus do SPPO (Sistema de Planejamento e Operação) do Rio de Janeiro.

## ✨ Características

### 🚀 Performance Otimizada
- **Cache inteligente** com TTL configurável
- **Rate limiting** para proteção da API
- **Compressão gzip** para redução de tráfego
- **Service Worker** para cache offline
- **Lazy loading** de recursos

### 🛡️ Segurança
- **Helmet.js** para headers de segurança
- **CORS** configurável
- **Validação de entrada** com Joi
- **Sanitização** de dados
- **Rate limiting** por IP

### 📱 Interface Moderna
- **Design responsivo** para todos os dispositivos
- **Tema escuro/claro** automático
- **Mapa interativo** com Leaflet
- **Tabela dinâmica** com busca e filtros
- **Exportação de dados** em CSV
- **Atualização automática** dos dados

### 🔧 Tecnologias

#### Backend
- **Node.js 18+** com ES6+ modules
- **Express.js** com middleware otimizado
- **Winston** para logging estruturado
- **Node-cache** para cache em memória
- **Swagger** para documentação da API
- **Joi** para validação de dados

#### Frontend
- **JavaScript ES6+** com classes
- **Leaflet** para mapas interativos
- **CSS Grid/Flexbox** para layout responsivo
- **Service Worker** para cache offline
- **Web APIs** modernas

## 🚀 Instalação

### Pré-requisitos
- Node.js 18.0.0 ou superior
- npm 8.0.0 ou superior

### Instalação Local

1. **Clone o repositório**
   ```bash
   git clone https://github.com/smtr-rio/monitoramento.git
   cd monitoramento
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas configurações
   ```

4. **Execute a aplicação**
   ```bash
   # Modo desenvolvimento
   npm run dev
   
   # Modo produção
   npm start
   ```

5. **Acesse a aplicação**
   - Interface web: http://localhost:3000
   - Documentação da API: http://localhost:3000/api-docs

## 📖 Uso da API

### Endpoints Principais

#### Obter todos os ônibus
```http
GET /api/sppo
```

#### Filtrar por linha
```http
GET /api/sppo/linha/{linha}
```

#### Filtrar por posição geográfica
```http
GET /api/sppo/posicao?lat={latitude}&lon={longitude}&raio={raio}
```

#### Obter estatísticas
```http
GET /api/sppo/stats
```

#### Health check
```http
GET /health
```

### Exemplos de Uso

#### JavaScript
```javascript
// Buscar todos os ônibus
const response = await fetch('/api/sppo');
const data = await response.json();

// Buscar ônibus da linha 415
const lineResponse = await fetch('/api/sppo/linha/415');
const lineData = await lineResponse.json();

// Buscar ônibus próximos
const positionResponse = await fetch('/api/sppo/posicao?lat=-22.9068&lon=-43.1729&raio=1');
const positionData = await positionResponse.json();
```

#### cURL
```bash
# Buscar todos os ônibus
curl http://localhost:3000/api/sppo

# Buscar ônibus da linha 415
curl http://localhost:3000/api/sppo/linha/415

# Buscar ônibus próximos
curl "http://localhost:3000/api/sppo/posicao?lat=-22.9068&lon=-43.1729&raio=1"
```

## 🔧 Configuração

### Variáveis de Ambiente

```env
# Servidor
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# CORS
ALLOWED_ORIGINS=*

# Cache
CACHE_TTL=300
CACHE_MAX_KEYS=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Log
LOG_LEVEL=info
LOG_FILE=logs/app.log

# API SPPO
SPPO_API_URL=https://dados.mobilidade.rio/gps/sppo
SPPO_TIMEOUT=30000
SPPO_RETRY_ATTEMPTS=3
```

### Configurações de Cache

- **Cache geral**: 5 minutos (300 segundos)
- **Cache por linha**: 3 minutos (180 segundos)
- **Cache por posição**: 2 minutos (120 segundos)

### Rate Limiting

- **Limite**: 1000 requisições por IP
- **Janela**: 15 minutos
- **Headers**: Inclui informações de limite

## 📊 Monitoramento

### Logs
- **Console**: Logs coloridos em desenvolvimento
- **Arquivo**: Logs estruturados em produção
- **Níveis**: error, warn, info, debug

### Métricas
- **Performance**: Tempo de resposta das requisições
- **Cache**: Hit/miss ratio dos caches
- **Erros**: Contagem e detalhes dos erros
- **Uso**: Estatísticas de uso da API

### Health Check
```http
GET /health
```

Resposta:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "2.0.0"
}
```

## 🧪 Testes

```bash
# Executar testes
npm test

# Executar testes com coverage
npm run test:coverage

# Executar linting
npm run lint

# Corrigir problemas de linting
npm run lint:fix
```

## 🚀 Deploy

### Docker
```bash
# Build da imagem
docker build -t smtr-rio .

# Executar container
docker run -p 3000:3000 smtr-rio
```

### PM2
```bash
# Instalar PM2
npm install -g pm2

# Executar com PM2
pm2 start src/server.js --name smtr-rio

# Monitorar
pm2 monit
```

### Heroku
```bash
# Deploy para Heroku
git push heroku main
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- **Prefeitura do Rio de Janeiro** por disponibilizar os dados do SPPO
- **OpenStreetMap** pelos tiles do mapa
- **Leaflet** pela biblioteca de mapas
- **Comunidade Node.js** pelas ferramentas e bibliotecas

## 📞 Suporte

- **Email**: suporte@smtr-rio.gov.br
- **Issues**: [GitHub Issues](https://github.com/smtr-rio/monitoramento/issues)
- **Documentação**: [Wiki](https://github.com/smtr-rio/monitoramento/wiki)

## 🔄 Changelog

### v2.0.0 (2025-10-19)
- ✨ Interface completamente redesenhada
- 🚀 Performance otimizada com cache inteligente
- 🛡️ Segurança aprimorada
- 📱 Design responsivo
- 🔧 Tecnologias modernas (ES6+, Node.js 18+)

### v1.0.0 (2023-10-18)
- 🎉 Lançamento inicial
- 🗺️ Mapa básico com Leaflet
- 📊 Tabela de dados
- 🔍 Filtros básicos

---

**Desenvolvido com ❤️ por Janaina Citeli**
