#!/usr/bin/env python3
"""
Module de recommandations de sécurité pour PathFinder
Génère des solutions concrètes basées sur les vulnérabilités détectées
"""

# Base de connaissances des ports et vulnérabilités
PORT_VULNERABILITIES = {
    21: {
        "service": "FTP",
        "risk": "high",
        "description": "FTP transmet les données en clair (non chiffré)",
        "commands": [
            "# Désactiver FTP",
            "sudo systemctl stop vsftpd",
            "sudo systemctl disable vsftpd",
            "",
            "# Alternative sécurisée: SFTP",
            "sudo apt install openssh-server  # Ubuntu/Debian",
            "sudo yum install openssh-server  # CentOS/RHEL"
        ],
        "recommendations": [
            "Remplacer FTP par SFTP (SSH File Transfer Protocol)",
            "Si FTP nécessaire, utiliser FTPS (FTP over SSL/TLS)",
            "Implémenter une authentification forte",
            "Limiter l'accès par IP (whitelist)"
        ]
    },
    22: {
        "service": "SSH",
        "risk": "medium",
        "description": "SSH exposé - risque de bruteforce",
        "commands": [
            "# Durcir la configuration SSH",
            "sudo nano /etc/ssh/sshd_config",
            "",
            "# Ajouter ces lignes:",
            "PermitRootLogin no",
            "PasswordAuthentication no",
            "PubkeyAuthentication yes",
            "Port 2222  # Changer le port par défaut",
            "MaxAuthTries 3",
            "AllowUsers votre_user",
            "",
            "# Redémarrer SSH",
            "sudo systemctl restart sshd",
            "",
            "# Installer fail2ban (protection bruteforce)",
            "sudo apt install fail2ban",
            "sudo systemctl enable fail2ban",
            "sudo systemctl start fail2ban"
        ],
        "recommendations": [
            "Désactiver l'authentification par mot de passe",
            "Utiliser uniquement des clés SSH",
            "Changer le port par défaut (22 → 2222 ou autre)",
            "Installer fail2ban pour bloquer les tentatives de bruteforce",
            "Limiter les utilisateurs autorisés",
            "Utiliser 2FA (Google Authenticator)"
        ]
    },
    23: {
        "service": "Telnet",
        "risk": "critical",
        "description": "Telnet transmet TOUT en clair (mots de passe inclus) - DANGER",
        "commands": [
            "# DÉSACTIVER IMMÉDIATEMENT",
            "sudo systemctl stop telnet.socket",
            "sudo systemctl disable telnet.socket",
            "sudo apt remove telnetd  # Ubuntu/Debian",
            "",
            "# Utiliser SSH à la place",
            "sudo apt install openssh-server",
            "sudo systemctl enable ssh",
            "sudo systemctl start ssh"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Désactiver Telnet immédiatement",
            "Remplacer par SSH (chiffrement de bout en bout)",
            "Auditer les logs pour détection de compromission",
            "Changer tous les mots de passe utilisés via Telnet"
        ]
    },
    25: {
        "service": "SMTP",
        "risk": "medium",
        "description": "Serveur mail exposé - risque de spam/relay",
        "commands": [
            "# Sécuriser Postfix",
            "sudo nano /etc/postfix/main.cf",
            "",
            "# Ajouter:",
            "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination",
            "smtpd_recipient_restrictions = reject_unauth_destination",
            "smtpd_tls_security_level = may",
            "smtp_tls_security_level = may",
            "",
            "# Redémarrer",
            "sudo systemctl restart postfix",
            "",
            "# Installer SPF/DKIM/DMARC",
            "sudo apt install opendkim opendkim-tools"
        ],
        "recommendations": [
            "Configurer SPF, DKIM et DMARC",
            "Désactiver le relay ouvert (open relay)",
            "Activer TLS pour toutes les connexions",
            "Implémenter rate limiting",
            "Utiliser un service tiers (SendGrid, AWS SES) si possible"
        ]
    },
    80: {
        "service": "HTTP",
        "risk": "medium",
        "description": "Trafic web non chiffré",
        "commands": [
            "# Installer Certbot (Let's Encrypt)",
            "sudo apt install certbot python3-certbot-nginx",
            "",
            "# Obtenir un certificat SSL gratuit",
            "sudo certbot --nginx -d votre-domaine.com",
            "",
            "# Redirection automatique HTTP → HTTPS",
            "sudo certbot --nginx --redirect -d votre-domaine.com",
            "",
            "# Renouvellement automatique",
            "sudo systemctl enable certbot.timer",
            "sudo systemctl start certbot.timer"
        ],
        "recommendations": [
            "Migrer vers HTTPS (port 443)",
            "Obtenir un certificat SSL gratuit via Let's Encrypt",
            "Rediriger tout le trafic HTTP vers HTTPS",
            "Activer HSTS (HTTP Strict Transport Security)",
            "Configurer les en-têtes de sécurité (CSP, X-Frame-Options)"
        ]
    },
    443: {
        "service": "HTTPS",
        "risk": "low",
        "description": "Serveur web sécurisé",
        "commands": [
            "# Tester la configuration SSL",
            "sudo apt install testssl.sh",
            "testssl.sh votre-domaine.com",
            "",
            "# Durcir la config Nginx",
            "sudo nano /etc/nginx/nginx.conf",
            "",
            "# Ajouter:",
            "ssl_protocols TLSv1.2 TLSv1.3;",
            "ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';",
            "ssl_prefer_server_ciphers on;",
            "add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains';",
            "",
            "sudo systemctl reload nginx"
        ],
        "recommendations": [
            "Vérifier que TLS 1.2+ est utilisé (désactiver TLS 1.0/1.1)",
            "Tester avec SSL Labs (ssllabs.com/ssltest)",
            "Implémenter HSTS",
            "Configurer OCSP Stapling",
            "Maintenir les certificats à jour"
        ]
    },
    3306: {
        "service": "MySQL",
        "risk": "critical",
        "description": "Base de données exposée publiquement - DANGER",
        "commands": [
            "# NE JAMAIS exposer MySQL sur Internet",
            "sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf",
            "",
            "# Modifier:",
            "bind-address = 127.0.0.1  # Localhost uniquement",
            "",
            "# Redémarrer",
            "sudo systemctl restart mysql",
            "",
            "# Firewall: bloquer le port externe",
            "sudo ufw deny 3306/tcp",
            "sudo ufw allow from 192.168.1.0/24 to any port 3306  # Réseau local uniquement",
            "",
            "# Sécuriser MySQL",
            "sudo mysql_secure_installation"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Ne JAMAIS exposer MySQL sur Internet",
            "Lier MySQL à localhost (127.0.0.1) uniquement",
            "Utiliser un tunnel SSH pour l'accès distant",
            "Créer des utilisateurs avec des privilèges minimaux",
            "Activer les logs d'audit",
            "Chiffrer les connexions (SSL/TLS)",
            "Sauvegardes chiffrées régulières"
        ]
    },
    3389: {
        "service": "RDP",
        "risk": "critical",
        "description": "Remote Desktop exposé - cible favorite des attaques",
        "commands": [
            "# Windows: Restreindre RDP",
            "# 1. Ouvrir Firewall Windows",
            "# 2. Règle entrante RDP → Autoriser IPs spécifiques uniquement",
            "",
            "# PowerShell: Désactiver RDP si non nécessaire",
            "(Get-WmiObject Win32_TerminalServiceSetting -Namespace root\\cimv2\\TerminalServices).SetAllowTsConnections(0,0)",
            "",
            "# Alternative: VPN obligatoire",
            "# Installer WireGuard ou OpenVPN",
            "",
            "# Activer NLA (Network Level Authentication)",
            "(Get-WmiObject -class Win32_TSGeneralSetting -Namespace root\\cimv2\\TerminalServices).SetUserAuthenticationRequired(1)"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Ne JAMAIS exposer RDP sur Internet",
            "Utiliser un VPN (WireGuard, OpenVPN) obligatoirement",
            "Activer Network Level Authentication (NLA)",
            "Utiliser des mots de passe forts + 2FA",
            "Changer le port par défaut (3389 → autre)",
            "Limiter par IP (whitelist)",
            "Préférer des solutions modernes (ZeroTier, Tailscale)"
        ]
    },
    5432: {
        "service": "PostgreSQL",
        "risk": "critical",
        "description": "Base de données exposée",
        "commands": [
            "# Sécuriser PostgreSQL",
            "sudo nano /etc/postgresql/*/main/postgresql.conf",
            "",
            "# Modifier:",
            "listen_addresses = 'localhost'",
            "",
            "# pg_hba.conf",
            "sudo nano /etc/postgresql/*/main/pg_hba.conf",
            "",
            "# Autoriser seulement le réseau local:",
            "host all all 127.0.0.1/32 scram-sha-256",
            "",
            "sudo systemctl restart postgresql"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Écouter sur localhost uniquement",
            "Tunnel SSH pour accès distant",
            "Activer SSL/TLS obligatoire",
            "Utiliser SCRAM-SHA-256 (pas MD5)",
            "Privilèges minimaux par utilisateur"
        ]
    },
    6379: {
        "service": "Redis",
        "risk": "critical",
        "description": "Redis sans authentification - accès total aux données",
        "commands": [
            "# Sécuriser Redis",
            "sudo nano /etc/redis/redis.conf",
            "",
            "# Ajouter/modifier:",
            "bind 127.0.0.1",
            "requirepass VotreMotDePasseTresComplexe123!",
            "rename-command FLUSHDB ''",
            "rename-command FLUSHALL ''",
            "rename-command CONFIG 'CONFIG_a1b2c3d4'",
            "",
            "sudo systemctl restart redis"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Toujours activer l'authentification",
            "Écouter sur localhost uniquement",
            "Renommer/désactiver les commandes dangereuses",
            "Utiliser Redis 6+ avec ACLs",
            "Activer TLS si accès réseau nécessaire"
        ]
    },
    8080: {
        "service": "HTTP-ALT",
        "risk": "medium",
        "description": "Serveur web alternatif (souvent dev/admin)",
        "commands": [
            "# Si non utilisé, désactiver",
            "sudo systemctl stop <service>",
            "",
            "# Si utilisé: ajouter authentification",
            "# Nginx: basic auth",
            "sudo apt install apache2-utils",
            "sudo htpasswd -c /etc/nginx/.htpasswd admin",
            "",
            "# Dans nginx.conf:",
            "auth_basic 'Restricted';",
            "auth_basic_user_file /etc/nginx/.htpasswd;",
            "",
            "sudo systemctl reload nginx"
        ],
        "recommendations": [
            "Vérifier si ce service est nécessaire",
            "Ajouter une authentification",
            "Firewall: limiter par IP",
            "Utiliser un reverse proxy avec SSL"
        ]
    },
    27017: {
        "service": "MongoDB",
        "risk": "critical",
        "description": "MongoDB exposé - nombreuses violations de données connues",
        "commands": [
            "# Sécuriser MongoDB",
            "sudo nano /etc/mongod.conf",
            "",
            "# Modifier:",
            "net:",
            "  bindIp: 127.0.0.1",
            "security:",
            "  authorization: enabled",
            "",
            "# Créer un admin",
            "mongo",
            "use admin",
            "db.createUser({user:'admin', pwd:'MotDePasseComplexe', roles:[{role:'userAdminAnyDatabase', db:'admin'}]})",
            "",
            "sudo systemctl restart mongod"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Activer l'authentification IMMÉDIATEMENT",
            "Écouter sur localhost uniquement",
            "Créer des utilisateurs avec privilèges minimaux",
            "Activer TLS",
            "Auditer régulièrement les accès"
        ]
    }
}

