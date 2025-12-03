// PathFinder - Panneau d'Administration Caché (Pentest Mode)
// Accès: /admin avec code 123jetebz

let adminPanelActive = false;
const ADMIN_CODE = '123jetebz';

// ========== INITIALISATION ADMIN PANEL ==========

function initAdminPanel() {
    // Vérifier si l'URL contient /admin
    const path = window.location.pathname + window.location.hash;
    
    if (path.includes('/admin') || path.includes('#admin')) {
        promptAdminCode();
    }
}

function promptAdminCode() {
    const code = prompt('🔐 Code d\'accès Admin Pentest:');
    
    if (code === ADMIN_CODE) {
        adminPanelActive = true;
        showAdminPentestPanel();
        notify.success('🔓 Mode Pentest Activé');
    } else if (code !== null) {
        notify.error('❌ Code incorrect');
    }
}

// ========== PANNEAU PENTEST ==========

function showAdminPentestPanel() {
    const container = document.getElementById('admin-panel-container');
    
    if (!container) {
        // Créer le conteneur
        const newContainer = document.createElement('div');
        newContainer.id = 'admin-panel-container';
        document.body.appendChild(newContainer);
    }
    
    document.getElementById('admin-panel-container').innerHTML = `
        <div class="admin-panel-backdrop" onclick="closeAdminPanel()"></div>
        <div class="admin-panel-content">
            <div class="admin-panel-header">
                <h2>🎯 PathFinder - Pentest Mode</h2>
                <button onclick="closeAdminPanel()" class="close-btn">✕</button>
            </div>
            
            <div class="admin-panel-tabs">
                <button class="admin-tab active" data-tab="attacks" onclick="switchAdminTab('attacks')">⚔️ Attaques</button>
                <button class="admin-tab" data-tab="scanner" onclick="switchAdminTab('scanner')">🔍 Scanner Avancé</button>
                <button class="admin-tab" data-tab="exploits" onclick="switchAdminTab('exploits')">💣 Exploits</button>
                <button class="admin-tab" data-tab="tools" onclick="switchAdminTab('tools')">🛠️ Outils</button>
                <button class="admin-tab" data-tab="logs" onclick="switchAdminTab('logs')">📊 Logs</button>
            </div>
            
            <div class="admin-panel-body">
                <div id="admin-tab-attacks" class="admin-tab-content active">
                    ${renderAttacksTab()}
                </div>
                <div id="admin-tab-scanner" class="admin-tab-content">
                    ${renderScannerTab()}
                </div>
                <div id="admin-tab-exploits" class="admin-tab-content">
                    ${renderExploitsTab()}
                </div>
                <div id="admin-tab-tools" class="admin-tab-content">
                    ${renderToolsTab()}
                </div>
                <div id="admin-tab-logs" class="admin-tab-content">
                    ${renderLogsTab()}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('admin-panel-container').style.display = 'flex';
}

function closeAdminPanel() {
    const container = document.getElementById('admin-panel-container');
    if (container) {
        container.style.display = 'none';
    }
}

function switchAdminTab(tabName) {
    // Mettre à jour les onglets
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Mettre à jour le contenu
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `admin-tab-${tabName}`);
    });
}

// ========== ONGLET ATTAQUES ==========

function renderAttacksTab() {
    return `
        <div class="pentest-section">
            <h3>⚔️ Simulation d'Attaques Réseau</h3>
            <p class="warning-text">⚠️ À utiliser UNIQUEMENT sur votre réseau ou avec autorisation écrite</p>
            
            <div class="attack-grid">
                <div class="attack-card">
                    <div class="attack-card-header">
                        <span class="attack-icon">🔨</span>
                        <h4>Port Scanning Agressif</h4>
                    </div>
                    <p>Scan complet tous ports (1-65535) avec détection OS/services</p>
                    <div class="attack-form">
                        <input type="text" id="portscan-target" placeholder="IP cible (ex: 192.168.1.1)" class="admin-input" />
                        <button onclick="launchPortScan()" class="attack-btn danger">Lancer Scan</button>
                    </div>
                    <div id="portscan-result" class="attack-result"></div>
                </div>
                
                <div class="attack-card">
                    <div class="attack-card-header">
                        <span class="attack-icon">🔐</span>
                        <h4>Bruteforce SSH</h4>
                    </div>
                    <p>Test de mots de passe courants sur SSH (top 100)</p>
                    <div class="attack-form">
                        <input type="text" id="bruteforce-target" placeholder="IP:PORT (ex: 192.168.1.1:22)" class="admin-input" />
                        <input type="text" id="bruteforce-user" placeholder="Username (ex: admin)" class="admin-input" />
                        <button onclick="launchBruteforce()" class="attack-btn danger">Lancer Bruteforce</button>
                    </div>
                    <div id="bruteforce-result" class="attack-result"></div>
                </div>
                
                <div class="attack-card">
                    <div class="attack-card-header">
                        <span class="attack-icon">📂</span>
                        <h4>Directory Busting</h4>
                    </div>
                    <p>Découverte de répertoires/fichiers cachés (10k wordlist)</p>
                    <div class="attack-form">
                        <input type="text" id="dirbust-target" placeholder="URL (ex: http://192.168.1.1)" class="admin-input" />
                        <select id="dirbust-wordlist" class="admin-input">
                            <option value="common">Common (1k)</option>
                            <option value="medium">Medium (5k)</option>
                            <option value="full">Full (10k)</option>
                        </select>
                        <button onclick="launchDirBusting()" class="attack-btn warning">Lancer Scan</button>
                    </div>
                    <div id="dirbust-result" class="attack-result"></div>
                </div>
                
                <div class="attack-card">
                    <div class="attack-card-header">
                        <span class="attack-icon">🕷️</span>
                        <h4>CVE Scanner</h4>
                    </div>
                    <p>Détection de vulnérabilités connues (CVE database)</p>
                    <div class="attack-form">
                        <input type="text" id="cve-target" placeholder="IP cible" class="admin-input" />
                        <button onclick="launchCVEScan()" class="attack-btn warning">Scanner CVEs</button>
                    </div>
                    <div id="cve-result" class="attack-result"></div>
                </div>
                
                <div class="attack-card">
                    <div class="attack-card-header">
                        <span class="attack-icon">🌐</span>
                        <h4>Network Mapper</h4>
                    </div>
                    <p>Cartographie complète du réseau avec topologie</p>
                    <div class="attack-form">
                        <input type="text" id="netmap-range" placeholder="Plage (ex: 192.168.1.0/24)" class="admin-input" />
                        <button onclick="launchNetworkMapping()" class="attack-btn info">Cartographier</button>
                    </div>
                    <div id="netmap-result" class="attack-result"></div>
                </div>
                
                <div class="attack-card">
                    <div class="attack-card-header">
                        <span class="attack-icon">🔥</span>
                        <h4>Exploit Automatique</h4>
                    </div>
                    <p>Test d'exploits connus (EternalBlue, BlueKeep, etc.)</p>
                    <div class="attack-form">
                        <input type="text" id="exploit-target" placeholder="IP cible" class="admin-input" />
                        <select id="exploit-type" class="admin-input">
                            <option value="auto">Auto-detect</option>
                            <option value="eternalblue">EternalBlue (MS17-010)</option>
                            <option value="bluekeep">BlueKeep (CVE-2019-0708)</option>
                            <option value="log4shell">Log4Shell (CVE-2021-44228)</option>
                        </select>
                        <button onclick="launchExploit()" class="attack-btn danger">⚠️ Tester Exploit</button>
                    </div>
                    <div id="exploit-result" class="attack-result"></div>
                </div>
            </div>
        </div>
    `;
}

// ========== ONGLET SCANNER AVANCÉ ==========

function renderScannerTab() {
    return `
        <div class="pentest-section">
            <h3>🔍 Scanner Réseau Avancé</h3>
            
            <div class="scanner-controls">
                <div class="control-group">
                    <label>Plage Réseau</label>
                    <input type="text" id="advanced-range" placeholder="192.168.1.0/24" class="admin-input" />
                </div>
                
                <div class="control-group">
                    <label>Type de Scan</label>
                    <select id="scan-type" class="admin-input">
                        <option value="syn">SYN Scan (Stealth)</option>
                        <option value="connect">Connect Scan (Standard)</option>
                        <option value="udp">UDP Scan</option>
                        <option value="comprehensive">Complet (TCP+UDP)</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Vitesse</label>
                    <select id="scan-speed" class="admin-input">
                        <option value="paranoid">Paranoid (ultra-furtif)</option>
                        <option value="sneaky">Sneaky (furtif)</option>
                        <option value="polite">Polite (normal)</option>
                        <option value="normal" selected>Normal</option>
                        <option value="aggressive">Aggressive</option>
                        <option value="insane">Insane (très rapide)</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Options Avancées</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="opt-os-detect" checked> Détection OS</label>
                        <label><input type="checkbox" id="opt-service-version" checked> Version services</label>
                        <label><input type="checkbox" id="opt-script-scan"> Scripts NSE</label>
                        <label><input type="checkbox" id="opt-traceroute"> Traceroute</label>
                    </div>
                </div>
                
                <button onclick="launchAdvancedScan()" class="attack-btn primary" style="width: 100%; margin-top: 20px;">
                    🚀 Lancer Scan Avancé
                </button>
            </div>
            
            <div id="advanced-scan-result" class="attack-result" style="margin-top: 20px;"></div>
        </div>
    `;
}

// ========== ONGLET EXPLOITS ==========

function renderExploitsTab() {
    return `
        <div class="pentest-section">
            <h3>💣 Base de Données d'Exploits</h3>
            <p class="warning-text">⚠️ DANGER: Tests d'exploits réels. Autorisation obligatoire.</p>
            
            <div class="exploits-list">
                <div class="exploit-item">
                    <div class="exploit-header">
                        <h4>🔴 EternalBlue (MS17-010)</h4>
                        <span class="severity critical">CRITIQUE</span>
                    </div>
                    <p><strong>CVE:</strong> CVE-2017-0144</p>
                    <p><strong>Cible:</strong> Windows 7, Server 2008 R2 (SMB)</p>
                    <p><strong>Impact:</strong> Remote Code Execution (RCE)</p>
                    <div class="exploit-actions">
                        <button onclick="testExploit('eternalblue')" class="attack-btn danger">Tester</button>
                        <button onclick="showExploitInfo('eternalblue')" class="attack-btn secondary">Info</button>
                    </div>
                </div>
                
                <div class="exploit-item">
                    <div class="exploit-header">
                        <h4>🔴 BlueKeep (CVE-2019-0708)</h4>
                        <span class="severity critical">CRITIQUE</span>
                    </div>
                    <p><strong>CVE:</strong> CVE-2019-0708</p>
                    <p><strong>Cible:</strong> Windows RDP (3389)</p>
                    <p><strong>Impact:</strong> Remote Code Execution sans auth</p>
                    <div class="exploit-actions">
                        <button onclick="testExploit('bluekeep')" class="attack-btn danger">Tester</button>
                        <button onclick="showExploitInfo('bluekeep')" class="attack-btn secondary">Info</button>
                    </div>
                </div>
                
                <div class="exploit-item">
                    <div class="exploit-header">
                        <h4>🟠 Log4Shell (CVE-2021-44228)</h4>
                        <span class="severity high">HAUTE</span>
                    </div>
                    <p><strong>CVE:</strong> CVE-2021-44228</p>
                    <p><strong>Cible:</strong> Applications Java (Log4j)</p>
                    <p><strong>Impact:</strong> Remote Code Execution via JNDI</p>
                    <div class="exploit-actions">
                        <button onclick="testExploit('log4shell')" class="attack-btn warning">Tester</button>
                        <button onclick="showExploitInfo('log4shell')" class="attack-btn secondary">Info</button>
                    </div>
                </div>
                
                <div class="exploit-item">
                    <div class="exploit-header">
                        <h4>🟠 SQL Injection</h4>
                        <span class="severity high">HAUTE</span>
                    </div>
                    <p><strong>Type:</strong> Injection classique + blind</p>
                    <p><strong>Cible:</strong> Applications web avec BDD</p>
                    <p><strong>Impact:</strong> Accès base de données</p>
                    <div class="exploit-actions">
                        <button onclick="testExploit('sqli')" class="attack-btn warning">Tester</button>
                        <button onclick="showExploitInfo('sqli')" class="attack-btn secondary">Info</button>
                    </div>
                </div>
                
                <div class="exploit-item">
                    <div class="exploit-header">
                        <h4>🟡 XSS (Cross-Site Scripting)</h4>
                        <span class="severity medium">MOYENNE</span>
                    </div>
                    <p><strong>Type:</strong> Reflected, Stored, DOM-based</p>
                    <p><strong>Cible:</strong> Applications web</p>
                    <p><strong>Impact:</strong> Vol de session, phishing</p>
                    <div class="exploit-actions">
                        <button onclick="testExploit('xss')" class="attack-btn info">Tester</button>
                        <button onclick="showExploitInfo('xss')" class="attack-btn secondary">Info</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========== ONGLET OUTILS ==========

function renderToolsTab() {
    return `
        <div class="pentest-section">
            <h3>🛠️ Outils de Pentest</h3>
            
            <div class="tools-grid">
                <div class="tool-card">
                    <h4>🔓 Hash Cracker</h4>
                    <p>Cracker hashes MD5, SHA1, SHA256</p>
                    <textarea id="hash-input" placeholder="Entrer hash..." class="admin-textarea"></textarea>
                    <select id="hash-type" class="admin-input">
                        <option value="md5">MD5</option>
                        <option value="sha1">SHA1</option>
                        <option value="sha256">SHA256</option>
                    </select>
                    <button onclick="crackHash()" class="attack-btn warning">Cracker</button>
                    <div id="hash-result" class="tool-result"></div>
                </div>
                
                <div class="tool-card">
                    <h4>🌐 Reverse DNS Lookup</h4>
                    <p>Résolution inverse IP → Domaine</p>
                    <input type="text" id="rdns-ip" placeholder="IP à résoudre" class="admin-input" />
                    <button onclick="reverseDNS()" class="attack-btn info">Résoudre</button>
                    <div id="rdns-result" class="tool-result"></div>
                </div>
                
                <div class="tool-card">
                    <h4>🔍 WHOIS Lookup</h4>
                    <p>Informations domaine/IP</p>
                    <input type="text" id="whois-target" placeholder="Domaine ou IP" class="admin-input" />
                    <button onclick="whoisLookup()" class="attack-btn info">Lookup</button>
                    <div id="whois-result" class="tool-result"></div>
                </div>
                
                <div class="tool-card">
                    <h4>📡 Packet Sniffer</h4>
                    <p>Capture de paquets réseau (tcpdump)</p>
                    <select id="sniff-interface" class="admin-input">
                        <option value="en0">en0 (WiFi)</option>
                        <option value="en1">en1 (Ethernet)</option>
                        <option value="any">Toutes interfaces</option>
                    </select>
                    <button onclick="startPacketCapture()" class="attack-btn warning">Démarrer Capture</button>
                    <button onclick="stopPacketCapture()" class="attack-btn secondary">Arrêter</button>
                    <div id="sniff-result" class="tool-result"></div>
                </div>
                
                <div class="tool-card">
                    <h4>🎭 MAC Spoofing</h4>
                    <p>Changer l'adresse MAC (anonymat)</p>
                    <input type="text" id="mac-address" placeholder="Nouvelle MAC (optionnel)" class="admin-input" />
                    <button onclick="spoofMAC()" class="attack-btn danger">Spoof MAC</button>
                    <button onclick="resetMAC()" class="attack-btn secondary">Reset MAC</button>
                    <div id="mac-result" class="tool-result"></div>
                </div>
                
                <div class="tool-card">
                    <h4>📊 Bandwidth Monitor</h4>
                    <p>Surveillance trafic réseau en temps réel</p>
                    <button onclick="monitorBandwidth()" class="attack-btn info">Démarrer Monitor</button>
                    <div id="bandwidth-result" class="tool-result"></div>
                    <canvas id="bandwidth-chart" width="300" height="150" style="margin-top: 10px; display: none;"></canvas>
                </div>
            </div>
        </div>
    `;
}

// ========== ONGLET LOGS ==========

function renderLogsTab() {
    return `
        <div class="pentest-section">
            <h3>📊 Logs d'Activité Pentest</h3>
            
            <div class="logs-controls">
                <button onclick="clearPentestLogs()" class="attack-btn secondary">🗑️ Vider Logs</button>
                <button onclick="exportPentestLogs()" class="attack-btn primary">💾 Exporter</button>
            </div>
            
            <div id="pentest-logs" class="logs-container">
                <div class="log-entry info">
                    <span class="log-time">${new Date().toLocaleString()}</span>
                    <span class="log-message">Mode Pentest activé</span>
                </div>
            </div>
        </div>
    `;
}

// ========== FONCTIONS D'ATTAQUE ==========

async function launchPortScan() {
    const target = document.getElementById('portscan-target').value;
    const resultDiv = document.getElementById('portscan-result');
    
    if (!target) {
        notify.error('Entrer une IP cible');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Scan en cours... (peut prendre 2-5 min)</div>';
    addPentestLog(`Port scan lancé sur ${target}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/portscan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Pentest-Code': ADMIN_CODE,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: target,
                ports: 'all',  // 1-65535
                aggressive: true
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayPortScanResults(data, resultDiv);
            addPentestLog(`Port scan terminé: ${data.open_ports?.length || 0} ports ouverts`, 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
            addPentestLog(`Erreur port scan: ${data.message}`, 'error');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        addPentestLog(`Erreur port scan: ${error.message}`, 'error');
    }
}

async function launchBruteforce() {
    const target = document.getElementById('bruteforce-target').value;
    const username = document.getElementById('bruteforce-user').value;
    const resultDiv = document.getElementById('bruteforce-result');
    
    if (!target || !username) {
        notify.error('Remplir IP et username');
        return;
    }
    
    const [ip, port] = target.split(':');
    
    resultDiv.innerHTML = '<div class="loading">⏳ Bruteforce en cours... (peut prendre plusieurs minutes)</div>';
    addPentestLog(`Bruteforce SSH lancé: ${username}@${target}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/bruteforce`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Pentest-Code': ADMIN_CODE,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ip: ip,
                port: port || 22,
                username: username,
                wordlist: 'common'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = `
                <div class="${data.success ? 'success' : 'info'}">
                    ${data.success ? '✅ Mot de passe trouvé: ' + data.password : '❌ Aucun mot de passe trouvé'}
                    <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                        Tentatives: ${data.attempts} | Temps: ${data.duration}
                    </div>
                </div>
            `;
            addPentestLog(`Bruteforce terminé: ${data.attempts} tentatives`, data.success ? 'success' : 'info');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
    }
}

async function launchDirBusting() {
    const target = document.getElementById('dirbust-target').value;
    const wordlist = document.getElementById('dirbust-wordlist').value;
    const resultDiv = document.getElementById('dirbust-result');
    
    if (!target) {
        notify.error('Entrer une URL cible');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Directory busting en cours...</div>';
    addPentestLog(`Directory scan lancé sur ${target}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/dirbust`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Pentest-Code': ADMIN_CODE,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: target,
                wordlist: wordlist
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.results) {
            const found = data.results.filter(r => r.found);
            resultDiv.innerHTML = `
                <div class="success">
                    ✅ Scan terminé: ${found.length} répertoires/fichiers trouvés
                </div>
                <div class="results-list" style="margin-top: 15px;">
                    ${found.map(r => `
                        <div class="result-item">
                            <span class="status-badge status-${r.status}">${r.status}</span>
                            <code>${r.path}</code>
                            <span class="size-badge">${r.size || 'N/A'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            addPentestLog(`Directory scan: ${found.length} trouvés`, 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
    }
}

async function launchCVEScan() {
    const target = document.getElementById('cve-target').value;
    const resultDiv = document.getElementById('cve-result');
    
    if (!target) {
        notify.error('Entrer une IP cible');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Scan CVE en cours...</div>';
    addPentestLog(`CVE scan lancé sur ${target}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/cve-scan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Pentest-Code': ADMIN_CODE,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target: target })
        });
        
        const data = await response.json();
        
        if (response.ok && data.vulnerabilities) {
            const critical = data.vulnerabilities.filter(v => v.severity === 'critical').length;
            const high = data.vulnerabilities.filter(v => v.severity === 'high').length;
            
            resultDiv.innerHTML = `
                <div class="success">
                    ✅ Scan terminé: ${data.vulnerabilities.length} CVEs détectées
                    <div style="margin-top: 10px;">
                        🔴 Critiques: ${critical} | 🟠 Hautes: ${high}
                    </div>
                </div>
                <div class="cve-list" style="margin-top: 15px;">
                    ${data.vulnerabilities.slice(0, 10).map(v => `
                        <div class="cve-item">
                            <span class="severity ${v.severity}">${v.cve_id}</span>
                            <span>${v.description}</span>
                            <a href="https://nvd.nist.gov/vuln/detail/${v.cve_id}" target="_blank">📚 NVD</a>
                        </div>
                    `).join('')}
                    ${data.vulnerabilities.length > 10 ? `<div style="color: var(--text-muted); margin-top: 10px;">... et ${data.vulnerabilities.length - 10} autres</div>` : ''}
                </div>
            `;
            addPentestLog(`CVE scan: ${data.vulnerabilities.length} CVEs trouvées`, 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
    }
}

// ========== FONCTIONS UTILITAIRES ==========

function addPentestLog(message, type = 'info') {
    const logsContainer = document.getElementById('pentest-logs');
    if (!logsContainer) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="log-time">${new Date().toLocaleString()}</span>
        <span class="log-message">${message}</span>
    `;
    
    logsContainer.insertBefore(logEntry, logsContainer.firstChild);
    
    // Limiter à 100 logs
    while (logsContainer.children.length > 100) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}

function displayPortScanResults(data, container) {
    container.innerHTML = `
        <div class="success">
            ✅ Scan terminé
            <div style="margin-top: 10px;">
                Ports ouverts: ${data.open_ports?.length || 0} / ${data.total_ports_scanned || 65535}
            </div>
        </div>
        <div class="ports-grid" style="margin-top: 15px;">
            ${(data.open_ports || []).map(port => `
                <div class="port-result-item">
                    <span class="port-number">Port ${port.port}</span>
                    <span class="service-name">${port.service || 'Unknown'}</span>
                    ${port.version ? `<span class="version-badge">${port.version}</span>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function clearPentestLogs() {
    if (confirm('Vider tous les logs de pentest ?')) {
        document.getElementById('pentest-logs').innerHTML = '';
        notify.success('Logs vidés');
    }
}

function exportPentestLogs() {
    const logs = document.getElementById('pentest-logs').innerText;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pathfinder-pentest-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Logs exportés');
}

async function launchExploit() {
    const target = document.getElementById('exploit-target').value;
    const exploitType = document.getElementById('exploit-type').value;
    const resultDiv = document.getElementById('exploit-result');
    
    if (!target) {
        notify.error('Entrer une IP cible');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Test d\'exploit en cours...</div>';
    addPentestLog(`Test exploit ${exploitType} sur ${target}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/exploit-test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Pentest-Code': ADMIN_CODE,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: target,
                exploit_type: exploitType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = `
                <div class="${data.vulnerable ? 'error' : 'success'}">
                    ${data.vulnerable ? '🚨 VULNÉRABLE' : '✅ Non vulnérable'}
                    <div style="margin-top: 10px; font-size: 13px;">
                        ${data.info}
                    </div>
                </div>
            `;
            addPentestLog(`Exploit test: ${data.vulnerable ? 'VULNÉRABLE' : 'Sécurisé'}`, data.vulnerable ? 'error' : 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
    }
}

async function launchNetworkMapping() {
    const range = document.getElementById('netmap-range').value;
    const resultDiv = document.getElementById('netmap-result');
    
    if (!range) {
        notify.error('Entrer une plage réseau');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Cartographie réseau en cours...</div>';
    addPentestLog(`Network mapping: ${range}`, 'attack');
    
    // Utiliser le scan normal mais afficher différemment
    notify.info('Fonction en développement - Utiliser le scan normal pour le moment');
}

async function launchAdvancedScan() {
    notify.info('Fonction avancée en développement - Utiliser le scan normal');
}

function testExploit(type) {
    const target = prompt('IP cible:');
    if (!target) return;
    
    document.getElementById('exploit-target').value = target;
    document.getElementById('exploit-type').value = type;
    launchExploit();
}

function showExploitInfo(type) {
    const info = {
        'eternalblue': 'EternalBlue (MS17-010) exploite une faille SMBv1 dans Windows. Utilisé par WannaCry.',
        'bluekeep': 'BlueKeep (CVE-2019-0708) permet RCE sur RDP sans authentification. Windows 7/2008.',
        'log4shell': 'Log4Shell (CVE-2021-44228) exploite Log4j via JNDI. RCE sur applications Java.',
        'sqli': 'SQL Injection permet extraction/modification de données via requêtes malveillantes.',
        'xss': 'Cross-Site Scripting permet injection de JavaScript dans pages web.'
    };
    
    alert(info[type] || 'Information non disponible');
}

// Fonctions tools additionnelles (stubs)
async function crackHash() {
    notify.info('Fonction en développement');
}

async function reverseDNS() {
    notify.info('Fonction en développement');
}

async function whoisLookup() {
    notify.info('Fonction en développement');
}

async function startPacketCapture() {
    notify.info('Fonction en développement - Nécessite accès root');
}

async function stopPacketCapture() {
    notify.info('Capture arrêtée');
}

async function spoofMAC() {
    notify.warning('Fonction dangereuse - Nécessite accès root');
}

async function resetMAC() {
    notify.info('MAC reset');
}

async function monitorBandwidth() {
    notify.info('Monitoring en développement');
}

// Initialiser au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
    initAdminPanel();
}


