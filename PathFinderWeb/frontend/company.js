/**
 * company.js
 *
 * Page "Mon entreprise" du dashboard : visible uniquement pour les chefs
 * d'entreprise (role=company_admin). Permet de voir l'état des licences,
 * d'ajouter un membre par email et de révoquer une licence.
 */

(function () {
    'use strict';

    const BASE = (typeof API_URL !== 'undefined')
        ? API_URL
        : 'http://localhost:5001/api';

    const state = { company: null, members: [], summary: null };

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
        console.log(msg);
    }

    async function fetchMine() {
        const r = await fetch(`${BASE}/company/me`, { headers: authHeaders() });
        if (r.status === 403) return { forbidden: true };
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.message || 'Erreur chargement entreprise');
        }
        return r.json();
    }

    async function addMember(email) {
        const r = await fetch(`${BASE}/company/members`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ email }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
    }

    async function removeMember(userId) {
        const r = await fetch(`${BASE}/company/members/${userId}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
    }

    // ---------------------------------------------------------------
    // Rendu
    // ---------------------------------------------------------------

    function renderSummary() {
        const el = document.getElementById('company-summary');
        if (!el) return;
        if (!state.company) {
            el.innerHTML = '<div class="subscription-current-loading">Chargement…</div>';
            return;
        }
        const c = state.company;
        const used = state.summary?.seats_used ?? 0;
        const total = c.license_count || 0;
        const avail = state.summary?.seats_available ?? Math.max(total - used, 0);
        const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
        const over = used > total;

        el.innerHTML = `
          <div class="subscription-current-plan tier-enterprise">
            <div class="subscription-current-left">
              <div class="subscription-current-tier">
                <span class="tier-badge tier-enterprise">Enterprise</span>
                <h3>${esc(c.name)}</h3>
              </div>
              <p class="subscription-current-quota">
                <strong>${used} / ${total}</strong> licences utilisées
                ${over ? '<span class="company-warning"> — ⚠️ dépassement, contactez l\'administrateur</span>' : ''}
              </p>
              <div class="company-seats-bar">
                <div class="company-seats-bar-fill${over ? ' over' : ''}" style="width:${pct}%"></div>
              </div>
              <p class="subscription-current-ends">
                ${avail} licence${avail > 1 ? 's' : ''} disponible${avail > 1 ? 's' : ''}
              </p>
            </div>
            <div class="subscription-current-right">
              <div class="subscription-price">${total}<span> licences</span></div>
            </div>
          </div>`;
    }

    function renderMembers() {
        const el = document.getElementById('company-members');
        if (!el) return;
        if (!state.members || state.members.length === 0) {
            el.innerHTML = '<p class="subscription-empty">Aucun membre pour l\'instant.</p>';
            return;
        }
        const rows = state.members.map(m => {
            const isOwner = !!m.is_owner;
            const action = isOwner
                ? '<span class="company-owner-tag">👑 Chef d\'entreprise</span>'
                : `<button class="btn btn-secondary btn-sm" data-action="remove" data-user-id="${m.id}">Retirer la licence</button>`;
            return `<tr>
              <td>${esc(m.username || '—')}</td>
              <td><code>${esc(m.email)}</code></td>
              <td>${fmtDate(m.created_at)}</td>
              <td>${m.last_login ? fmtDate(m.last_login) : '—'}</td>
              <td>${action}</td>
            </tr>`;
        }).join('');
        el.innerHTML = `<table class="invoices-table">
            <thead><tr>
              <th>Nom</th><th>Email</th><th>Inscrit le</th><th>Dernière connexion</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
        el.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', () => onRemoveClick(btn.dataset.userId));
        });
    }

    async function onRemoveClick(userId) {
        const m = state.members.find(x => String(x.id) === String(userId));
        const who = m ? (m.email || 'ce membre') : 'ce membre';
        if (!confirm(`Retirer la licence à ${who} ? Son compte repassera en Free.`)) return;
        const res = await removeMember(userId);
        if (res.ok) {
            toast('Licence retirée.', 'success');
            await reload();
        } else {
            toast(res.body.message || 'Échec du retrait.', 'error');
        }
    }

    async function onAddSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('company-add-email');
        const errEl = document.getElementById('company-add-error');
        errEl.style.display = 'none';
        const email = (input.value || '').trim();
        if (!email || !email.includes('@')) {
            errEl.textContent = 'Email valide requis.';
            errEl.style.display = 'block';
            return;
        }
        const res = await addMember(email);
        if (res.ok) {
            toast(`✅ Licence attribuée à ${email}`, 'success');
            input.value = '';
            await reload();
        } else {
            errEl.textContent = res.body.message || 'Erreur lors de l\'attribution.';
            errEl.style.display = 'block';
        }
    }

    // ---------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------

    async function reload() {
        try {
            const data = await fetchMine();
            if (data.forbidden) {
                const el = document.getElementById('company-container');
                if (el) {
                    el.innerHTML = `<div class="subscription-header">
                        <h2>🏢 Mon entreprise</h2>
                        <p class="subscription-subtitle">
                          Vous n'êtes pas chef d'entreprise. Contactez l'administrateur PathFinder
                          pour être désigné comme chef d'entreprise.
                        </p>
                      </div>`;
                }
                return;
            }
            state.company = data.company;
            state.members = data.members || [];
            state.summary = { seats_used: data.seats_used, seats_available: data.seats_available };
            renderSummary();
            renderMembers();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function renderCompanyView() {
        reload();
    }

    // Affiche le lien nav uniquement pour les chefs d'entreprise.
    function applyCompanyNav() {
        const link = document.querySelector('[data-page="company"]');
        if (!link) return;
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const isCompanyAdmin = (userData.role === 'company_admin');
            link.style.display = isCompanyAdmin ? '' : 'none';
        } catch (_) {
            link.style.display = 'none';
        }
    }

    window.CompanyUI = {
        renderCompanyView,
        applyCompanyNav,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('company-add-form');
        if (form) form.addEventListener('submit', onAddSubmit);
        applyCompanyNav();
    });
})();
