// PathFinder - Système de Tooltips

class TooltipSystem {
    constructor() {
        this.tooltip = null;
        this.init();
    }

    init() {
        // Créer l'élément tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        document.body.appendChild(this.tooltip);

        // Ajouter les event listeners pour tous les éléments avec data-tooltip
        this.attachTooltips();
    }

    attachTooltips() {
        document.addEventListener('mouseover', (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.show(element);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.hide();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.tooltip.classList.contains('tooltip-visible')) {
                this.position(e);
            }
        });
    }

    show(element) {
        const text = element.getAttribute('data-tooltip');
        const position = element.getAttribute('data-tooltip-position') || 'top';
        
        this.tooltip.textContent = text;
        this.tooltip.className = `tooltip tooltip-${position} tooltip-visible`;
    }

    hide() {
        this.tooltip.classList.remove('tooltip-visible');
    }

    position(e) {
        const offset = 15;
        this.tooltip.style.left = e.pageX + offset + 'px';
        this.tooltip.style.top = e.pageY + offset + 'px';
    }
}

// Instance globale
window.tooltips = new TooltipSystem();

// CSS pour les tooltips
const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `
.tooltip {
    position: absolute;
    background: var(--bg);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    pointer-events: none;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.2s;
    max-width: 250px;
    border: 1px solid var(--border);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    line-height: 1.4;
}

.tooltip-visible {
    opacity: 1;
}

.tooltip::before {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border: 6px solid transparent;
}

.tooltip-top::before {
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: var(--bg);
}

.tooltip-bottom::before {
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: var(--bg);
}

.tooltip-left::before {
    right: -12px;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: var(--bg);
}

.tooltip-right::before {
    left: -12px;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: var(--bg);
}
`;
document.head.appendChild(tooltipStyle);