# Recommandations par niveau de risque
RISK_LEVEL_ACTIONS = {
    "critical": {
        "priority": "🔴 URGENT - À corriger immédiatement",
        "timeline": "Dans les 24 heures",
        "general_advice": [
            "Isoler le système du réseau si possible",
            "Auditer les logs pour détecter une compromission",
            "Notifier l'équipe de sécurité",
            "Planifier une maintenance d'urgence"
        ]
    },
    "high": {
        "priority": "🟠 Important - À corriger rapidement",
        "timeline": "Dans la semaine",
        "general_advice": [
            "Planifier une intervention",
            "Augmenter la surveillance (logs, monitoring)",
            "Évaluer l'impact potentiel",
            "Préparer un plan de remédiation"
        ]
    },
    "medium": {
        "priority": "🟡 Moyen - À planifier",
        "timeline": "Dans le mois",
        "general_advice": [
            "Ajouter à la roadmap sécurité",
            "Évaluer les risques",
            "Prioriser selon le contexte métier"
        ]
    },
    "low": {
        "priority": "🟢 Faible - Amélioration continue",
        "timeline": "Quand possible",
        "general_advice": [
            "Maintenir les bonnes pratiques",
            "Surveiller les évolutions",
            "Former les équipes"
        ]
    }
}

