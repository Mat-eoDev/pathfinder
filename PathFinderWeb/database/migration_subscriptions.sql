-- Migration idempotente : ajoute le système d'abonnement à une base existante.
-- À lancer avec : mysql -u root -proot pathfinder < migration_subscriptions.sql
-- Safe à relancer plusieurs fois : tous les ALTER/CREATE sont conditionnels.

USE pathfinder;

-- ---------------------------------------------------------------------------
-- 1. Colonnes abonnement sur users (ajoutées seulement si absentes)
-- ---------------------------------------------------------------------------

SET @db = DATABASE();

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT ''free''',
        'SELECT ''users.subscription_tier déjà présent'' AS info'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_tier'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN subscription_started_at DATETIME NULL',
        'SELECT ''users.subscription_started_at déjà présent'' AS info'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_started_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN subscription_ends_at DATETIME NULL',
        'SELECT ''users.subscription_ends_at déjà présent'' AS info'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_ends_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN subscription_auto_renew TINYINT(1) NOT NULL DEFAULT 1',
        'SELECT ''users.subscription_auto_renew déjà présent'' AS info'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_auto_renew'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'CREATE INDEX idx_tier ON users(subscription_tier)',
        'SELECT ''index idx_tier déjà présent'' AS info'
    )
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_tier'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2. Tables subscriptions + fake_invoices (CREATE IF NOT EXISTS natif)
-- ---------------------------------------------------------------------------

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
    fake_payment_method VARCHAR(50) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_ends_at (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fake_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT NULL,
    tier VARCHAR(20) NOT NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status ENUM('paid', 'refused', 'refunded') NOT NULL DEFAULT 'paid',
    payment_method VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    issued_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    INDEX idx_user_issued (user_id, issued_at DESC),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 3. Seed : les admins existants passent en Enterprise, les autres en Free
-- ---------------------------------------------------------------------------

UPDATE users SET subscription_tier = 'enterprise'
WHERE role = 'admin' AND subscription_tier = 'free';

SELECT '✅ Migration abonnements appliquée' AS Message;
SELECT subscription_tier, COUNT(*) AS nb FROM users GROUP BY subscription_tier;
