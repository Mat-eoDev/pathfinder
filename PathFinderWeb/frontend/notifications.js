// PathFinder - Système de Notifications Toast

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Créer le conteneur de notifications
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Icône selon le type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-content">
                <div class="notification-message"></div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        notification.querySelector('.notification-message').textContent = String(message);

        this.container.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => notification.classList.add('notification-show'), 10);
        
        // Auto-fermeture
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('notification-show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        return notification;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    loading(message) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-loading';
        
        notification.innerHTML = `
            <div class="notification-icon">
                <div class="spinner"></div>
            </div>
            <div class="notification-content">
                <div class="notification-message"></div>
            </div>
        `;
        notification.querySelector('.notification-message').textContent = String(message);

        this.container.appendChild(notification);
        setTimeout(() => notification.classList.add('notification-show'), 10);
        
        return notification;
    }

    close(notification) {
        if (notification) {
            notification.classList.remove('notification-show');
            setTimeout(() => notification.remove(), 300);
        }
    }
}

// Instance globale
window.notify = new NotificationSystem();

// CSS pour les notifications
const style = document.createElement('style');
style.textContent = `
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 400px;
}

.notification {
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateX(400px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-show {
    opacity: 1;
    transform: translateX(0);
}

.notification-success {
    border-left: 4px solid #10B981;
}

.notification-error {
    border-left: 4px solid #EF4444;
}

.notification-warning {
    border-left: 4px solid #F59E0B;
}

.notification-info {
    border-left: 4px solid #06B6D4;
}

.notification-loading {
    border-left: 4px solid #8B5CF6;
}

.notification-icon {
    font-size: 24px;
    flex-shrink: 0;
}

.notification-content {
    flex: 1;
}

.notification-message {
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
}

.notification-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
    flex-shrink: 0;
}

.notification-close:hover {
    background: var(--bg);
    color: var(--text);
}

.spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--border);
    border-top-color: #8B5CF6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
    .notification-container {
        left: 20px;
        right: 20px;
        max-width: none;
    }
}
`;
document.head.appendChild(style);