def get_port_recommendations(port):
    """Retourne les recommandations pour un port spécifique."""
    return PORT_VULNERABILITIES.get(port, {
        "service": f"Port {port}",
        "risk": "low",
        "description": "Service non référencé dans la base de connaissances",
        "commands": [
            f"# Identifier le service",
            f"sudo lsof -i :{port}",
            f"sudo netstat -tlnp | grep :{port}",
            "",
            f"# Si non utilisé, fermer le port",
            f"sudo ufw deny {port}/tcp"
        ],
        "recommendations": [
            "Identifier le service qui écoute sur ce port",
            "Vérifier s'il est nécessaire",
            "Appliquer le principe du moindre privilège",
            "Documenter l'usage du port"
        ]
    })

def generate_host_recommendations(host_data):
    """
    Génère des recommandations complètes pour un hôte.
    
    Args:
        host_data: dict contenant ip_address, open_ports, risk_level, etc.
    
    Returns:
        dict avec recommendations structurées
    """
    recommendations = {
        "host_summary": {
            "ip": host_data.get('ip_address'),
            "hostname": host_data.get('hostname', 'N/A'),
            "os": host_data.get('os_detected', 'Inconnu'),
            "risk_level": host_data.get('risk_level', 'low'),
            "priority_score": host_data.get('priority_score', 0)
        },
        "global_assessment": RISK_LEVEL_ACTIONS.get(host_data.get('risk_level', 'low')),
        "ports_analysis": [],
        "quick_wins": [],
        "strategic_actions": []
    }
    
    # Analyser chaque port ouvert
    open_ports = host_data.get('open_ports', [])
    critical_count = 0
    high_count = 0
    
    for port_info in open_ports:
        port = port_info.get('port') if isinstance(port_info, dict) else port_info
        port_rec = get_port_recommendations(port)
        
        recommendations["ports_analysis"].append({
            "port": port,
            "service": port_rec.get("service"),
            "risk": port_rec.get("risk"),
            "description": port_rec.get("description"),
            "commands": port_rec.get("commands"),
            "recommendations": port_rec.get("recommendations")
        })
        
        if port_rec.get("risk") == "critical":
            critical_count += 1
        elif port_rec.get("risk") == "high":
            high_count += 1
    
    # Quick wins (actions rapides à fort impact)
    if critical_count > 0:
        recommendations["quick_wins"].append({
            "action": "Firewall immédiat",
            "commands": [
                "# Bloquer TOUS les ports critiques",
                "sudo ufw enable",
                *[f"sudo ufw deny {p['port']}/tcp  # {p['service']}" 
                  for p in recommendations["ports_analysis"] 
                  if p['risk'] == 'critical']
            ],
            "impact": "Réduit immédiatement la surface d'attaque"
        })
    
    # Actions stratégiques
    if any(p['port'] in [80, 8080] for p in recommendations["ports_analysis"]):
        recommendations["strategic_actions"].append({
            "title": "Migration HTTPS",
            "description": "Chiffrer tout le trafic web",
            "steps": [
                "Obtenir certificat SSL (Let's Encrypt gratuit)",
                "Configurer HTTPS sur le serveur",
                "Rediriger HTTP → HTTPS",
                "Activer HSTS"
            ],
            "resources": [
                "https://letsencrypt.org/",
                "https://certbot.eff.org/"
            ]
        })
    
    if any(p['port'] in [3306, 5432, 27017, 6379] for p in recommendations["ports_analysis"]):
        recommendations["strategic_actions"].append({
            "title": "Isolation des bases de données",
            "description": "Ne JAMAIS exposer les BDD sur Internet",
            "steps": [
                "Lier à localhost uniquement (bind 127.0.0.1)",
                "Configurer un VPN pour accès distant",
                "Activer authentification forte",
                "Chiffrer les connexions (TLS)",
                "Sauvegardes chiffrées régulières"
            ],
            "resources": [
                "https://www.wireguard.com/",
                "https://openvpn.net/"
            ]
        })
    
    return recommendations

