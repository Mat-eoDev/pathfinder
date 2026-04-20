// PathFinder - Panneau d'Administration (Pentest Mode)
// Accès : /admin pour les comptes dont le JWT contient role='admin' (vérifié côté backend).

let adminPanelActive = false;

// ========== INITIALISATION ADMIN PANEL ==========

function initAdminPanel() {
    const path = window.location.pathname + window.location.hash;
    if (!path.includes('/admin') && !path.includes('#admin')) return;

    let user = null;
    try { user = JSON.parse(localStorage.getItem('userData') || 'null'); } catch (_) {}

    if (!user) {
        if (window.notify) notify.error('🔒 Connectez-vous en tant qu\'administrateur');
        return;
    }
    if (user.role !== 'admin') {
        if (window.notify) notify.error('❌ Accès réservé aux administrateurs');
        return;
    }

    adminPanelActive = true;
    showAdminPentestPanel();
    if (window.notify) notify.success('🔓 Mode Pentest Activé');
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
                    <h4>🔓 Hash Cracker Pro</h4>
                    <p>Cracker hashes avec rockyou.txt (14M passwords)</p>
                    <textarea id="hash-input" placeholder="Entrer hash..." class="admin-textarea"></textarea>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <select id="hash-type" class="admin-input">
                            <option value="md5">MD5</option>
                            <option value="sha1">SHA1</option>
                            <option value="sha256" selected>SHA256</option>
                        </select>
                        <select id="hash-wordlist" class="admin-input">
                            <option value="common">Common (500)</option>
                            <option value="top10k">Top 10k</option>
                            <option value="rockyou" selected>RockYou (14M)</option>
                        </select>
                    </div>
                    <div style="margin-top: 10px;">
                        <label style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                            <span>Max tentatives:</span>
                            <input type="number" id="hash-max-attempts" value="14344391" min="1000" max="14344391" step="100000" class="admin-input" style="width: 140px;" />
                            <span style="font-size: 11px;">(14.3M = complet)</span>
                        </label>
                    </div>
                    <button onclick="crackHash()" class="attack-btn warning" style="margin-top: 10px;">🔨 Cracker</button>
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
            addPentestLog(`Port scan terminé: ${data.open_ports?.length || 0} ports ouverts sur ${data.total_ports_scanned} scannés`, 'success');
            notify.success(`✅ ${data.open_ports?.length || 0} ports ouverts trouvés`);
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
            addPentestLog(`Erreur port scan: ${data.message}`, 'error');
            notify.error(data.message);
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        addPentestLog(`Erreur port scan: ${error.message}`, 'error');
        notify.error('Erreur connexion API');
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
            if (data.success) {
                resultDiv.innerHTML = `
                    <div class="error" style="padding: 20px;">
                        <div style="font-size: 20px; margin-bottom: 15px;">🚨 VULNÉRABLE - Mot de passe trouvé !</div>
                        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <div style="font-family: monospace; font-size: 16px; color: #10B981;">
                                Username: <strong>${data.username}</strong><br>
                                Password: <strong>${data.password}</strong>
                                ${data.access_level ? `<br>Access: <strong>${data.access_level}</strong>` : ''}
                            </div>
                        </div>
                        <div style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">
                            ⏱️ Temps: ${data.duration} | 🔄 Tentatives: ${data.attempts} | 📡 Méthode: ${data.method}
                        </div>
                        <div style="margin-top: 15px; padding: 12px; background: rgba(239, 68, 68, 0.2); border-radius: 6px;">
                            <strong>⚠️ Actions recommandées:</strong><br>
                            • Changer ce mot de passe IMMÉDIATEMENT<br>
                            • Désactiver authentification par mot de passe (clés SSH)<br>
                            • Installer fail2ban<br>
                            • Auditer logs pour tentatives suspectes
                        </div>
                    </div>
                `;
                notify.error(`🚨 MOT DE PASSE TROUVÉ: ${data.password}`);
                addPentestLog(`⚠️ VULNÉRABLE: Password = ${data.password}`, 'error');
            } else {
                resultDiv.innerHTML = `
                    <div class="success">
                        ✅ Aucun mot de passe courant trouvé - SSH semble sécurisé
                        <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                            ⏱️ Temps: ${data.duration} | 🔄 Tentatives: ${data.attempts} | 📡 Méthode: ${data.method}
                        </div>
                        ${data.info ? `<div style="margin-top: 10px; padding: 10px; background: rgba(6, 182, 212, 0.1); border-radius: 6px; font-size: 13px;">${data.info}</div>` : ''}
                    </div>
                `;
                notify.success('✅ SSH sécurisé contre mots de passe courants');
                addPentestLog(`Bruteforce: ${data.attempts} tentatives - Aucun succès`, 'success');
            }
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
            notify.error(data.message);
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
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
            const critical = found.filter(r => r.path.includes('.git') || r.path.includes('.env'));
            const protected = found.filter(r => r.status === 403 || r.status === 401);
            const accessible = found.filter(r => r.status === 200);
            
            resultDiv.innerHTML = `
                <div class="${critical.length > 0 ? 'error' : 'success'}">
                    ${critical.length > 0 ? '🚨 FICHIERS CRITIQUES EXPOSÉS !' : '✅ Scan terminé'}
                    <div style="margin-top: 10px; font-size: 14px;">
                        📁 Total trouvés: ${found.length} | 
                        ✅ Accessibles: ${accessible.length} | 
                        🔒 Protégés: ${protected.length} | 
                        🚨 Critiques: ${critical.length}
                    </div>
                    ${data.scan_time ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">⏱️ ${data.scan_time}</div>` : ''}
                </div>
                <div class="results-list" style="margin-top: 15px; max-height: 400px; overflow-y: auto;">
                    ${found.map(r => {
                        const isCritical = r.path.includes('.git') || r.path.includes('.env') || r.path.includes('config') || r.path.includes('backup');
                        const statusColor = r.status === 200 ? 'var(--success)' : r.status === 403 || r.status === 401 ? 'var(--warning)' : 'var(--info)';
                        
                        return `
                        <div class="result-item" style="border-left: 3px solid ${isCritical ? 'var(--danger)' : statusColor};">
                            <span class="status-badge status-${r.status}" style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${r.status}</span>
                            <code style="flex: 1; color: ${isCritical ? 'var(--danger)' : 'var(--text)'}; font-weight: ${isCritical ? '600' : '400'};">
                                ${r.path}${isCritical ? ' ⚠️' : ''}
                            </code>
                            <span class="size-badge" style="color: var(--text-muted); font-size: 12px;">${r.size || 'N/A'}</span>
                            ${r.url ? `<a href="${r.url}" target="_blank" style="color: var(--primary); text-decoration: none; font-size: 12px;">🔗</a>` : ''}
                        </div>
                    `}).join('')}
                </div>
                ${critical.length > 0 ? `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(239, 68, 68, 0.15); border-radius: 8px; border-left: 4px solid var(--danger);">
                        <strong style="color: var(--danger);">⚠️ ALERTE SÉCURITÉ:</strong><br>
                        <div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
                            ${critical.length} fichier(s) critique(s) exposé(s) (.git, .env, config, backup)<br>
                            → Risque de fuite de credentials, code source, secrets<br>
                            → Bloquer immédiatement via .htaccess ou Nginx
                        </div>
                    </div>
                ` : ''}
            `;
            addPentestLog(`Directory busting: ${found.length} trouvés (${critical.length} critiques)`, critical.length > 0 ? 'error' : 'success');
            
            if (critical.length > 0) {
                notify.error(`🚨 ${critical.length} fichier(s) critique(s) exposé(s) !`);
            } else {
                notify.success(`✅ ${found.length} chemins trouvés`);
            }
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
            notify.error(data.message || 'Erreur scan');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target: target })
        });
        
        const data = await response.json();
        
        if (response.ok && data.vulnerabilities) {
            const critical = data.vulnerabilities.filter(v => v.severity === 'critical');
            const high = data.vulnerabilities.filter(v => v.severity === 'high');
            const medium = data.vulnerabilities.filter(v => v.severity === 'medium');
            
            resultDiv.innerHTML = `
                <div class="${critical.length > 0 ? 'error' : 'success'}">
                    ${critical.length > 0 ? '🚨 VULNÉRABILITÉS CRITIQUES DÉTECTÉES' : '✅ Scan terminé'}
                    <div style="margin-top: 10px; font-size: 14px;">
                        Total: ${data.vulnerabilities.length} CVEs | 
                        🔴 Critiques: ${critical.length} | 
                        🟠 Hautes: ${high.length} | 
                        🟡 Moyennes: ${medium.length}
                    </div>
                    ${data.scan_time ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">⏱️ ${data.scan_time} | 📡 ${data.services_scanned || 0} services scannés</div>` : ''}
                </div>
                <div class="cve-list" style="margin-top: 15px; max-height: 500px; overflow-y: auto;">
                    ${data.vulnerabilities.map(v => {
                        const severityColor = {
                            'critical': 'var(--danger)',
                            'high': 'var(--warning)',
                            'medium': 'var(--info)',
                            'low': 'var(--success)'
                        }[v.severity] || 'var(--text-muted)';
                        
                        return `
                        <div class="cve-item" style="background: var(--bg); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${severityColor};">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div>
                                    <span class="severity ${v.severity}" style="background: ${severityColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                                        ${v.cve_id}
                                    </span>
                                    ${v.name ? `<span style="color: var(--text); font-weight: 600; margin-left: 10px; font-size: 14px;">${v.name}</span>` : ''}
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    ${v.cvss ? `<span style="color: var(--text-muted); font-size: 12px;">CVSS: ${v.cvss}</span>` : ''}
                                    ${v.exploit_available ? `<span style="color: var(--danger); font-size: 12px;">💣 Exploit dispo</span>` : ''}
                                </div>
                            </div>
                            <div style="color: var(--text); font-size: 14px; margin-bottom: 8px;">
                                ${v.description}
                            </div>
                            <div style="display: flex; gap: 15px; font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
                                ${v.service ? `<span>🔌 Service: <strong>${v.service}</strong></span>` : ''}
                                ${v.port ? `<span>📍 Port: <strong>${v.port}</strong></span>` : ''}
                                ${v.impact ? `<span>💥 Impact: <strong>${v.impact}</strong></span>` : ''}
                            </div>
                            ${v.mitigation ? `
                                <div style="margin-top: 10px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; font-size: 13px;">
                                    <strong style="color: var(--success);">✅ Mitigation:</strong> ${v.mitigation}
                                </div>
                            ` : ''}
                            <div style="margin-top: 10px; display: flex; gap: 10px;">
                                <a href="https://nvd.nist.gov/vuln/detail/${v.cve_id}" target="_blank" style="color: var(--primary); text-decoration: none; font-size: 12px;">📚 NVD</a>
                                <a href="https://www.cvedetails.com/cve/${v.cve_id}/" target="_blank" style="color: var(--primary); text-decoration: none; font-size: 12px;">🔍 Details</a>
                                ${v.exploit_available ? `<a href="https://www.exploit-db.com/search?cve=${v.cve_id}" target="_blank" style="color: var(--danger); text-decoration: none; font-size: 12px;">💣 Exploits</a>` : ''}
                            </div>
                        </div>
                    `}).join('')}
                </div>
                ${critical.length > 0 ? `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(239, 68, 68, 0.15); border-radius: 8px; border-left: 4px solid var(--danger);">
                        <strong style="color: var(--danger);">🚨 ACTION URGENTE REQUISE:</strong><br>
                        <div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
                            ${critical.length} vulnérabilité(s) CRITIQUE(s) avec exploits disponibles<br>
                            → Patcher immédiatement ou isoler du réseau<br>
                            → Consulter les mitigations ci-dessus
                        </div>
                    </div>
                ` : ''}
            `;
            addPentestLog(`CVE scan: ${data.vulnerabilities.length} CVEs (${critical.length} critiques)`, critical.length > 0 ? 'error' : 'success');
            
            if (critical.length > 0) {
                notify.error(`🚨 ${critical.length} CVE(s) CRITIQUE(s) détectée(s) !`);
            } else {
                notify.success(`✅ ${data.vulnerabilities.length} CVE(s) détectée(s)`);
            }
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
            notify.error(data.message || 'Erreur scan');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: target,
                exploit_type: exploitType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const confColor = {
                'low': 'var(--info)',
                'medium': 'var(--warning)',
                'high': 'var(--danger)',
                'confirmed': 'var(--danger)'
            }[data.confidence] || 'var(--text-muted)';
            
            resultDiv.innerHTML = `
                <div class="${data.vulnerable ? 'error' : 'success'}" style="padding: 20px;">
                    <div style="font-size: 20px; margin-bottom: 10px;">
                        ${data.vulnerable ? '🚨 SYSTÈME VULNÉRABLE' : '✅ Système Sécurisé'}
                    </div>
                    <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 15px;">
                        ${data.info}
                    </div>
                    ${data.confidence ? `
                        <div style="margin-bottom: 15px;">
                            <span style="color: var(--text-muted); font-size: 13px;">Confiance: </span>
                            <span style="color: ${confColor}; font-weight: 600; font-size: 13px;">${data.confidence.toUpperCase()}</span>
                        </div>
                    ` : ''}
                    ${data.details && Object.keys(data.details).length > 0 ? `
                        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <strong>📋 Détails Techniques:</strong>
                            <div style="margin-top: 10px; font-family: monospace; font-size: 13px; color: var(--text-muted);">
                                ${Object.entries(data.details).map(([key, value]) => {
                                    if (typeof value === 'object') return '';
                                    return `<div><strong>${key}:</strong> ${value}</div>`;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${data.recommendations && data.recommendations.length > 0 ? `
                        <div style="margin-top: 15px; padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border-left: 4px solid var(--success);">
                            <strong style="color: var(--success);">✅ Recommandations:</strong>
                            <ul style="margin: 10px 0 0 20px; font-size: 13px; color: var(--text-muted); line-height: 1.8;">
                                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
            addPentestLog(`Exploit ${data.exploit}: ${data.vulnerable ? 'VULNÉRABLE (' + data.confidence + ')' : 'Sécurisé'}`, data.vulnerable ? 'error' : 'success');
            
            if (data.vulnerable) {
                notify.error(`🚨 Vulnérable à ${data.exploit.toUpperCase()}`);
            } else {
                notify.success(`✅ Non vulnérable à ${data.exploit.toUpperCase()}`);
            }
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
            notify.error(data.message);
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function launchNetworkMapping() {
    const range = document.getElementById('netmap-range').value;
    const resultDiv = document.getElementById('netmap-result');
    
    if (!range) {
        notify.error('Entrer une plage réseau');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Cartographie réseau en cours... (peut prendre 2-5 min)</div>';
    addPentestLog(`Network mapping: ${range}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/network-map`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                network_range: range
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = `
                <div class="success">
                    ✅ Cartographie terminée
                    <div style="margin-top: 10px; font-size: 14px;">
                        📊 Réseau: ${data.network}<br>
                        🖥️ Hôtes totaux: ${data.total_hosts || 0}<br>
                        ✅ Hôtes actifs: ${data.alive_hosts || 0}<br>
                        🌐 Gateway: ${data.gateway || 'N/A'}<br>
                        📡 DNS: ${data.dns_servers?.join(', ') || 'N/A'}<br>
                        ⏱️ Temps: ${data.scan_time || 'N/A'}
                    </div>
                </div>
                ${data.hosts && data.hosts.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <strong>Hôtes actifs détectés:</strong>
                        <div class="hosts-list" style="margin-top: 10px; max-height: 300px; overflow-y: auto;">
                            ${data.hosts.map(h => `
                                <div style="padding: 8px; background: var(--bg); border-radius: 6px; margin-bottom: 5px; font-family: monospace;">
                                    💻 ${h.ip || h} ${h.ports ? `(Ports: ${h.ports.join(', ')})` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
            addPentestLog(`Network mapping: ${data.alive_hosts || 0} hôtes actifs`, 'success');
            notify.success(`✅ ${data.alive_hosts || 0} hôte(s) actif(s) détecté(s)`);
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || data.error || 'Erreur'}</div>`;
            notify.error(data.message || data.error || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function launchAdvancedScan() {
    const range = document.getElementById('advanced-range').value;
    const scanType = document.getElementById('scan-type').value;
    const scanSpeed = document.getElementById('scan-speed').value;
    const osDetect = document.getElementById('opt-os-detect').checked;
    const serviceVersion = document.getElementById('opt-service-version').checked;
    const scriptScan = document.getElementById('opt-script-scan').checked;
    const traceroute = document.getElementById('opt-traceroute').checked;
    const resultDiv = document.getElementById('advanced-scan-result');
    
    if (!range) {
        notify.error('Entrer une plage réseau');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Scan avancé en cours... (peut prendre 5-10 min)</div>';
    addPentestLog(`Advanced scan: ${range} (${scanType}, ${scanSpeed})`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/advanced-scan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                network_range: range,
                scan_type: scanType,
                scan_speed: scanSpeed,
                options: {
                    os_detect: osDetect,
                    service_version: serviceVersion,
                    script_scan: scriptScan,
                    traceroute: traceroute,
                    comprehensive: true
                }
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayPortScanResults(data, resultDiv);
            addPentestLog(`Advanced scan terminé: ${data.open_ports?.length || 0} ports`, 'success');
            notify.success(`✅ Scan avancé terminé`);
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
            notify.error(data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
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

// Fonctions tools additionnelles (RÉELLES)
async function crackHash() {
    const hashInput = document.getElementById('hash-input').value.trim();
    const hashType = document.getElementById('hash-type').value;
    const wordlistType = document.getElementById('hash-wordlist').value;
    const maxAttempts = parseInt(document.getElementById('hash-max-attempts').value) || 100000;
    const resultDiv = document.getElementById('hash-result');
    
    if (!hashInput) {
        notify.error('Entrer un hash');
        return;
    }
    
    const wordlistSizes = {
        'common': '500',
        'top10k': '10,000',
        'rockyou': '14,000,000'
    };
    
    resultDiv.innerHTML = `<div class="loading">⏳ Cracking en cours avec ${wordlistSizes[wordlistType]} passwords...<br><span style="font-size: 12px; color: var(--text-muted);">Peut prendre 10s à 5min selon la position du mot de passe</span></div>`;
    addPentestLog(`Hash crack: ${hashType} - ${wordlistType} (max ${maxAttempts})`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/hash-crack`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hash: hashInput,
                hash_type: hashType,
                wordlist_type: wordlistType,
                max_attempts: maxAttempts
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.error) {
                resultDiv.innerHTML = `
                    <div class="error" style="padding: 15px;">
                        ❌ ${data.error}
                        ${data.info ? `<div style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">${data.info}</div>` : ''}
                    </div>
                `;
                notify.error(data.error);
            } else if (data.success) {
                const position = data.attempts || 0;
                resultDiv.innerHTML = `
                    <div class="error" style="padding: 20px;">
                        <div style="font-size: 22px; margin-bottom: 15px; font-weight: 700;">🚨 HASH CRACKÉ !</div>
                        <div style="background: rgba(0,0,0,0.4); padding: 18px; border-radius: 8px; margin: 15px 0;">
                            <div style="font-family: monospace; font-size: 15px; color: #10B981; line-height: 1.8;">
                                Hash Type: <strong style="color: var(--text);">${data.hash_type?.toUpperCase() || hashType.toUpperCase()}</strong><br>
                                Password: <strong style="color: var(--danger); font-size: 20px; background: rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 4px;">${data.password}</strong><br>
                                Wordlist: <strong style="color: var(--text);">${data.wordlist || 'N/A'}</strong><br>
                                Position: <strong style="color: var(--warning);">#${position.toLocaleString()}</strong><br>
                                Tentatives: <strong style="color: var(--text);">${position.toLocaleString()}</strong><br>
                                Durée: <strong style="color: var(--text);">${data.duration || 'N/A'}</strong><br>
                                Vitesse: <strong style="color: var(--primary);">${data.hash_rate || 'N/A'}</strong>
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding: 15px; background: rgba(239, 68, 68, 0.15); border-radius: 8px; border-left: 4px solid var(--danger); font-size: 13px;">
                            <strong style="color: var(--danger);">⚠️ VULNÉRABILITÉ CRITIQUE:</strong><br>
                            <div style="margin-top: 8px; color: var(--text-muted); line-height: 1.6;">
                                • Ce mot de passe est à la position <strong>${position.toLocaleString()}</strong> dans rockyou.txt<br>
                                • Extrêmement vulnérable au bruteforce (cracké en ${data.duration || 'quelques secondes'})<br>
                                • Un attaquant avec hashcat peut le trouver instantanément<br>
                                • <strong style="color: var(--danger);">ACTION:</strong> Changer pour un mot de passe fort (16+ caractères aléatoires)
                            </div>
                        </div>
                    </div>
                `;
                notify.error(`🚨 Password: ${data.password} (position #${position.toLocaleString()})`);
                addPentestLog(`⚠️ Hash cracké: ${data.password} (position ${position})`, 'error');
            } else {
                const attempts = data.attempts || 0;
                resultDiv.innerHTML = `
                    <div class="success" style="padding: 15px;">
                        ✅ Hash résiste au cracking (excellent !)
                        <div style="margin-top: 15px; background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid var(--success);">
                            <div style="font-size: 13px; color: var(--text-muted); line-height: 1.6;">
                                Tentatives: <strong style="color: var(--text);">${attempts.toLocaleString()}</strong><br>
                                Durée: <strong style="color: var(--text);">${data.duration || 'N/A'}</strong><br>
                                Wordlist: <strong style="color: var(--text);">${data.wordlist || 'N/A'}</strong>
                            </div>
                            ${data.info ? `<div style="margin-top: 10px; padding: 10px; background: rgba(6, 182, 212, 0.1); border-radius: 6px; font-size: 12px;">${data.info}</div>` : ''}
                            <div style="margin-top: 12px; padding: 12px; background: rgba(16, 185, 129, 0.15); border-radius: 6px; font-size: 13px;">
                                <strong style="color: var(--success);">✅ BON MOT DE PASSE:</strong><br>
                                Le hash n'est pas dans les ${attempts.toLocaleString()} premiers mots de passe courants.<br>
                                Probablement un mot de passe fort ou unique.
                            </div>
                        </div>
                    </div>
                `;
                notify.success(`✅ Hash résiste (${attempts.toLocaleString()} tentatives)`);
                addPentestLog(`Hash crack: Résiste après ${attempts.toLocaleString()} tentatives`, 'success');
            }
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
            notify.error(data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function reverseDNS() {
    const ip = document.getElementById('rdns-ip').value.trim();
    const resultDiv = document.getElementById('rdns-result');
    
    if (!ip) {
        notify.error('Entrer une IP');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Résolution en cours...</div>';
    addPentestLog(`Reverse DNS: ${ip}`, 'info');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/reverse-dns`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ip: ip
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.hostname) {
                resultDiv.innerHTML = `
                    <div class="success" style="padding: 15px;">
                        ✅ Reverse DNS trouvé
                        <div style="margin-top: 10px; font-family: monospace; font-size: 14px;">
                            IP: <strong>${data.ip}</strong><br>
                            Hostname: <strong>${data.hostname}</strong><br>
                            ${data.aliases && data.aliases.length > 0 ? `Aliases: ${data.aliases.join(', ')}<br>` : ''}
                            ${data.addresses && data.addresses.length > 0 ? `Addresses: ${data.addresses.join(', ')}` : ''}
                        </div>
                    </div>
                `;
                notify.success(`Hostname: ${data.hostname}`);
                addPentestLog(`Reverse DNS: ${data.hostname}`, 'success');
            } else {
                resultDiv.innerHTML = `
                    <div class="info" style="padding: 15px;">
                        ❌ ${data.error || 'Pas de reverse DNS'}
                    </div>
                `;
                notify.info('Pas de reverse DNS');
            }
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.message || 'Erreur'}</div>`;
            notify.error(data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function whoisLookup() {
    const target = document.getElementById('whois-target').value.trim();
    const resultDiv = document.getElementById('whois-result');
    
    if (!target) {
        notify.error('Entrer un domaine ou IP');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ WHOIS lookup en cours...</div>';
    addPentestLog(`WHOIS: ${target}`, 'info');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/whois`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: target
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div class="success" style="padding: 15px;">
                    ✅ WHOIS récupéré
                    <div style="margin-top: 10px; max-height: 400px; overflow-y: auto; background: var(--bg); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">
                        ${data.whois_data || 'Aucune donnée'}
                    </div>
                </div>
            `;
            notify.success('WHOIS récupéré');
            addPentestLog(`WHOIS: ${target} - Données récupérées`, 'success');
        } else {
            resultDiv.innerHTML = `
                <div class="info" style="padding: 15px;">
                    ❌ ${data.error || 'Erreur WHOIS'}
                    ${data.error && data.error.includes('install') ? `
                        <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                            Installer: <code>brew install whois</code> (macOS) ou <code>apt install whois</code> (Linux)
                        </div>
                    ` : ''}
                </div>
            `;
            notify.info(data.error || 'Erreur WHOIS');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

let currentCaptureId = null;

async function startPacketCapture() {
    const interface = document.getElementById('sniff-interface').value;
    const resultDiv = document.getElementById('sniff-result');
    
    resultDiv.innerHTML = '<div class="loading">⏳ Démarrage capture...</div>';
    addPentestLog(`Packet capture: ${interface}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/packet-capture/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                interface: interface,
                duration: 60
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentCaptureId = data.capture_id;
            resultDiv.innerHTML = `
                <div class="success" style="padding: 15px;">
                    ✅ Capture en cours
                    <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                        Interface: <strong>${data.interface}</strong><br>
                        Capture ID: <code>${data.capture_id}</code><br>
                        Fichier: <code>${data.output_file}</code><br>
                        Status: <strong>${data.status}</strong>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; font-size: 12px;">
                        ${data.info || 'Capture de 100 paquets...'}
                    </div>
                </div>
            `;
            notify.success('Capture démarrée');
            addPentestLog(`Capture démarrée: ${data.capture_id}`, 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.error || data.message || 'Erreur'}</div>`;
            notify.error(data.error || data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function stopPacketCapture() {
    const resultDiv = document.getElementById('sniff-result');
    
    if (!currentCaptureId) {
        notify.error('Aucune capture en cours');
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ Arrêt capture...</div>';
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/packet-capture/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                capture_id: currentCaptureId
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div class="success" style="padding: 15px;">
                    ✅ Capture arrêtée
                    <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                        Paquets capturés: <strong>${data.packets_captured}</strong><br>
                        Taille fichier: <strong>${data.file_size}</strong><br>
                        Fichier PCAP: <code>${data.output_file}</code>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: rgba(6, 182, 212, 0.1); border-radius: 6px; font-size: 12px;">
                        💡 Analyser avec: <code>tcpdump -r ${data.output_file}</code> ou Wireshark
                    </div>
                </div>
            `;
            notify.success('Capture terminée');
            addPentestLog(`Capture terminée: ${data.packets_captured} paquets`, 'success');
            currentCaptureId = null;
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.error || data.message || 'Erreur'}</div>`;
            notify.error(data.error || data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function spoofMAC() {
    const newMAC = document.getElementById('mac-address').value.trim();
    const resultDiv = document.getElementById('mac-result');
    
    if (!confirm('⚠️ Changer MAC peut couper la connexion réseau. Continuer ?')) {
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">⏳ MAC spoofing...</div>';
    addPentestLog(`MAC spoofing: ${newMAC || 'aléatoire'}`, 'attack');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/mac-spoof`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                interface: 'en0',  // WiFi par défaut
                new_mac: newMAC || null
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div class="success" style="padding: 15px;">
                    ✅ MAC spoofée avec succès
                    <div style="margin-top: 10px; font-family: monospace; font-size: 14px; color: var(--text-muted);">
                        Interface: <strong>${data.interface}</strong><br>
                        Nouvelle MAC: <strong style="color: var(--danger);">${data.new_mac}</strong>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; font-size: 12px;">
                        ⚠️ ${data.info || 'Connexion réseau peut être interrompue'}
                    </div>
                </div>
            `;
            notify.warning(`MAC changée: ${data.new_mac}`);
            addPentestLog(`MAC spoofée: ${data.new_mac}`, 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.error || data.message || 'Erreur'}</div>`;
            notify.error(data.error || data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function resetMAC() {
    const resultDiv = document.getElementById('mac-result');
    
    resultDiv.innerHTML = '<div class="loading">⏳ Reset MAC...</div>';
    addPentestLog('MAC reset', 'info');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/mac-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                interface: 'en0'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div class="success" style="padding: 15px;">
                    ✅ MAC reset à la valeur d'origine
                    <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                        Interface: <strong>${data.interface}</strong><br>
                        ${data.info || 'Connexion réseau restaurée'}
                    </div>
                </div>
            `;
            notify.success('MAC reset');
            addPentestLog('MAC reset réussi', 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.error || data.message || 'Erreur'}</div>`;
            notify.error(data.error || data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

async function monitorBandwidth() {
    const resultDiv = document.getElementById('bandwidth-result');
    
    resultDiv.innerHTML = '<div class="loading">⏳ Monitoring pendant 10 secondes...</div>';
    addPentestLog('Bandwidth monitoring démarré', 'info');
    
    try {
        const response = await fetch(`${API_URL}/pentest/tools/bandwidth-monitor`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                interface: 'en0',
                duration: 10
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div class="success" style="padding: 15px;">
                    ✅ Monitoring terminé (${data.duration}s)
                    <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--text-muted);">⬆️ Upload</div>
                            <div style="font-size: 20px; font-weight: 600; color: var(--success);">${data.upload.mbps} Mbps</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${data.upload.human} | ${data.upload.packets} paquets</div>
                        </div>
                        <div style="background: rgba(6, 182, 212, 0.1); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--text-muted);">⬇️ Download</div>
                            <div style="font-size: 20px; font-weight: 600; color: var(--info);">${data.download.mbps} Mbps</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${data.download.human} | ${data.download.packets} paquets</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; text-align: center; font-size: 14px; color: var(--text-muted);">
                        Total: <strong style="color: var(--text);">${data.total_mbps} Mbps</strong>
                    </div>
                </div>
            `;
            notify.success(`Débit: ${data.total_mbps} Mbps`);
            addPentestLog(`Bandwidth: ${data.total_mbps} Mbps`, 'success');
        } else {
            resultDiv.innerHTML = `<div class="error">❌ ${data.error || data.message || 'Erreur'}</div>`;
            notify.error(data.error || data.message || 'Erreur');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">❌ Erreur: ${error.message}</div>`;
        notify.error('Erreur connexion API');
    }
}

// Initialiser au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
    initAdminPanel();
}


