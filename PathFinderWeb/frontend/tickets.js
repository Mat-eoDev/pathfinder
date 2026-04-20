// PathFinder - Système de Tickets et Support

let currentTicketId = null;
let currentFilter = 'all';

// ========== CHARGEMENT DES TICKETS ==========

async function loadTickets() {
    try {
        const response = await fetch(`${API_URL}/tickets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        displayTickets(data.tickets, data.is_admin);
        updateTicketCounts(data.tickets);
        
    } catch (error) {
        console.error('Erreur tickets:', error);
        document.getElementById('tickets-list').innerHTML = `
            <div class="loading">Impossible de charger les tickets</div>
        `;
    }
}

function displayTickets(tickets, showAdminInfo = false) {
    const listEl = document.getElementById('tickets-list');
    
    if (!tickets || tickets.length === 0) {
        listEl.innerHTML = '<div class="loading">Aucun ticket. Créez-en un pour démarrer ! 🎫</div>';
        return;
    }
    
    // Filtrer selon le filtre actif
    let filteredTickets = tickets;
    if (currentFilter !== 'all') {
        filteredTickets = tickets.filter(t => t.status === currentFilter);
    }
    
    if (filteredTickets.length === 0) {
        listEl.innerHTML = '<div class="loading">Aucun ticket avec ce filtre</div>';
        return;
    }
    
    listEl.innerHTML = filteredTickets.map(ticket => {
        const statusLabels = {
            'open': '🟢 Ouvert',
            'in_progress': '🔵 En cours',
            'waiting_user': '⏳ En attente',
            'resolved': '✅ Résolu',
            'closed': '⚫ Fermé'
        };
        
        const priorityLabels = {
            'low': '⬇️ Basse',
            'medium': '➡️ Moyenne',
            'high': '⬆️ Haute',
            'urgent': '🔥 Urgente'
        };
        
        const categoryLabels = {
            'support': '💬 Support',
            'bug': '🐛 Bug',
            'feature': '✨ Feature',
            'question': '❓ Question'
        };
        
        const adminInfo = showAdminInfo && ticket.username ?
            `<div style="color: var(--warning); font-size: 12px; font-weight: 600; margin-bottom: 8px;">
                👤 ${escapeHtml(ticket.username)} (${escapeHtml(ticket.email || '')})
            </div>` : '';

        const unreadCount = Number(ticket.unread_count) || 0;
        const unreadBadge = unreadCount > 0 ?
            `<span class="unread-badge">${unreadCount} non lu${unreadCount > 1 ? 's' : ''}</span>` : '';

        const messageCount = Number(ticket.message_count) || 0;
        const ticketStatus = String(ticket.status || '');
        const ticketPriority = String(ticket.priority || '');
        const ticketCategory = String(ticket.category || '');

        return `
            <div class="ticket-item" onclick="openTicketDetail(${Number(ticket.id)})">
                ${adminInfo}
                <div class="ticket-item-header">
                    <div class="ticket-item-title">
                        <h3>${escapeHtml(ticket.subject || '')}</h3>
                        <div class="ticket-item-meta">
                            <span class="ticket-id-badge">#${Number(ticket.id)}</span>
                            <span class="ticket-status-badge ${escapeHtml(ticketStatus)}">${escapeHtml(statusLabels[ticketStatus] || ticketStatus)}</span>
                            <span class="ticket-priority-badge ${escapeHtml(ticketPriority)}">${escapeHtml(priorityLabels[ticketPriority] || ticketPriority)}</span>
                            <span class="ticket-category-badge">${escapeHtml(categoryLabels[ticketCategory] || ticketCategory)}</span>
                        </div>
                    </div>
                </div>
                <div class="ticket-item-info">
                    <span>Créé le ${escapeHtml(formatDate(ticket.created_at))}</span>
                    <div class="ticket-message-count">
                        💬 ${messageCount} message${messageCount > 1 ? 's' : ''}
                        ${unreadBadge}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateTicketCounts(tickets) {
    const counts = {
        all: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length
    };
    
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-open').textContent = counts.open;
    document.getElementById('count-progress').textContent = counts.in_progress;
    document.getElementById('count-resolved').textContent = counts.resolved;
    document.getElementById('count-closed').textContent = counts.closed;
    
    // Badge dans la nav
    const totalUnread = tickets.reduce((sum, t) => sum + (t.unread_count || 0), 0);
    const badge = document.getElementById('tickets-badge');
    if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ========== CRÉATION DE TICKET ==========

async function handleCreateTicket(e) {
    e.preventDefault();
    
    const subject = document.getElementById('ticket-subject').value;
    const description = document.getElementById('ticket-description').value;
    const category = document.getElementById('ticket-category').value;
    const priority = document.getElementById('ticket-priority').value;
    
    const loadingNotif = notify.loading('Création du ticket...');
    
    try {
        const response = await fetch(`${API_URL}/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ subject, description, category, priority })
        });
        
        const data = await response.json();
        
        notify.close(loadingNotif);
        
        if (response.ok) {
            notify.success('✅ Ticket créé avec succès !');
            document.getElementById('create-ticket-modal').style.display = 'none';
            document.getElementById('create-ticket-form').reset();
            loadTickets();
        } else {
            notify.error(data.message || 'Erreur lors de la création');
        }
    } catch (error) {
        notify.close(loadingNotif);
        notify.error('Impossible de se connecter au serveur');
    }
}

// ========== DÉTAILS TICKET ET CHAT ==========

async function openTicketDetail(ticketId) {
    currentTicketId = ticketId;
    
    try {
        const response = await fetch(`${API_URL}/tickets/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Erreur de chargement');
        
        const data = await response.json();
        displayTicketDetail(data.ticket);
        
        document.getElementById('ticket-detail-modal').style.display = 'flex';
        
    } catch (error) {
        console.error('Erreur détails ticket:', error);
        notify.error('Impossible de charger le ticket');
    }
}

function displayTicketDetail(ticket) {
    const statusLabels = {
        'open': '🟢 Ouvert',
        'in_progress': '🔵 En cours',
        'waiting_user': '⏳ En attente',
        'resolved': '✅ Résolu',
        'closed': '⚫ Fermé'
    };
    
    const priorityLabels = {
        'low': '⬇️ Basse',
        'medium': '➡️ Moyenne',
        'high': '⬆️ Haute',
        'urgent': '🔥 Urgente'
    };
    
    const categoryLabels = {
        'support': '💬 Support',
        'bug': '🐛 Bug',
        'feature': '✨ Feature',
        'question': '❓ Question'
    };
    
    // Header
    document.getElementById('ticket-detail-subject').textContent = ticket.subject;
    document.getElementById('ticket-detail-id').textContent = `#${ticket.id}`;
    document.getElementById('ticket-detail-status').textContent = statusLabels[ticket.status];
    document.getElementById('ticket-detail-status').className = `ticket-status-badge ${ticket.status}`;
    document.getElementById('ticket-detail-priority').textContent = priorityLabels[ticket.priority];
    document.getElementById('ticket-detail-priority').className = `ticket-priority-badge ${ticket.priority}`;
    document.getElementById('ticket-detail-category').textContent = categoryLabels[ticket.category];
    document.getElementById('ticket-detail-date').textContent = formatDate(ticket.created_at);
    document.getElementById('ticket-detail-description').textContent = ticket.description;
    
    // Afficher les actions admin si admin
    if (isAdmin) {
        document.getElementById('ticket-actions-admin').style.display = 'flex';
        document.getElementById('ticket-status-select').value = ticket.status;
    }
    
    // Messages
    displayChatMessages(ticket.messages || []);
}

function displayChatMessages(messages) {
    const container = document.getElementById('ticket-chat-messages');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="loading">Aucun message. Envoyez le premier !</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const isAdmin = !!msg.is_admin_reply;
        const authorName = String(msg.username || 'Utilisateur');
        const initial = (authorName.charAt(0) || '?').toUpperCase();
        // Échapper le message PUIS convertir les \n en <br> pour préserver les sauts de ligne sans permettre d'HTML
        const safeMessage = escapeHtml(String(msg.message || '')).replace(/\n/g, '<br>');

        return `
            <div class="chat-message ${isAdmin ? 'admin' : ''}">
                <div class="chat-avatar">${escapeHtml(initial)}</div>
                <div class="chat-bubble">
                    <div class="chat-bubble-header">
                        <span class="chat-bubble-author">${isAdmin ? '👑 ' : ''}${escapeHtml(authorName)}</span>
                        <span class="chat-bubble-time">${escapeHtml(formatRelativeDate(msg.created_at))}</span>
                    </div>
                    <div class="chat-bubble-message">${safeMessage}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll vers le bas
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ========== ENVOI DE MESSAGE ==========

async function handleSendMessage(e) {
    e.preventDefault();
    
    const message = document.getElementById('ticket-chat-message').value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch(`${API_URL}/tickets/${currentTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) throw new Error('Erreur d\'envoi');
        
        document.getElementById('ticket-chat-message').value = '';
        
        // Recharger le ticket
        openTicketDetail(currentTicketId);
        
        notify.success('Message envoyé ✅');
        
    } catch (error) {
        console.error('Erreur envoi message:', error);
        notify.error('Impossible d\'envoyer le message');
    }
}

// ========== CHANGER STATUT (ADMIN) ==========

async function handleUpdateStatus() {
    const newStatus = document.getElementById('ticket-status-select').value;
    
    try {
        const response = await fetch(`${API_URL}/tickets/${currentTicketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) throw new Error('Erreur de mise à jour');
        
        notify.success('Statut mis à jour ✅');
        
        // Recharger
        openTicketDetail(currentTicketId);
        loadTickets();
        
    } catch (error) {
        console.error('Erreur statut:', error);
        notify.error('Impossible de mettre à jour le statut');
    }
}

// ========== FILTRES ==========

function setupTicketFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.getAttribute('data-filter');
            
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            loadTickets();
        });
    });
}

// ========== MODALS ==========

function setupTicketModals() {
    // Bouton créer ticket
    document.getElementById('create-ticket-btn').addEventListener('click', () => {
        document.getElementById('create-ticket-modal').style.display = 'flex';
    });
    
    // Fermer modaux
    document.querySelectorAll('.modal-close-ticket').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('create-ticket-modal').style.display = 'none';
        });
    });
    
    document.querySelectorAll('.modal-close-ticket-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('ticket-detail-modal').style.display = 'none';
        });
    });
    
    // Formulaire création
    document.getElementById('create-ticket-form').addEventListener('submit', handleCreateTicket);
    
    // Formulaire chat
    document.getElementById('ticket-chat-form').addEventListener('submit', handleSendMessage);
    
    // Bouton changer statut (admin)
    const updateStatusBtn = document.getElementById('update-status-btn');
    if (updateStatusBtn) {
        updateStatusBtn.addEventListener('click', handleUpdateStatus);
    }
    
    // Fermer sur clic extérieur
    document.getElementById('create-ticket-modal').addEventListener('click', (e) => {
        if (e.target.id === 'create-ticket-modal') {
            document.getElementById('create-ticket-modal').style.display = 'none';
        }
    });
    
    document.getElementById('ticket-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'ticket-detail-modal') {
            document.getElementById('ticket-detail-modal').style.display = 'none';
        }
    });
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    setupTicketModals();
    setupTicketFilters();
});

