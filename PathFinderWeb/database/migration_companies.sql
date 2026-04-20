-- Migration idempotente : entreprises Enterprise + rôle company_admin + devis.
-- À exécuter sur une base PathFinder existante (post-migration_subscriptions.sql).
USE pathfinder;

-- 1) Ajouter company_id sur users (si absent).
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_id'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN company_id INT NULL AFTER subscription_auto_renew',
    'SELECT "users.company_id déjà présent" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Index sur company_id (si absent).
SET @idx_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_company'
);
SET @sql := IF(@idx_exists = 0,
    'ALTER TABLE users ADD INDEX idx_company (company_id)',
    'SELECT "idx_company déjà présent" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Étendre l'ENUM role pour accepter 'company_admin'.
--    MySQL ne permet pas ADD VALUE ; on fait un ALTER complet.
ALTER TABLE users
    MODIFY COLUMN role ENUM('user', 'admin', 'company_admin')
    NOT NULL DEFAULT 'user';

-- 4) Créer la table companies.
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    owner_user_id INT NOT NULL UNIQUE,
    license_count INT NOT NULL DEFAULT 1,
    notes TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_user_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) FK users.company_id -> companies.id (uniquement si absente).
SET @fk_exists := (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_id'
      AND REFERENCED_TABLE_NAME = 'companies'
);
SET @sql := IF(@fk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL',
    'SELECT "FK users.company_id déjà présente" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6) Table des demandes de devis.
CREATE TABLE IF NOT EXISTS quote_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    contact_name VARCHAR(150) NULL,
    company_name VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    seats_requested INT NULL,
    message TEXT NULL,
    status ENUM('new', 'contacted', 'closed') NOT NULL DEFAULT 'new',
    user_id INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Migration entreprises appliquée.' AS status;
