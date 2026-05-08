/**
 * 996 Farms - Vercel serverless function for the contact form
 *
 * Receives JSON inquiries from the website form, validates them, stops bots,
 * and emails the lead to TO_EMAIL via Resend.
 *
 * Required env vars (set in Vercel dashboard - Project - Settings - Environment Variables):
 *   RESEND_API_KEY      - API key from https://resend.com (free 100/day)
 *   FROM_EMAIL          - verified sender, e.g. "996 Farms <inquiries@996farms.com>"
 *                         For testing without a verified domain, use "onboarding@resend.dev"
 *   TO_EMAIL            - destination, e.g. "info@996farms.com"
 *
 * Optional:
 *   TURNSTILE_SECRET    - Cloudflare Turnstile secret. If set, the route requires
 *                         a valid cf-turnstile-response on every submit.
 */

export default async function handler(req, res) {
    // Vercel calls this same-origin from the deployed site, so CORS is unneeded.
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const data = req.body;
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid body' });
    }

    // Honeypot - bots fill this; real users don't see it. Pretend success so bots don't retry.
    if (data.company_website && String(data.company_website).trim() !== '') {
        return res.status(200).json({ ok: true });
    }

    // Required fields
    const required = ['name', 'email', 'inquiry_type', 'message'];
    for (const f of required) {
        if (!data[f] || String(data[f]).trim() === '') {
            return res.status(400).json({ error: `Missing field: ${f}` });
        }
    }

    if (String(data.message).length > 2000) {
        return res.status(400).json({ error: 'Message too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
        return res.status(400).json({ error: 'Invalid email' });
    }

    // Optional Turnstile verification
    if (process.env.TURNSTILE_SECRET) {
        const token = data['cf-turnstile-response'];
        if (!token) return res.status(400).json({ error: 'Captcha required' });
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || '';
        try {
            const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: process.env.TURNSTILE_SECRET,
                    response: token,
                    remoteip: ip,
                }),
            });
            const verifyJson = await verify.json();
            if (!verifyJson.success) return res.status(403).json({ error: 'Captcha failed' });
        } catch {
            return res.status(502).json({ error: 'Captcha verification failed' });
        }
    }

    // Sanitize for plaintext email body
    const clean = (s) => String(s ?? '').replace(/[<>]/g, '').slice(0, 2000);
    const lead = {
        name: clean(data.name),
        email: clean(data.email),
        company: clean(data.company),
        country: clean(data.country),
        inquiry_type: clean(data.inquiry_type),
        message: clean(data.message),
        ip: req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
        ua: req.headers['user-agent'] || '',
        ts: new Date().toISOString(),
    };

    if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.TO_EMAIL) {
        console.error('Missing one of RESEND_API_KEY / FROM_EMAIL / TO_EMAIL');
        return res.status(500).json({ error: 'Server email not configured' });
    }

    const subject = `New inquiry from ${lead.name} - ${lead.inquiry_type}`;
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

    try {
        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: process.env.FROM_EMAIL,
                to: [process.env.TO_EMAIL],
                reply_to: lead.email,
                subject,
                text,
            }),
        });

        if (!emailRes.ok) {
            const errBody = await emailRes.text().catch(() => '');
            console.error('Resend failed', emailRes.status, errBody);
            return res.status(502).json({ error: 'Failed to send email' });
        }
    } catch (err) {
        console.error('Resend network error', err);
        return res.status(502).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true });
}
