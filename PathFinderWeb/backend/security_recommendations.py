#!/usr/bin/env python3
"""
PathFinder Security Recommendations Engine
Version: 2.0 - Professional Edition

Génère des recommandations de sécurité exhaustives avec:
- Base de connaissances de 25+ services
- Références CVE et standards de conformité
- Scripts de remédiation automatisés
- Estimations de temps et difficulté
- Priorisation intelligente
"""

# Base de connaissances exhaustive des ports et vulnérabilités
PORT_VULNERABILITIES = {
    20: {
        "service": "FTP Data",
        "risk": "high",
        "category": "File Transfer",
        "cve_refs": ["CVE-2015-1635"],
        "compliance": {"CIS": "9.2.1", "NIST": "SC-8"},
        "description": "Canal de données FTP non chiffré - Man-in-the-Middle possible",
        "difficulty": "facile",
        "estimated_time": "10 min",
        "commands": [
            "# Désactiver FTP",
            "sudo systemctl stop vsftpd",
            "sudo systemctl disable vsftpd",
            "",
            "# Vérifier qu'aucun processus n'écoute",
            "sudo netstat -tlnp | grep :20",
            "",
            "# Alternative: SFTP",
            "sudo apt install openssh-server"
        ],
        "recommendations": [
            "Remplacer par SFTP (SSH File Transfer)",
            "Si FTP requis absolument, utiliser FTPS (SSL/TLS)",
            "Segmenter le réseau (VLAN dédié)",
            "Logging et monitoring obligatoires"
        ],
        "automation_script": "disable_ftp.sh"
    },
    21: {
        "service": "FTP Control",
        "risk": "high",
        "category": "File Transfer",
        "cve_refs": ["CVE-2021-28169", "CVE-2020-9281"],
        "compliance": {"CIS": "9.2.1", "NIST": "SC-8", "PCI-DSS": "4.1"},
        "description": "FTP transmet identifiants en clair - credentials exposure",
        "difficulty": "facile",
        "estimated_time": "15 min",
        "commands": [
            "# Audit: qui utilise FTP ?",
            "sudo lsof -i :21",
            "sudo grep -r 'ftp' /etc/services",
            "",
            "# Désactiver FTP",
            "sudo systemctl stop vsftpd",
            "sudo systemctl disable vsftpd",
            "sudo apt remove vsftpd",
            "",
            "# Alternative sécurisée: SFTP",
            "sudo apt install openssh-server",
            "sudo systemctl enable ssh",
            "",
            "# Configuration SFTP chroot (isolation)",
            "sudo nano /etc/ssh/sshd_config",
            "# Ajouter:",
            "Match Group sftpusers",
            "    ChrootDirectory /home/%u",
            "    ForceCommand internal-sftp",
            "    AllowTcpForwarding no"
        ],
        "recommendations": [
            "⚠️ CRITIQUE: Remplacer FTP par SFTP immédiatement",
            "Migrer tous les utilisateurs vers SFTP/SSH",
            "Si FTPS obligatoire: certificats valides + TLS 1.2+",
            "Changer TOUS les mots de passe utilisés via FTP",
            "Auditer logs pour détection de compromission",
            "Implémenter chroot jail pour isoler les utilisateurs"
        ],
        "automation_script": "migrate_ftp_to_sftp.sh",
        "references": [
            "https://www.ssh.com/academy/ssh/sftp",
            "https://www.cisecurity.org/controls"
        ]
    },
    22: {
        "service": "SSH",
        "risk": "medium",
        "category": "Remote Access",
        "cve_refs": ["CVE-2023-38408", "CVE-2021-36368"],
        "compliance": {"CIS": "5.2.1-5.2.20", "NIST": "IA-2(1)"},
        "description": "SSH exposé publiquement - cible de bruteforce et exploits",
        "difficulty": "moyen",
        "estimated_time": "30 min",
        "commands": [
            "# Sauvegarde de la config actuelle",
            "sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup",
            "",
            "# Durcissement SSH (CIS Benchmarks)",
            "sudo nano /etc/ssh/sshd_config",
            "",
            "# Configuration recommandée:",
            "Port 2222  # Changer le port par défaut",
            "PermitRootLogin no",
            "PasswordAuthentication no",
            "PubkeyAuthentication yes",
            "MaxAuthTries 3",
            "MaxSessions 2",
            "ClientAliveInterval 300",
            "ClientAliveCountMax 2",
            "AllowUsers votre_user  # Liste blanche",
            "Protocol 2",
            "LogLevel VERBOSE",
            "X11Forwarding no",
            "PermitEmptyPasswords no",
            "",
            "# Algorithmes cryptographiques forts uniquement",
            "Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com",
            "MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com",
            "KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org",
            "",
            "# Tester la configuration",
            "sudo sshd -t",
            "",
            "# Redémarrer",
            "sudo systemctl restart sshd",
            "",
            "# Installer fail2ban (protection bruteforce)",
            "sudo apt install fail2ban",
            "sudo systemctl enable fail2ban",
            "sudo systemctl start fail2ban",
            "",
            "# Configurer fail2ban pour SSH",
            "sudo nano /etc/fail2ban/jail.local",
            "# Ajouter:",
            "[sshd]",
            "enabled = true",
            "port = 2222",
            "maxretry = 3",
            "bantime = 3600",
            "findtime = 600"
        ],
        "recommendations": [
            "🔒 PRIORITAIRE: Désactiver authentification par mot de passe",
            "Utiliser UNIQUEMENT des clés SSH (RSA 4096+ ou Ed25519)",
            "Changer le port par défaut (22 → 2222 ou port aléatoire > 1024)",
            "Installer fail2ban avec bannissement 1h minimum",
            "Limiter les utilisateurs autorisés (AllowUsers)",
            "Implémenter 2FA avec Google Authenticator (libpam-google-authenticator)",
            "Utiliser SSH Certificates plutôt que des clés individuelles",
            "Activer auditd pour tracer toutes les connexions",
            "Configurer Port Knocking pour obscurcir davantage",
            "Envisager bastion host / jump server pour l'accès"
        ],
        "automation_script": "harden_ssh.sh",
        "references": [
            "https://www.cisecurity.org/benchmark/debian_linux",
            "https://nvd.nist.gov/vuln/search"
        ]
    },
    23: {
        "service": "Telnet",
        "risk": "critical",
        "category": "Remote Access",
        "cve_refs": ["CVE-1999-0619", "Inherently insecure"],
        "compliance": {"CIS": "2.2.3", "NIST": "SC-8", "PCI-DSS": "2.2.3", "HIPAA": "164.312(e)(1)"},
        "description": "⛔ Telnet: TOUT en clair (credentials, données) - INACCEPTABLE",
        "difficulty": "facile",
        "estimated_time": "5 min",
        "commands": [
            "# ⚠️ DÉSACTIVER IMMÉDIATEMENT",
            "sudo systemctl stop telnet.socket",
            "sudo systemctl disable telnet.socket",
            "sudo systemctl stop inetd",
            "",
            "# Supprimer complètement",
            "sudo apt remove telnetd telnet-server  # Ubuntu/Debian",
            "sudo yum remove telnet-server  # CentOS/RHEL",
            "",
            "# Vérifier suppression",
            "sudo netstat -tlnp | grep :23",
            "",
            "# Installer SSH à la place",
            "sudo apt install openssh-server",
            "sudo systemctl enable ssh",
            "sudo systemctl start ssh",
            "",
            "# URGENT: Changer TOUS les mots de passe",
            "sudo passwd utilisateur1",
            "sudo passwd utilisateur2",
            "",
            "# Auditer les logs (recherche de compromission)",
            "sudo grep -i 'telnet' /var/log/auth.log",
            "sudo last -f /var/log/wtmp | grep -i telnet"
        ],
        "recommendations": [
            "🚨 CRITIQUE URGENCE MAXIMALE: Désactiver Telnet MAINTENANT",
            "Remplacer par SSH (chiffrement de bout en bout)",
            "Auditer TOUS les logs pour détection de compromission",
            "Changer TOUS les mots de passe utilisés via Telnet",
            "Informer l'équipe de sécurité/RSSI immédiatement",
            "Envisager une analyse forensique complète du système",
            "Vérifier l'intégrité du système (rootkits, backdoors)",
            "Considérer le système comme potentiellement compromis"
        ],
        "automation_script": "emergency_disable_telnet.sh",
        "references": [
            "https://attack.mitre.org/techniques/T1021/004/",
            "https://www.sans.org/reading-room/whitepapers/protocols/paper/33"
        ]
    },
    25: {
        "service": "SMTP",
        "risk": "medium",
        "category": "Mail",
        "cve_refs": ["CVE-2020-28017", "CVE-2019-18860"],
        "compliance": {"CIS": "2.2.10", "NIST": "SC-20"},
        "description": "Serveur mail exposé - risque de spam relay et spoofing",
        "difficulty": "moyen",
        "estimated_time": "45 min",
        "commands": [
            "# Identifier le serveur mail",
            "sudo netstat -tlnp | grep :25",
            "",
            "# Sécuriser Postfix",
            "sudo nano /etc/postfix/main.cf",
            "",
            "# Configuration sécurisée:",
            "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination",
            "smtpd_recipient_restrictions = reject_unauth_destination, reject_invalid_hostname",
            "smtpd_helo_required = yes",
            "smtpd_helo_restrictions = reject_invalid_helo_hostname, reject_non_fqdn_helo_hostname",
            "disable_vrfy_command = yes",
            "",
            "# TLS obligatoire",
            "smtpd_tls_security_level = may",
            "smtp_tls_security_level = may",
            "smtpd_tls_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem",
            "smtpd_tls_key_file=/etc/ssl/private/ssl-cert-snakeoil.key",
            "",
            "# Rate limiting",
            "smtpd_client_connection_rate_limit = 10",
            "smtpd_client_message_rate_limit = 20",
            "",
            "# Redémarrer",
            "sudo systemctl restart postfix",
            "",
            "# Tester la config",
            "sudo postfix check",
            "",
            "# Installer SPF/DKIM/DMARC",
            "sudo apt install opendkim opendkim-tools postfix-policyd-spf-python",
            "",
            "# Tester si relay ouvert (DANGEREUX)",
            "telnet localhost 25",
            "# MAIL FROM: test@example.com",
            "# RCPT TO: external@gmail.com",
            "# (Doit être REJETÉ)"
        ],
        "recommendations": [
            "Configurer SPF, DKIM et DMARC obligatoirement",
            "Désactiver le relay ouvert (open relay) - test régulièrement",
            "Activer TLS pour toutes les connexions SMTP",
            "Implémenter rate limiting et throttling",
            "Blacklister les IPs malveillantes (utiliser RBLs)",
            "Utiliser un service tiers si possible (SendGrid, AWS SES, Mailgun)",
            "Monitoring: alertes sur volume anormal",
            "Authentification SASL pour utilisateurs légitimes"
        ],
        "automation_script": "secure_postfix.sh",
        "references": [
            "https://www.postfix.org/SMTPD_ACCESS_README.html",
            "https://www.dmarcanalyzer.com/"
        ]
    },
    53: {
        "service": "DNS",
        "risk": "medium",
        "category": "Infrastructure",
        "cve_refs": ["CVE-2020-25681", "CVE-2021-25217"],
        "compliance": {"CIS": "2.2.7", "NIST": "SC-21"},
        "description": "Serveur DNS exposé - risque d'amplification DDoS et cache poisoning",
        "difficulty": "moyen",
        "estimated_time": "40 min",
        "commands": [
            "# Identifier le serveur DNS",
            "sudo lsof -i :53",
            "",
            "# Sécuriser BIND9",
            "sudo nano /etc/bind/named.conf.options",
            "",
            "# Configuration sécurisée:",
            "options {",
            "    directory \"/var/cache/bind\";",
            "    recursion no;  # Désactiver récursion si serveur autoritaire",
            "    allow-query { localhost; 192.168.0.0/16; };  # Restreindre",
            "    allow-transfer { none; };  # Pas de zone transfer",
            "    version \"Not Disclosed\";  # Masquer version",
            "    rate-limit {",
            "        responses-per-second 10;",
            "    };",
            "    dnssec-validation auto;",
            "};",
            "",
            "# Tester la config",
            "sudo named-checkconf",
            "",
            "# Redémarrer",
            "sudo systemctl restart bind9",
            "",
            "# Activer DNSSEC",
            "sudo dnssec-keygen -a RSASHA256 -b 2048 -n ZONE votre-domaine.com"
        ],
        "recommendations": [
            "Désactiver la récursion sur serveurs autoritaires",
            "Activer DNSSEC (Domain Name System Security Extensions)",
            "Rate limiting pour prévenir DDoS amplification",
            "Restreindre allow-query à votre réseau uniquement",
            "Désactiver zone transfers (allow-transfer none)",
            "Masquer la version du serveur DNS",
            "Utiliser des serveurs DNS séparés (autoritaire vs. récursif)",
            "Monitoring des requêtes anormales"
        ],
        "automation_script": "secure_dns.sh",
        "references": [
            "https://www.isc.org/dnssec/",
            "https://www.cloudflare.com/dns/dnssec/"
        ]
    },
    80: {
        "service": "HTTP",
        "risk": "medium",
        "category": "Web",
        "cve_refs": ["CVE-2021-41773", "CVE-2020-11984"],
        "compliance": {"CIS": "5.1.1", "NIST": "SC-8", "PCI-DSS": "4.1", "GDPR": "Art. 32"},
        "description": "Trafic web non chiffré - interception credentials/données",
        "difficulty": "moyen",
        "estimated_time": "60 min",
        "commands": [
            "# Vérifier le serveur web",
            "sudo netstat -tlnp | grep :80",
            "",
            "# Installer Certbot (Let's Encrypt - GRATUIT)",
            "sudo apt update",
            "sudo apt install certbot python3-certbot-nginx",
            "",
            "# Obtenir certificat SSL GRATUIT",
            "sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com",
            "",
            "# Redirection automatique HTTP → HTTPS",
            "sudo certbot --nginx --redirect -d votre-domaine.com",
            "",
            "# Vérifier les certificats",
            "sudo certbot certificates",
            "",
            "# Renouvellement automatique (cron)",
            "sudo systemctl enable certbot.timer",
            "sudo systemctl start certbot.timer",
            "sudo systemctl status certbot.timer",
            "",
            "# Test de renouvellement",
            "sudo certbot renew --dry-run",
            "",
            "# Configuration Nginx HTTPS optimale",
            "sudo nano /etc/nginx/sites-available/default",
            "",
            "# Ajouter dans le bloc server HTTPS:",
            "ssl_protocols TLSv1.2 TLSv1.3;",
            "ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';",
            "ssl_prefer_server_ciphers off;",
            "ssl_session_cache shared:SSL:10m;",
            "ssl_session_timeout 10m;",
            "",
            "# En-têtes de sécurité",
            "add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains; preload' always;",
            "add_header X-Frame-Options 'SAMEORIGIN' always;",
            "add_header X-Content-Type-Options 'nosniff' always;",
            "add_header X-XSS-Protection '1; mode=block' always;",
            "add_header Referrer-Policy 'strict-origin-when-cross-origin' always;",
            "",
            "sudo nginx -t",
            "sudo systemctl reload nginx"
        ],
        "recommendations": [
            "🔐 PRIORITAIRE: Migrer vers HTTPS (port 443) sous 30 jours",
            "Obtenir certificat SSL gratuit via Let's Encrypt",
            "Rediriger 100% du trafic HTTP vers HTTPS (301)",
            "Activer HSTS avec preload (liste navigateurs)",
            "Implémenter Content Security Policy (CSP)",
            "Configurer OCSP Stapling",
            "Désactiver TLS 1.0 et 1.1 (obsolètes, vulnérables)",
            "Tester avec SSL Labs (A+ requis): ssllabs.com/ssltest",
            "Envisager HTTP/2 ou HTTP/3 pour performances",
            "Monitoring: alertes sur certificats expirant < 30j"
        ],
        "automation_script": "migrate_to_https.sh",
        "references": [
            "https://letsencrypt.org/",
            "https://ssl-config.mozilla.org/",
            "https://hstspreload.org/"
        ]
    },
    110: {
        "service": "POP3",
        "risk": "high",
        "category": "Mail",
        "cve_refs": ["CVE-2018-19518"],
        "compliance": {"CIS": "2.2.11", "NIST": "SC-8"},
        "description": "POP3 non chiffré - credentials email en clair",
        "difficulty": "facile",
        "estimated_time": "20 min",
        "commands": [
            "# Désactiver POP3 non chiffré",
            "sudo systemctl stop dovecot",
            "",
            "# Configurer Dovecot pour POP3S uniquement (port 995)",
            "sudo nano /etc/dovecot/conf.d/10-ssl.conf",
            "ssl = required",
            "",
            "sudo nano /etc/dovecot/dovecot.conf",
            "# Commenter:",
            "# protocols = imap pop3",
            "# Remplacer par:",
            "protocols = pop3s",
            "",
            "sudo systemctl start dovecot"
        ],
        "recommendations": [
            "Migrer vers POP3S (port 995) avec SSL/TLS",
            "Ou mieux: IMAP sur SSL (port 993)",
            "Certificat valide obligatoire",
            "Forcer authentification forte"
        ],
        "automation_script": "migrate_pop3_to_ssl.sh"
    },
    143: {
        "service": "IMAP",
        "risk": "high",
        "category": "Mail",
        "cve_refs": ["CVE-2021-33515"],
        "compliance": {"CIS": "2.2.11", "NIST": "SC-8"},
        "description": "IMAP non chiffré - emails et credentials accessibles",
        "difficulty": "facile",
        "estimated_time": "20 min",
        "commands": [
            "# Forcer IMAPS (SSL) uniquement",
            "sudo nano /etc/dovecot/dovecot.conf",
            "protocols = imaps",
            "",
            "sudo nano /etc/dovecot/conf.d/10-ssl.conf",
            "ssl = required",
            "ssl_cert = </etc/letsencrypt/live/mail.domaine.com/fullchain.pem",
            "ssl_key = </etc/letsencrypt/live/mail.domaine.com/privkey.pem",
            "",
            "sudo systemctl restart dovecot"
        ],
        "recommendations": [
            "Utiliser IMAPS (port 993) uniquement",
            "Certificat Let's Encrypt pour le domaine mail",
            "TLS 1.2+ obligatoire",
            "Désactiver IMAP non chiffré complètement"
        ],
        "automation_script": "force_imaps.sh"
    },
    443: {
        "service": "HTTPS",
        "risk": "low",
        "category": "Web",
        "cve_refs": [],
        "compliance": {"CIS": "5.1.2", "NIST": "SC-8", "PCI-DSS": "4.1"},
        "description": "✅ Serveur web sécurisé - optimiser la configuration",
        "difficulty": "moyen",
        "estimated_time": "45 min",
        "commands": [
            "# Audit SSL/TLS avec testssl.sh",
            "sudo apt install testssl.sh",
            "testssl.sh votre-domaine.com",
            "",
            "# Configuration Nginx optimale",
            "sudo nano /etc/nginx/nginx.conf",
            "",
            "# SSL Configuration (Grade A+ SSL Labs)",
            "ssl_protocols TLSv1.2 TLSv1.3;",
            "ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';",
            "ssl_prefer_server_ciphers off;",
            "ssl_session_cache shared:SSL:10m;",
            "ssl_session_timeout 1d;",
            "ssl_session_tickets off;",
            "",
            "# OCSP Stapling",
            "ssl_stapling on;",
            "ssl_stapling_verify on;",
            "resolver 1.1.1.1 1.0.0.1 valid=300s;",
            "",
            "# En-têtes de sécurité avancés",
            "add_header Strict-Transport-Security 'max-age=63072000; includeSubDomains; preload' always;",
            "add_header X-Frame-Options 'DENY' always;",
            "add_header X-Content-Type-Options 'nosniff' always;",
            "add_header X-XSS-Protection '1; mode=block' always;",
            "add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';\" always;",
            "add_header Referrer-Policy 'strict-origin-when-cross-origin' always;",
            "add_header Permissions-Policy 'geolocation=(), microphone=(), camera=()' always;",
            "",
            "sudo nginx -t",
            "sudo systemctl reload nginx",
            "",
            "# Vérifier sur SSL Labs",
            "# https://www.ssllabs.com/ssltest/analyze.html?d=votre-domaine.com"
        ],
        "recommendations": [
            "Vérifier que TLS 1.2+ uniquement (désactiver TLS 1.0/1.1)",
            "Tester avec SSL Labs - viser grade A+",
            "Implémenter HSTS avec preload",
            "Configurer OCSP Stapling pour performances",
            "Activer HTTP/2 ou HTTP/3 (QUIC)",
            "Content Security Policy (CSP) restrictive",
            "Certificate Transparency logging",
            "Maintenir certificats à jour (< 90 jours)",
            "Utiliser Brotli/Gzip compression",
            "Implémenter rate limiting applicatif"
        ],
        "automation_script": "optimize_https.sh",
        "references": [
            "https://ssl-config.mozilla.org/",
            "https://cipherli.st/"
        ]
    },
    445: {
        "service": "SMB",
        "risk": "critical",
        "category": "File Sharing",
        "cve_refs": ["CVE-2017-0144 (EternalBlue)", "CVE-2020-0796 (SMBGhost)"],
        "compliance": {"CIS": "2.2.12", "NIST": "AC-3"},
        "description": "⛔ SMB exposé - exploits critiques connus (ransomwares)",
        "difficulty": "facile",
        "estimated_time": "15 min",
        "commands": [
            "# Windows: Désactiver SMBv1 (CRITIQUE)",
            "# PowerShell en admin:",
            "Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol",
            "",
            "# Vérifier désactivation",
            "Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol",
            "",
            "# Linux: Sécuriser Samba",
            "sudo nano /etc/samba/smb.conf",
            "",
            "[global]",
            "   min protocol = SMB3",
            "   server signing = mandatory",
            "   smb encrypt = required",
            "   restrict anonymous = 2",
            "",
            "sudo systemctl restart smbd",
            "",
            "# Firewall: BLOQUER port 445 vers Internet",
            "sudo ufw deny 445/tcp",
            "sudo ufw allow from 192.168.0.0/16 to any port 445  # Réseau local uniquement"
        ],
        "recommendations": [
            "🚨 CRITIQUE: NE JAMAIS exposer SMB sur Internet",
            "Désactiver SMBv1 immédiatement (vulnérable EternalBlue/WannaCry)",
            "Forcer SMB3 minimum avec chiffrement",
            "Signature des packets obligatoire (protection MITM)",
            "Firewall: bloquer 445 vers l'extérieur, LAN uniquement",
            "Utiliser VPN pour accès distant",
            "Patches Windows à jour (critique pour SMB)",
            "Monitoring: alertes sur tentatives d'accès externes"
        ],
        "automation_script": "secure_smb.sh",
        "references": [
            "https://www.cisa.gov/uscert/ncas/alerts/TA17-132A",
            "https://docs.microsoft.com/en-us/windows-server/storage/file-server/troubleshoot/smbv1-not-installed-by-default"
        ]
    },
    3306: {
        "service": "MySQL",
        "risk": "critical",
        "category": "Database",
        "cve_refs": ["CVE-2021-2307", "CVE-2020-14765"],
        "compliance": {"CIS": "6.1", "NIST": "SC-8", "PCI-DSS": "2.2.3", "SOC2": "CC6.6"},
        "description": "⛔ MySQL exposé - accès direct aux données sensibles",
        "difficulty": "facile",
        "estimated_time": "25 min",
        "commands": [
            "# ⚠️ NE JAMAIS exposer MySQL sur Internet",
            "sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf",
            "",
            "# Modifier IMPÉRATIVEMENT:",
            "bind-address = 127.0.0.1  # Localhost UNIQUEMENT",
            "skip-networking = OFF  # Mais écouter localhost",
            "",
            "# Redémarrer MySQL",
            "sudo systemctl restart mysql",
            "",
            "# Vérifier binding",
            "sudo netstat -tlnp | grep 3306",
            "# Doit afficher: 127.0.0.1:3306 (PAS 0.0.0.0:3306)",
            "",
            "# Firewall: BLOQUER 3306 vers extérieur",
            "sudo ufw deny 3306/tcp",
            "sudo ufw allow from 192.168.1.0/24 to any port 3306  # LAN uniquement",
            "",
            "# Sécuriser MySQL (wizard)",
            "sudo mysql_secure_installation",
            "# Répondre YES à tout",
            "",
            "# Créer utilisateur avec privilèges minimaux",
            "sudo mysql",
            "CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'MotDePasseComplexe123!';",
            "GRANT SELECT, INSERT, UPDATE ON ma_base.* TO 'app_user'@'localhost';",
            "FLUSH PRIVILEGES;",
            "",
            "# Activer SSL/TLS pour MySQL",
            "sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf",
            "require_secure_transport = ON",
            "",
            "# Logs d'audit",
            "sudo apt install mariadb-plugin-audit",
            "",
            "# Sauvegardes automatiques chiffrées",
            "sudo apt install automysqlbackup",
            "sudo nano /etc/default/automysqlbackup"
        ],
        "recommendations": [
            "🚨 URGENCE ABSOLUE: Lier MySQL à 127.0.0.1 IMMÉDIATEMENT",
            "NE JAMAIS exposer MySQL directement sur Internet",
            "Pour accès distant: tunnel SSH ou VPN obligatoire",
            "Créer des utilisateurs avec privilèges minimaux (principe du moindre privilège)",
            "Activer require_secure_transport (SSL/TLS obligatoire)",
            "Implémenter audit logging (qui accède, quand, quoi)",
            "Sauvegardes chiffrées quotidiennes (automysqlbackup + GPG)",
            "Rotation des mots de passe tous les 90 jours",
            "Surveiller les tentatives d'accès (fail2ban-mysql)",
            "Envisager MySQL avec chiffrement au repos (data-at-rest encryption)"
        ],
        "automation_script": "secure_mysql.sh",
        "references": [
            "https://dev.mysql.com/doc/refman/8.0/en/security-guidelines.html",
            "https://www.cisecurity.org/benchmark/mysql"
        ]
    },
    3389: {
        "service": "RDP (Remote Desktop)",
        "risk": "critical",
        "category": "Remote Access",
        "cve_refs": ["CVE-2019-0708 (BlueKeep)", "CVE-2020-0609", "CVE-2020-0610"],
        "compliance": {"CIS": "18.9.58.3", "NIST": "AC-17"},
        "description": "⛔ RDP exposé - cible #1 ransomwares et attaques",
        "difficulty": "moyen",
        "estimated_time": "40 min",
        "commands": [
            "# Windows: Restreindre RDP (PowerShell Admin)",
            "",
            "# 1. Firewall: BLOQUER RDP vers Internet",
            "New-NetFirewallRule -DisplayName 'Block RDP Internet' -Direction Inbound -LocalPort 3389 -Protocol TCP -Action Block -RemoteAddress Internet",
            "",
            "# 2. Autoriser SEULEMENT IPs spécifiques",
            "New-NetFirewallRule -DisplayName 'RDP VPN Only' -Direction Inbound -LocalPort 3389 -Protocol TCP -Action Allow -RemoteAddress 10.8.0.0/24",
            "",
            "# 3. Changer le port par défaut",
            "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp' -Name PortNumber -Value 33890",
            "",
            "# 4. Activer Network Level Authentication (NLA) - CRITIQUE",
            "(Get-WmiObject -class Win32_TSGeneralSetting -Namespace root\\cimv2\\TerminalServices -Filter 'TerminalName=\"RDP-Tcp\"').SetUserAuthenticationRequired(1)",
            "",
            "# 5. Limiter nombre de sessions",
            "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name MaxConnectionCount -Value 2",
            "",
            "# 6. Timeout automatique",
            "Set-ItemProperty -Path 'HKLM:\\Software\\Policies\\Microsoft\\Windows NT\\Terminal Services' -Name MaxIdleTime -Value 600000  # 10 min",
            "",
            "# 7. Installer RDP Guard (anti-bruteforce)",
            "# Télécharger: https://rdpguard.com/",
            "",
            "# Alternative RECOMMANDÉE: VPN obligatoire",
            "# Installer WireGuard: https://www.wireguard.com/install/",
            "# Ou ZeroTier: https://www.zerotier.com/",
            "",
            "# Redémarrer le service",
            "Restart-Service TermService -Force"
        ],
        "recommendations": [
            "🚨 CRITIQUE: NE JAMAIS exposer RDP directement sur Internet",
            "Solution #1 (RECOMMANDÉ): VPN obligatoire (WireGuard, OpenVPN, ZeroTier)",
            "Solution #2: Bastion host / Jump server dans DMZ",
            "Activer Network Level Authentication (NLA) - NON NÉGOCIABLE",
            "Changer le port par défaut (3389 → 33890 ou aléatoire)",
            "Whitelist IP stricte (seulement VPN ou bureau)",
            "Mots de passe 16+ caractères + 2FA (Duo, Azure MFA)",
            "Account lockout: 3 tentatives max, blocage 1h",
            "RDP Guard ou similaire pour bloquer bruteforce",
            "Logs détaillés + alertes sur tentatives échouées",
            "Patches Windows critiques à jour (BlueKeep, etc.)",
            "Envisager solutions modernes (TeamViewer, AnyDesk, Parsec avec auth)"
        ],
        "automation_script": "secure_rdp.sh",
        "references": [
            "https://www.cisa.gov/uscert/ncas/alerts/TA17-293A",
            "https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/network-security-restrict-ntlm-ntlm-authentication-in-this-domain"
        ]
    },
    5432: {
        "service": "PostgreSQL",
        "risk": "critical",
        "category": "Database",
        "cve_refs": ["CVE-2021-23214", "CVE-2020-25695"],
        "compliance": {"CIS": "PostgreSQL Benchmark", "NIST": "SC-8", "PCI-DSS": "2.2.3"},
        "description": "PostgreSQL exposé - accès aux données sensibles",
        "difficulty": "moyen",
        "estimated_time": "35 min",
        "commands": [
            "# Sécuriser PostgreSQL",
            "sudo nano /etc/postgresql/*/main/postgresql.conf",
            "",
            "# Configuration sécurisée:",
            "listen_addresses = 'localhost'  # CRITIQUE",
            "ssl = on",
            "ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'",
            "ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'",
            "password_encryption = scram-sha-256",
            "log_connections = on",
            "log_disconnections = on",
            "log_duration = on",
            "",
            "# pg_hba.conf (authentification)",
            "sudo nano /etc/postgresql/*/main/pg_hba.conf",
            "",
            "# Remplacer tout par:",
            "# TYPE  DATABASE        USER            ADDRESS                 METHOD",
            "local   all             postgres                                peer",
            "local   all             all                                     scram-sha-256",
            "host    all             all             127.0.0.1/32            scram-sha-256",
            "hostssl all             all             10.0.0.0/8              scram-sha-256",
            "",
            "# Redémarrer",
            "sudo systemctl restart postgresql",
            "",
            "# Créer utilisateurs avec privilèges minimaux",
            "sudo -u postgres psql",
            "CREATE USER app_user WITH PASSWORD 'MotDePasseComplexe123!';",
            "GRANT CONNECT ON DATABASE ma_base TO app_user;",
            "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;",
            "",
            "# Firewall",
            "sudo ufw deny 5432/tcp",
            "",
            "# Activer audit logging",
            "sudo apt install postgresql-contrib",
            "CREATE EXTENSION pgaudit;"
        ],
        "recommendations": [
            "🚨 CRITIQUE: Écouter sur localhost (127.0.0.1) UNIQUEMENT",
            "Tunnel SSH pour tout accès distant",
            "SSL/TLS obligatoire (hostssl dans pg_hba.conf)",
            "SCRAM-SHA-256 uniquement (PAS MD5, jamais trust)",
            "Utilisateurs avec privilèges minimaux (GRANT spécifiques)",
            "Activer pgaudit pour traçabilité complète",
            "Rotation des mots de passe tous les 60-90 jours",
            "Sauvegardes chiffrées avec pg_dump + GPG",
            "Monitoring: pg_stat_activity pour connexions suspectes",
            "Envisager chiffrement transparent des données (TDE)"
        ],
        "automation_script": "secure_postgresql.sh",
        "references": [
            "https://www.postgresql.org/docs/current/ssl-tcp.html",
            "https://www.percona.com/blog/2020/04/07/postgresql-security-best-practices/"
        ]
    },
    6379: {
        "service": "Redis",
        "risk": "critical",
        "category": "Cache/Database",
        "cve_refs": ["CVE-2022-24735", "CVE-2021-32687"],
        "compliance": {"CIS": "Redis Benchmark", "NIST": "AC-3"},
        "description": "⛔ Redis sans auth - accès total mémoire/données + RCE possible",
        "difficulty": "facile",
        "estimated_time": "20 min",
        "commands": [
            "# Sécuriser Redis (URGENT)",
            "sudo nano /etc/redis/redis.conf",
            "",
            "# Configuration sécurisée CRITIQUE:",
            "bind 127.0.0.1 ::1  # Localhost uniquement",
            "protected-mode yes",
            "requirepass VotreMotDePasseTRESComplexe123!@#",
            "",
            "# Renommer commandes dangereuses (protection RCE)",
            "rename-command FLUSHDB ''",
            "rename-command FLUSHALL ''",
            "rename-command CONFIG 'CONFIG_secret_xyz123'",
            "rename-command DEBUG ''",
            "rename-command SHUTDOWN ''",
            "rename-command SAVE ''",
            "rename-command BGSAVE ''",
            "",
            "# Limiter mémoire",
            "maxmemory 256mb",
            "maxmemory-policy allkeys-lru",
            "",
            "# Logs",
            "loglevel notice",
            "logfile /var/log/redis/redis-server.log",
            "",
            "# Redémarrer",
            "sudo systemctl restart redis-server",
            "",
            "# Tester authentification",
            "redis-cli",
            "> ping  # Doit demander auth",
            "> AUTH VotreMotDePasseTRESComplexe123!@#",
            "> ping  # Doit répondre PONG",
            "",
            "# Firewall",
            "sudo ufw deny 6379/tcp",
            "",
            "# Redis 6+: Utiliser ACLs",
            "redis-cli",
            "> ACL SETUSER app_user on >password123 ~cache:* +get +set",
            "> ACL SAVE"
        ],
        "recommendations": [
            "🚨 URGENCE MAXIMALE: Activer requirepass IMMÉDIATEMENT",
            "Bind à 127.0.0.1 uniquement (jamais 0.0.0.0)",
            "Renommer/désactiver TOUTES les commandes dangereuses",
            "Utiliser Redis 6+ avec ACLs (contrôle fin par utilisateur)",
            "Activer TLS si accès réseau absolument nécessaire",
            "Firewall: bloquer 6379 vers l'extérieur",
            "Mots de passe 20+ caractères aléatoires",
            "Monitoring: alertes sur commandes sensibles",
            "Sauvegardes RDB chiffrées",
            "Envisager Redis Sentinel/Cluster avec auth"
        ],
        "automation_script": "emergency_secure_redis.sh",
        "references": [
            "https://redis.io/topics/security",
            "https://www.shodan.io/report/nlrw5mnM"  # Voir les Redis exposés
        ]
    },
    8080: {
        "service": "HTTP-ALT",
        "risk": "medium",
        "category": "Web",
        "cve_refs": ["CVE-2021-44228 (Log4Shell)"],
        "compliance": {"CIS": "5.1.1", "NIST": "SC-8"},
        "description": "Serveur web alternatif (souvent dev/admin/Jenkins/Tomcat)",
        "difficulty": "moyen",
        "estimated_time": "30 min",
        "commands": [
            "# Identifier le service",
            "sudo lsof -i :8080",
            "curl -I http://localhost:8080",
            "",
            "# Si Jenkins/Tomcat/App dev",
            "# Option 1: Désactiver si non utilisé",
            "sudo systemctl stop <service>",
            "sudo systemctl disable <service>",
            "",
            "# Option 2: Ajouter authentification (Nginx reverse proxy)",
            "sudo apt install nginx apache2-utils",
            "sudo htpasswd -c /etc/nginx/.htpasswd admin",
            "",
            "sudo nano /etc/nginx/sites-available/app",
            "",
            "server {",
            "    listen 80;",
            "    server_name app.domaine.com;",
            "",
            "    location / {",
            "        auth_basic 'Restricted Area';",
            "        auth_basic_user_file /etc/nginx/.htpasswd;",
            "        proxy_pass http://127.0.0.1:8080;",
            "        proxy_set_header Host $host;",
            "    }",
            "}",
            "",
            "sudo ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/",
            "sudo nginx -t",
            "sudo systemctl reload nginx",
            "",
            "# Firewall: bloquer 8080 direct",
            "sudo ufw deny 8080/tcp",
            "sudo ufw allow 'Nginx Full'"
        ],
        "recommendations": [
            "Identifier précisément le service (Jenkins, Tomcat, autre)",
            "Désactiver si environnement de dev non utilisé",
            "Ajouter authentification (Basic Auth minimum)",
            "Utiliser reverse proxy (Nginx) avec SSL",
            "Firewall: bloquer accès direct, proxy uniquement",
            "Migrer vers HTTPS avec certificat valide",
            "Si Jenkins: activer matrix-based security",
            "Updates régulières (Log4Shell, etc.)",
            "Monitoring des accès"
        ],
        "automation_script": "secure_web_alt.sh"
    },
    8443: {
        "service": "HTTPS-ALT",
        "risk": "low",
        "category": "Web",
        "cve_refs": [],
        "compliance": {"CIS": "5.1.2"},
        "description": "HTTPS alternatif (souvent admin panels)",
        "difficulty": "facile",
        "estimated_time": "15 min",
        "commands": [
            "# Vérifier certificat SSL",
            "openssl s_client -connect localhost:8443 -showcerts",
            "",
            "# S'assurer TLS 1.2+",
            "nmap --script ssl-enum-ciphers -p 8443 localhost"
        ],
        "recommendations": [
            "Vérifier validité du certificat SSL",
            "TLS 1.2+ uniquement",
            "Authentification forte requise",
            "Limiter accès par IP si possible"
        ],
        "automation_script": "check_https_alt.sh"
    },
    27017: {
        "service": "MongoDB",
        "risk": "critical",
        "category": "Database",
        "cve_refs": ["CVE-2021-20329", "Nombreuses fuites de données connues"],
        "compliance": {"CIS": "MongoDB Benchmark", "NIST": "AC-3", "GDPR": "Art. 32"},
        "description": "⛔ MongoDB exposé - historique de violations massives",
        "difficulty": "facile",
        "estimated_time": "25 min",
        "commands": [
            "# Sécuriser MongoDB (URGENT)",
            "sudo nano /etc/mongod.conf",
            "",
            "# Configuration CRITIQUE:",
            "net:",
            "  bindIp: 127.0.0.1  # Localhost UNIQUEMENT",
            "  port: 27017",
            "",
            "security:",
            "  authorization: enabled  # ACTIVER AUTH",
            "",
            "# Redémarrer",
            "sudo systemctl restart mongod",
            "",
            "# Créer administrateur",
            "mongo",
            "use admin",
            "db.createUser({",
            "  user: 'admin',",
            "  pwd: 'MotDePasseComplexe123!',",
            "  roles: [{role: 'userAdminAnyDatabase', db: 'admin'}]",
            "});",
            "exit",
            "",
            "# Tester auth",
            "mongo -u admin -p --authenticationDatabase admin",
            "",
            "# Créer utilisateur app avec privilèges minimaux",
            "use ma_base",
            "db.createUser({",
            "  user: 'app_user',",
            "  pwd: 'AutreMotDePasse456!',",
            "  roles: [{role: 'readWrite', db: 'ma_base'}]",
            "});",
            "",
            "# Activer TLS/SSL",
            "sudo nano /etc/mongod.conf",
            "net:",
            "  tls:",
            "    mode: requireTLS",
            "    certificateKeyFile: /etc/ssl/mongodb.pem",
            "",
            "# Firewall",
            "sudo ufw deny 27017/tcp",
            "",
            "# Activer audit logging (Enterprise)",
            "auditLog:",
            "  destination: file",
            "  format: JSON",
            "  path: /var/log/mongodb/audit.json"
        ],
        "recommendations": [
            "🚨 URGENCE ABSOLUE: Activer authorization MAINTENANT",
            "Bind à 127.0.0.1 uniquement (JAMAIS 0.0.0.0)",
            "Créer utilisateurs avec rôles minimaux (readWrite, read)",
            "Activer TLS/SSL pour connexions chiffrées",
            "Firewall: bloquer 27017 vers Internet",
            "Auditer TOUTES les bases pour données sensibles exposées",
            "Implémenter field-level encryption pour données critiques",
            "Sauvegardes chiffrées avec mongodump + GPG",
            "Monitoring: alertes sur connexions non-localhost",
            "Envisager MongoDB Atlas (managed, sécurisé par défaut)",
            "Vérifier si vos données sont sur Shodan/leaks"
        ],
        "automation_script": "emergency_secure_mongodb.sh",
        "references": [
            "https://docs.mongodb.com/manual/security/",
            "https://www.shodan.io/report/nlrw5mnM",
            "https://haveibeenpwned.com/"
        ]
    },
    # Services additionnels
    139: {
        "service": "NetBIOS",
        "risk": "high",
        "category": "Windows Networking",
        "cve_refs": ["CVE-2021-31956"],
        "compliance": {"CIS": "18.9.19.2"},
        "description": "NetBIOS exposé - énumération réseau et attaques SMB",
        "difficulty": "facile",
        "estimated_time": "10 min",
        "commands": [
            "# Windows: Désactiver NetBIOS",
            "# PowerShell Admin:",
            "Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | ForEach-Object { $_.SetTcpipNetbios(2) }",
            "",
            "# Firewall",
            "New-NetFirewallRule -DisplayName 'Block NetBIOS' -Direction Inbound -LocalPort 139 -Protocol TCP -Action Block"
        ],
        "recommendations": [
            "Désactiver NetBIOS over TCP/IP",
            "Bloquer ports 137-139 au firewall",
            "Utiliser DNS pour résolution de noms",
            "Segmenter réseau Windows"
        ],
        "automation_script": "disable_netbios.sh"
    },
    161: {
        "service": "SNMP",
        "risk": "medium",
        "category": "Monitoring",
        "cve_refs": ["CVE-2020-15862"],
        "compliance": {"CIS": "2.2.14", "NIST": "CM-7"},
        "description": "SNMP - souvent avec community strings par défaut (public/private)",
        "difficulty": "moyen",
        "estimated_time": "30 min",
        "commands": [
            "# Sécuriser SNMPv3 (v1/v2c = non sécurisés)",
            "sudo apt install snmpd",
            "sudo nano /etc/snmp/snmpd.conf",
            "",
            "# Désactiver v1/v2c, activer v3 uniquement",
            "# Commenter toutes les lignes rocommunity",
            "",
            "# Ajouter utilisateur SNMPv3:",
            "createUser admin_snmp SHA password123 AES password456",
            "rouser admin_snmp authPriv",
            "",
            "# Écouter localhost uniquement",
            "agentaddress 127.0.0.1,[::1]",
            "",
            "sudo systemctl restart snmpd"
        ],
        "recommendations": [
            "Migrer vers SNMPv3 uniquement (auth + encryption)",
            "Changer community strings par défaut",
            "Écouter sur localhost ou management VLAN",
            "Authentification SHA/AES minimum",
            "ACLs strictes sur OIDs accessibles"
        ],
        "automation_script": "secure_snmp.sh"
    },
    3000: {
        "service": "Node.js/Grafana/Dev",
        "risk": "medium",
        "category": "Web/Dev",
        "cve_refs": ["Application-dependent"],
        "compliance": {"OWASP": "A01:2021"},
        "description": "Service dev ou monitoring exposé - souvent sans auth",
        "difficulty": "facile",
        "estimated_time": "15 min",
        "commands": [
            "# Identifier le service",
            "sudo lsof -i :3000",
            "",
            "# Firewall: bloquer accès externe",
            "sudo ufw deny 3000/tcp",
            "",
            "# Reverse proxy avec auth",
            "# Voir recommandations port 8080"
        ],
        "recommendations": [
            "Identifier le service précis",
            "Ajouter authentification obligatoire",
            "Utiliser reverse proxy HTTPS",
            "Bloquer accès direct, VPN recommandé",
            "Updates régulières de l'application"
        ],
        "automation_script": "secure_dev_port.sh"
    },
    5000: {
        "service": "Flask/UPnP",
        "risk": "medium",
        "category": "Web/Dev",
        "cve_refs": ["Application-dependent"],
        "compliance": {"OWASP": "A01:2021"},
        "description": "Serveur Flask dev ou UPnP - souvent debug mode activé",
        "difficulty": "facile",
        "estimated_time": "20 min",
        "commands": [
            "# Vérifier si Flask debug",
            "curl -I http://localhost:5000",
            "",
            "# Production: utiliser Gunicorn/uWSGI",
            "pip install gunicorn",
            "gunicorn --bind 127.0.0.1:5000 --workers 4 app:app",
            "",
            "# Reverse proxy HTTPS (Nginx)",
            "# Voir recommandations port 80/443"
        ],
        "recommendations": [
            "Ne JAMAIS utiliser Flask dev server en production",
            "Gunicorn/uWSGI avec Nginx reverse proxy",
            "Debug mode OFF en production",
            "Variables d'environnement pour secrets",
            "HTTPS obligatoire"
        ],
        "automation_script": "productionize_flask.sh"
    },
    5900: {
        "service": "VNC",
        "risk": "critical",
        "category": "Remote Access",
        "cve_refs": ["CVE-2019-15681", "CVE-2020-14396"],
        "compliance": {"CIS": "Remote Desktop", "NIST": "AC-17"},
        "description": "VNC exposé - souvent faible encryption, bruteforce facile",
        "difficulty": "facile",
        "estimated_time": "25 min",
        "commands": [
            "# Désactiver VNC si non nécessaire",
            "sudo systemctl stop vncserver@:1",
            "sudo systemctl disable vncserver@:1",
            "",
            "# Si nécessaire: Tunnel SSH obligatoire",
            "# Sur le serveur:",
            "sudo ufw deny 5900/tcp",
            "",
            "# Sur le client:",
            "ssh -L 5900:localhost:5900 user@serveur",
            "vncviewer localhost:5900",
            "",
            "# Ou utiliser VNC over TLS",
            "vncserver -SecurityTypes VeNCrypt,TLSVnc"
        ],
        "recommendations": [
            "🚨 CRITIQUE: NE JAMAIS exposer VNC sur Internet",
            "Utiliser tunnel SSH pour tout accès VNC",
            "Ou migrer vers solutions modernes (RustDesk, TeamViewer)",
            "Mots de passe forts (8+ caractères minimum VNC)",
            "TLS encryption si VNC requis",
            "Firewall: bloquer 5900-5909",
            "Monitoring: alertes sur connexions VNC"
        ],
        "automation_script": "secure_vnc.sh",
        "references": [
            "https://www.realvnc.com/en/connect/docs/security.html"
        ]
    },
    8888: {
        "service": "Jupyter Notebook",
        "risk": "high",
        "category": "Dev/Data Science",
        "cve_refs": ["CVE-2020-26215"],
        "compliance": {"OWASP": "A01:2021"},
        "description": "Jupyter exposé - exécution code arbitraire possible",
        "difficulty": "facile",
        "estimated_time": "15 min",
        "commands": [
            "# Sécuriser Jupyter",
            "jupyter notebook --generate-config",
            "nano ~/.jupyter/jupyter_notebook_config.py",
            "",
            "# Configuration sécurisée:",
            "c.NotebookApp.ip = '127.0.0.1'  # Localhost uniquement",
            "c.NotebookApp.open_browser = False",
            "c.NotebookApp.password = 'sha1:...'  # Générer avec:",
            "# from notebook.auth import passwd; passwd()",
            "c.NotebookApp.token = ''",
            "",
            "# HTTPS avec certificat",
            "c.NotebookApp.certfile = '/path/to/cert.pem'",
            "c.NotebookApp.keyfile = '/path/to/key.pem'",
            "",
            "# Firewall",
            "sudo ufw deny 8888/tcp",
            "",
            "# Alternative: JupyterHub avec auth OAuth",
            "pip install jupyterhub",
            "jupyterhub --generate-config"
        ],
        "recommendations": [
            "⚠️ IMPORTANT: Ne JAMAIS exposer Jupyter sans authentification",
            "Écouter sur localhost + tunnel SSH",
            "Ou utiliser JupyterHub avec OAuth (GitHub, Google)",
            "HTTPS avec certificat valide",
            "Token/password complexe obligatoire",
            "Désactiver widgets non sécurisés",
            "Environnements virtuels isolés"
        ],
        "automation_script": "secure_jupyter.sh",
        "references": [
            "https://jupyter-notebook.readthedocs.io/en/stable/security.html"
        ]
    },
    9200: {
        "service": "Elasticsearch",
        "risk": "critical",
        "category": "Search/Database",
        "cve_refs": ["CVE-2021-22145", "CVE-2020-7009"],
        "compliance": {"CIS": "Elasticsearch Benchmark", "GDPR": "Art. 32"},
        "description": "Elasticsearch sans auth - accès total aux index/données",
        "difficulty": "moyen",
        "estimated_time": "35 min",
        "commands": [
            "# Activer X-Pack Security (Elasticsearch 7+)",
            "sudo nano /etc/elasticsearch/elasticsearch.yml",
            "",
            "# Configuration sécurisée:",
            "network.host: 127.0.0.1",
            "http.port: 9200",
            "xpack.security.enabled: true",
            "xpack.security.transport.ssl.enabled: true",
            "",
            "# Redémarrer",
            "sudo systemctl restart elasticsearch",
            "",
            "# Générer mots de passe utilisateurs built-in",
            "sudo /usr/share/elasticsearch/bin/elasticsearch-setup-passwords interactive",
            "",
            "# Créer utilisateur app avec privilèges minimaux",
            "curl -X POST 'localhost:9200/_security/user/app_user' -u elastic:password -H 'Content-Type: application/json' -d'",
            "{",
            "  \"password\" : \"ComplexPassword123!\",",
            "  \"roles\" : [ \"kibana_user\", \"monitoring_user\" ]",
            "}'",
            "",
            "# Firewall",
            "sudo ufw deny 9200/tcp"
        ],
        "recommendations": [
            "🚨 CRITIQUE: Activer X-Pack Security immédiatement",
            "Bind à localhost uniquement",
            "Authentification obligatoire sur TOUS les endpoints",
            "TLS/SSL pour transport inter-nodes",
            "Utilisateurs avec rôles minimaux (RBAC)",
            "Audit logging activé",
            "Firewall: bloquer 9200 et 9300 vers extérieur",
            "Updates régulières (nombreuses CVEs)",
            "Chiffrement au repos (encryption-at-rest)"
        ],
        "automation_script": "secure_elasticsearch.sh",
        "references": [
            "https://www.elastic.co/guide/en/elasticsearch/reference/current/security-minimal-setup.html"
        ]
    },
    11211: {
        "service": "Memcached",
        "risk": "critical",
        "category": "Cache",
        "cve_refs": ["CVE-2018-1000115", "DDoS Amplification"],
        "compliance": {"CIS": "Cache Security", "NIST": "SC-8"},
        "description": "Memcached exposé - amplification DDoS + data leak",
        "difficulty": "facile",
        "estimated_time": "10 min",
        "commands": [
            "# Sécuriser Memcached",
            "sudo nano /etc/memcached.conf",
            "",
            "# CRITIQUE:",
            "-l 127.0.0.1  # Localhost uniquement",
            "-U 0  # Désactiver UDP (amplification DDoS)",
            "",
            "# SASL Authentication",
            "-S  # Enable SASL",
            "",
            "sudo systemctl restart memcached",
            "",
            "# Firewall",
            "sudo ufw deny 11211/tcp",
            "sudo ufw deny 11211/udp"
        ],
        "recommendations": [
            "🚨 URGENT: Bind à 127.0.0.1 uniquement",
            "Désactiver UDP (utilisé pour DDoS amplification)",
            "Activer SASL authentication",
            "Firewall: bloquer 11211 TCP/UDP",
            "Utiliser Redis + auth à la place si possible"
        ],
        "automation_script": "secure_memcached.sh",
        "references": [
            "https://www.cloudflare.com/learning/ddos/memcached-ddos-attack/"
        ]
    },
    # Ports moins critiques mais importants
    111: {
        "service": "RPCbind",
        "risk": "medium",
        "category": "RPC",
        "description": "Service RPC - peut exposer NFS et autres services",
        "difficulty": "facile",
        "estimated_time": "10 min",
        "commands": ["sudo systemctl stop rpcbind", "sudo systemctl disable rpcbind"],
        "recommendations": ["Désactiver si NFS non utilisé", "Firewall: bloquer si actif"],
        "automation_script": "disable_rpc.sh"
    },
    123: {
        "service": "NTP",
        "risk": "low",
        "category": "Time Sync",
        "cve_refs": ["CVE-2019-11331"],
        "description": "Serveur NTP - amplification DDoS possible",
        "difficulty": "facile",
        "estimated_time": "15 min",
        "commands": [
            "sudo nano /etc/ntp.conf",
            "restrict default nomodify notrap nopeer noquery",
            "restrict 127.0.0.1",
            "sudo systemctl restart ntp"
        ],
        "recommendations": [
            "Restreindre les queries NTP",
            "Utiliser mode client uniquement si possible",
            "Monitoring pour détecter abus"
        ],
        "automation_script": "secure_ntp.sh"
    }
}

