// ----- i18n (EN / FR) -----
// Stores choice in localStorage; falls back to browser language on first visit.
(function initI18n() {
    const SUPPORTED = ['en', 'fr'];
    const STORAGE_KEY = 'lang-v1';

    const stored = localStorage.getItem(STORAGE_KEY);
    const browser = (navigator.language || 'en').slice(0, 2);
    const initial = SUPPORTED.includes(stored) ? stored
                  : SUPPORTED.includes(browser) ? browser
                  : 'en';

    const dictCache = window.__i18nCache = window.__i18nCache || {};

    const applyDict = (dict) => {
        // textContent — most cases
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.dataset.i18n;
            if (dict[key] !== undefined) el.textContent = dict[key];
        });
        // placeholder attribute (for inputs / textareas)
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.dataset.i18nPlaceholder;
            if (dict[key] !== undefined) el.placeholder = dict[key];
        });
        // Re-sync Read More buttons to the new locale based on expanded state
        document.querySelectorAll('.read-more-btn').forEach((btn) => {
            const expanded = btn.closest('.feature-box')?.classList.contains('expanded');
            const key = expanded ? 'readless' : 'readmore';
            if (dict[key] !== undefined) btn.textContent = dict[key];
        });
    };

    const loadLang = async (lang) => {
        if (dictCache[lang]) return dictCache[lang];
        try {
            const res = await fetch(`./lang/${lang}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const dict = await res.json();
            dictCache[lang] = dict;
            return dict;
        } catch (err) {
            console.warn(`i18n: failed to load ${lang}`, err);
            return null;
        }
    };

    const setLang = async (lang) => {
        if (!SUPPORTED.includes(lang)) lang = 'en';
        const dict = await loadLang(lang);
        if (!dict) return;

        const update = () => {
            applyDict(dict);
            document.documentElement.lang = lang;
            localStorage.setItem(STORAGE_KEY, lang);
            document.querySelectorAll('.lang-btn').forEach((btn) =>
                btn.classList.toggle('is-active', btn.dataset.lang === lang)
            );
        };

        // Use View Transitions API where available — smooth cross-fade
        if (document.startViewTransition) {
            document.startViewTransition(update);
        } else {
            update();
        }
    };

    document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });

    // Initial paint
    setLang(initial);
})();

// ----- PWA: register service worker (production only) -----
// On localhost we actively UNREGISTER any leftover SW + clear caches, so
// development never serves stale assets. On real domains we register normally.
const __isLocalDev = ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(location.hostname);

if ('serviceWorker' in navigator) {
    if (__isLocalDev) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((reg) => reg.unregister());
        });
        if ('caches' in window) {
            caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
        }
    } else {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
        // When a new SW takes control, reload once so fresh assets are used
        let __refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (__refreshing) return;
            __refreshing = true;
            window.location.reload();
        });
    }
}

// ----- Live Harvest status banner -----
// Fetches { status: 'in-season' | 'limited' | 'off', label, detail } from the
// Worker (set window.HARVEST_ENDPOINT to enable). Falls back to default copy
// in HTML. Dismissal persists for 24 hours, not forever — so a real status
// change still reaches the buyer the next day.
(function initHarvestBanner() {
    const banner = document.getElementById('harvest-banner');
    if (!banner) return;

    const STORAGE_KEY = 'harvest-dismissed-until';
    const dismissedUntil = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (Date.now() < dismissedUntil) return;

    const labelEl = banner.querySelector('[data-i18n="harvest.label"]');
    const detailEl = document.getElementById('harvest-detail');

    const apply = (data) => {
        if (data?.status) banner.setAttribute('data-status', data.status);
        if (data?.label && labelEl) labelEl.textContent = data.label;
        if (data?.detail && detailEl) detailEl.textContent = data.detail;
        banner.hidden = false;
    };

    // Show default copy immediately so users see something even if the API hangs
    apply({ status: 'in-season' });

    // Optionally enrich with live status from the Worker
    if (window.HARVEST_ENDPOINT) {
        fetch(window.HARVEST_ENDPOINT, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data) apply(data); })
            .catch(() => { /* keep defaults */ });
    }

    banner.querySelector('.close-banner')?.addEventListener('click', () => {
        banner.hidden = true;
        localStorage.setItem(STORAGE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    });
})();

// ----- Footer year -----
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ----- Header scroll state + hero parallax -----
const header = document.querySelector('header');
const heroSection = document.querySelector('.hero');
let scrollTicking = false;

window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
        const y = window.scrollY;
        if (header) header.classList.toggle('scrolled', y > 30);
        // Parallax: only update when hero is in viewport (cheap & avoids paint past it)
        if (heroSection && y < window.innerHeight) {
            heroSection.style.setProperty('--scroll', y);
        }
        scrollTicking = false;
    });
}, { passive: true });

// ----- Animate sections on first scroll-in (one-shot, no flicker) -----
// rootMargin extends the viewport's bottom edge by 120px, so the observer
// fires while the section is still slightly below the fold — by the time
// the user scrolls to it, the entrance animation has already started.
const animateTargets = document.querySelectorAll(
    '.steps-container, .features-container, .video-container, .catalog-grid'
);
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px 120px 0px' });
    animateTargets.forEach(el => observer.observe(el));
} else {
    animateTargets.forEach(el => el.classList.add('animate'));
}

// ----- Animated stat counters -----
// Counts each .counter from 0 to data-target when scrolled into view.
const counters = document.querySelectorAll('.counter');
if (counters.length && 'IntersectionObserver' in window) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animateCounter = (el) => {
        const target = Number(el.dataset.target) || 0;
        if (reduceMotion) {
            el.textContent = String(target);
            return;
        }
        const duration = 1400;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            // ease-out-cubic
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = String(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    const counterObs = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });

    counters.forEach(c => counterObs.observe(c));
}

// ----- Read More toggle -----
// Pulls labels from the active language's dictionary so the button stays
// translated. Defaults to English if no dict has been cached yet.
document.querySelectorAll('.read-more-btn').forEach(button => {
    button.addEventListener('click', function () {
        const featureBox = this.closest('.feature-box');
        if (!featureBox) return;
        const expanded = featureBox.classList.toggle('expanded');
        const lang = document.documentElement.lang || 'en';
        const dict = window.__i18nCache?.[lang];
        const key = expanded ? 'readless' : 'readmore';
        const fallback = expanded ? 'Read Less' : 'Read More';
        this.textContent = (dict && dict[key]) || fallback;
        this.setAttribute('aria-expanded', String(expanded));
    });
});

// ----- Video preview on hover, full controls on click -----
document.querySelectorAll('.video-wrapper video').forEach(video => {
    video.addEventListener('mouseenter', () => {
        if (!video.controls) {
            video.currentTime = 0;
            video.muted = true;
            video.play().catch(() => { /* autoplay blocked, ignore */ });
        }
    });
    video.addEventListener('mouseleave', () => {
        if (!video.controls) {
            video.pause();
            video.currentTime = 0;
        }
    });
    video.addEventListener('click', () => {
        video.muted = false;
        video.controls = true;
        video.play().catch(() => {});
    });
});

// ----- Quote calculator -----
// Indicative quote: tonnage × variety multiplier × destination uplift.
// Numbers are placeholder — adjust BASE / multipliers to match real costs.
(function initQuote() {
    const tonnage = document.getElementById('quote-tonnage');
    const tonnageOut = document.getElementById('quote-tonnage-out');
    const variety = document.getElementById('quote-variety');
    const destination = document.getElementById('quote-destination');
    const leadEl = document.getElementById('quote-lead');
    const priceEl = document.getElementById('quote-price');
    if (!tonnage || !variety || !destination) return;

    const VARIETY_MULTIPLIER = {
        sugarloaf: 1.00,
        cayenne: 0.85,
        bulk: 0.70,
        export: 1.20,
    };

    const DEST = {
        ghana:        { lead: [1, 2],  uplift: 1.00, freight: 0   },
        ecowas:       { lead: [2, 3],  uplift: 1.15, freight: 80  },
        europe:       { lead: [3, 5],  uplift: 1.45, freight: 220 },
        'middle-east':{ lead: [3, 5],  uplift: 1.55, freight: 260 },
        other:        { lead: [4, 7],  uplift: 1.85, freight: 420 },
    };

    const BASE_PER_TONNE = 850; // USD baseline per tonne, FOB Ghana

    const fmt = (n) => '$' + Math.round(n).toLocaleString();

    const flash = (el) => {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 250);
    };

    const recompute = () => {
        const t = Number(tonnage.value);
        const vMul = VARIETY_MULTIPLIER[variety.value] ?? 1;
        const d = DEST[destination.value] ?? DEST.ghana;

        // Tonnage discount: more volume → small per-tonne discount
        const volDiscount = t >= 50 ? 0.92 : t >= 20 ? 0.96 : 1.00;

        const perTonne = BASE_PER_TONNE * vMul * d.uplift * volDiscount;
        const subtotal = perTonne * t + d.freight;

        // Show as a band (±8%) — buyers expect a range, not an exact number
        const low = subtotal * 0.92;
        const high = subtotal * 1.08;

        tonnageOut.textContent = `${t} t`;
        leadEl.textContent = `${d.lead[0]}–${d.lead[1]} weeks`;
        priceEl.textContent = `${fmt(low)} – ${fmt(high)}`;
        flash(leadEl); flash(priceEl);
    };

    [tonnage, variety, destination].forEach((el) =>
        el.addEventListener('input', recompute)
    );
    recompute();
})();

// ----- Catalog lightbox -----
(function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    const cards = Array.from(document.querySelectorAll('.catalog-card'));
    if (!cards.length) return;

    const imgEl = lightbox.querySelector('.lightbox-img');
    const captionEl = lightbox.querySelector('.lightbox-caption');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    // Build a list of {src, alt, caption} from each card's image + name
    const items = cards.map((card) => {
        const img = card.querySelector('.catalog-image img');
        const name = card.querySelector('.catalog-name')?.textContent?.trim() || '';
        const variety = card.querySelector('.catalog-variety')?.textContent?.trim() || '';
        return {
            src: img?.src || '',
            alt: img?.alt || '',
            caption: variety ? `${variety} — ${name}` : name,
        };
    });

    let current = 0;

    const open = (idx) => {
        current = idx;
        const item = items[idx];
        imgEl.src = item.src;
        imgEl.alt = item.alt;
        captionEl.textContent = item.caption;
        lightbox.classList.add('is-open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const close = () => {
        lightbox.classList.remove('is-open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    const move = (dir) => open((current + dir + items.length) % items.length);

    cards.forEach((card, idx) => {
        // Cards already have anchor links to #contact inside; only open lightbox
        // when the user clicks the image area itself, not the CTA links.
        const imageArea = card.querySelector('.catalog-image');
        if (!imageArea) return;
        imageArea.style.cursor = 'zoom-in';
        imageArea.addEventListener('click', () => open(idx));
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => move(-1));
    nextBtn.addEventListener('click', () => move(1));

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') move(-1);
        else if (e.key === 'ArrowRight') move(1);
    });
})();

// ----- Mobile menu: close after clicking a link -----
const mobileMenuCheckbox = document.getElementById('mobile-menu-checkbox');
if (mobileMenuCheckbox) {
    document.querySelectorAll('.mobile-menu a').forEach(a => {
        a.addEventListener('click', () => {
            mobileMenuCheckbox.checked = false;
        });
    });
}

// ----- Contact form -----
// Endpoint: Cloudflare Worker that validates + emails the inquiry.
// Set CONTACT_ENDPOINT to your Worker's deployed URL (e.g. https://996-contact.your-subdomain.workers.dev).
// Falls back to a mailto: link if the endpoint isn't configured.
const CONTACT_ENDPOINT = window.CONTACT_ENDPOINT || '';

const form = document.getElementById('contact-form');
if (form) {
    const status = form.querySelector('.form-status');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.textContent = '';
        status.className = 'form-status';

        // Honeypot: real users leave this empty
        if (form.elements['company_website'].value.trim() !== '') {
            status.textContent = 'Thanks — your inquiry has been received.';
            status.classList.add('ok');
            form.reset();
            return;
        }

        // Native validation
        if (!form.checkValidity()) {
            status.textContent = 'Please fill in the required fields correctly.';
            status.classList.add('err');
            form.reportValidity();
            return;
        }

        const data = Object.fromEntries(new FormData(form).entries());

        // No backend configured? Fall back to mailto so the form is still usable.
        if (!CONTACT_ENDPOINT) {
            const subject = encodeURIComponent(`Inquiry from ${data.name} (${data.inquiry_type})`);
            const body = encodeURIComponent(
                `Name: ${data.name}\nEmail: ${data.email}\nCompany: ${data.company || '-'}\nCountry: ${data.country || '-'}\nInquiry type: ${data.inquiry_type}\n\nMessage:\n${data.message}`
            );
            window.location.href = `mailto:996farms@gmail.com?subject=${subject}&body=${body}`;
            status.textContent = 'Opening your email client…';
            status.classList.add('ok');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';

        try {
            const res = await fetch(CONTACT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                throw new Error(json.error || `Request failed (${res.status})`);
            }
            status.textContent = 'Thanks! Your inquiry was sent. We\'ll be in touch shortly.';
            status.classList.add('ok');
            form.reset();
        } catch (err) {
            status.textContent = `Sorry, we couldn't send that. ${err.message}. You can email us directly at 996farms@gmail.com.`;
            status.classList.add('err');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Inquiry';
        }
    });
}
