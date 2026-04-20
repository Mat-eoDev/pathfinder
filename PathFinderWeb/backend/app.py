#!/usr/bin/env python3
"""
PathFinder Web API - Backend Flask
Gère l'authentification, les scans et l'envoi des résultats vers MySQL
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import hashlib
import bcrypt
import jwt
import datetime
import secrets
import warnings
from functools import wraps
import json
import os
from security_recommendations import generate_host_recommendations, generate_scan_report, get_port_recommendations, generate_remediation_script
from pentest_engine import (
    aggressive_port_scan, bruteforce_ssh, directory_busting, cve_scanner, 
    network_mapping, test_exploit, crack_hash, reverse_dns_lookup, whois_lookup,
    start_packet_capture, stop_packet_capture, spoof_mac_address, reset_mac_address, monitor_bandwidth
)

app = Flask(__name__)
CORS(app)  # Permettre les requêtes cross-origin

# ----- Secret JWT : exigé en prod, généré éphémèrement en debug -----
_secret = os.getenv('PATHFINDER_SECRET_KEY')
if not _secret:
    if os.getenv('FLASK_DEBUG') == '1':
        _secret = secrets.token_urlsafe(64)
        warnings.warn(
            "PATHFINDER_SECRET_KEY absente : un secret éphémère a été généré (mode debug). "
            "Tous les JWT seront invalidés à chaque redémarrage."
        )
    else:
        raise RuntimeError(
            "PATHFINDER_SECRET_KEY doit être définie en production. "
            "Générer une valeur sûre : python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
app.config['SECRET_KEY'] = _secret
app.config['MYSQL_HOST'] = os.getenv('PATHFINDER_MYSQL_HOST', 'localhost')
app.config['MYSQL_PORT'] = int(os.getenv('PATHFINDER_MYSQL_PORT', '3306'))  # Port MySQL standard (3306) ou MAMP (8889)
app.config['MYSQL_USER'] = os.getenv('PATHFINDER_MYSQL_USER', 'root')
app.config['MYSQL_PASSWORD'] = os.getenv('PATHFINDER_MYSQL_PASSWORD', 'root')  # Mot de passe MAMP par défaut
app.config['MYSQL_DATABASE'] = os.getenv('PATHFINDER_MYSQL_DATABASE', 'pathfinder')
app.config['MYSQL_UNIX_SOCKET'] = os.getenv('PATHFINDER_MYSQL_SOCKET', '/Applications/MAMP/tmp/mysql/mysql.sock')

# Connexion MySQL
def get_db_connection():
    """Crée une connexion à la base de données MySQL."""
    # D'abord essayer avec host:port (fonctionne partout : Hostinger, VPS, etc.)
    try:
        connection = mysql.connector.connect(
            host=app.config['MYSQL_HOST'],
            port=app.config['MYSQL_PORT'],
            user=app.config['MYSQL_USER'],
            password=app.config['MYSQL_PASSWORD'],
            database=app.config['MYSQL_DATABASE']
        )
        return connection
    except Error as e:
        # Fallback : essayer avec socket Unix (MAMP local uniquement)
        if app.config.get('MYSQL_UNIX_SOCKET'):
            try:
                connection = mysql.connector.connect(
                    unix_socket=app.config['MYSQL_UNIX_SOCKET'],
                    user=app.config['MYSQL_USER'],
                    password=app.config['MYSQL_PASSWORD'],
                    database=app.config['MYSQL_DATABASE']
                )
                return connection
            except Error as e2:
                print(f"Erreur de connexion MySQL (socket): {e2}")
        print(f"Erreur de connexion MySQL (host:port): {e}")
        return None

# ----- Hashage des mots de passe -----
# bcrypt pour les nouveaux mots de passe ; les anciens hashes SHA-256 (64 chars hex) sont
# vérifiés en compatibilité descendante, puis ré-hashés en bcrypt au prochain login réussi.

def hash_password(password: str) -> str:
    """Retourne un hash bcrypt UTF-8 prêt pour stockage."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')


def _is_legacy_sha256(stored_hash: str) -> bool:
    """Détecte un hash SHA-256 hex (64 chars hex), héritage des anciennes versions."""
    return len(stored_hash) == 64 and all(c in '0123456789abcdef' for c in stored_hash.lower())


def verify_password(password: str, stored_hash: str) -> bool:
    """Vérifie un mot de passe contre un hash bcrypt OU un legacy SHA-256."""
    if not stored_hash:
        return False
    if stored_hash.startswith('$2'):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        except (ValueError, TypeError):
            return False
    if _is_legacy_sha256(stored_hash):
        return hashlib.sha256(password.encode('utf-8')).hexdigest() == stored_hash
    return False


def _upgrade_legacy_hash_if_needed(user_id: int, password: str, stored_hash: str) -> None:
    """Si le hash est en legacy SHA-256, le ré-hash en bcrypt et l'enregistre."""
    if not stored_hash or not _is_legacy_sha256(stored_hash):
        return
    new_hash = hash_password(password)
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
        conn.commit()
        cur.close()
    except Error:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


# Décorateur d'authentification
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'message': 'Token manquant'}), 401
        
        try:
            # Enlever "Bearer " si présent
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expiré'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token invalide'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

# ========== ROUTES D'AUTHENTIFICATION ==========

