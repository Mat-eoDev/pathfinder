/**
 * subscription.js
 *
 * Gère la pricing page publique, la page "Mon abonnement" du dashboard,
 * la modal de checkout CB factice, la liste de factures et le badge de tier.
 *
 * Source de vérité : backend (/api/subscription/*). Les limites affichées côté
 * UI viennent toujours de /api/subscription/plans ou /api/subscription/me.
 */

(function () {
    'use strict';

    const BASE = (typeof API_URL !== 'undefined')
        ? API_URL
        : 'http://localhost:5001/api';

    const state = {
        plans: null,       // Array<Plan>
        me: null,          // état abonnement courant
    };

    // Cartes de test (inspiration Stripe) — juste pour hint utilisateur
    const TEST_CARDS = {
        ok: '4242 4242 4242 4242',
        refused: '4000 0000 0000 0002',
    };

    // ---------------------------------------------------------------
    // Utils
    // ---------------------------------------------------------------

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

    function fmtEUR(cents) {
        return (cents / 100).toLocaleString('fr-FR', {
            style: 'currency', currency: 'EUR'
        });
    }

    function fmtDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch (_) { return iso; }
    }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---------------------------------------------------------------
    // API
    // ---------------------------------------------------------------

    async function fetchPlans() {
        const r = await fetch(`${BASE}/subscription/plans`);
        if (!r.ok) throw new Error('Plans indisponibles');
        const data = await r.json();
        state.plans = data.plans || [];
        return state.plans;
    }

    async function fetchMe() {
        const t = getToken();
        if (!t) return null;
        const r = await fetch(`${BASE}/subscription/me`, { headers: authHeaders() });
        if (!r.ok) return null;
        state.me = await r.json();
        return state.me;
    }

    async function fetchInvoices() {
        const r = await fetch(`${BASE}/subscription/invoices`, { headers: authHeaders() });
        if (!r.ok) return [];
        const data = await r.json();
        return data.invoices || [];
    }

    async function apiCheckout(tier, card) {
        const r = await fetch(`${BASE}/subscription/checkout`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ tier, card }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
    }

    async function apiCancel() {
        const r = await fetch(`${BASE}/subscription/cancel`, {
            method: 'POST', headers: authHeaders()
        });
        return r.ok;
    }

    // ---------------------------------------------------------------
    // Rendering : carte plan
    // ---------------------------------------------------------------

    function renderPlanCard(plan, opts) {
        const currentTier = opts.currentTier;
        const featured = plan.tier === 'pro';
        const isCurrent = plan.tier === currentTier;
        const quoteOnly = !!plan.quote_only;

        let priceLine;
        if (quoteOnly) {
            priceLine = '<span class="price-amount">Sur devis</span>';
        } else if (plan.price_cents === 0) {
            priceLine = '<span class="price-amount">0€</span><span class="price-period">/mois</span>';
        } else {
            priceLine = `<span class="price-amount">${plan.price_eur.toFixed(0)}€</span><span class="price-period">/mois</span>`;
        }

        const featuresHtml = (plan.features || [])
            .map(f => `<li>✅ ${esc(f)}</li>`).join('');

        let cta;
        if (quoteOnly) {
            // Enterprise : pas de checkout self-service, même pour les connectés.
            cta = isCurrent
                ? `<button class="btn btn-secondary btn-pricing" disabled>Plan actuel</button>`
                : `<button class="btn btn-primary btn-pricing" data-action="request-quote" data-tier="${plan.tier}">✉️ Contacter les ventes</button>`;
        } else if (!getToken()) {
            cta = `<button class="btn btn-primary btn-pricing" data-action="login-to-subscribe">Se connecter</button>`;
        } else if (isCurrent) {
            cta = `<button class="btn btn-secondary btn-pricing" disabled>Plan actuel</button>`;
        } else if (plan.tier === 'free') {
            cta = `<button class="btn btn-secondary btn-pricing" data-action="downgrade">Rétrograder</button>`;
        } else {
            const verb = tierRank(plan.tier) > tierRank(currentTier) ? 'Passer' : 'Choisir';
            cta = `<button class="btn btn-primary btn-pricing" data-action="subscribe" data-tier="${plan.tier}">${verb} au plan ${esc(plan.name)}</button>`;
        }

        const badge = featured
            ? '<div class="pricing-badge">⭐ POPULAIRE</div>' : '';
        const quoteBadge = quoteOnly
            ? '<div class="pricing-badge pricing-badge-quote">🏢 ENTREPRISE</div>' : '';
        const current = isCurrent
            ? '<div class="pricing-badge pricing-badge-current">✓ ACTUEL</div>' : '';

        return `
        <div class="pricing-card ${featured ? 'pricing-card-featured' : ''} ${isCurrent ? 'pricing-card-current' : ''} ${quoteOnly ? 'pricing-card-quote' : ''}" data-tier="${plan.tier}">
            ${current || quoteBadge || badge}
            <div class="pricing-header">
                <h3>${esc(plan.name)}</h3>
                <div class="pricing-price">${priceLine}</div>
                <p class="pricing-tagline">${esc(plan.tagline || '')}</p>
            </div>
            <ul class="pricing-features">${featuresHtml}</ul>
            ${cta}
        </div>`;
    }

    function tierRank(t) { return { free: 0, pro: 1, enterprise: 2 }[t] ?? 0; }

    // ---------------------------------------------------------------
    // Rendering : landing grid
    // ---------------------------------------------------------------

    async function renderLandingPricing() {
        const grid = document.getElementById('landing-pricing-grid');
        if (!grid) return;
        try {
            const plans = state.plans || await fetchPlans();
            const current = state.me?.tier || null;
            grid.innerHTML = plans.map(p => renderPlanCard(p, { currentTier: current })).join('');
            wirePricingGrid(grid, { inDashboard: false });
        } catch (e) {
            grid.innerHTML = `<div class="pricing-card pricing-card-skeleton">⚠️ ${esc(e.message)}</div>`;
        }
    }

    // ---------------------------------------------------------------
    // Rendering : dashboard "Mon abonnement"
    // ---------------------------------------------------------------

    async function renderSubscriptionView() {
        await Promise.all([fetchPlans(), fetchMe()]);
        renderCurrentCard();
        renderDashboardPricing();
        renderInvoices();
    }

    function renderCurrentCard() {
        const el = document.getElementById('subscription-current-card');
        if (!el || !state.me) return;

        const me = state.me;
        const plan = me.plan;
        const quotaLine = me.usage.scans_limit == null
            ? `<strong>${me.usage.scans_last_30d}</strong> scans sur les 30 derniers jours (illimité)`
            : `<strong>${me.usage.scans_last_30d} / ${me.usage.scans_limit}</strong> scans utilisés ce mois-ci`;

        const endsLine = me.ends_at
            ? (me.auto_renew
                ? `Renouvelé automatiquement le ${fmtDate(me.ends_at)}`
                : `Se termine le ${fmtDate(me.ends_at)} (renouvellement désactivé)`)
            : 'Plan gratuit, sans échéance';

        el.innerHTML = `
          <div class="subscription-current-plan tier-${me.tier}">
            <div class="subscription-current-left">
              <div class="subscription-current-tier">
                <span class="tier-badge tier-${me.tier}">${esc(plan.name)}</span>
                <h3>${esc(plan.tagline || '')}</h3>
              </div>
              <p class="subscription-current-quota">${quotaLine}</p>
              <p class="subscription-current-ends">${esc(endsLine)}</p>
            </div>
            <div class="subscription-current-right">
              ${plan.price_cents > 0 ? `<div class="subscription-price">${fmtEUR(plan.price_cents)}<span>/mois</span></div>` : ''}
              ${me.tier !== 'free' && me.auto_renew
                ? '<button class="btn btn-secondary" data-action="cancel-sub">Annuler le renouvellement</button>'
                : ''}
            </div>
          </div>
        `;

        const btn = el.querySelector('[data-action="cancel-sub"]');
        if (btn) btn.addEventListener('click', onCancelClick);
    }

    function renderDashboardPricing() {
        const grid = document.getElementById('dashboard-pricing-grid');
        if (!grid || !state.plans) return;
        const current = state.me?.tier || 'free';
        grid.innerHTML = state.plans
            .map(p => renderPlanCard(p, { currentTier: current })).join('');
        wirePricingGrid(grid, { inDashboard: true });
    }

    async function renderInvoices() {
        const el = document.getElementById('subscription-invoices');
        if (!el) return;
        const invoices = await fetchInvoices();
        if (invoices.length === 0) {
            el.innerHTML = '<p class="subscription-empty">Aucune facture pour le moment.</p>';
            return;
        }
        const rows = invoices.map(i => {
            const statusLabel = {
                paid: '<span class="invoice-status invoice-paid">✅ Payée</span>',
                refused: '<span class="invoice-status invoice-refused">❌ Refusée</span>',
                refunded: '<span class="invoice-status invoice-refunded">↩️ Remboursée</span>',
            }[i.status] || i.status;
            return `<tr>
              <td><code>${esc(i.invoice_number)}</code></td>
              <td>${esc(i.tier)}</td>
              <td>${fmtDate(i.issued_at)}</td>
              <td>${fmtEUR(i.amount_cents)}</td>
              <td>${esc(i.payment_method)}</td>
              <td>${statusLabel}</td>
            </tr>`;
        }).join('');
        el.innerHTML = `<table class="invoices-table">
            <thead><tr><th>N°</th><th>Plan</th><th>Date</th><th>Montant</th><th>Paiement</th><th>Statut</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
    }

    // ---------------------------------------------------------------
    // Wiring CTA
    // ---------------------------------------------------------------

    function wirePricingGrid(root, ctx) {
        root.querySelectorAll('[data-action="subscribe"]').forEach(btn => {
            btn.addEventListener('click', () => openCheckout(btn.dataset.tier));
        });
        root.querySelectorAll('[data-action="request-quote"]').forEach(btn => {
            btn.addEventListener('click', () => openQuoteModal());
        });
        root.querySelectorAll('[data-action="login-to-subscribe"]').forEach(btn => {
            btn.addEventListener('click', () => {
                // Ouvre la landing login si présente
                const loginBtn = document.getElementById('nav-login-btn');
                if (loginBtn) loginBtn.click();
            });
        });
        root.querySelectorAll('[data-action="downgrade"]').forEach(btn => {
            btn.addEventListener('click', onCancelClick);
        });
    }

    async function onCancelClick() {
        if (!confirm('Annuler le renouvellement ? Vous garderez votre plan jusqu\'à la fin de la période en cours.')) return;
        const ok = await apiCancel();
        if (ok) {
            toast('Renouvellement annulé.', 'success');
            await renderSubscriptionView();
            refreshTierBadge();
        } else {
            toast('Échec de l\'annulation.', 'error');
        }
    }

    // ---------------------------------------------------------------
    // Modal checkout
    // ---------------------------------------------------------------

    function openCheckout(tier) {
        const plan = (state.plans || []).find(p => p.tier === tier);
        if (!plan) { toast('Plan introuvable.', 'error'); return; }
        if (plan.quote_only) { openQuoteModal(); return; }
        const modal = document.getElementById('checkout-modal');
        document.getElementById('checkout-title').textContent = `Passer au plan ${plan.name}`;
        const amountLabel = fmtEUR(plan.price_cents);
        document.getElementById('checkout-amount-label').textContent = amountLabel;
        document.getElementById('checkout-submit-amount').textContent = amountLabel;
        document.getElementById('checkout-form').dataset.tier = tier;
        document.getElementById('checkout-error').style.display = 'none';
        modal.style.display = 'flex';
    }

    function closeCheckout() {
        document.getElementById('checkout-modal').style.display = 'none';
    }

    // ---------------------------------------------------------------
    // Modal "Contacter les ventes" (devis Enterprise)
    // ---------------------------------------------------------------

    function openQuoteModal() {
        const modal = document.getElementById('quote-modal');
        if (!modal) {
            toast('Formulaire de devis indisponible.', 'error');
            return;
        }
        const err = document.getElementById('quote-error');
        const ok = document.getElementById('quote-success');
        if (err) { err.style.display = 'none'; err.textContent = ''; }
        if (ok) { ok.style.display = 'none'; ok.textContent = ''; }

        // Pré-remplissage si user connecté
        const form = document.getElementById('quote-form');
        if (form) form.reset();
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.email) {
                const e = document.getElementById('quote-email');
                if (e && !e.value) e.value = userData.email;
            }
            if (userData.username) {
                const n = document.getElementById('quote-name');
                if (n && !n.value) n.value = userData.username;
            }
        } catch (_) { /* ignore */ }

        modal.style.display = 'flex';
    }

    function closeQuoteModal() {
        const modal = document.getElementById('quote-modal');
        if (modal) modal.style.display = 'none';
    }

    async function onQuoteSubmit(e) {
        e.preventDefault();
        const email = (document.getElementById('quote-email').value || '').trim();
        const name = (document.getElementById('quote-name').value || '').trim();
        const company = (document.getElementById('quote-company').value || '').trim();
        const phone = (document.getElementById('quote-phone').value || '').trim();
        const seats = document.getElementById('quote-seats').value;
        const message = (document.getElementById('quote-message').value || '').trim();
        const errEl = document.getElementById('quote-error');
        const okEl = document.getElementById('quote-success');
        errEl.style.display = 'none';
        okEl.style.display = 'none';

        if (!email || !email.includes('@')) {
            errEl.textContent = 'Email valide requis.';
            errEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('quote-submit');
        btn.disabled = true;
        const oldLabel = btn.innerHTML;
        btn.innerHTML = '⏳ Envoi…';
        try {
            const r = await fetch(`${BASE}/subscription/quote-request`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    email, contact_name: name, company_name: company,
                    phone, seats_requested: seats || null, message,
                }),
            });
            const body = await r.json().catch(() => ({}));
            if (r.ok) {
                okEl.textContent = body.message
                    || 'Merci ! Notre équipe vous recontacte sous 2 jours ouvrés.';
                okEl.style.display = 'block';
                document.getElementById('quote-form').reset();
                setTimeout(closeQuoteModal, 2500);
            } else {
                errEl.textContent = body.message || 'Erreur lors de l\'envoi.';
                errEl.style.display = 'block';
            }
        } catch (err) {
            errEl.textContent = 'Erreur réseau : ' + err.message;
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldLabel;
        }
    }

    function parseExpiry(s) {
        const m = (s || '').match(/^\s*(\d{1,2})\s*\/\s*(\d{2,4})\s*$/);
        if (!m) return null;
        const mm = parseInt(m[1], 10);
        let yy = parseInt(m[2], 10);
        return { month: mm, year: yy };
    }

    async function onCheckoutSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const tier = form.dataset.tier;
        const holder = document.getElementById('checkout-holder').value.trim();
        const number = document.getElementById('checkout-number').value;
        const cvv = document.getElementById('checkout-cvv').value.trim();
        const exp = parseExpiry(document.getElementById('checkout-expiry').value);
        const err = document.getElementById('checkout-error');
        err.style.display = 'none';

        if (!exp) {
            err.textContent = 'Format date invalide (MM/AA).';
            err.style.display = 'block';
            return;
        }

        const btn = document.getElementById('checkout-submit');
        btn.disabled = true;
        const oldLabel = btn.innerHTML;
        btn.innerHTML = '⏳ Traitement…';

        try {
            const res = await apiCheckout(tier, {
                holder,
                number,
                exp_month: exp.month,
                exp_year: exp.year,
                cvv,
            });
            if (res.ok && res.body.status === 'paid') {
                toast(`✅ Paiement accepté — vous êtes maintenant sur le plan ${tier}.`, 'success');
                closeCheckout();
                await renderSubscriptionView();
                refreshTierBadge();
            } else {
                err.textContent = res.body.message || 'Paiement refusé.';
                err.style.display = 'block';
            }
        } catch (e) {
            err.textContent = 'Erreur réseau : ' + e.message;
            err.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldLabel;
        }
    }

    // ---------------------------------------------------------------
    // Badge de tier dans la navbar
    // ---------------------------------------------------------------

    async function refreshTierBadge() {
        const el = document.getElementById('user-tier-badge');
        if (!el) return;
        if (!getToken()) { el.style.display = 'none'; return; }
        const me = state.me || await fetchMe();
        if (!me) { el.style.display = 'none'; return; }
        el.className = 'tier-badge tier-' + me.tier;
        el.textContent = me.plan.name;
        el.style.display = 'inline-block';
    }

    // ---------------------------------------------------------------
    // Helpers UI
    // ---------------------------------------------------------------

    function toast(msg, type) {
        if (window.showToast) return window.showToast(msg, type);
        (type === 'error' ? console.error : console.log)(msg);
        alert(msg);
    }

    // ---------------------------------------------------------------
    // Exports globaux (utilisés par app.js pour le routing des pages)
    // ---------------------------------------------------------------

    window.SubscriptionUI = {
        renderLandingPricing,
        renderSubscriptionView,
        refreshTierBadge,
        openCheckout,
        openQuoteModal,
    };

    // ---------------------------------------------------------------
    // Initialisation
    // ---------------------------------------------------------------

    document.addEventListener('DOMContentLoaded', () => {
        // Formate auto le numéro de carte : espace tous les 4 chiffres
        const numInput = document.getElementById('checkout-number');
        if (numInput) {
            numInput.addEventListener('input', () => {
                const digits = numInput.value.replace(/\D/g, '').slice(0, 19);
                numInput.value = digits.replace(/(\d{4})/g, '$1 ').trim();
            });
        }
        const expInput = document.getElementById('checkout-expiry');
        if (expInput) {
            expInput.addEventListener('input', () => {
                let v = expInput.value.replace(/\D/g, '').slice(0, 4);
                if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
                expInput.value = v;
            });
        }

        const form = document.getElementById('checkout-form');
        if (form) form.addEventListener('submit', onCheckoutSubmit);

        const closeBtn = document.getElementById('checkout-close');
        if (closeBtn) closeBtn.addEventListener('click', closeCheckout);

        const overlay = document.querySelector('.checkout-modal-overlay');
        if (overlay) overlay.addEventListener('click', closeCheckout);

        // Modal devis Enterprise
        const quoteForm = document.getElementById('quote-form');
        if (quoteForm) quoteForm.addEventListener('submit', onQuoteSubmit);
        const quoteClose = document.getElementById('quote-close');
        if (quoteClose) quoteClose.addEventListener('click', closeQuoteModal);
        const quoteOverlay = document.querySelector('.quote-modal-overlay');
        if (quoteOverlay) quoteOverlay.addEventListener('click', closeQuoteModal);

        // Landing : charge les plans dès le départ
        renderLandingPricing();

        // Si déjà loggé : affiche le badge de tier
        if (getToken()) refreshTierBadge();
    });
})();
