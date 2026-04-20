-- PathFinder Database Schema
-- Base de données MySQL pour stocker les utilisateurs et les scans

CREATE DATABASE IF NOT EXISTS pathfinder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pathfinder;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
    -- Abonnement : 'free' | 'pro' | 'enterprise'. ends_at=NULL => pas d'échéance (free).
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
    subscription_started_at DATETIME NULL,
    subscription_ends_at DATETIME NULL,
    subscription_auto_renew TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    last_login DATETIME,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_tier (subscription_tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique des abonnements (audit + permet de voir les changements de plan).
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tier VARCHAR(20) NOT NULL,
    status ENUM('active', 'canceled', 'expired', 'failed') NOT NULL DEFAULT 'active',
    started_at DATETIME NOT NULL,
    ends_at DATETIME NULL,
    canceled_at DATETIME NULL,
    amount_cents INT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    fake_payment_method VARCHAR(50) NULL,   -- ex: "visa ****4242"
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_ends_at (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fausses factures générées lors des checkout / renouvellements.
CREATE TABLE IF NOT EXISTS fake_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT NULL,
    tier VARCHAR(20) NOT NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status ENUM('paid', 'refused', 'refunded') NOT NULL DEFAULT 'paid',
    payment_method VARCHAR(50) NOT NULL,    -- ex: "visa ****4242"
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    issued_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    INDEX idx_user_issued (user_id, issued_at DESC),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des scans
CREATE TABLE IF NOT EXISTS scans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    network_range VARCHAR(50) NOT NULL,
    total_hosts INT NOT NULL DEFAULT 0,
    alive_hosts INT NOT NULL DEFAULT 0,
    critical_hosts INT NOT NULL DEFAULT 0,
    high_risk_hosts INT NOT NULL DEFAULT 0,
    mode VARCHAR(20) DEFAULT 'manual',
    scan_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_scan_date (scan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des hôtes détectés
CREATE TABLE IF NOT EXISTS scan_hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scan_id INT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    hostname VARCHAR(255),
    os_detected VARCHAR(100),
    ttl INT,
    open_ports JSON,
    risk_level VARCHAR(20),
    priority_score INT DEFAULT 0,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
    INDEX idx_scan_id (scan_id),
    INDEX idx_ip (ip_address),
    INDEX idx_risk (risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_timestamp (user_id, timestamp DESC),
    INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des tickets de support
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('bug', 'feature', 'question', 'support') DEFAULT 'support',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'waiting_user', 'resolved', 'closed') DEFAULT 'open',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    closed_at DATETIME,
    assigned_to INT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des messages de ticket (chat)
CREATE TABLE IF NOT EXISTS ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    read_at DATETIME,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comptes seed (à changer immédiatement en production).
-- Hashes bcrypt (cost 12). Mots de passe d'origine : admin123 / test123.
-- L'app supporte aussi les anciens hashes SHA-256 et les ré-hash en bcrypt au prochain login.
INSERT IGNORE INTO users (email, username, password_hash, role, created_at)
VALUES ('admin@pathfinder.local', 'Super Admin', '$2b$12$IXqNaEQgNmaSd6CsxhVG3.PHU9oFPwqy5J6ohNaW58oLFs6voGAPW', 'admin', NOW());

INSERT IGNORE INTO users (email, username, password_hash, role, created_at)
VALUES ('user@pathfinder.local', 'Test User', '$2b$12$YeFm8tUnbz4h/SQpaYHsj.ixw5V8H9JvDla1XLo.MuRaqj3jEafh.', 'user', NOW());

-- Afficher le résumé
SELECT 'Base de données PathFinder créée avec succès !' as Message;
SELECT COUNT(*) as 'Utilisateurs créés' FROM users;

