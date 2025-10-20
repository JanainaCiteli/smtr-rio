/**
 * SMTR Rio - Aplicação de Monitoramento de Ônibus
 * Versão 2.0 - Modernizada com ES6+ e otimizações de performance
 */

class BusMonitorApp {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.markerCluster = null;
        this.busData = [];
        this.filteredData = [];
        this.isLoading = false;
        this.lastUpdateTime = null;
        this.autoRefreshInterval = null;
        this.refreshInterval = 60000; // 1 minuto
        
        // OTIMIZAÇÃO: Propriedades para Virtual Scrolling
        this.currentBuses = [];
        this.currentPage = 0;
        this.itemsPerPage = 50;
        this.scrollListener = null;
        
        this.init();
    }

    /**
     * Inicializa a aplicação
     */
    async init() {
        try {
            this.setupEventListeners();
            await this.initMap();
            // CORRIGIDO: Carregar dados iniciais para mostrar interface
            await this.loadInitialData();
            // COMENTADO: Não iniciar refresh automático
            // this.startAutoRefresh();
            
            console.log('🚀 Aplicação inicializada com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar aplicação:', error);
            this.showError('Erro ao inicializar a aplicação. Recarregue a página.');
            // Mostrar interface mesmo com erro
            this.updateTable([]);
            this.updateStats();
        }
    }

    /**
     * Configura os event listeners
     */
    setupEventListeners() {
        // Botões de busca
        document.getElementById('searchByLine')?.addEventListener('click', () => this.searchByLine());
        document.getElementById('searchByPosition')?.addEventListener('click', () => this.searchByPosition());
        document.getElementById('showAll')?.addEventListener('click', () => this.showAllBuses());
        document.getElementById('clearFilters')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('refreshData')?.addEventListener('click', () => this.refreshData());

        // Busca por linha - Enter key
        document.getElementById('lineInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchByLine();
        });

        // Busca por posição - Enter key
        document.getElementById('latInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchByPosition();
        });
        document.getElementById('lonInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchByPosition();
        });

        // Controles do mapa
        document.getElementById('centerMap')?.addEventListener('click', () => this.centerMap());
        document.getElementById('toggleMap')?.addEventListener('click', () => this.toggleMap());

        // Busca na tabela - OTIMIZADO com debouncing
        document.getElementById('tableSearch')?.addEventListener('input', 
            this.debounce((e) => this.filterTable(e.target.value), 300)
        );

        // Exportar dados
        document.getElementById('exportData')?.addEventListener('click', () => this.exportData());

        // Fechar erro
        document.getElementById('dismissError')?.addEventListener('click', () => this.hideError());

        // Atualizar estatísticas
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateStats();
            }
        });
    }

    /**
     * Inicializa o mapa Leaflet
     */
    async initMap() {
        try {
            // Verificar se o Leaflet está disponível
            if (typeof L === 'undefined') {
                console.warn('⚠️ Leaflet não carregado, mapa será desabilitado');
                return;
            }

            // Coordenadas do Rio de Janeiro
            const rioCenter = [-22.9068, -43.1729];
            
            this.map = L.map('map').setView(rioCenter, 11);
            
            // Adicionar tiles do OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(this.map);

            console.log('🗺️ Mapa inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar mapa:', error);
            // Não falhar a aplicação se o mapa não carregar
            console.warn('⚠️ Continuando sem mapa');
        }
    }

    /**
     * Carrega dados iniciais
     */
    async loadInitialData() {
        try {
            // CORRIGIDO: Reativar loading
            this.showLoading(true);
            await this.fetchAllBuses();
            this.showLoading(false);
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            this.showError('Erro ao carregar dados iniciais. Verifique sua conexão e tente novamente.');
            this.showLoading(false);
            // Mostrar interface mesmo com erro
            this.updateTable([]);
            this.updateStats();
        }
    }

    /**
     * Busca todos os ônibus
     */
    async fetchAllBuses() {
        try {
        const response = await fetch('/api/sppo');
        if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.busData = result.data || result;
            this.filteredData = [...this.busData];
            this.lastUpdateTime = new Date();
            
            this.updateMap(this.filteredData);
            this.updateTable(this.filteredData);
            this.updateStats();
            
            console.log(`✅ ${this.busData.length} ônibus carregados`);
        } catch (error) {
            console.error('❌ Erro ao buscar todos os ônibus:', error);
            throw error;
        }
    }

    /**
     * Busca ônibus por linha
     */
    async searchByLine() {
        const lineInput = document.getElementById('lineInput');
        const line = lineInput.value.trim();
        
        if (!line) {
            this.showError('Digite o número da linha para buscar.');
            return;
        }

        try {
            console.log(`🔍 Buscando ônibus da linha ${line}...`);
            const response = await fetch(`/api/sppo/linha/${encodeURIComponent(line)}`);
            
        if (!response.ok) {
                if (response.status === 404) {
                    this.showError(`Nenhum ônibus encontrado para a linha ${line}.`);
                    this.clearFilters();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.filteredData = result.data || result;
            
            this.updateMap(this.filteredData);
            this.updateTable(this.filteredData);
            this.updateStats();
            
            console.log(`✅ ${this.filteredData.length} ônibus EM ROTA encontrados para a linha ${line}`);
        } catch (error) {
            console.error('❌ Erro ao buscar por linha:', error);
            this.showError('Erro ao buscar ônibus por linha. Tente novamente.');
        }
    }

    /**
     * Busca ônibus por posição
     */
    async searchByPosition() {
        const latInput = document.getElementById('latInput');
        const lonInput = document.getElementById('lonInput');
        const radiusInput = document.getElementById('radiusInput');
        
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        const radius = parseFloat(radiusInput.value) || 1;
        
        if (isNaN(lat) || isNaN(lon)) {
            this.showError('Digite coordenadas válidas (latitude e longitude).');
            return;
        }
        
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            this.showError('Coordenadas fora do range válido.');
            return;
        }

        try {
            console.log(`📍 Buscando ônibus próximos à posição (${lat}, ${lon}) com raio de ${radius}km...`);
            const response = await fetch(`/api/sppo/posicao?lat=${lat}&lon=${lon}&raio=${radius}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.showError(`Nenhum ônibus encontrado em um raio de ${radius}km da posição.`);
                    this.clearFilters();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.filteredData = result.data || result;
            
            this.updateMap(this.filteredData, { lat, lon });
            this.updateTable(this.filteredData);
            this.updateStats();
            
            console.log(`✅ ${this.filteredData.length} ônibus EM ROTA encontrados na posição`);
    } catch (error) {
            console.error('❌ Erro ao buscar por posição:', error);
            this.showError('Erro ao buscar ônibus por posição. Tente novamente.');
        }
    }

    /**
     * Mostra todos os ônibus
     */
    async showAllBuses() {
        try {
            // Se não há dados carregados, carregar primeiro
            if (!this.busData || this.busData.length === 0) {
                console.log('📡 Carregando dados pela primeira vez...');
                await this.fetchAllBuses();
            } else {
                this.filteredData = [...this.busData];
                this.updateMap(this.filteredData);
                this.updateTable(this.filteredData);
                this.updateStats();
                console.log('✅ Mostrando todos os ônibus EM ROTA');
            }
        } catch (error) {
            console.error('❌ Erro ao mostrar todos os ônibus:', error);
            this.showError('Erro ao mostrar todos os ônibus.');
        }
    }

    /**
     * Limpa todos os filtros
     */
    clearFilters() {
        // Limpar inputs
        document.getElementById('lineInput').value = '';
        document.getElementById('latInput').value = '';
        document.getElementById('lonInput').value = '';
        document.getElementById('radiusInput').value = '1';
        document.getElementById('tableSearch').value = '';
        
        // Mostrar todos os ônibus
        this.showAllBuses();
        console.log('🔄 Filtros limpos');
    }

    /**
     * Atualiza dados
     */
    async refreshData() {
        try {
            console.log('🔄 Atualizando dados...');
            await this.fetchAllBuses();
            console.log('✅ Dados atualizados com sucesso');
    } catch (error) {
            console.error('❌ Erro ao atualizar dados:', error);
            this.showError('Erro ao atualizar dados. Tente novamente.');
        }
    }

    /**
     * Inicia atualização automática
     */
    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // COMENTADO: Não iniciar atualização automática
        // this.autoRefreshInterval = setInterval(() => {
        //     if (!document.hidden && !this.isLoading) {
        //         this.refreshData();
        //     }
        // }, this.refreshInterval);
        
        console.log('⏰ Atualização automática desabilitada - Aguardando ação do usuário');
    }

    /**
     * Para atualização automática
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    /**
     * Atualiza o mapa com os dados dos ônibus - OTIMIZADO com Clustering
     */
    updateMap(buses, centerPoint = null) {
        if (!this.map || typeof L === 'undefined') {
            console.warn('⚠️ Mapa não disponível, pulando atualização');
            return;
        }
        
        try {
    // Limpar marcadores existentes
            this.clearMarkers();
    
    if (buses.length === 0) {
                this.showNoDataMessage();
        return;
    }
    
            // OTIMIZAÇÃO: Usar clustering para muitos marcadores
            if (buses.length > 100) {
                this.updateMapWithClustering(buses);
            } else {
                // Para poucos marcadores, usar método tradicional otimizado
                this.updateMapOptimized(buses);
            }
            
            // Centralizar mapa
            if (centerPoint) {
                this.map.setView([centerPoint.lat, centerPoint.lon], 13);
            } else if (buses.length > 0) {
                const bounds = L.latLngBounds(buses.map(bus => [bus.latitude, bus.longitude]));
                this.map.fitBounds(bounds);
            }
            
            console.log(`🗺️ Mapa atualizado com ${buses.length} ônibus (Clustering: ${buses.length > 100 ? 'Sim' : 'Não'})`);
        } catch (error) {
            console.error('❌ Erro ao atualizar mapa:', error);
        }
    }

    /**
     * Atualização otimizada do mapa para poucos marcadores
     */
    updateMapOptimized(buses) {
        // Usar DocumentFragment para melhor performance
        const markers = [];
        
        buses.forEach(bus => {
            if (bus.latitude && bus.longitude) {
                const marker = this.createBusMarker(bus);
                markers.push(marker);
                this.markers.set(bus.ordem, marker);
            }
        });
        
        // Adicionar todos os marcadores de uma vez
        markers.forEach(marker => marker.addTo(this.map));
    }

    /**
     * Atualização do mapa com clustering para muitos marcadores
     */
    updateMapWithClustering(buses) {
        // Criar grupo de clustering se não existir
        if (!this.markerCluster) {
            this.markerCluster = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true
            });
            this.map.addLayer(this.markerCluster);
        }
        
        // Limpar cluster anterior
        this.markerCluster.clearLayers();
        
        // Adicionar marcadores ao cluster
    buses.forEach(bus => {
            if (bus.latitude && bus.longitude) {
                const marker = this.createBusMarker(bus);
                this.markerCluster.addLayer(marker);
                this.markers.set(bus.ordem, marker);
            }
        });
    }

    /**
     * Cria um marcador para um ônibus
     */
    createBusMarker(bus) {
        const icon = this.createBusIcon();
        const marker = L.marker([bus.latitude, bus.longitude], { icon })
            .bindPopup(this.createBusPopup(bus));
        
        marker.addTo(this.map);
        return marker;
    }

    /**
     * Cria ícone personalizado para ônibus
     */
    createBusIcon() {
        return L.divIcon({
            className: 'bus-marker',
            html: '<div class="bus-icon">🚌</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    /**
     * Cria popup para ônibus
     */
    createBusPopup(bus) {
        return `
                <div class="bus-popup">
                    <div class="bus-popup-line">Linha: ${bus.linha}</div>
                    <div>Ordem: ${bus.ordem}</div>
                    <div>Velocidade: ${bus.velocidade} km/h</div>
                <div>Hora: ${this.formatDateTime(bus.dataHora)}</div>
                </div>
        `;
    }

    /**
     * Limpa todos os marcadores do mapa
     */
    clearMarkers() {
        if (!this.map || typeof L === 'undefined') return;
        
        try {
            this.markers.forEach(marker => {
                if (marker && marker.remove) {
                    marker.remove();
                }
            });
            this.markers.clear();
        } catch (error) {
            console.error('❌ Erro ao limpar marcadores:', error);
        }
    }

    /**
     * Centraliza o mapa
     */
    centerMap() {
        if (this.filteredData.length > 0) {
            const bounds = L.latLngBounds(this.filteredData.map(bus => [bus.latitude, bus.longitude]));
            this.map.fitBounds(bounds);
        } else {
            this.map.setView([-22.9068, -43.1729], 11);
        }
    }

    /**
     * Alterna visibilidade do mapa
     */
    toggleMap() {
        const mapContainer = document.getElementById('map');
        const toggleBtn = document.getElementById('toggleMap');
        
        if (mapContainer.style.display === 'none') {
            mapContainer.style.display = 'block';
            toggleBtn.innerHTML = '<span class="btn-icon">👁️</span> Ocultar';
        } else {
            mapContainer.style.display = 'none';
            toggleBtn.innerHTML = '<span class="btn-icon">👁️</span> Mostrar';
        }
    }

    /**
     * Atualiza a tabela com os dados dos ônibus - OTIMIZADO com Virtual Scrolling
     */
    updateTable(buses) {
        const tbody = document.querySelector('#busTable tbody');
        const noDataMessage = document.getElementById('noDataMessage');
        
        if (!tbody) return;
        
        // Limpar tabela
        tbody.innerHTML = '';
    
    if (buses.length === 0) {
            noDataMessage.classList.remove('hidden');
        return;
    }
    
        noDataMessage.classList.add('hidden');
        
        // OTIMIZAÇÃO: Virtual Scrolling - renderizar apenas 50 itens por vez
        this.currentBuses = buses;
        this.currentPage = 0;
        this.itemsPerPage = 50;
        this.renderTablePage();
        
        // Adicionar scroll listener para lazy loading
        this.setupVirtualScroll();
        
        console.log(`📊 Tabela atualizada com ${buses.length} ônibus (Virtual Scrolling ativo)`);
    }

    /**
     * Renderiza uma página da tabela (Virtual Scrolling)
     */
    renderTablePage() {
        const tbody = document.querySelector('#busTable tbody');
        if (!tbody || !this.currentBuses) return;
        
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.currentBuses.length);
        
        // Usar DocumentFragment para melhor performance
        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i < endIndex; i++) {
            const bus = this.currentBuses[i];
            const row = document.createElement('tr');
            
            // OTIMIZAÇÃO: Usar textContent em vez de innerHTML quando possível
            const linhaCell = document.createElement('td');
            linhaCell.className = 'font-semibold';
            linhaCell.textContent = bus.linha;
            
            const ordemCell = document.createElement('td');
            ordemCell.textContent = bus.ordem;
            
            const velocidadeCell = document.createElement('td');
            velocidadeCell.textContent = `${bus.velocidade} km/h`;
            
            const latCell = document.createElement('td');
            latCell.className = 'text-sm';
            latCell.textContent = parseFloat(bus.latitude).toFixed(6);
            
            const lonCell = document.createElement('td');
            lonCell.className = 'text-sm';
            lonCell.textContent = parseFloat(bus.longitude).toFixed(6);
            
            const horaCell = document.createElement('td');
            horaCell.className = 'text-sm';
            horaCell.textContent = this.formatDateTime(bus.dataHora);
            
            row.appendChild(linhaCell);
            row.appendChild(ordemCell);
            row.appendChild(velocidadeCell);
            row.appendChild(latCell);
            row.appendChild(lonCell);
            row.appendChild(horaCell);
            
            fragment.appendChild(row);
        }
        
        tbody.appendChild(fragment);
    }

    /**
     * Configura virtual scrolling para lazy loading
     */
    setupVirtualScroll() {
        const tableContainer = document.querySelector('.table-container');
        if (!tableContainer) return;
        
        // Remover listener anterior se existir
        if (this.scrollListener) {
            tableContainer.removeEventListener('scroll', this.scrollListener);
        }
        
        this.scrollListener = this.throttle(() => {
            const { scrollTop, scrollHeight, clientHeight } = tableContainer;
            const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
            
            // Carregar próxima página quando chegar a 80% do scroll
            if (scrollPercentage > 0.8 && this.currentPage * this.itemsPerPage < this.currentBuses.length) {
                this.currentPage++;
                this.renderTablePage();
            }
        }, 100);
        
        tableContainer.addEventListener('scroll', this.scrollListener);
    }

    /**
     * Filtra a tabela por texto
     */
    filterTable(searchText) {
        const rows = document.querySelectorAll('#busTable tbody tr');
        const searchLower = searchText.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchLower) ? '' : 'none';
        });
    }

    /**
     * Atualiza estatísticas
     */
    updateStats() {
        const totalBuses = this.filteredData.length;
        const avgSpeed = totalBuses > 0 
            ? (this.filteredData.reduce((sum, bus) => sum + parseFloat(bus.velocidade), 0) / totalBuses).toFixed(2)
            : 0;
        
        document.getElementById('totalBuses').textContent = totalBuses;
        document.getElementById('avgSpeed').textContent = avgSpeed;
        document.getElementById('lastUpdate').textContent = this.lastUpdateTime 
            ? this.formatDateTime(this.lastUpdateTime.toISOString())
            : '-';
    }

    /**
     * Exporta dados para CSV
     */
    exportData() {
        if (this.filteredData.length === 0) {
            this.showError('Nenhum dado para exportar.');
            return;
        }
        
        try {
            const csv = this.convertToCSV(this.filteredData);
            this.downloadCSV(csv, `onibus_sppo_${new Date().toISOString().split('T')[0]}.csv`);
            console.log('📥 Dados exportados para CSV');
        } catch (error) {
            console.error('❌ Erro ao exportar dados:', error);
            this.showError('Erro ao exportar dados.');
        }
    }

    /**
     * Converte dados para CSV
     */
    convertToCSV(data) {
        const headers = ['Linha', 'Ordem', 'Velocidade', 'Latitude', 'Longitude', 'DataHora'];
        const rows = data.map(bus => [
            bus.linha,
            bus.ordem,
            bus.velocidade,
            bus.latitude,
            bus.longitude,
            bus.dataHora
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Faz download do CSV
     */
    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Formata data e hora
     */
    formatDateTime(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Mostra indicador de carregamento - CORRIGIDO
     */
    showLoading(show) {
        this.isLoading = show;
        const indicator = document.getElementById('loadingIndicator');
        
        // CORREÇÃO: Verificar se elemento existe antes de usar
        if (indicator) {
            if (show) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        } else {
            // Elemento não existe, criar um indicador simples no console
            if (show) {
                console.log('🔄 Carregando dados...');
            } else {
                console.log('✅ Carregamento concluído');
            }
        }
    }

    /**
     * Mostra mensagem de erro
     */
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        const errorText = errorElement.querySelector('.error-text');
        
        errorText.textContent = message;
        errorElement.classList.remove('hidden');
        
        // Auto-hide após 5 segundos
        setTimeout(() => this.hideError(), 5000);
    }

    /**
     * Esconde mensagem de erro
     */
    hideError() {
        const errorElement = document.getElementById('errorMessage');
        errorElement.classList.add('hidden');
    }

    /**
     * Mostra mensagem de nenhum dado
     */
    showNoDataMessage() {
        const noDataMessage = document.getElementById('noDataMessage');
        noDataMessage.classList.remove('hidden');
    }

    /**
     * OTIMIZAÇÃO: Função de debounce para reduzir chamadas excessivas
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * OTIMIZAÇÃO: Função de throttle para limitar frequência de execução
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.busMonitorApp = new BusMonitorApp();
});

// Cleanup quando a página for fechada
window.addEventListener('beforeunload', () => {
    if (window.busMonitorApp) {
        window.busMonitorApp.stopAutoRefresh();
    }
});

// OTIMIZAÇÃO: CSS movido para arquivo estático (style.css)
// Removido CSS inline para melhor performance