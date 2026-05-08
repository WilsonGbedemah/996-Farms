# Deploying 996 Farms (Cloudflare Pages + Worker)

The site is fully static. The contact form posts to a Cloudflare Worker
that validates, stops bots, persists the lead, and emails it via Resend.

## 1. Deploy the static site to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick this repo. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/` (the repo root)
4. Deploy. You'll get a `*.pages.dev` URL. Add your custom domain (`996farms.com`) under
   **Custom domains** when ready.

`_headers`, `robots.txt`, and `sitemap.xml` are picked up automatically.

## 2. Deploy the contact Worker

```sh
cd worker
npm install
npx wrangler login
```

### a. Create the leads KV namespace (optional but recommended)

```sh
npx wrangler kv namespace create LEADS
```

Copy the `id` it prints into the `[[kv_namespaces]]` block in
`worker/wrangler.toml` and uncomment it.

### b. Sign up for Resend (free, 100 emails/day)

1. Go to https://resend.com → create account.
2. Verify your sending domain (`996farms.com`) by adding the DNS records they
   give you. Until your domain is verified, you can send from `onboarding@resend.dev`
   for testing.
3. Create an API key.

### c. Set Worker secrets

```sh
npx wrangler secret put RESEND_API_KEY      # paste the key
npx wrangler secret put FROM_EMAIL          # e.g. "996 Farms <inquiries@996farms.com>"
npx wrangler secret put TO_EMAIL            # info@996farms.com
npx wrangler secret put ALLOWED_ORIGIN      # https://996farms.com
```

### d. (Optional) Add Cloudflare Turnstile for bulletproof spam protection

1. Cloudflare dashboard → **Turnstile** → **Add site**. Domain: `996farms.com`.
2. Copy the **Site key** and **Secret key**.
3. Add this `<script>` to `index.html` `<head>`:
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```
4. In the contact form (just above the submit button), add:
   ```html
   <div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
   ```
5. Set the secret on the Worker:
   ```sh
   npx wrangler secret put TURNSTILE_SECRET
   ```

The Worker will then reject any submission without a valid Turnstile token.

### e. Deploy

```sh
npx wrangler deploy
```

You'll get a URL like `https://996-farms-contact.<your-subdomain>.workers.dev`.

## 3. Wire the form to the Worker

In `index.html`, find this block near the bottom and paste your Worker URL:

```html
<script>
    window.CONTACT_ENDPOINT = 'https://996-farms-contact.your-subdomain.workers.dev';
</script>
```

Commit and Pages redeploys automatically.

## 4. Test it

1. Open the deployed site, fill out the contact form, submit.
2. Check `info@996farms.com` for the inquiry.
3. (If KV bound) check Cloudflare dashboard → **Workers & Pages** → your Worker
   → **KV** → `LEADS` to see stored leads.

## Troubleshooting

- **CORS error in browser console** → `ALLOWED_ORIGIN` secret doesn't match the
  domain the form is being submitted from. Update with `wrangler secret put ALLOWED_ORIGIN`.
- **"Server email not configured"** → one of `RESEND_API_KEY`, `FROM_EMAIL`,
  `TO_EMAIL` isn't set. Run `wrangler secret list` to confirm.
- **Resend 422 "domain not verified"** → either verify your domain in Resend,
  or temporarily set `FROM_EMAIL` to `onboarding@resend.dev`.
