# μ(t) Official Webiste

Built with React, Vite, and Cloudflare Pages Functions.

## Running
Run `npm ci`, `npm run build`, then `npm run dev`. Open `http://localhost:8788`. Vite alone does not run the API functions.

## repository sign-in

The whole course repository requires a University of Toronto Microsoft account, including file listings, direct PDF links, and uploads. Public site pages remain available. Auth.js verifies the UofT tenant and Microsoft Graph member profile, then stores the session in an encrypted HttpOnly cookie. Sessions last one hour.

Copy `.dev.vars.example` to `.dev.vars` for local credentials. Set `AUTH_MICROSOFT_ENTRA_ID_SECRET` to a Microsoft client secret and generate `AUTH_SECRET` with `openssl rand -base64 32`. Keep both secrets server-side. For production, configure these values in Cloudflare Pages variables and secrets, then redeploy.

In the existing Microsoft registration (`aef86eb3-05d9-439d-868d-151580102dac`), add these **web** redirect URIs:

- `http://localhost:8788/api/auth/callback/microsoft-entra-id`
- `https://<your-site-domain>/api/auth/callback/microsoft-entra-id`

Use delegated Graph `User.Read` and `openid profile email`. No mailbox permissions are needed. Missing credentials keep the repository locked. `GET /api/me` returns the verified user's `id`, primary `email`, and `name`; use `id` as the account key. Account access does not establish current student enrollment.

Run `npm test` for the Pages routing and repository access integration tests, and `npx tsc --noEmit --incremental false` for typechecking.

## Adding Events
1. Create a new index.js file in `pages/events/EVENT_NAME/index.js`
2. Copy over the contents of `pages/events/example/index.js`
3. Supply an image, which by default is expected at `pages/events/EVENT_NAME/image.png`