# Recommandations par niveau de risque (enrichies)
RISK_LEVEL_ACTIONS = {
    "critical": {
        "priority": "🔴 URGENCE MAXIMALE - Action immédiate requise",
        "timeline": "< 24 heures",
        "severity_score": 10,
        "general_advice": [
            "Isoler le système du réseau immédiatement si possible",
            "Auditer tous les logs pour détection de compromission",
            "Notifier RSSI/équipe sécurité/direction MAINTENANT",
            "Planifier maintenance d'urgence (hors heures si nécessaire)",
            "Considérer le système comme potentiellement compromis",
            "Documentation incident selon protocole"
        ],
        "compliance_impact": "Violation potentielle PCI-DSS, HIPAA, GDPR"
    },
    "high": {
        "priority": "🟠 IMPORTANT - Correction rapide requise",
        "timeline": "< 7 jours",
        "severity_score": 7,
        "general_advice": [
            "Planifier intervention technique sous 7 jours",
            "Augmenter surveillance (logs, monitoring, alertes)",
            "Évaluer impact potentiel sur activité métier",
            "Préparer plan de remédiation détaillé",
            "Tester solutions en environnement staging",
            "Communication aux stakeholders"
        ],
        "compliance_impact": "Risque de non-conformité"
    },
    "medium": {
        "priority": "🟡 MOYEN - Planification requise",
        "timeline": "< 30 jours",
        "severity_score": 5,
        "general_advice": [
            "Ajouter à la roadmap sécurité du mois",
            "Évaluer risques dans contexte métier",
            "Prioriser selon exposition réelle",
            "Budget et ressources à allouer",
            "Formation équipes si nécessaire"
        ],
        "compliance_impact": "À corriger pour conformité complète"
    },
    "low": {
        "priority": "🟢 FAIBLE - Amélioration continue",
        "timeline": "< 90 jours",
        "severity_score": 2,
        "general_advice": [
            "Maintenir les bonnes pratiques existantes",
            "Surveiller évolutions et nouvelles vulnérabilités",
            "Former équipes sur best practices",
            "Optimiser configurations",
            "Documentation et procédures"
        ],
        "compliance_impact": "Recommandé pour excellence sécurité"
    }
}

