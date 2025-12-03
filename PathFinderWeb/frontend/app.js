// PathFinder Web Dashboard - JavaScript

const API_URL = 'http://localhost:5001/api';
let currentUser = null;
let authToken = null;
let isAdmin = false;
let selectedUserId = null;

// ========== GESTION AUTOMATIQUE DES TOKENS ==========

async function apiCallWithRetry(url, options = {}) {
    /**
     * Effectue un appel API avec gestion automatique de l'expiration du token.
     * En cas de token expiré, tente de rafraîchir le token et refait l'appel.
     */
    try {
        const response = await fetch(url, options);
        
        // Si le token est expiré
        if (response.status === 401) {
            const data = await response.json();
            if (data.message && (data.message.includes('expiré') || data.message.includes('expired'))) {
                // Tenter de rafraîchir le token
                const refreshed = await refreshAuthToken();
                
                if (refreshed) {
                    // Refaire l'appel avec le nouveau token
                    if (options.headers) {
                        options.headers['Authorization'] = `Bearer ${authToken}`;
                    }
                    return await fetch(url, options);
                } else {
                    // Impossible de rafraîchir, déconnecter
                    showNotification('Session expirée. Reconnexion requise.', 'error');
                    setTimeout(() => logout(), 2000);
                    throw new Error('Token expired and refresh failed');
                }
            }
        }
        
        return response;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

async function refreshAuthToken() {
    /**
     * Rafraîchit le token JWT auprès du serveur.
     * Retourne true si succès, false sinon.
     */
    try {
        const response = await fetch(`${API_URL}/refresh-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            console.log('✅ Token rafraîchi avec succès');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Erreur refresh token:', error);
        return false;
    }
}

let tokenRefreshInterval = null;

function startTokenAutoRefresh() {
    /**
     * Démarre le rafraîchissement automatique du token.
     * Rafraîchit tous les 6 jours (avant expiration à 7 jours).
     */
    // Arrêter l'ancien interval s'il existe
    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
    }
    
    // Rafraîchir tous les 6 jours (6 * 24 * 60 * 60 * 1000 ms)
    const sixDaysInMs = 6 * 24 * 60 * 60 * 1000;
    
    tokenRefreshInterval = setInterval(async () => {
        console.log('🔄 Auto-refresh du token...');
        const success = await refreshAuthToken();
        if (!success) {
            console.error('❌ Échec du auto-refresh, déconnexion...');
            logout();
        }
    }, sixDaysInMs);
    
    console.log('⏰ Auto-refresh du token activé (tous les 6 jours)');
}

function stopTokenAutoRefresh() {
    /**
     * Arrête le rafraîchissement automatique du token.
     */
    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
        console.log('⏹️ Auto-refresh du token désactivé');
    }
}

// Charts
let scansChart = null;
let osChart = null;

// ========== INITIALISATION ==========

document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si l'utilisateur est déjà connecté
    authToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (authToken && userData) {
        currentUser = JSON.parse(userData);
        // Démarrer l'auto-refresh du token
        startTokenAutoRefresh();
        showDashboard();
    } else {
        showLandingPage();
    }
    
    // Event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Landing Page
    document.getElementById('nav-login-btn').addEventListener('click', showLoginPage);
    document.getElementById('hero-login-btn').addEventListener('click', showLoginPage);
    document.getElementById('hero-register-btn').addEventListener('click', showRegisterPage);
    document.getElementById('cta-login-btn').addEventListener('click', showLoginPage);
    
    // Bouton "Essayer Gratuitement" dans la section Comment Ça Marche
    const ctaDemoBtn = document.querySelector('.cta-demo-btn');
    if (ctaDemoBtn) {
        ctaDemoBtn.addEventListener('click', showRegisterPage);
    }
    
    // Authentification
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterPage();
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Bouton retour au site
    document.getElementById('back-to-site-btn').addEventListener('click', backToLanding);
    
    // Dashboard Navigation
    document.querySelectorAll('.nav-dashboard-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.getAttribute('data-page');
            switchDashboardPage(page);
        });
    });
    
    // Dashboard
    document.getElementById('refresh-btn').addEventListener('click', loadDashboardData);
    
    // Profile Tabs
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchProfileTab(e.currentTarget.getAttribute('data-tab'));
        });
    });
    
    // Profile Forms
    document.getElementById('update-profile-form').addEventListener('submit', handleUpdateProfile);
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    
    // Modal
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('scan-modal').addEventListener('click', (e) => {
        if (e.target.id === 'scan-modal') closeModal();
    });
}

// ========== NAVIGATION ==========

function showLandingPage() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'none';
}

function showLoginPage() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'none';
}

function showRegisterPage() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'flex';
    document.getElementById('dashboard-page').style.display = 'none';
}

function showDashboard() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'block';
    
    // Afficher l'utilisateur
    document.getElementById('user-info').textContent = `👤 ${currentUser.username}`;
    
    // Afficher le badge admin si applicable
    isAdmin = currentUser.role === 'admin';
    if (isAdmin) {
        const badge = document.getElementById('user-role-badge');
        badge.textContent = '👑 ADMIN';
        badge.style.display = 'inline-block';
        
        // Afficher le panneau admin
        document.getElementById('admin-panel').style.display = 'block';
        
        // Charger la liste des utilisateurs
        loadUsersList();
        
        // Event listener pour le sélecteur
        document.getElementById('user-select').addEventListener('change', handleUserChange);
    }
    
    // Charger les données
    loadDashboardData();
    
    // Afficher la vue Scans par défaut
    switchDashboardPage('scans');
}

// ========== NAVIGATION DASHBOARD ==========

function switchDashboardPage(page) {
    // Cacher toutes les vues
    document.getElementById('guide-view').style.display = 'none';
    document.getElementById('scans-view').style.display = 'none';
    document.getElementById('tickets-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'none';
    
    // Afficher la vue demandée
    if (page === 'guide') {
        document.getElementById('guide-view').style.display = 'block';
        setupInstallationTabs();
    } else if (page === 'scans') {
        document.getElementById('scans-view').style.display = 'block';
        loadDashboardData();
    } else if (page === 'tickets') {
        document.getElementById('tickets-view').style.display = 'block';
        loadTickets();
    } else if (page === 'profile') {
        document.getElementById('profile-view').style.display = 'block';
        loadProfileData();
    }
    
    // Mettre à jour les liens actifs
    document.querySelectorAll('.nav-dashboard-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === page) {
            link.classList.add('active');
        }
    });
}

function setupInstallationTabs() {
    document.querySelectorAll('.install-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const os = tab.getAttribute('data-os');
            
            // Désactiver tous
            document.querySelectorAll('.install-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.install-instructions').forEach(i => i.classList.remove('active'));
            
            // Activer le bon
            tab.classList.add('active');
            document.getElementById(`install-${os}`).classList.add('active');
        });
    });
}

function switchProfileTab(tab) {
    // Désactiver tous les tabs
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
    
    // Activer le tab demandé
    document.querySelector(`.profile-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    // Charger les données spécifiques
    if (tab === 'activity') {
        loadActivityLogs();
    }
}

function handleUserChange(e) {
    selectedUserId = e.target.value ? parseInt(e.target.value) : null;
    loadDashboardData();
}

async function loadUsersList() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const select = document.getElementById('user-select');
        
        // Ajouter les utilisateurs au select
        data.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.email}) - ${user.total_scans} scans`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Erreur chargement users:', error);
    }
}

// ========== AUTHENTIFICATION ==========

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userData', JSON.stringify(currentUser));
            
            // Démarrer l'auto-refresh du token
            startTokenAutoRefresh();
            
            notify.success(`Bienvenue ${currentUser.username} ! 🎉`);
            showDashboard();
        } else {
            showError('login-error', data.message || 'Erreur de connexion');
            notify.error(data.message || 'Erreur de connexion');
        }
    } catch (error) {
        showError('login-error', 'Impossible de se connecter au serveur');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            notify.success('✅ Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
            showLoginPage();
            document.getElementById('login-email').value = email;
        } else {
            showError('register-error', data.message || 'Erreur lors de la création du compte');
            notify.error(data.message || 'Erreur lors de la création du compte');
        }
    } catch (error) {
        showError('register-error', 'Impossible de se connecter au serveur');
    }
}

function handleLogout() {
    // Arrêter l'auto-refresh du token
    stopTokenAutoRefresh();
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    authToken = null;
    currentUser = null;
    notify.info('À bientôt ! 👋');
    showLandingPage();
}

function backToLanding() {
    // Retourner au site sans se déconnecter
    showLandingPage();
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

// ========== DASHBOARD DATA ==========

async function loadDashboardData() {
    try {
        // Charger les statistiques
        await loadStats();
        
        // Charger les scans
        await loadScans();
        
    } catch (error) {
        console.error('Erreur de chargement:', error);
    }
}

async function loadStats() {
    try {
        let url = `${API_URL}/dashboard/stats`;
        if (isAdmin && selectedUserId) {
            url += `?user_id=${selectedUserId}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        
        // Afficher les stats globales
        document.getElementById('total-scans').textContent = data.global_stats.total_scans || 0;
        document.getElementById('total-devices').textContent = data.global_stats.total_devices || 0;
        document.getElementById('total-critical').textContent = data.global_stats.total_critical || 0;
        document.getElementById('total-high-risk').textContent = data.global_stats.total_high_risk || 0;
        
        // Créer le graphique des scans
        createScansChart(data.recent_scans);
        
        // Créer le graphique des OS
        createOsChart(data.os_distribution);
        
    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

async function loadScans() {
    try {
        let url = `${API_URL}/scans`;
        if (isAdmin && selectedUserId) {
            url += `?user_id=${selectedUserId}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        
        displayScansList(data.scans, data.is_admin);
        
    } catch (error) {
        console.error('Erreur scans:', error);
    }
}

// ========== AFFICHAGE ==========

function displayScansList(scans, showAdmin) {
    const listEl = document.getElementById('scans-list');
    
    // Par défaut showAdmin = false si non défini
    if (showAdmin === undefined) showAdmin = false;
    
    if (!scans || scans.length === 0) {
        listEl.innerHTML = '<div class="loading">Aucun scan disponible. Lancez PathFinder pour commencer !</div>';
        return;
    }
    
    listEl.innerHTML = scans.map(scan => {
        const userInfo = showAdmin && scan.user_name ? 
            `<div style="color: var(--warning); font-size: 12px; font-weight: 600; margin-bottom: 8px;">
                👤 ${scan.user_name} (${scan.user_email})
            </div>` : '';
        
        return `
            <div class="scan-item" onclick="viewScanDetails(${scan.id})">
                ${userInfo}
                <div class="scan-item-header">
                    <div class="scan-item-title">🌐 ${scan.network_range}</div>
                    <div class="scan-item-date">${formatDate(scan.scan_date)}</div>
                </div>
                <div class="scan-item-stats">
                    <div class="scan-stat scan-stat-success">
                        ✅ ${scan.alive_hosts} hôtes actifs
                    </div>
                    <div class="scan-stat scan-stat-danger">
                        🔴 ${scan.critical_hosts} critiques
                    </div>
                    <div class="scan-stat scan-stat-warning">
                        🟠 ${scan.high_risk_hosts} risques élevés
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function viewScanDetails(scanId) {
    try {
        // Stocker le scan ID pour téléchargement script
        window.currentScanId = scanId;
        
        const response = await fetch(`${API_URL}/scans/${scanId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        
        displayScanDetails(data.scan);
        
        // Afficher les recommandations de sécurité
        if (data.security_report) {
            displaySecurityRecommendations(data.security_report);
        }
        
    } catch (error) {
        console.error('Erreur détails scan:', error);
    }
}

function displayScanDetails(scan) {
    const detailsEl = document.getElementById('scan-details');
    
    // Stocker les hôtes pour le filtrage
    window.currentScanHosts = scan.hosts || [];
    
    detailsEl.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h3 style="color: var(--primary); margin-bottom: 15px;">📊 Résumé du Scan</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: var(--dark); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: 600;">${scan.total_hosts || 0}</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Total hôtes scannés</div>
                </div>
                <div style="background: var(--dark); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--success);">${scan.alive_hosts || 0}</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Hôtes actifs</div>
                </div>
                <div style="background: var(--dark); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--danger);">${scan.critical_hosts || 0}</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Hôtes critiques</div>
                </div>
                <div style="background: var(--dark); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--warning);">${scan.high_risk_hosts || 0}</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Risques élevés</div>
                </div>
                <div style="background: var(--dark); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--info);">${(scan.hosts || []).reduce((sum, h) => sum + (h.open_ports || []).length, 0)}</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Ports ouverts</div>
                </div>
                <div style="background: var(--dark); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 18px; font-weight: 600; color: var(--text-muted);">${scan.network_range || 'N/A'}</div>
                    <div style="color: var(--text-muted); font-size: 14px;">Plage réseau</div>
                </div>
            </div>
        </div>
        
        <!-- Barre de recherche -->
        <div style="margin-bottom: 20px;">
            <div style="position: relative;">
                <input 
                    type="text" 
                    id="host-search" 
                    placeholder="🔍 Rechercher par IP, hostname, OS, port..." 
                    style="width: 100%; padding: 12px 45px 12px 15px; background: var(--dark); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 14px;"
                    oninput="filterHosts(this.value)"
                />
                <div id="search-count" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;"></div>
            </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="color: var(--primary); margin: 0;">🖥️ Hôtes Détectés</h3>
            <div style="display: flex; gap: 10px;">
                <button onclick="filterByRisk('all')" class="filter-btn active" data-filter="all">Tous (${(scan.hosts || []).length})</button>
                <button onclick="filterByRisk('critical')" class="filter-btn" data-filter="critical">🔴 Critiques (${(scan.hosts || []).filter(h => (h.risk_level || '').toLowerCase() === 'critical').length})</button>
                <button onclick="filterByRisk('high')" class="filter-btn" data-filter="high">🟠 Élevés (${(scan.hosts || []).filter(h => (h.risk_level || '').toLowerCase() === 'high').length})</button>
                <button onclick="filterByRisk('medium')" class="filter-btn" data-filter="medium">🟡 Moyens (${(scan.hosts || []).filter(h => (h.risk_level || '').toLowerCase() === 'medium').length})</button>
            </div>
        </div>
        
        <div id="hosts-container"></div>
        
        <div id="security-recommendations" style="margin-top: 30px;"></div>
    `;
    
    // Afficher les hôtes initialement
    renderHosts(window.currentScanHosts);
    
    document.getElementById('scan-modal').style.display = 'flex';
}

function renderHosts(hosts, filterText = '', riskFilter = 'all') {
    const container = document.getElementById('hosts-container');
    const searchCount = document.getElementById('search-count');
    
    if (!hosts || hosts.length === 0) {
        container.innerHTML = '<div class="loading">Aucun hôte détecté</div>';
        if (searchCount) searchCount.textContent = '';
        return;
    }
    
    // Filtrage
    let filteredHosts = hosts;
    
    // Filtre par risque (case-insensitive pour gérer CRITICAL vs critical)
    if (riskFilter !== 'all') {
        filteredHosts = filteredHosts.filter(h => {
            const hostRisk = (h.risk_level || '').toLowerCase();
            return hostRisk === riskFilter.toLowerCase();
        });
    }
    
    // Filtre par texte
    if (filterText) {
        const search = filterText.toLowerCase();
        filteredHosts = filteredHosts.filter(host => {
            const ip = (host.ip_address || '').toLowerCase();
            const hostname = (host.hostname || '').toLowerCase();
            const os = (host.os_detected || '').toLowerCase();
            const ports = (host.open_ports || []).map(p => String(p)).join(' ');
            
            return ip.includes(search) || hostname.includes(search) || 
                   os.includes(search) || ports.includes(search);
        });
    }
    
    // Afficher compteur
    if (searchCount) {
        searchCount.textContent = `${filteredHosts.length} / ${hosts.length}`;
    }
    
    console.log(`Filtrage: ${filteredHosts.length} hôtes affichés (risque: ${riskFilter}, recherche: "${filterText}")`);
    if (filteredHosts.length === 0 && hosts.length > 0) {
        console.warn('Aucun hôte ne correspond aux filtres. Vérifier les risk_level:', hosts.map(h => h.risk_level));
    }
    
    // Message si aucun résultat
    if (filteredHosts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div style="font-size: 48px; margin-bottom: 15px;">🔍</div>
                <div style="font-size: 16px; margin-bottom: 8px;">Aucun hôte ne correspond aux critères</div>
                <div style="font-size: 14px;">Essayez de modifier le filtre ou la recherche</div>
            </div>
        `;
        return;
    }
    
    // Rendu HTML
    const hostsHtml = filteredHosts.map(host => {
        const riskClass = `risk-${(host.risk_level || 'info').toLowerCase()}`;
        const openPorts = host.open_ports || [];
        const riskColors = {
            'critical': 'var(--danger)',
            'high': 'var(--warning)',
            'medium': 'var(--info)',
            'low': 'var(--success)',
            'info': 'var(--text-muted)'
        };
        const riskLevel = (host.risk_level || 'info').toLowerCase();
        const riskColor = riskColors[riskLevel] || 'var(--text-muted)';
            
            return `
            <div class="host-card ${riskClass}" style="background: var(--dark); padding: 20px; border-radius: 12px; margin-bottom: 15px; border-left: 4px solid ${riskColor}; transition: all 0.3s ease;">
                <div class="host-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                        <div class="host-ip" style="font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                            💻 ${host.ip_address || 'IP inconnue'}
                        </div>
                        <div class="host-os" style="font-size: 14px; color: var(--text-muted);">
                            ${host.hostname || 'Nom inconnu'} • ${host.os_detected || 'OS inconnu'} ${host.ttl ? `• TTL: ${host.ttl}` : ''}
                        </div>
                        </div>
                        <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: 700; color: ${riskColor}; margin-bottom: 3px;">
                            ${host.priority_score || 0}<span style="font-size: 14px; opacity: 0.7;">/100</span>
                        </div>
                        <div style="display: inline-block; padding: 4px 12px; background: ${riskColor}; color: white; border-radius: 6px; font-size: 12px; font-weight: 600;">
                            ${(host.risk_level || 'INFO').toUpperCase()}
                    </div>
                    </div>
                </div>
                <div class="host-ports" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${openPorts.length > 0 ? 
                        openPorts.map(port => `
                            <span class="port-badge" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-weight: 500;">
                                <span style="color: var(--primary);">🔌</span>
                                <span style="color: var(--text);">Port ${port}</span>
                            </span>
                        `).join('') 
                        : '<span style="color: var(--text-muted); font-size: 14px;">✅ Aucun port ouvert</span>'
                    }
                    </div>
                </div>
            `;
        }).join('');
    
    container.innerHTML = hostsHtml || '<div class="loading">Aucun résultat</div>';
}

function filterHosts(searchText) {
    const riskFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    renderHosts(window.currentScanHosts, searchText, riskFilter);
}

function filterByRisk(risk) {
    // Mettre à jour les boutons actifs
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === risk);
    });
    
    const searchText = document.getElementById('host-search')?.value || '';
    renderHosts(window.currentScanHosts, searchText, risk);
}

// ========== RECOMMANDATIONS DE SÉCURITÉ ==========

function displaySecurityRecommendations(securityReport) {
    if (!securityReport) return;
    
    const recsContainer = document.getElementById('security-recommendations');
    const summary = securityReport.executive_summary;
    
    // Score de sécurité avec couleur
    let scoreColor = '#10B981'; // Vert
    if (summary.score < 50) scoreColor = '#EF4444'; // Rouge
    else if (summary.score < 75) scoreColor = '#F59E0B'; // Orange
    
    let html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; margin-bottom: 25px;">
            <h3 style="color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                <span>🛡️</span> Rapport de Sécurité Professionnel
            </h3>
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                <button onclick="downloadRemediationScript()" style="padding: 10px 20px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">
                    <span>⬇️</span> Télécharger Script de Remédiation
                </button>
                </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 15px;">
                <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 36px; font-weight: 700; color: ${scoreColor};">${summary.score}<span style="font-size: 18px; opacity: 0.7;">/100</span></div>
                    <div style="color: white; opacity: 0.9; font-size: 13px; margin-top: 5px;">Score Sécurité</div>
                    <div style="color: white; opacity: 0.7; font-size: 12px; margin-top: 3px;">Grade: ${summary.grade || 'N/A'}</div>
                </div>
                <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 36px; font-weight: 700; color: #EF4444;">${summary.critical_hosts || 0}</div>
                    <div style="color: white; opacity: 0.9; font-size: 13px; margin-top: 5px;">Hôtes Critiques</div>
                </div>
                <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 36px; font-weight: 700; color: #F59E0B;">${summary.high_risk_hosts || 0}</div>
                    <div style="color: white; opacity: 0.9; font-size: 13px; margin-top: 5px;">Risques Élevés</div>
                </div>
                <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 36px; font-weight: 700; color: #06B6D4;">${summary.medium_risk_hosts || 0}</div>
                    <div style="color: white; opacity: 0.9; font-size: 13px; margin-top: 5px;">Risques Moyens</div>
            </div>
                <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 20px; font-weight: 600; color: white; opacity: 0.9;">⏱️ ${summary.total_remediation_time || 'N/A'}</div>
                    <div style="color: white; opacity: 0.9; font-size: 13px; margin-top: 5px;">Temps estimé</div>
        </div>
        </div>
            ${securityReport.compliance_summary && securityReport.compliance_summary.frameworks_impacted && securityReport.compliance_summary.frameworks_impacted.length > 0 ? `
                <div style="background: rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; margin-top: 12px;">
                    <div style="color: white; font-size: 13px; opacity: 0.9;">
                        <strong>📋 Conformité impactée:</strong> ${securityReport.compliance_summary.frameworks_impacted.join(', ')}
                    </div>
                    <div style="color: white; font-size: 12px; opacity: 0.7; margin-top: 5px;">
                        Statut: ${securityReport.compliance_summary.compliance_score || 'À évaluer'}
                    </div>
                </div>
            ` : ''}
            ${securityReport.cve_summary && securityReport.cve_summary.length > 0 ? `
                <div style="background: rgba(239, 68, 68, 0.15); padding: 12px; border-radius: 8px; margin-top: 10px;">
                    <div style="color: white; font-size: 13px; opacity: 0.9;">
                        <strong>🚨 CVEs détectées:</strong> ${securityReport.cve_summary.slice(0, 5).join(', ')}${securityReport.cve_summary.length > 5 ? ` (+${securityReport.cve_summary.length - 5} autres)` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Actions réseau globales (si présentes)
    if (securityReport.network_wide_actions && securityReport.network_wide_actions.length > 0) {
        html += `
            <div style="background: var(--dark); padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #EF4444;">
                <h4 style="color: #EF4444; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                    <span>⚠️</span> Actions Urgentes Requises
                </h4>
                ${securityReport.network_wide_actions.map(action => `
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: 600; color: var(--text); margin-bottom: 8px;">
                            ${action.priority}: ${action.action}
        </div>
                        <div style="color: var(--text-muted); margin-bottom: 10px; font-size: 14px;">
                            ${action.description}
                        </div>
                        <ul style="color: var(--text-muted); font-size: 14px; margin-left: 20px;">
                            ${action.steps.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Recommandations par hôte
    if (securityReport.hosts_recommendations && securityReport.hosts_recommendations.length > 0) {
        html += `<h4 style="color: var(--primary); margin-bottom: 20px;">💡 Solutions de Remédiation par Hôte</h4>`;
        
        securityReport.hosts_recommendations.forEach(hostRec => {
            // Vérifications de sécurité
            if (!hostRec || !hostRec.host_summary) {
                console.warn('Host recommendation invalide:', hostRec);
                return;
            }
            
            const host = hostRec.host_summary;
            const riskLevel = (host.risk_level || 'low').toLowerCase();
            const riskClass = `risk-${riskLevel}`;
            const globalAssessment = hostRec.global_assessment || {
                priority: '🟢 Faible - Amélioration continue',
                timeline: 'Quand possible',
                general_advice: ['Maintenir les bonnes pratiques']
            };
            
            html += `
                <div class="recommendation-card" style="background: var(--dark); padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid var(--${riskLevel === 'critical' ? 'danger' : riskLevel === 'high' ? 'warning' : 'success'});">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                ${host.ip || 'IP inconnue'} ${host.hostname && host.hostname !== 'N/A' ? `(${host.hostname})` : ''}
                            </div>
                            <div style="font-size: 14px; color: var(--text-muted);">
                                ${host.os || 'OS inconnu'} • Score: ${host.priority_score || 0}/100
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 14px; font-weight: 600; color: var(--${riskLevel === 'critical' ? 'danger' : riskLevel === 'high' ? 'warning' : 'success'});">
                                ${globalAssessment.priority}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                ${globalAssessment.timeline}
                            </div>
                        </div>
                    </div>
                    
                    ${hostRec.quick_wins && hostRec.quick_wins.length > 0 ? `
                        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%); padding: 18px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(16, 185, 129, 0.3);">
                            <h5 style="color: #10B981; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                                <span>⚡</span> Quick Wins - Impact Immédiat
                            </h5>
                            ${hostRec.quick_wins.map((qw, idx) => `
                                <div style="margin-bottom: ${idx < hostRec.quick_wins.length - 1 ? '15px' : '0'};">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <div style="font-weight: 600; color: var(--text); font-size: 15px;">${qw.action}</div>
                                        <div style="display: flex; gap: 10px; font-size: 12px; color: var(--text-muted);">
                                            ${qw.estimated_time ? `<span>⏱️ ${qw.estimated_time}</span>` : ''}
                                            ${qw.difficulty ? `<span>📊 ${qw.difficulty}</span>` : ''}
                                        </div>
                                    </div>
                                    <div style="background: #0f1419; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto; color: #10B981; line-height: 1.6;">
                                        ${qw.commands ? qw.commands.map(cmd => `<div style="margin: 2px 0;">${escapeHtml(cmd)}</div>`).join('') : ''}
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                                        <div style="color: var(--text-muted); font-size: 13px;">
                                            💡 <strong style="color: #10B981;">Impact:</strong> ${qw.impact}
                                        </div>
                                        <button onclick="copyCommands('quickwin-${idx}')" style="padding: 6px 12px; background: #10B981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                            📋 Copier
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${hostRec.ports_analysis && hostRec.ports_analysis.length > 0 ? `
                        <div style="margin-bottom: 20px;">
                            <h5 style="color: var(--text); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                                <span>🔐</span> Analyse Détaillée des Ports
                                <span style="font-size: 12px; font-weight: normal; color: var(--text-muted); background: var(--darker); padding: 4px 10px; border-radius: 12px;">
                                    ${hostRec.ports_analysis.length} port(s)
                                </span>
                                ${hostRec.estimated_total_time ? `
                                    <span style="font-size: 12px; font-weight: normal; color: var(--text-muted); margin-left: auto;">
                                        ⏱️ Temps total: ${hostRec.estimated_total_time}
                                    </span>
                                ` : ''}
                            </h5>
                            ${hostRec.ports_analysis.map((portAnalysis, idx) => {
                                const riskEmoji = {
                                    'critical': '🔴',
                                    'high': '🟠',
                                    'medium': '🟡',
                                    'low': '🟢'
                                }[portAnalysis.risk] || '⚪';
                                
                                return `
                                <details style="background: var(--darker); padding: 15px; border-radius: 8px; margin-bottom: 12px; cursor: pointer; border: 1px solid var(--border);" ${idx === 0 ? 'open' : ''}>
                                    <summary style="font-weight: 600; color: var(--text); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; padding: 5px 0;">
                                        <span style="display: flex; align-items: center; gap: 10px;">
                                            <span style="display: inline-block; min-width: 90px; text-align: center; background: var(--${portAnalysis.risk === 'critical' ? 'danger' : portAnalysis.risk === 'high' ? 'warning' : portAnalysis.risk === 'medium' ? 'info' : 'success'}); padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 700;">
                                                ${riskEmoji} ${portAnalysis.port}
                                            </span>
                                            <div>
                                                <div style="font-size: 15px;">${portAnalysis.service}${portAnalysis.category ? ` <span style="color: var(--text-muted); font-size: 12px;">(${portAnalysis.category})</span>` : ''}</div>
                                                <div style="font-size: 13px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${portAnalysis.description}</div>
                                            </div>
                                        </span>
                                        <span style="display: flex; align-items: center; gap: 15px; font-size: 12px; color: var(--text-muted);">
                                            ${portAnalysis.estimated_time ? `<span>⏱️ ${portAnalysis.estimated_time}</span>` : ''}
                                            ${portAnalysis.difficulty ? `<span>📊 ${portAnalysis.difficulty}</span>` : ''}
                                            <span>▼</span>
                                        </span>
                                    </summary>
                                    
                                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                                        ${portAnalysis.cve_refs && portAnalysis.cve_refs.length > 0 ? `
                                            <div style="background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px;">
                                                <div style="font-size: 12px; font-weight: 600; color: #EF4444; margin-bottom: 5px;">🚨 CVEs Connues</div>
                                                <div style="font-size: 13px; color: var(--text-muted); font-family: monospace;">
                                                    ${portAnalysis.cve_refs.map(cve => `<span style="margin-right: 10px;">${cve}</span>`).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        
                                        ${portAnalysis.compliance && Object.keys(portAnalysis.compliance).length > 0 ? `
                                            <div style="background: rgba(102, 126, 234, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px;">
                                                <div style="font-size: 12px; font-weight: 600; color: #667eea; margin-bottom: 5px;">📋 Conformité Impactée</div>
                                                <div style="font-size: 13px; color: var(--text-muted);">
                                                    ${Object.entries(portAnalysis.compliance).map(([framework, ref]) => `<span style="margin-right: 12px;"><strong>${framework}:</strong> ${ref}</span>`).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        
                                        <div style="margin-bottom: 15px;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                                <div style="font-weight: 600; color: var(--text);">📋 Commandes de Correction</div>
                                                <button onclick="copyToClipboard(${idx}, 'port-${portAnalysis.port}')" class="copy-btn" style="padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                                    📋 Copier
                                                </button>
                                            </div>
                                            <div id="port-${portAnalysis.port}-commands" style="background: #0f1419; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto; line-height: 1.6; color: #a6e22e; position: relative;">
                                                ${portAnalysis.commands ? portAnalysis.commands.map(cmd => `<div style="margin: 2px 0;">${escapeHtml(cmd)}</div>`).join('') : '<div>Aucune commande disponible</div>'}
                                            </div>
                                        </div>
                                        
                                        <div style="margin-bottom: 15px;">
                                            <div style="font-weight: 600; color: var(--text); margin-bottom: 8px;">💡 Recommandations Professionnelles</div>
                                            <ul style="color: var(--text-muted); font-size: 14px; margin-left: 20px; line-height: 1.8;">
                                                ${portAnalysis.recommendations ? portAnalysis.recommendations.map(rec => `<li>${rec}</li>`).join('') : '<li>Aucune recommandation disponible</li>'}
                                            </ul>
                                        </div>
                                        
                                        ${portAnalysis.references && portAnalysis.references.length > 0 ? `
                                            <div style="margin-top: 15px; padding: 12px; background: rgba(6, 182, 212, 0.05); border-left: 3px solid var(--primary); border-radius: 4px;">
                                                <div style="font-size: 12px; font-weight: 600; color: var(--primary); margin-bottom: 6px;">📚 Ressources & Documentation</div>
                                                <div style="font-size: 13px;">
                                                    ${portAnalysis.references.map(ref => `<div style="margin: 4px 0;"><a href="${ref}" target="_blank" style="color: var(--primary); text-decoration: none;">${ref}</a></div>`).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </details>
                            `}).join('')}
                        </div>
                    ` : ''}
                    
                    ${hostRec.strategic_actions && hostRec.strategic_actions.length > 0 ? `
                        <div style="background: rgba(102, 126, 234, 0.1); padding: 18px; border-radius: 10px; border: 1px solid rgba(102, 126, 234, 0.3);">
                            <h5 style="color: #667eea; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                                <span>🎯</span> Actions Stratégiques Recommandées
                            </h5>
                            ${hostRec.strategic_actions.map((action, idx) => `
                                <div style="margin-bottom: ${idx < hostRec.strategic_actions.length - 1 ? '20px' : '0'}; padding-bottom: ${idx < hostRec.strategic_actions.length - 1 ? '20px' : '0'}; border-bottom: ${idx < hostRec.strategic_actions.length - 1 ? '1px solid rgba(102, 126, 234, 0.2)' : 'none'};">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                        <div style="font-weight: 600; color: var(--text); font-size: 15px;">${action.title}</div>
                                        ${action.priority ? `
                                            <div style="padding: 4px 10px; background: rgba(239, 68, 68, 0.2); color: #EF4444; border-radius: 6px; font-size: 11px; font-weight: 600;">
                                                ${action.priority}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px;">${action.description}</div>
                                    ${action.estimated_time || action.difficulty ? `
                                        <div style="display: flex; gap: 15px; margin-bottom: 12px; font-size: 13px;">
                                            ${action.estimated_time ? `<span style="color: var(--text-muted);">⏱️ Temps: <strong style="color: var(--text);">${action.estimated_time}</strong></span>` : ''}
                                            ${action.difficulty ? `<span style="color: var(--text-muted);">📊 Difficulté: <strong style="color: var(--text);">${action.difficulty}</strong></span>` : ''}
                                        </div>
                                    ` : ''}
                                    <div style="font-size: 14px; color: var(--text); margin-bottom: 8px; font-weight: 500;">Plan d'Action:</div>
                                    <ol style="color: var(--text-muted); font-size: 14px; margin-left: 20px; line-height: 1.8;">
                                        ${action.steps.map(step => `<li style="margin-bottom: 4px;">${step}</li>`).join('')}
                                    </ol>
                                    ${action.resources && action.resources.length > 0 ? `
                                        <div style="margin-top: 12px; padding: 10px; background: rgba(6, 182, 212, 0.08); border-radius: 6px;">
                                            <div style="font-size: 12px; font-weight: 600; color: var(--primary); margin-bottom: 5px;">📚 Ressources & Documentation</div>
                                            <div style="font-size: 13px; display: flex; flex-direction: column; gap: 4px;">
                                                ${action.resources.map(r => `<a href="${r}" target="_blank" style="color: var(--primary); text-decoration: none; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">→ ${r}</a>`).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                        <div style="font-size: 13px; color: var(--text-muted);">
                            <strong>Conseil général:</strong> ${(globalAssessment.general_advice || ['Maintenir les bonnes pratiques']).join(' • ')}
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    recsContainer.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard(idx, elementId) {
    const commandsDiv = document.getElementById(`${elementId}-commands`);
    if (!commandsDiv) return;
    
    const text = commandsDiv.innerText;
    
    navigator.clipboard.writeText(text).then(() => {
        notify.success('Commandes copiées dans le presse-papier ! 📋');
    }).catch(err => {
        console.error('Erreur copie:', err);
        notify.error('Erreur lors de la copie');
    });
}

async function downloadRemediationScript() {
    if (!window.currentScanId) {
        notify.error('Aucun scan sélectionné');
        return;
    }
    
    try {
        notify.info('Génération du script de remédiation...');
        
        const response = await fetch(`${API_URL}/scans/${window.currentScanId}/remediation-script`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            notify.error('Erreur lors de la génération du script');
            return;
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pathfinder-remediation-scan-${window.currentScanId}.sh`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        notify.success('Script téléchargé ! Vérifier et exécuter avec sudo. 🛡️');
    } catch (error) {
        console.error('Erreur téléchargement script:', error);
        notify.error('Erreur lors du téléchargement');
    }
}

function closeModal() {
    document.getElementById('scan-modal').style.display = 'none';
}

// ========== GRAPHIQUES ==========

function createScansChart(recentScans) {
    const ctx = document.getElementById('scans-chart').getContext('2d');
    
    // Détruire l'ancien graphique
    if (scansChart) scansChart.destroy();
    
    const labels = recentScans.map(s => formatDate(s.scan_date)).reverse();
    const aliveData = recentScans.map(s => s.alive_hosts).reverse();
    const criticalData = recentScans.map(s => s.critical_hosts).reverse();
    
    scansChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hôtes actifs',
                    data: aliveData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Hôtes critiques',
                    data: criticalData,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#E2E8F0' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94A3B8' },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' }
                },
                x: {
                    ticks: { color: '#94A3B8' },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' }
                }
            }
        }
    });
}

function createOsChart(osDistribution) {
    const ctx = document.getElementById('os-chart').getContext('2d');
    
    // Détruire l'ancien graphique
    if (osChart) osChart.destroy();
    
    const labels = osDistribution.map(os => os.os_detected || 'Inconnu');
    const data = osDistribution.map(os => os.count);
    
    osChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', 
                    '#EF4444', '#3B82F6', '#EC4899', '#14B8A6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#E2E8F0' }
                }
            }
        }
    });
}

// ========== PROFILE ==========

async function loadProfileData() {
    try {
        // Afficher skeleton pendant le chargement
        showProfileSkeleton();
        
        const response = await fetch(`${API_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        
        // Mettre à jour les infos
        document.getElementById('profile-name').textContent = data.username;
        document.getElementById('profile-email').textContent = data.email;
        document.getElementById('profile-avatar-text').textContent = data.username.charAt(0).toUpperCase();
        
        const roleBadge = document.getElementById('profile-role-badge');
        roleBadge.textContent = data.role === 'admin' ? '👑 Admin' : 'Utilisateur';
        if (data.role === 'admin') roleBadge.classList.add('admin');
        
        // Stats
        document.getElementById('user-total-scans').textContent = data.total_scans || 0;
        document.getElementById('user-total-devices').textContent = data.total_devices || 0;
        document.getElementById('user-total-critical').textContent = data.total_critical || 0;
        document.getElementById('user-member-since').textContent = new Date(data.created_at).getFullYear();
        
        // Pré-remplir les formulaires
        document.getElementById('update-username').value = data.username;
        document.getElementById('update-email').value = data.email;
        
        hideProfileSkeleton();
        
    } catch (error) {
        console.error('Erreur profil:', error);
        notify.error('Impossible de charger le profil');
    }
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    
    const username = document.getElementById('update-username').value;
    const email = document.getElementById('update-email').value;
    
    const loadingNotif = notify.loading('Mise à jour en cours...');
    
    try {
        const response = await fetch(`${API_URL}/user/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username, email })
        });
        
        const data = await response.json();
        
        notify.close(loadingNotif);
        
        if (response.ok) {
            currentUser.username = username;
            currentUser.email = email;
            localStorage.setItem('userData', JSON.stringify(currentUser));
            
            document.getElementById('user-info').textContent = `👤 ${username}`;
            document.getElementById('profile-name').textContent = username;
            document.getElementById('profile-email').textContent = email;
            
            notify.success('✅ Profil mis à jour avec succès !');
        } else {
            notify.error(data.message || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        notify.close(loadingNotif);
        notify.error('Impossible de se connecter au serveur');
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        notify.error('Les mots de passe ne correspondent pas');
        return;
    }
    
    if (newPassword.length < 6) {
        notify.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
    }
    
    const loadingNotif = notify.loading('Changement du mot de passe...');
    
    try {
        const response = await fetch(`${API_URL}/user/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ 
                current_password: currentPassword,
                new_password: newPassword 
            })
        });
        
        const data = await response.json();
        
        notify.close(loadingNotif);
        
        if (response.ok) {
            notify.success('🔒 Mot de passe changé avec succès !');
            document.getElementById('change-password-form').reset();
        } else {
            notify.error(data.message || 'Erreur lors du changement');
        }
    } catch (error) {
        notify.close(loadingNotif);
        notify.error('Impossible de se connecter au serveur');
    }
}

async function loadActivityLogs() {
    try {
        const response = await fetch(`${API_URL}/user/activity-logs`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        displayActivityLogs(data.logs);
        
    } catch (error) {
        console.error('Erreur logs:', error);
        document.getElementById('activity-logs').innerHTML = `
            <div class="loading">Impossible de charger les logs d'activité</div>
        `;
    }
}

function displayActivityLogs(logs) {
    const container = document.getElementById('activity-logs');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="loading">Aucune activité enregistrée</div>';
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const icons = {
            'login': '🔐',
            'logout': '🚪',
            'scan': '🔍',
            'export': '📄',
            'update_profile': '✏️',
            'change_password': '🔑'
        };
        
        return `
            <div class="activity-log-item">
                <div class="activity-icon">${icons[log.action] || '📋'}</div>
                <div class="activity-content">
                    <div class="activity-title">${log.description}</div>
                    <div class="activity-date">${formatRelativeDate(log.timestamp)}</div>
                    ${log.details ? `<div class="activity-details">${log.details}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function showProfileSkeleton() {
    // Skeleton loading pour le profil
}

function hideProfileSkeleton() {
    // Cacher skeleton
}

// ========== UTILITAIRES ==========

function formatDate(dateString) {
    if (!dateString) return 'Date inconnue';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeDate(dateString) {
    if (!dateString) return 'Date inconnue';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return formatDate(dateString);
}

