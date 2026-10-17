# μ(t) Official Webiste

Built with React, Vite, and Cloudflare Pages Functions.

## Running
Run `npm ci`, `npm run build`, then `npm run dev`. Open `http://localhost:8788`. Vite alone does not run the API functions.

## repository sign-in

The repository frontend checks `https://uoftauth.boratto.ca/me` with `credentials: 'include'`. A user response shows the repository; `null` shows a sign-in link. Login returns to the original page. The auth service verifies UofT Microsoft member accounts, not current student enrollment.

The auth service lives in `~/git/uoftauth`; this site needs no Microsoft credentials or auth secrets. `https://muoft.ca` skips the service's consent screen. Other origins, including local development, show consent first.

This gates the frontend only. Direct repository API and PDF URLs remain public. Cross-site browser calls require third-party cookies.

Run `npm test` for the Pages routing and repository access integration tests, and `npx tsc --noEmit --incremental false` for typechecking.

## Adding Events
1. Create a new index.js file in `pages/events/EVENT_NAME/index.js`
2. Copy over the contents of `pages/events/example/index.js`
3. Supply an image, which by default is expected at `pages/events/EVENT_NAME/image.png`
