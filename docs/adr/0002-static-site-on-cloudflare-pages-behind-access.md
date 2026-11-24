# Static site on Cloudflare Pages, behind Cloudflare Access

The site is fully static output deployed to Cloudflare Pages on a `*.pages.dev` hostname, with Cloudflare Access (GitHub login only) in front of every request. The only server code is one Pages Function for large files. This is the only combination found that is private, needs no server to maintain, and is free. A static site also suits the offline PWA, because every page is a cacheable file.

## Consequences

- Protecting a `pages.dev` hostname with Access is a documented workaround, not a first-class feature, and can break after Pages settings change. The fallback is our own auth in a Pages Function (passkey + signed cookie + Turnstile), so auth assumptions must stay in one place.
- Content can be up to a day stale, since there's no server to render on request.
- Access answers expired sessions with a redirect to its login page. The PWA must ask for a 401 instead (`X-Requested-With`) and never cache Access responses.

## Considered Options

Nextcloud or a self-hosted VM (Oracle free tier): rejected as too much maintenance. A custom domain: rejected because it costs money.
