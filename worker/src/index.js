/**
 * 996 Farms — Contact form Worker
 *
 * Receives JSON inquiries from the website form, validates them,
 * stops bots, persists the lead, and emails it to 996farms@gmail.com.
 *
 * Required Worker secrets (set with `wrangler secret put`):
 *   RESEND_API_KEY      — API key from https://resend.com (free 100/day)
 *   FROM_EMAIL          — verified sender, e.g. "996 Farms <inquiries@996farms.com>"
 *   TO_EMAIL            — destination, e.g. "996farms@gmail.com"
 *   ALLOWED_ORIGIN      — your site origin, e.g. "https://996farms.com"
 *
 * Optional:
 *   TURNSTILE_SECRET    — Cloudflare Turnstile secret. If set, the Worker
 *                         requires the cf-turnstile-response field on submit.
 *
 * Optional bindings (in wrangler.toml):
 *   LEADS               — KV namespace for storing leads + per-IP rate limit
 */

const MAX_BODY_BYTES = 8 * 1024;          // 8 KB — plenty for a form
const RATE_LIMIT_WINDOW_S = 60 * 60;       // 1 hour
const RATE_LIMIT_MAX = 5;                  // 5 submissions / hour / IP

export default {
    async fetch(request, env) {
        const origin = env.ALLOWED_ORIGIN || '*';
        const corsHeaders = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // GET /harvest — live harvest status
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname.endsWith('/harvest')) {
            // Status is admin-controllable via KV. Set HARVEST_STATUS in the LEADS namespace
            // to one of: { status: "in-season" | "limited" | "off", label: "...", detail: "..." }
            // Falls back to a sensible default if KV isn't configured.
            let payload = {
                status: 'in-season',
                label: 'In season',
                detail: 'Sugarloaf available now — typical lead time 2 weeks.',
            };
            if (env.LEADS) {
                try {
                    const stored = await env.LEADS.get('HARVEST_STATUS', { type: 'json' });
                    if (stored && stored.status) payload = stored;
                } catch { /* ignore */ }
            }
            return json(payload, 200, { ...corsHeaders, 'Cache-Control': 'public, max-age=300' });
        }

        if (request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405, corsHeaders);
        }

        // Body size guard
        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > MAX_BODY_BYTES) {
            return json({ error: 'Payload too large' }, 413, corsHeaders);
        }

        let data;
        try {
            data = await request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400, corsHeaders);
        }

        // Honeypot — bots fill this; real users don't see it
        if (data.company_website && String(data.company_website).trim() !== '') {
            // Pretend success so bots don't retry
            return json({ ok: true }, 200, corsHeaders);
        }

        // Required fields
        const required = ['name', 'email', 'inquiry_type', 'message'];
        for (const f of required) {
            if (!data[f] || String(data[f]).trim() === '') {
                return json({ error: `Missing field: ${f}` }, 400, corsHeaders);
            }
        }

        // Length / format guards
        if (String(data.message).length > 2000) {
            return json({ error: 'Message too long' }, 400, corsHeaders);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
            return json({ error: 'Invalid email' }, 400, corsHeaders);
        }

        // Optional: Turnstile verification
        if (env.TURNSTILE_SECRET) {
            const token = data['cf-turnstile-response'];
            if (!token) {
                return json({ error: 'Captcha required' }, 400, corsHeaders);
            }
            const ip = request.headers.get('CF-Connecting-IP') || '';
            const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: env.TURNSTILE_SECRET,
                    response: token,
                    remoteip: ip,
                }),
            });
            const verifyJson = await verify.json();
            if (!verifyJson.success) {
                return json({ error: 'Captcha failed' }, 403, corsHeaders);
            }
        }

        // Rate limit by IP (only if KV is bound)
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (env.LEADS) {
            const key = `rl:${ip}`;
            const count = Number(await env.LEADS.get(key)) || 0;
            if (count >= RATE_LIMIT_MAX) {
                return json({ error: 'Too many submissions. Try again later.' }, 429, corsHeaders);
            }
            await env.LEADS.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_S });
        }

        // Sanitize for email body
        const clean = (s) => String(s ?? '').replace(/[<>]/g, '').slice(0, 2000);
        const lead = {
            name: clean(data.name),
            email: clean(data.email),
            company: clean(data.company),
            country: clean(data.country),
            inquiry_type: clean(data.inquiry_type),
            message: clean(data.message),
            ip,
            ua: request.headers.get('User-Agent') || '',
            ts: new Date().toISOString(),
        };

        // Persist (best-effort)
        if (env.LEADS) {
            await env.LEADS.put(
                `lead:${lead.ts}:${crypto.randomUUID()}`,
                JSON.stringify(lead),
                { expirationTtl: 60 * 60 * 24 * 90 } // keep 90 days
            );
        }

        // Send email via Resend
        if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
            return json({ error: 'Server email not configured' }, 500, corsHeaders);
        }

        const subject = `New inquiry from ${lead.name} — ${lead.inquiry_type}`;
        const text = [
            `Name:        ${lead.name}`,
            `Email:       ${lead.email}`,
            `Company:     ${lead.company || '-'}`,
            `Country:     ${lead.country || '-'}`,
            `Inquiry:     ${lead.inquiry_type}`,
            `IP:          ${lead.ip}`,
            `Submitted:   ${lead.ts}`,
            ``,
            `Message:`,
            lead.message,
        ].join('\n');

        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.FROM_EMAIL,
                to: [env.TO_EMAIL],
                reply_to: lead.email,
                subject,
                text,
            }),
        });

        if (!emailRes.ok) {
            const errBody = await emailRes.text().catch(() => '');
            console.error('Resend failed', emailRes.status, errBody);
            return json({ error: 'Failed to send email' }, 502, corsHeaders);
        }

        return json({ ok: true }, 200, corsHeaders);
    },
};

function json(body, status, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...extraHeaders,
        },
    });
}