@app.route('/api/register', methods=['POST'])
def register():
    """Inscription d'un nouvel utilisateur."""
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    username = data.get('username')
    
    if not email or not password or not username:
        return jsonify({'message': 'Email, username et password requis'}), 400
    if len(password) < 8:
        return jsonify({'message': 'Le mot de passe doit contenir au moins 8 caractères'}), 400

    password_hash = hash_password(password)
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion à la base de données'}), 500
    
    cursor = conn.cursor()
    
    try:
        # Vérifier si l'email existe déjà
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'message': 'Email déjà utilisé'}), 400
        
        # Créer l'utilisateur
        cursor.execute(
            "INSERT INTO users (email, username, password_hash, created_at) VALUES (%s, %s, %s, %s)",
            (email, username, password_hash, datetime.datetime.now())
        )
        user_id = cursor.lastrowid
        conn.commit()
        
        # Log l'activité
        log_activity(user_id, 'register', f'Nouveau compte créé: {username}')
        
        return jsonify({'message': 'Utilisateur créé avec succès'}), 201
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    """Connexion d'un utilisateur."""
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'message': 'Email et password requis'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion à la base de données'}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT id, email, username, role, password_hash FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()

        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'message': 'Email ou mot de passe incorrect'}), 401

        # Migration transparente SHA-256 -> bcrypt au premier login réussi
        _upgrade_legacy_hash_if_needed(user['id'], password, user['password_hash'])
        
        # Créer le token JWT (valide 24h)
        token = jwt.encode({
            'user_id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)  # 7 jours au lieu de 24h
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        # Mettre à jour last_login
        cursor.execute(
            "UPDATE users SET last_login = %s WHERE id = %s",
            (datetime.datetime.now(), user['id'])
        )
        conn.commit()
        
        # Log l'activité
        log_activity(user['id'], 'login', f'Connexion de {user["username"]}')
        
        return jsonify({
            'message': 'Connexion réussie',
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'username': user['username'],
                'role': user['role']
            }
        }), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

# ========== ROUTES DES SCANS ==========

@app.route('/api/scans', methods=['POST'])
@token_required
def create_scan(current_user_id):
    """Enregistre un nouveau scan."""
    data = request.get_json()
    
    network_range = data.get('network_range')
    results = data.get('results', [])
    mode = data.get('mode', 'fast')
    if mode not in ('fast', 'full'):
        mode = 'fast'

    if not network_range or not results:
        return jsonify({'message': 'network_range et results requis'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion à la base de données'}), 500
    
    cursor = conn.cursor()
    
    try:
        # Calculer les statistiques
        alive_hosts = [h for h in results if h.get('alive')]
        total_hosts = len(results)
        alive_count = len(alive_hosts)
        critical_count = len([h for h in alive_hosts if h.get('risk_level') == 'CRITIQUE'])
        high_risk_count = len([h for h in alive_hosts if h.get('risk_level') == 'ÉLEVÉ'])
        
        # Insérer le scan
        cursor.execute(
            """INSERT INTO scans 
            (user_id, network_range, total_hosts, alive_hosts, critical_hosts, high_risk_hosts, scan_date, mode)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (current_user_id, network_range, total_hosts, alive_count, 
             critical_count, high_risk_count, datetime.datetime.now(), mode)
        )
        scan_id = cursor.lastrowid
        
        # Insérer les hôtes détaillés
        for host in alive_hosts:
            cursor.execute(
                """INSERT INTO scan_hosts 
                (scan_id, ip_address, hostname, os_detected, ttl, open_ports, risk_level, priority_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (scan_id, host.get('ip'), host.get('hostname', ''), host.get('os', 'Unknown'),
                 host.get('ttl', 0), json.dumps(host.get('open_ports', [])),
                 host.get('risk_level', 'INFO'), host.get('priority_score', 0))
            )
        
        conn.commit()
        
        # Log l'activité
        log_activity(current_user_id, 'scan', 
                    f'Scan réseau effectué: {network_range}',
                    f'{alive_count} hôtes actifs, {critical_count} critiques')
        
        return jsonify({
            'message': 'Scan enregistré avec succès',
            'scan_id': scan_id
        }), 201
        
    except Error as e:
        conn.rollback()
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/scans', methods=['GET'])
@token_required
def get_scans(current_user_id):
    """Récupère tous les scans d'un utilisateur."""
    # Récupérer le rôle de l'utilisateur
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        is_admin = token_data.get('role') == 'admin'
        selected_user = request.args.get('user_id', type=int)  # Pour l'admin
    except:
        is_admin = False
        selected_user = None
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Si admin et user_id spécifié, récupérer les scans de cet utilisateur
        if is_admin and selected_user:
            target_user_id = selected_user
        elif is_admin:
            # Admin sans user_id spécifié = tous les scans
            cursor.execute(
                """SELECT s.id, s.network_range, s.total_hosts, s.alive_hosts, 
                s.critical_hosts, s.high_risk_hosts, s.scan_date, s.user_id,
                u.username as user_name, u.email as user_email
                FROM scans s 
                JOIN users u ON s.user_id = u.id
                ORDER BY s.scan_date DESC LIMIT 100"""
            )
            scans = cursor.fetchall()
            
            for scan in scans:
                scan['scan_date'] = scan['scan_date'].isoformat() if scan['scan_date'] else None
            
            return jsonify({'scans': scans, 'is_admin': True}), 200
        else:
            target_user_id = current_user_id
        
        cursor.execute(
            """SELECT id, network_range, total_hosts, alive_hosts, 
            critical_hosts, high_risk_hosts, scan_date 
            FROM scans WHERE user_id = %s ORDER BY scan_date DESC LIMIT 50""",
            (target_user_id,)
        )
        scans = cursor.fetchall()
        
        # Convertir les dates en string
        for scan in scans:
            scan['scan_date'] = scan['scan_date'].isoformat() if scan['scan_date'] else None
        
        return jsonify({'scans': scans, 'is_admin': is_admin}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/scans/<int:scan_id>', methods=['GET'])
@token_required
def get_scan_detail(current_user_id, scan_id):
    """Récupère les détails d'un scan spécifique."""
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Vérifier que le scan appartient à l'utilisateur
        cursor.execute(
            "SELECT * FROM scans WHERE id = %s AND user_id = %s",
            (scan_id, current_user_id)
        )
        scan = cursor.fetchone()
        
        if not scan:
            return jsonify({'message': 'Scan non trouvé'}), 404
        
        # Récupérer les hôtes
        cursor.execute(
            "SELECT * FROM scan_hosts WHERE scan_id = %s ORDER BY priority_score DESC",
            (scan_id,)
        )
        hosts = cursor.fetchall()
        
        # Parser les open_ports JSON
        for host in hosts:
            host['open_ports'] = json.loads(host['open_ports']) if host['open_ports'] else []
        
        scan['scan_date'] = scan['scan_date'].isoformat() if scan['scan_date'] else None
        scan['hosts'] = hosts
        
        # Générer les recommandations de sécurité
        scan_with_recommendations = {'hosts': hosts}
        security_report = generate_scan_report(scan_with_recommendations)
        
        return jsonify({
            'scan': scan,
            'security_report': security_report
        }), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user_id):
    """Récupère les statistiques pour le dashboard."""
    # Récupérer le rôle de l'utilisateur
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        is_admin = token_data.get('role') == 'admin'
        selected_user = request.args.get('user_id', type=int)
    except:
        is_admin = False
        selected_user = None
    
    # Déterminer l'utilisateur cible
    if is_admin and selected_user:
        target_user_id = selected_user
        user_filter = f"WHERE user_id = {selected_user}"
    elif is_admin:
        target_user_id = None
        user_filter = ""  # Tous les utilisateurs
    else:
        target_user_id = current_user_id
        user_filter = f"WHERE user_id = {current_user_id}"
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Stats globales
        if is_admin and not selected_user:
            # Admin voit TOUT
            cursor.execute(
                """SELECT 
                    COUNT(*) as total_scans,
                    SUM(alive_hosts) as total_devices,
                    SUM(critical_hosts) as total_critical,
                    SUM(high_risk_hosts) as total_high_risk
                FROM scans"""
            )
        else:
            cursor.execute(
                f"""SELECT 
                    COUNT(*) as total_scans,
                    SUM(alive_hosts) as total_devices,
                    SUM(critical_hosts) as total_critical,
                    SUM(high_risk_hosts) as total_high_risk
                FROM scans {user_filter}"""
            )
        global_stats = cursor.fetchone()
        
        # Derniers scans
        if is_admin and not selected_user:
            cursor.execute(
                """SELECT s.scan_date, s.alive_hosts, s.critical_hosts, u.username
                FROM scans s
                JOIN users u ON s.user_id = u.id
                ORDER BY s.scan_date DESC LIMIT 7"""
            )
        else:
            cursor.execute(
                f"""SELECT scan_date, alive_hosts, critical_hosts 
                FROM scans {user_filter}
                ORDER BY scan_date DESC LIMIT 7"""
            )
        recent_scans = cursor.fetchall()
        
        # Distribution des OS
        if is_admin and not selected_user:
            cursor.execute(
                """SELECT os_detected, COUNT(*) as count 
                FROM scan_hosts sh
                JOIN scans s ON sh.scan_id = s.id
                GROUP BY os_detected
                ORDER BY count DESC LIMIT 10"""
            )
        else:
            cursor.execute(
                f"""SELECT os_detected, COUNT(*) as count 
                FROM scan_hosts sh
                JOIN scans s ON sh.scan_id = s.id
                {user_filter.replace('user_id', 's.user_id')}
                GROUP BY os_detected
                ORDER BY count DESC LIMIT 10"""
            )
        os_distribution = cursor.fetchall()
        
        # Convertir dates
        for scan in recent_scans:
            scan['scan_date'] = scan['scan_date'].isoformat() if scan['scan_date'] else None
        
        return jsonify({
            'global_stats': global_stats,
            'recent_scans': recent_scans,
            'os_distribution': os_distribution,
            'is_admin': is_admin
        }), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

# ========== ROUTES USER PROFILE ==========

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_user_profile(current_user_id):
    """Récupère le profil complet de l'utilisateur."""
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            """SELECT u.id, u.email, u.username, u.role, u.created_at, u.last_login,
            COUNT(DISTINCT s.id) as total_scans,
            COALESCE(SUM(s.alive_hosts), 0) as total_devices,
            COALESCE(SUM(s.critical_hosts), 0) as total_critical
            FROM users u
            LEFT JOIN scans s ON u.id = s.user_id
            WHERE u.id = %s
            GROUP BY u.id""",
            (current_user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'message': 'Utilisateur non trouvé'}), 404
        
        # Convertir dates
        user['created_at'] = user['created_at'].isoformat() if user['created_at'] else None
        user['last_login'] = user['last_login'].isoformat() if user['last_login'] else None
        
        return jsonify(user), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/update', methods=['PUT'])
@token_required
def update_user_profile(current_user_id):
    """Met à jour le profil utilisateur."""
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    
    if not username or not email:
        return jsonify({'message': 'Username et email requis'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor()
    
    try:
        # Vérifier si l'email est déjà utilisé par un autre user
        cursor.execute(
            "SELECT id FROM users WHERE email = %s AND id != %s",
            (email, current_user_id)
        )
        if cursor.fetchone():
            return jsonify({'message': 'Email déjà utilisé'}), 400
        
        # Mettre à jour
        cursor.execute(
            "UPDATE users SET username = %s, email = %s WHERE id = %s",
            (username, email, current_user_id)
        )
        conn.commit()
        
        # Log l'activité
        log_activity(current_user_id, 'update_profile', f'Profil mis à jour: {username}')
        
        return jsonify({'message': 'Profil mis à jour'}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/change-password', methods=['PUT'])
@token_required
def change_password(current_user_id):
    """Change le mot de passe utilisateur."""
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'message': 'Mots de passe requis'}), 400
    if len(new_password) < 8:
        return jsonify({'message': 'Le nouveau mot de passe doit contenir au moins 8 caractères'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT password_hash FROM users WHERE id = %s",
            (current_user_id,)
        )
        user = cursor.fetchone()

        if not user or not verify_password(current_password, user['password_hash']):
            return jsonify({'message': 'Mot de passe actuel incorrect'}), 401

        new_password_hash = hash_password(new_password)
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (new_password_hash, current_user_id)
        )
        conn.commit()
        
        # Log l'activité
        log_activity(current_user_id, 'change_password', 'Mot de passe changé')
        
        return jsonify({'message': 'Mot de passe changé'}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/activity-logs', methods=['GET'])
@token_required
def get_activity_logs(current_user_id):
    """Récupère les logs d'activité de l'utilisateur."""
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            """SELECT action, description, details, timestamp 
            FROM activity_logs 
            WHERE user_id = %s 
            ORDER BY timestamp DESC 
            LIMIT 50""",
            (current_user_id,)
        )
        logs = cursor.fetchall()
        
        # Convertir dates
        for log in logs:
            log['timestamp'] = log['timestamp'].isoformat() if log['timestamp'] else None
        
        return jsonify({'logs': logs}), 200
        
    except Error as e:
        # Si la table n'existe pas encore, retourner tableau vide
        return jsonify({'logs': []}), 200
    finally:
        cursor.close()
        conn.close()

def log_activity(user_id, action, description, details=None):
    """Enregistre une activité utilisateur."""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """INSERT INTO activity_logs (user_id, action, description, details, timestamp)
            VALUES (%s, %s, %s, %s, %s)""",
            (user_id, action, description, details, datetime.datetime.now())
        )
        conn.commit()
    except:
        pass  # Silencieusement ignorer si erreur
    finally:
        cursor.close()
        conn.close()

# ========== ROUTES TICKETS ==========

@app.route('/api/tickets', methods=['POST'])
@token_required
def create_ticket(current_user_id):
    """Créer un nouveau ticket de support."""
    data = request.get_json()
    
    subject = data.get('subject')
    description = data.get('description')
    category = data.get('category', 'support')
    priority = data.get('priority', 'medium')
    
    if not subject or not description:
        return jsonify({'message': 'Sujet et description requis'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor()
    
    try:
        now = datetime.datetime.now()
        cursor.execute(
            """INSERT INTO tickets 
            (user_id, subject, description, category, priority, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'open', %s, %s)""",
            (current_user_id, subject, description, category, priority, now, now)
        )
        ticket_id = cursor.lastrowid
        conn.commit()
        
        # Log l'activité
        log_activity(current_user_id, 'ticket_created', 
                    f'Ticket créé: {subject}', 
                    f'Catégorie: {category}, Priorité: {priority}')
        
        return jsonify({
            'message': 'Ticket créé avec succès',
            'ticket_id': ticket_id
        }), 201
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/tickets', methods=['GET'])
@token_required
def get_tickets(current_user_id):
    """Récupère les tickets de l'utilisateur ou tous (admin)."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        is_admin = token_data.get('role') == 'admin'
    except:
        is_admin = False
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        if is_admin:
            # Admin voit tous les tickets
            cursor.execute(
                """SELECT t.*, u.username, u.email,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND read_at IS NULL AND is_admin_reply = FALSE) as unread_count
                FROM tickets t
                JOIN users u ON t.user_id = u.id
                ORDER BY t.updated_at DESC"""
            )
        else:
            # Utilisateur voit uniquement ses tickets
            cursor.execute(
                """SELECT t.*,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND read_at IS NULL AND is_admin_reply = TRUE) as unread_count
                FROM tickets t
                WHERE t.user_id = %s
                ORDER BY t.updated_at DESC""",
                (current_user_id,)
            )
        
        tickets = cursor.fetchall()
        
        # Convertir dates
        for ticket in tickets:
            ticket['created_at'] = ticket['created_at'].isoformat() if ticket['created_at'] else None
            ticket['updated_at'] = ticket['updated_at'].isoformat() if ticket['updated_at'] else None
            ticket['closed_at'] = ticket['closed_at'].isoformat() if ticket['closed_at'] else None
        
        return jsonify({'tickets': tickets, 'is_admin': is_admin}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/tickets/<int:ticket_id>', methods=['GET'])
@token_required
def get_ticket_details(current_user_id, ticket_id):
    """Récupère les détails d'un ticket avec tous ses messages."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        is_admin = token_data.get('role') == 'admin'
    except:
        is_admin = False
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Récupérer le ticket
        if is_admin:
            cursor.execute(
                """SELECT t.*, u.username, u.email
                FROM tickets t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = %s""",
                (ticket_id,)
            )
        else:
            cursor.execute(
                "SELECT * FROM tickets WHERE id = %s AND user_id = %s",
                (ticket_id, current_user_id)
            )
        
        ticket = cursor.fetchone()
        
        if not ticket:
            return jsonify({'message': 'Ticket non trouvé'}), 404
        
        # Récupérer tous les messages
        cursor.execute(
            """SELECT m.*, u.username, u.role
            FROM ticket_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.ticket_id = %s
            ORDER BY m.created_at ASC""",
            (ticket_id,)
        )
        messages = cursor.fetchall()
        
        # Marquer les messages comme lus
        if not is_admin:
            cursor.execute(
                """UPDATE ticket_messages 
                SET read_at = %s 
                WHERE ticket_id = %s AND read_at IS NULL AND is_admin_reply = TRUE""",
                (datetime.datetime.now(), ticket_id)
            )
        else:
            cursor.execute(
                """UPDATE ticket_messages 
                SET read_at = %s 
                WHERE ticket_id = %s AND read_at IS NULL AND is_admin_reply = FALSE""",
                (datetime.datetime.now(), ticket_id)
            )
        conn.commit()
        
        # Convertir dates
        ticket['created_at'] = ticket['created_at'].isoformat() if ticket['created_at'] else None
        ticket['updated_at'] = ticket['updated_at'].isoformat() if ticket['updated_at'] else None
        ticket['closed_at'] = ticket['closed_at'].isoformat() if ticket['closed_at'] else None
        
        for msg in messages:
            msg['created_at'] = msg['created_at'].isoformat() if msg['created_at'] else None
            msg['read_at'] = msg['read_at'].isoformat() if msg['read_at'] else None
        
        ticket['messages'] = messages
        
        return jsonify({'ticket': ticket}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/tickets/<int:ticket_id>/messages', methods=['POST'])
@token_required
def send_ticket_message(current_user_id, ticket_id):
    """Envoyer un message dans un ticket."""
    data = request.get_json()
    message = data.get('message')
    
    if not message:
        return jsonify({'message': 'Message requis'}), 400
    
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        is_admin = token_data.get('role') == 'admin'
    except:
        is_admin = False
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Vérifier que le ticket existe et appartient à l'utilisateur (ou admin)
        if is_admin:
            cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
        else:
            cursor.execute(
                "SELECT * FROM tickets WHERE id = %s AND user_id = %s",
                (ticket_id, current_user_id)
            )
        
        ticket = cursor.fetchone()
        
        if not ticket:
            return jsonify({'message': 'Ticket non trouvé'}), 404
        
        # Insérer le message
        now = datetime.datetime.now()
        cursor.execute(
            """INSERT INTO ticket_messages 
            (ticket_id, user_id, message, is_admin_reply, created_at)
            VALUES (%s, %s, %s, %s, %s)""",
            (ticket_id, current_user_id, message, is_admin, now)
        )
        
        # Mettre à jour le ticket
        new_status = 'in_progress' if is_admin else 'waiting_user'
        cursor.execute(
            "UPDATE tickets SET updated_at = %s, status = %s WHERE id = %s",
            (now, new_status, ticket_id)
        )
        
        conn.commit()
        
        # Log l'activité
        log_activity(current_user_id, 'ticket_message', 
                    f'Message envoyé sur ticket #{ticket_id}')
        
        return jsonify({'message': 'Message envoyé'}), 201
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/tickets/<int:ticket_id>/status', methods=['PUT'])
@token_required
def update_ticket_status(current_user_id, ticket_id):
    """Mettre à jour le statut d'un ticket (admin ou propriétaire)."""
    data = request.get_json()
    new_status = data.get('status')
    
    if new_status not in ['open', 'in_progress', 'waiting_user', 'resolved', 'closed']:
        return jsonify({'message': 'Statut invalide'}), 400
    
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        is_admin = token_data.get('role') == 'admin'
    except:
        is_admin = False
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor()
    
    try:
        # Vérifier les permissions
        if is_admin:
            query = "UPDATE tickets SET status = %s, updated_at = %s WHERE id = %s"
            params = (new_status, datetime.datetime.now(), ticket_id)
        else:
            query = "UPDATE tickets SET status = %s, updated_at = %s WHERE id = %s AND user_id = %s"
            params = (new_status, datetime.datetime.now(), ticket_id, current_user_id)
        
        cursor.execute(query, params)
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'Ticket non trouvé ou permission refusée'}), 404
        
        # Si fermé, mettre la date
        if new_status == 'closed':
            cursor.execute(
                "UPDATE tickets SET closed_at = %s WHERE id = %s",
                (datetime.datetime.now(), ticket_id)
            )
        
        conn.commit()
        
        return jsonify({'message': 'Statut mis à jour'}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_all_users(current_user_id):
    """Liste tous les utilisateurs (admin seulement)."""
    # Vérifier si admin
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        if token_data.get('role') != 'admin':
            return jsonify({'message': 'Accès non autorisé'}), 403
    except:
        return jsonify({'message': 'Token invalide'}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            """SELECT u.id, u.email, u.username, u.role, u.created_at, u.last_login,
            COUNT(s.id) as total_scans,
            COALESCE(SUM(s.alive_hosts), 0) as total_devices,
            COALESCE(SUM(s.critical_hosts), 0) as total_critical
            FROM users u
            LEFT JOIN scans s ON u.id = s.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC"""
        )
        users = cursor.fetchall()
        
        # Convertir dates
        for user in users:
            user['created_at'] = user['created_at'].isoformat() if user['created_at'] else None
            user['last_login'] = user['last_login'].isoformat() if user['last_login'] else None
        
        return jsonify({'users': users}), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

# ========== ROUTE DE TEST ==========

@app.route('/api/health', methods=['GET'])
def health():
    """Vérifier que l'API fonctionne."""
    return jsonify({
        'status': 'online',
        'timestamp': datetime.datetime.now().isoformat()
    }), 200

@app.route('/api/refresh-token', methods=['POST'])
@token_required
def refresh_token(current_user_id):
    """Rafraîchir le token JWT."""
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            "SELECT id, email, username, role FROM users WHERE id = %s",
            (current_user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'message': 'Utilisateur non trouvé'}), 404
        
        # Générer un nouveau token
        new_token = jwt.encode({
            'user_id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            'message': 'Token rafraîchi',
            'token': new_token
        }), 200
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

# ========== ROUTES DE TÉLÉCHARGEMENT ==========

@app.route('/api/scans/<int:scan_id>/remediation-script', methods=['GET'])
@token_required
def download_remediation_script(current_user_id, scan_id):
    """Génère et télécharge un script bash de remédiation automatique."""
    from flask import Response
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'message': 'Erreur de connexion'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Vérifier que le scan appartient à l'utilisateur
        cursor.execute(
            "SELECT * FROM scans WHERE id = %s AND user_id = %s",
            (scan_id, current_user_id)
        )
        scan = cursor.fetchone()
        
        if not scan:
            return jsonify({'message': 'Scan non trouvé'}), 404
        
        # Récupérer les hôtes
        cursor.execute(
            "SELECT * FROM scan_hosts WHERE scan_id = %s ORDER BY priority_score DESC",
            (scan_id,)
        )
        hosts = cursor.fetchall()
        
        # Parser les open_ports
        for host in hosts:
            host['open_ports'] = json.loads(host['open_ports']) if host['open_ports'] else []
        
        # Générer les recommandations
        scan_data = {'hosts': hosts}
        security_report = generate_scan_report(scan_data)
        
        # Générer le script pour chaque hôte
        script_content = f"""#!/bin/bash
# PathFinder - Script de Remédiation Automatique
# Généré le: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
# Scan ID: {scan_id}
# Réseau: {scan['network_range']}
#
# ⚠️  ATTENTION: Vérifier et tester avant exécution en production
# 📋 Ce script doit être exécuté avec sudo sur chaque hôte concerné

set -e  # Exit on error
set -u  # Exit on undefined variable

echo "════════════════════════════════════════════════"
echo "🛡️  PathFinder - Remédiation de Sécurité"
echo "════════════════════════════════════════════════"
echo ""
echo "Scan ID: {scan_id}"
echo "Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
echo "Hôtes à corriger: {len(hosts)}"
echo "Score actuel: {security_report['executive_summary']['score']}/100"
echo ""
echo "════════════════════════════════════════════════"
echo ""

# Vérifier que le script tourne en sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Ce script doit être exécuté avec sudo"
    exit 1
fi

"""
        
        # Ajouter les recommandations pour chaque hôte
        for host_rec in security_report.get('hosts_recommendations', []):
            host_sum = host_rec.get('host_summary', {})
            script_content += f"""
echo "──────────────────────────────────────────────"
echo "🖥️  Hôte: {host_sum.get('ip', 'N/A')}"
echo "    Hostname: {host_sum.get('hostname', 'N/A')}"
echo "    OS: {host_sum.get('os', 'N/A')}"
echo "    Risque: {host_sum.get('risk_level', 'N/A').upper()}"
echo "──────────────────────────────────────────────"
echo ""

"""
            # Quick Wins pour cet hôte
            for qw in host_rec.get('quick_wins', []):
                script_content += f"# {qw.get('action', 'Action')}\n"
                script_content += f"echo '⚡ {qw.get('action', 'Action')}...'\n"
                for cmd in qw.get('commands', []):
                    if cmd and not cmd.startswith('#') and cmd.strip():
                        script_content += f"{cmd}\n"
                script_content += "\n"
            
            # Commandes par port
            for port_analysis in host_rec.get('ports_analysis', []):
                if port_analysis.get('risk') in ['critical', 'high']:
                    script_content += f"# Port {port_analysis.get('port')} - {port_analysis.get('service')}\n"
                    script_content += f"echo 'Sécurisation port {port_analysis.get('port')} ({port_analysis.get('service')})...'\n"
                    for cmd in port_analysis.get('commands', []):
                        if cmd and not cmd.startswith('#') and cmd.strip():
                            script_content += f"{cmd}\n"
                    script_content += "\n"
        
        script_content += """
echo ""
echo "════════════════════════════════════════════════"
echo "✅ Remédiation terminée !"
echo "════════════════════════════════════════════════"
echo ""
echo "⚠️  Actions suivantes recommandées:"
echo "  1. Redémarrer les services modifiés"
echo "  2. Vérifier les logs pour erreurs"
echo "  3. Lancer un nouveau scan PathFinder"
echo "  4. Comparer le nouveau score de sécurité"
echo ""
"""
        
        # Retourner en tant que fichier téléchargeable
        return Response(
            script_content,
            mimetype='text/x-shellscript',
            headers={
                'Content-Disposition': f'attachment; filename=pathfinder-remediation-scan-{scan_id}.sh'
            }
        )
        
    except Error as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/download/<platform>', methods=['GET'])
def download_app(platform):
    """Télécharger l'application pour une plateforme spécifique."""
    downloads_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'downloads')
    
    files = {
        'windows': 'PathFinder-Windows.exe',
        'macos': 'PathFinder-macOS.dmg',
        'android': 'PathFinder-Android.apk'
    }
    
    if platform not in files:
        return jsonify({'message': 'Plateforme invalide'}), 400
    
    filename = files[platform]
    filepath = os.path.join(downloads_path, filename)
    
    # Vérifier si le fichier existe
    if not os.path.exists(filepath):
        # Créer un fichier placeholder si n'existe pas
        return jsonify({
            'message': f'Le fichier {filename} est en préparation',
            'status': 'coming_soon'
        }), 404
    
    try:
        return send_from_directory(downloads_path, filename, as_attachment=True)
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/download/info', methods=['GET'])
def download_info():
    """Informations sur les téléchargements disponibles."""
    downloads_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'downloads')
    
    files_info = []
    
    for platform, filename in [('windows', 'PathFinder-Windows.exe'), 
                               ('macos', 'PathFinder-macOS.dmg'),
                               ('android', 'PathFinder-Android.apk')]:
        filepath = os.path.join(downloads_path, filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            size_mb = round(size / (1024 * 1024), 1)
            files_info.append({
                'platform': platform,
                'filename': filename,
                'size_mb': size_mb,
                'available': True
            })
        else:
            files_info.append({
                'platform': platform,
                'filename': filename,
                'available': False
            })
    
    return jsonify({'downloads': files_info}), 200

# ========== ROUTE POUR SERVIR LE FRONTEND ==========

@app.route('/')
def serve_frontend():
    """Sert le fichier index.html."""
    frontend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
    try:
        return send_from_directory(frontend_path, 'index.html')
    except Exception as e:
        return f"Erreur: {e}<br>Path: {frontend_path}", 500

@app.route('/<path:path>')
def serve_static(path):
    """Sert les fichiers statiques."""
    # Ignorer les routes API
    if path.startswith('api/'):
        return jsonify({'message': 'Not found'}), 404
    
    frontend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
    try:
        return send_from_directory(frontend_path, path)
    except Exception as e:
        return f"Erreur: {e}<br>Path: {frontend_path}/{path}", 404

# ========== ROUTES PENTEST (Admin Mode) ==========
# L'accès aux routes pentest est réservé aux comptes dont le JWT contient role='admin'.
# La variable d'environnement PATHFINDER_PENTEST_CODE peut éventuellement être définie pour
# exiger un second facteur (header X-Pentest-Code) en plus du rôle admin.
PENTEST_CODE = os.environ.get('PATHFINDER_PENTEST_CODE')

def verify_pentest_access():
    """Autorise uniquement les utilisateurs admin (role JWT == 'admin').
    Si PATHFINDER_PENTEST_CODE est défini, exige en plus le header X-Pentest-Code correspondant."""
    token = request.headers.get('Authorization', '')
    if token.startswith('Bearer '):
        token = token[7:]
    if not token:
        return False
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    if data.get('role') != 'admin':
        return False
    if PENTEST_CODE and request.headers.get('X-Pentest-Code') != PENTEST_CODE:
        return False
    return True

@app.route('/api/pentest/portscan', methods=['POST'])
@token_required
def pentest_portscan(current_user_id):
    """Scan de ports agressif (mode pentest)."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    target = data.get('target')
    
    if not target:
        return jsonify({'message': 'Cible requise'}), 400
    
    try:
        results = aggressive_port_scan(target)
        log_activity(current_user_id, 'pentest_portscan', f'Port scan sur {target}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/bruteforce', methods=['POST'])
@token_required
def pentest_bruteforce(current_user_id):
    """Bruteforce SSH (mode pentest)."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    ip = data.get('ip')
    port = data.get('port', 22)
    username = data.get('username')
    wordlist = data.get('wordlist', 'common')
    
    if not ip or not username:
        return jsonify({'message': 'IP et username requis'}), 400
    
    try:
        results = bruteforce_ssh(ip, port, username, wordlist)
        log_activity(current_user_id, 'pentest_bruteforce', f'Bruteforce SSH {username}@{ip}:{port}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/dirbust', methods=['POST'])
@token_required
def pentest_dirbust(current_user_id):
    """Directory busting (mode pentest)."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    target = data.get('target')
    wordlist = data.get('wordlist', 'common')
    
    if not target:
        return jsonify({'message': 'URL cible requise'}), 400
    
    try:
        results = directory_busting(target, wordlist)
        log_activity(current_user_id, 'pentest_dirbust', f'Directory busting {target}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/cve-scan', methods=['POST'])
@token_required
def pentest_cve_scan(current_user_id):
    """Scanner CVE (mode pentest)."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    target = data.get('target')
    
    if not target:
        return jsonify({'message': 'Cible requise'}), 400
    
    try:
        results = cve_scanner(target)
        log_activity(current_user_id, 'pentest_cve', f'CVE scan {target}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/exploit-test', methods=['POST'])
@token_required
def pentest_exploit_test(current_user_id):
    """Test d'exploit (détection uniquement, pas d'exploitation réelle)."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    target = data.get('target')
    exploit_type = data.get('exploit_type', 'auto')
    
    if not target:
        return jsonify({'message': 'Cible requise'}), 400
    
    try:
        results = test_exploit(target, exploit_type)
        log_activity(current_user_id, 'pentest_exploit', f'Test exploit {exploit_type} sur {target}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/network-map', methods=['POST'])
@token_required
def pentest_network_map(current_user_id):
    """Cartographie réseau complète."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    network_range = data.get('network_range')
    
    if not network_range:
        return jsonify({'message': 'Plage réseau requise'}), 400
    
    try:
        results = network_mapping(network_range)
        log_activity(current_user_id, 'pentest_network_map', f'Network mapping {network_range}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/advanced-scan', methods=['POST'])
@token_required
def pentest_advanced_scan(current_user_id):
    """Scan avancé avec options."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    network_range = data.get('network_range')
    scan_type = data.get('scan_type', 'connect')
    scan_speed = data.get('scan_speed', 'normal')
    options = data.get('options', {})
    
    if not network_range:
        return jsonify({'message': 'Plage réseau requise'}), 400
    
    try:
        # Utiliser le scan agressif avec options
        results = aggressive_port_scan(network_range, scan_all=options.get('comprehensive', False))
        log_activity(current_user_id, 'pentest_advanced_scan', f'Advanced scan {network_range}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/hash-crack', methods=['POST'])
@token_required
def pentest_hash_crack(current_user_id):
    """Cracker un hash avec wordlist massive."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    hash_value = data.get('hash')
    hash_type = data.get('hash_type', 'md5')
    wordlist_type = data.get('wordlist_type', 'rockyou')
    max_attempts = data.get('max_attempts', 14344391)  # Scan complet rockyou.txt par défaut
    
    if not hash_value:
        return jsonify({'message': 'Hash requis'}), 400
    
    try:
        results = crack_hash(hash_value, hash_type, wordlist_type, max_attempts)
        log_activity(current_user_id, 'pentest_hash_crack', f'Hash crack {hash_type} ({wordlist_type})', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/reverse-dns', methods=['POST'])
@token_required
def pentest_reverse_dns(current_user_id):
    """Reverse DNS lookup."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    ip = data.get('ip')
    
    if not ip:
        return jsonify({'message': 'IP requise'}), 400
    
    try:
        results = reverse_dns_lookup(ip)
        log_activity(current_user_id, 'pentest_reverse_dns', f'Reverse DNS {ip}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/whois', methods=['POST'])
@token_required
def pentest_whois(current_user_id):
    """WHOIS lookup."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    target = data.get('target')
    
    if not target:
        return jsonify({'message': 'Cible requise'}), 400
    
    try:
        results = whois_lookup(target)
        log_activity(current_user_id, 'pentest_whois', f'WHOIS {target}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/packet-capture/start', methods=['POST'])
@token_required
def pentest_packet_capture_start(current_user_id):
    """Démarrer capture de paquets."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    interface = data.get('interface', 'en0')
    duration = data.get('duration', 60)
    
    try:
        results = start_packet_capture(interface, duration)
        log_activity(current_user_id, 'pentest_packet_capture', f'Capture {interface}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/packet-capture/stop', methods=['POST'])
@token_required
def pentest_packet_capture_stop(current_user_id):
    """Arrêter capture de paquets."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    capture_id = data.get('capture_id')
    
    if not capture_id:
        return jsonify({'message': 'Capture ID requis'}), 400
    
    try:
        results = stop_packet_capture(capture_id)
        log_activity(current_user_id, 'pentest_packet_stop', f'Stop capture {capture_id}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/mac-spoof', methods=['POST'])
@token_required
def pentest_mac_spoof(current_user_id):
    """MAC spoofing."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    interface = data.get('interface', 'en0')
    new_mac = data.get('new_mac', None)
    
    try:
        results = spoof_mac_address(interface, new_mac)
        log_activity(current_user_id, 'pentest_mac_spoof', f'MAC spoof {interface}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/mac-reset', methods=['POST'])
@token_required
def pentest_mac_reset(current_user_id):
    """Reset MAC address."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    interface = data.get('interface', 'en0')
    
    try:
        results = reset_mac_address(interface)
        log_activity(current_user_id, 'pentest_mac_reset', f'MAC reset {interface}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

@app.route('/api/pentest/tools/bandwidth-monitor', methods=['POST'])
@token_required
def pentest_bandwidth_monitor(current_user_id):
    """Monitoring de bande passante."""
    if not verify_pentest_access():
        return jsonify({'message': 'Accès admin requis'}), 403
    
    data = request.get_json()
    interface = data.get('interface', 'en0')
    duration = data.get('duration', 10)
    
    try:
        results = monitor_bandwidth(interface, duration)
        log_activity(current_user_id, 'pentest_bandwidth', f'Bandwidth {interface}', json.dumps(results))
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'message': f'Erreur: {str(e)}'}), 500

if __name__ == '__main__':
    # Mode développement uniquement
    # En production, utiliser wsgi.py avec serveur web (Apache/Nginx)
    DEBUG_MODE = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    PORT = int(os.getenv('PORT', '5001'))
    
    print("🚀 PathFinder API démarrée sur http://localhost:{}".format(PORT))
    print("📊 Dashboard disponible sur http://localhost:{}".format(PORT))
    
    if DEBUG_MODE:
        print("⚠️  Mode DEBUG activé - Ne pas utiliser en production !")
    else:
        print("✅ Mode PRODUCTION - Utiliser wsgi.py avec serveur web en production")

    # Migration légère : colonne `mode` sur scans (pour que MAUI puisse persister fast/full)
    _conn = get_db_connection()
    if _conn:
        try:
            _c = _conn.cursor()
            _c.execute("SHOW COLUMNS FROM scans LIKE 'mode'")
            if not _c.fetchone():
                _c.execute("ALTER TABLE scans ADD COLUMN mode VARCHAR(20) DEFAULT 'fast'")
                _conn.commit()
                print('[DB] Colonne scans.mode ajoutée')
            _c.close()
        except Error as e:
            print(f'[DB] Erreur migration mode: {e}')
        finally:
            _conn.close()

    app.run(debug=DEBUG_MODE, host='0.0.0.0', port=PORT)