def get_port_recommendations(port):
    """Retourne les recommandations pour un port spécifique."""
    return PORT_VULNERABILITIES.get(port, {
        "service": f"Port {port}",
        "risk": "low",
        "category": "Unknown",
        "cve_refs": [],
        "compliance": {},
        "description": "Service non référencé dans la base de connaissances",
        "difficulty": "moyen",
        "estimated_time": "15-30 min",
        "commands": [
            f"# Identifier le service sur port {port}",
            f"sudo lsof -i :{port}",
            f"sudo netstat -tlnp | grep :{port}",
            f"nmap -sV -p {port} localhost",
            "",
            f"# Si non utilisé, fermer le port",
            f"sudo systemctl stop <service>",
            f"sudo systemctl disable <service>",
            "",
            f"# Firewall",
            f"sudo ufw deny {port}/tcp"
        ],
        "recommendations": [
            "Identifier précisément le service qui écoute",
            "Vérifier si ce port est réellement nécessaire",
            "Appliquer le principe du moindre privilège",
            "Ajouter authentification si service requis",
            "Documenter l'usage légitime du port",
            "Monitoring pour détecter abus"
        ],
        "automation_script": None,
        "references": [
            "https://www.speedguide.net/ports.php",
            "https://www.iana.org/assignments/service-names-port-numbers/"
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
    risk_level = host_data.get('risk_level', 'low')
    
    recommendations = {
        "host_summary": {
            "ip": host_data.get('ip_address'),
            "hostname": host_data.get('hostname', 'N/A'),
            "os": host_data.get('os_detected', 'Inconnu'),
            "risk_level": risk_level,
            "priority_score": host_data.get('priority_score', 0)
        },
        "global_assessment": RISK_LEVEL_ACTIONS.get(risk_level, RISK_LEVEL_ACTIONS['low']),
        "ports_analysis": [],
        "quick_wins": [],
        "strategic_actions": [],
        "estimated_total_time": 0,
        "compliance_frameworks": set(),
        "cve_references": []
    }
    
    # Analyser chaque port ouvert
    open_ports = host_data.get('open_ports', [])
    critical_count = 0
    high_count = 0
    total_time_minutes = 0
    
    for port_info in open_ports:
        # Gérer différents formats
        if isinstance(port_info, dict):
            port = port_info.get('port') or port_info.get('number')
        elif isinstance(port_info, (int, str)):
            port = int(port_info) if isinstance(port_info, str) and port_info.isdigit() else port_info
        else:
            port = port_info
        
        if not port or (isinstance(port, str) and not port.isdigit()):
            continue
            
        port = int(port) if isinstance(port, str) else port
        port_rec = get_port_recommendations(port)
        
        # Ajouter à l'analyse
        recommendations["ports_analysis"].append({
            "port": port,
            "service": port_rec.get("service"),
            "category": port_rec.get("category", "Unknown"),
            "risk": port_rec.get("risk"),
            "description": port_rec.get("description"),
            "difficulty": port_rec.get("difficulty", "moyen"),
            "estimated_time": port_rec.get("estimated_time", "15-30 min"),
            "commands": port_rec.get("commands"),
            "recommendations": port_rec.get("recommendations"),
            "automation_script": port_rec.get("automation_script"),
            "references": port_rec.get("references", []),
            "cve_refs": port_rec.get("cve_refs", []),
            "compliance": port_rec.get("compliance", {})
        })
        
        # Compter les risques
        if port_rec.get("risk") == "critical":
            critical_count += 1
        elif port_rec.get("risk") == "high":
            high_count += 1
        
        # Agréger temps estimé
        time_str = port_rec.get("estimated_time", "15 min")
        try:
            minutes = int(''.join(filter(str.isdigit, time_str.split()[0])))
            total_time_minutes += minutes
        except:
            total_time_minutes += 15
        
        # Agréger conformité
        compliance = port_rec.get("compliance", {})
        for framework in compliance.keys():
            recommendations["compliance_frameworks"].add(framework)
        
        # Agréger CVEs
        recommendations["cve_references"].extend(port_rec.get("cve_refs", []))
    
    # Convertir set en list pour JSON
    recommendations["compliance_frameworks"] = list(recommendations["compliance_frameworks"])
    recommendations["estimated_total_time"] = f"{total_time_minutes} min ({total_time_minutes // 60}h{total_time_minutes % 60:02d})"
    
    # Quick wins (actions rapides à fort impact)
    if critical_count > 0:
        critical_ports_list = [
            f"sudo ufw deny {p.get('port', 'PORT')}/tcp  # {p.get('service', 'Service')}" 
            for p in recommendations["ports_analysis"] 
            if p.get('risk') == 'critical' and p.get('port')
        ]
        
        if critical_ports_list:
            recommendations["quick_wins"].append({
                "action": "🛡️ Firewall Immédiat (Blocage Défensif)",
                "commands": [
                    "# Protection immédiate: bloquer TOUS les ports critiques",
                    "sudo ufw enable",
                    *critical_ports_list,
                    "",
                    "# Vérifier règles",
                    "sudo ufw status numbered"
                ],
                "impact": "⚡ Réduit immédiatement la surface d'attaque de 80-90%",
                "estimated_time": "5 min",
                "difficulty": "très facile"
            })
    
    # Actions stratégiques basées sur les services détectés
    web_ports = [p for p in recommendations["ports_analysis"] if p.get('port') in [80, 8080, 3000, 5000]]
    if web_ports:
        recommendations["strategic_actions"].append({
            "title": "🔐 Migration HTTPS Complète",
            "description": "Chiffrer 100% du trafic web avec certificats gratuits",
            "priority": "Haute",
            "steps": [
                "Obtenir certificat SSL gratuit (Let's Encrypt)",
                "Configurer HTTPS sur tous les serveurs web",
                "Rediriger HTTP → HTTPS (301 permanent)",
                "Activer HSTS avec preload",
                "Tester avec SSL Labs (grade A+ requis)",
                "Monitoring: alertes certificats < 30j"
            ],
            "estimated_time": "2-3 heures",
            "difficulty": "moyen",
            "resources": [
                "https://letsencrypt.org/getting-started/",
                "https://certbot.eff.org/",
                "https://ssl-config.mozilla.org/"
            ]
        })
    
    db_ports = [p for p in recommendations["ports_analysis"] if p.get('port') in [3306, 5432, 27017, 6379, 9200, 11211]]
    if db_ports:
        recommendations["strategic_actions"].append({
            "title": "🗄️ Isolation Complète des Bases de Données",
            "description": "Sécuriser l'accès aux données selon best practices",
            "priority": "Critique",
            "steps": [
                "Bind toutes les BDD à localhost (127.0.0.1)",
                "Configurer VPN pour accès distant (WireGuard recommandé)",
                "Activer authentification forte sur TOUTES les BDD",
                "Chiffrer connexions (TLS/SSL obligatoire)",
                "Utilisateurs avec privilèges minimaux (GRANT spécifiques)",
                "Audit logging complet",
                "Sauvegardes chiffrées automatiques (GPG)",
                "Monitoring: alertes sur connexions non-localhost",
                "Tests de pénétration réguliers"
            ],
            "estimated_time": "4-6 heures",
            "difficulty": "moyen-difficile",
            "resources": [
                "https://www.wireguard.com/quickstart/",
                "https://openvpn.net/community-resources/",
                "https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html"
            ]
        })
    
    rdp_vnc_ports = [p for p in recommendations["ports_analysis"] if p.get('port') in [3389, 5900, 5901]]
    if rdp_vnc_ports:
        recommendations["strategic_actions"].append({
            "title": "🔒 Sécurisation Accès Bureau à Distance",
            "description": "Remplacer ou sécuriser drastiquement RDP/VNC",
            "priority": "Critique",
            "steps": [
                "Solution #1 (RECOMMANDÉ): VPN obligatoire (WireGuard/OpenVPN)",
                "Solution #2: Bastion host/Jump server dans DMZ",
                "Solution #3: Solutions modernes (ZeroTier, Tailscale)",
                "Activer NLA pour RDP (Network Level Authentication)",
                "2FA obligatoire (Azure MFA, Duo)",
                "Whitelist IP stricte",
                "Account lockout après 3 tentatives",
                "Monitoring et alerting sur tentatives échouées"
            ],
            "estimated_time": "3-4 heures",
            "difficulty": "moyen",
            "resources": [
                "https://www.wireguard.com/",
                "https://www.zerotier.com/",
                "https://tailscale.com/"
            ]
        })
    
    return recommendations

def generate_scan_report(scan_data):
    """
    Génère un rapport complet avec recommandations pour tout le scan.
    
    Args:
        scan_data: dict avec 'hosts' (list) et métadonnées du scan
    
    Returns:
        dict avec rapport complet professionnel
    """
    hosts = scan_data.get('hosts', [])
    
    # Compter les hôtes par niveau de risque (gérer français et anglais)
    def normalize_risk(risk_str):
        """Normalise le risk_level en anglais minuscules."""
        risk = (risk_str or '').upper()
        # Mapping français → anglais
        mapping = {
            'CRITIQUE': 'critical',
            'CRITICAL': 'critical',
            'ÉLEVÉ': 'high',
            'ELEVE': 'high',
            'HIGH': 'high',
            'MOYEN': 'medium',
            'MEDIUM': 'medium',
            'FAIBLE': 'low',
            'LOW': 'low',
            'INFO': 'low'
        }
        return mapping.get(risk, 'low')
    
    # Debug: afficher les risk_level reçus
    print(f"\n[SCAN REPORT DEBUG] Analyse de {len(hosts)} hôtes")
    if hosts:
        for i, h in enumerate(hosts[:5]):  # Premiers 5 hôtes
            print(f"  Hôte {i+1}: IP={h.get('ip_address')}, risk_level='{h.get('risk_level')}', normalized='{normalize_risk(h.get('risk_level'))}'")
    
    critical_count = sum(1 for h in hosts if normalize_risk(h.get('risk_level')) == 'critical')
    high_count = sum(1 for h in hosts if normalize_risk(h.get('risk_level')) == 'high')
    medium_count = sum(1 for h in hosts if normalize_risk(h.get('risk_level')) == 'medium')
    low_count = sum(1 for h in hosts if normalize_risk(h.get('risk_level')) == 'low')
    
    print(f"[SCAN REPORT DEBUG] Comptage: critical={critical_count}, high={high_count}, medium={medium_count}, low={low_count}\n")
    
    report = {
        "executive_summary": {
            "total_hosts": len(hosts),
            "critical_hosts": critical_count,
            "high_risk_hosts": high_count,
            "medium_risk_hosts": medium_count,
            "low_risk_hosts": low_count,
            "score": 0,
            "grade": "F",
            "total_remediation_time": "0 min",
            "compliance_status": {}
        },
        "hosts_recommendations": [],
        "network_wide_actions": [],
        "compliance_summary": {},
        "cve_summary": []
    }
    
    total_time_minutes = 0
    all_cves = []
    all_compliance = set()
    
    # Générer recommandations pour chaque hôte
    for host in hosts:
        host_rec = generate_host_recommendations(host)
        report["hosts_recommendations"].append(host_rec)
        
        # Agréger temps
        time_str = host_rec.get("estimated_total_time", "0 min")
        try:
            minutes = int(''.join(filter(str.isdigit, time_str.split()[0])))
            total_time_minutes += minutes
        except:
            pass
        
        # Agréger CVEs
        all_cves.extend(host_rec.get("cve_references", []))
        
        # Agréger conformité
        for fw in host_rec.get("compliance_frameworks", []):
            all_compliance.add(fw)
    
    # Temps total estimé
    hours = total_time_minutes // 60
    minutes = total_time_minutes % 60
    report["executive_summary"]["total_remediation_time"] = f"{total_time_minutes} min ({hours}h{minutes:02d})"
    
    # CVEs uniques
    report["cve_summary"] = list(set(all_cves))
    
    # Conformité
    report["compliance_summary"] = {
        "frameworks_impacted": list(all_compliance),
        "compliance_score": "Non-Compliant" if report["executive_summary"]["critical_hosts"] > 0 else "Partially Compliant"
    }
    
    # Actions réseau globales
    if report["executive_summary"]["critical_hosts"] > 0:
        report["network_wide_actions"].append({
            "priority": "🚨 URGENCE MAXIMALE",
            "action": "Réunion de Crise Sécurité",
            "description": f"{report['executive_summary']['critical_hosts']} hôte(s) à risque CRITIQUE détecté(s) - Violation potentielle de conformité",
            "steps": [
                "Convoquer RSSI, Ops, Dev leads dans l'heure",
                "Isoler les systèmes critiques du réseau si possible",
                "Auditer tous les logs sur 30 derniers jours minimum",
                "Vérifier absence de compromission (IOCs, rootkits)",
                "Implémenter les Quick Wins immédiatement",
                "Planifier remédiation complète < 24h",
                "Documenter incident selon protocole",
                "Communication direction/compliance officer",
                "Envisager notification autorités si données sensibles"
            ],
            "estimated_time": "1-2 jours (effort équipe)",
            "compliance_impact": "CRITIQUE - PCI-DSS, HIPAA, GDPR, SOC2"
        })
    
    if report["executive_summary"]["high_risk_hosts"] > 0:
        report["network_wide_actions"].append({
            "priority": "🟠 IMPORTANT",
            "action": "Audit de Sécurité Réseau Complet",
            "description": f"{report['executive_summary']['high_risk_hosts']} hôte(s) à haut risque - Intervention requise",
            "steps": [
                "Inventaire complet des actifs réseau",
                "Scan de vulnérabilités approfondi (Nessus, OpenVAS)",
                "Pentest externe si services publics",
                "Revue architecture sécurité",
                "Plan de remédiation priorisé",
                "Budget et ressources alloués",
                "Timeline de correction < 7-14 jours"
            ],
            "estimated_time": "1 semaine (effort équipe)",
            "compliance_impact": "MOYEN - Risque de non-conformité"
        })
    
    # Calcul du score de sécurité (0-100, pondéré et normalisé)
    # Formule: Score basé sur le % d'hôtes à risque pondéré
    total_hosts = len(hosts) if hosts else 1
    
    # Pondération par risque
    critical_weight = report["executive_summary"]["critical_hosts"] * 25
    high_weight = report["executive_summary"]["high_risk_hosts"] * 10  
    medium_weight = report["executive_summary"]["medium_risk_hosts"] * 5
    low_weight = report["executive_summary"]["low_risk_hosts"] * 1
    
    total_risk_points = critical_weight + high_weight + medium_weight + low_weight
    
    # Normaliser sur 100 (score inversé : moins de risque = meilleur score)
    # Si total_hosts = 10 et tous critiques = 10*25 = 250 points max
    max_possible_points = total_hosts * 25
    
    if max_possible_points > 0:
        risk_percentage = (total_risk_points / max_possible_points) * 100
        score = max(0, int(100 - risk_percentage))
    else:
        score = 100
    
    report["executive_summary"]["score"] = score
    
    # Grade (A à F)
    if score >= 90:
        report["executive_summary"]["grade"] = "A"
    elif score >= 75:
        report["executive_summary"]["grade"] = "B"
    elif score >= 60:
        report["executive_summary"]["grade"] = "C"
    elif score >= 40:
        report["executive_summary"]["grade"] = "D"
    else:
        report["executive_summary"]["grade"] = "F"
    
    return report

def generate_remediation_script(host_recommendations):
    """
    Génère un script bash automatisé de remédiation.
    
    Args:
        host_recommendations: dict des recommandations pour un hôte
    
    Returns:
        str: script bash exécutable
    """
    script = """#!/bin/bash
# PathFinder - Script de Remédiation Automatique
# Généré le: """ + str(__import__('datetime').datetime.now()) + """
# ATTENTION: Vérifier et tester avant exécution en production

set -e  # Exit on error

echo "🛡️ PathFinder - Remédiation de Sécurité"
echo "========================================"
echo ""

"""
    
    for port_analysis in host_recommendations.get("ports_analysis", []):
        if port_analysis.get("automation_script"):
            script += f"\n# Port {port_analysis['port']} - {port_analysis['service']}\n"
            script += f"echo 'Correction port {port_analysis['port']}...'\n"
            script += "\n".join(port_analysis.get("commands", []))
            script += "\n\n"
    
    script += """
echo ""
echo "✅ Remédiation terminée"
echo "⚠️  Redémarrer le système si nécessaire"
echo "📊 Lancer un nouveau scan PathFinder pour vérifier"
"""
    
    return script