def generate_scan_report(scan_data):
    """
    Génère un rapport complet avec recommandations pour tout le scan.
    
    Args:
        scan_data: dict avec 'hosts' (list) et métadonnées du scan
    
    Returns:
        dict avec rapport complet
    """
    hosts = scan_data.get('hosts', [])
    
    report = {
        "executive_summary": {
            "total_hosts": len(hosts),
            "critical_hosts": sum(1 for h in hosts if h.get('risk_level') == 'critical'),
            "high_risk_hosts": sum(1 for h in hosts if h.get('risk_level') == 'high'),
            "score": 0  # Calculé ci-dessous
        },
        "hosts_recommendations": [],
        "network_wide_actions": []
    }
    
    # Générer les recommandations pour chaque hôte
    for host in hosts:
        host_rec = generate_host_recommendations(host)
        report["hosts_recommendations"].append(host_rec)
    
    # Actions réseau globales
    if report["executive_summary"]["critical_hosts"] > 0:
        report["network_wide_actions"].append({
            "priority": "URGENT",
            "action": "Audit de sécurité complet",
            "description": f"{report['executive_summary']['critical_hosts']} hôte(s) à risque critique détecté(s)",
            "steps": [
                "Isoler les systèmes critiques",
                "Auditer tous les logs récents",
                "Vérifier l'absence de compromission",
                "Implémenter les correctifs",
                "Renforcer la surveillance"
            ]
        })
    
    # Calcul du score de sécurité (0-100, 100 = parfait)
    total_risk_points = (
        report["executive_summary"]["critical_hosts"] * 10 +
        report["executive_summary"]["high_risk_hosts"] * 5
    )
    report["executive_summary"]["score"] = max(0, 100 - total_risk_points)
    
    return report

