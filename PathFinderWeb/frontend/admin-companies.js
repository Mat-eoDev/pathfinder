/**
 * admin-companies.js
 *
 * Panneau admin intégré au dashboard : CRUD entreprises + demandes de devis.
 * Visible uniquement pour les super admins (role=admin).
 */

(function () {
    'use strict';

    const BASE = (typeof API_URL !== 'undefined')
        ? API_URL
        : 'http://localhost:5001/api';

    function getToken() {
        return localStorage.getItem('authToken')
            || localStorage.getItem('token')
            || sessionStorage.getItem('token');
    }

    function authHeaders() {
        const h = { 'Content-Type': 'application/json' };
        const t = getToken();
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmtDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch (_) { return iso; }
    }

    function toast(msg, type) {
        if (window.showToast) return window.showToast(msg, type);
        if (type === 'error') console.error(msg); else console.log(msg);
    }

    // ---------------------------------------------------------------
    // Chargement
    // ---------------------------------------------------------------

    async function loadAll() {
        await Promise.all([loadCompanies(), loadQuoteRequests()]);
    }

    async function loadCompanies() {
        const el = document.getElementById('admin-companies-list');
        if (!el) return;
        try {
            const r = await fetch(`${BASE}/admin/companies`, { headers: authHeaders() });
            if (!r.ok) {
                const b = await r.json().catch(() => ({}));
                el.innerHTML = `<p class="subscription-empty">⚠️ ${esc(b.message || 'Erreur')}</p>`;
                return;
            }
            const data = await r.json();
            renderCompanies(data.companies || []);
        } catch (e) {
            el.innerHTML = `<p class="subscription-empty">⚠️ ${esc(e.message)}</p>`;
        }
    }

    function renderCompanies(companies) {
        const el = document.getElementById('admin-companies-list');
        if (!el) return;
        if (!companies.length) {
            el.innerHTML = '<p class="subscription-empty">Aucune entreprise pour l\'instant.</p>';
            return;
        }
        el.innerHTML = companies.map(c => {
            const over = (c.seats_used || 0) > (c.license_count || 0);
            return `<div class="admin-company-card" data-company-id="${c.id}">
                <div>
                    <strong>${esc(c.name)}</strong>
                    <div class="admin-company-meta">
                        <span>👑 ${esc(c.owner_email)}</span>
                        <span>💺 ${c.seats_used || 0} / ${c.license_count || 0} licences${over ? ' ⚠️' : ''}</span>
                        <span>📅 créée le ${fmtDate(c.created_at)}</span>
                    </div>
                    ${c.notes ? `<div class="admin-company-meta"><em>${esc(c.notes)}</em></div>` : ''}
                </div>
                <div class="admin-company-actions">
                    <button class="btn btn-secondary btn-sm" data-action="edit-licenses" data-company-id="${c.id}" data-current="${c.license_count}">✏️ Licences</button>
                    <button class="btn btn-secondary btn-sm" data-action="delete" data-company-id="${c.id}" data-name="${esc(c.name)}">🗑️ Supprimer</button>
                </div>
            </div>`;
        }).join('');

        el.querySelectorAll('[data-action="edit-licenses"]').forEach(btn => {
            btn.addEventListener('click', () => onEditLicenses(btn.dataset.companyId, btn.dataset.current));
        });
        el.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => onDelete(btn.dataset.companyId, btn.dataset.name));
        });
    }

    async function onEditLicenses(id, current) {
        const next = prompt(`Nombre de licences pour cette entreprise (actuellement ${current}) :`, current);
        if (next == null) return;
        const n = parseInt(next, 10);
        if (isNaN(n) || n < 1 || n > 10000) {
            toast('Valeur invalide (1-10000).', 'error');
            return;
        }
        const r = await fetch(`${BASE}/admin/companies/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ license_count: n }),
        });
        const b = await r.json().catch(() => ({}));
        if (r.ok) {
            toast(b.over_quota
                ? `⚠️ ${b.seats_used} membres déjà présents, au-dessus de ${b.license_count} licences.`
                : 'Licences mises à jour.', b.over_quota ? 'error' : 'success');
            await loadCompanies();
        } else {
            toast(b.message || 'Erreur.', 'error');
        }
    }

    async function onDelete(id, name) {
        if (!confirm(`Supprimer l'entreprise "${name}" ? Tous ses membres repasseront en Free.`)) return;
        const r = await fetch(`${BASE}/admin/companies/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        const b = await r.json().catch(() => ({}));
        if (r.ok) {
            toast('Entreprise supprimée.', 'success');
            await loadCompanies();
        } else {
            toast(b.message || 'Erreur.', 'error');
        }
    }

    async function onCreateSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('ac-name').value.trim();
        const owner_email = document.getElementById('ac-owner').value.trim();
        const license_count = parseInt(document.getElementById('ac-licenses').value, 10) || 0;
        const notes = document.getElementById('ac-notes').value.trim();
        const errEl = document.getElementById('ac-error');
        errEl.style.display = 'none';

        if (!name || !owner_email || license_count < 1) {
            errEl.textContent = 'Tous les champs sont requis (licences ≥ 1).';
            errEl.style.display = 'block';
            return;
        }
        const r = await fetch(`${BASE}/admin/companies`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name, owner_email, license_count, notes }),
        });
        const b = await r.json().catch(() => ({}));
        if (r.ok) {
            toast(`✅ Entreprise "${name}" créée. Chef : ${owner_email}.`, 'success');
            document.getElementById('admin-company-create').reset();
            document.getElementById('ac-licenses').value = '5';
            await loadCompanies();
        } else {
            errEl.textContent = b.message || 'Erreur lors de la création.';
            errEl.style.display = 'block';
        }
    }

    // ---------------------------------------------------------------
    // Demandes de devis
    // ---------------------------------------------------------------

    async function loadQuoteRequests() {
        const el = document.getElementById('admin-quote-requests');
        if (!el) return;
        try {
            const r = await fetch(`${BASE}/admin/quote-requests`, { headers: authHeaders() });
            if (!r.ok) {
                el.innerHTML = '<p class="subscription-empty">Impossible de charger les demandes.</p>';
                return;
            }
            const data = await r.json();
            renderQuoteRequests(data.quote_requests || []);
        } catch (e) {
            el.innerHTML = `<p class="subscription-empty">⚠️ ${esc(e.message)}</p>`;
        }
    }

    function renderQuoteRequests(list) {
        const el = document.getElementById('admin-quote-requests');
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<p class="subscription-empty">Aucune demande pour l\'instant.</p>';
            return;
        }
        el.innerHTML = list.map(q => {
            const statusLabel = {
                new: '🟢 Nouvelle',
                contacted: '🟡 Contactée',
                closed: '⚫ Clôturée',
            }[q.status] || q.status;
            return `<div class="admin-company-card" data-req-id="${q.id}">
                <div>
                    <strong>${esc(q.contact_name || q.email)}</strong>
                    <span style="margin-left:8px">${statusLabel}</span>
                    <div class="admin-company-meta">
                        <span>✉️ ${esc(q.email)}</span>
                        ${q.phone ? `<span>📞 ${esc(q.phone)}</span>` : ''}
                        ${q.company_name ? `<span>🏢 ${esc(q.company_name)}</span>` : ''}
                        ${q.seats_requested ? `<span>💺 ${q.seats_requested} licences</span>` : ''}
                        <span>📅 ${fmtDate(q.created_at)}</span>
                    </div>
                    ${q.message ? `<div class="admin-company-meta"><em>${esc(q.message)}</em></div>` : ''}
                </div>
                <div class="admin-company-actions">
                    ${q.status !== 'contacted' ? `<button class="btn btn-secondary btn-sm" data-qaction="contacted" data-req-id="${q.id}">🟡 Contacté</button>` : ''}
                    ${q.status !== 'closed' ? `<button class="btn btn-secondary btn-sm" data-qaction="closed" data-req-id="${q.id}">⚫ Clôturer</button>` : ''}
                </div>
            </div>`;
        }).join('');

        el.querySelectorAll('[data-qaction]').forEach(btn => {
            btn.addEventListener('click', () => updateQuoteStatus(btn.dataset.reqId, btn.dataset.qaction));
        });
    }

    async function updateQuoteStatus(id, status) {
        const r = await fetch(`${BASE}/admin/quote-requests/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status }),
        });
        if (r.ok) {
            toast('Statut mis à jour.', 'success');
            loadQuoteRequests();
        } else {
            toast('Erreur.', 'error');
        }
    }

    // ---------------------------------------------------------------
    // Nav
    // ---------------------------------------------------------------

    function applyAdminNav() {
        const link = document.querySelector('[data-page="admin-companies"]');
        if (!link) return;
        try {
            const u = JSON.parse(localStorage.getItem('userData') || '{}');
            link.style.display = u.role === 'admin' ? '' : 'none';
        } catch (_) {
            link.style.display = 'none';
        }
    }

    function renderAdminCompaniesView() {
        loadAll();
    }

    window.AdminCompaniesUI = {
        renderAdminCompaniesView,
        applyAdminNav,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('admin-company-create');
        if (form) form.addEventListener('submit', onCreateSubmit);
        applyAdminNav();
    });
})();
