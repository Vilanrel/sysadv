# Incident: SysADV login timeout behind Railway Web reverse proxy

## Observed
- Web returns HTTP 200 for the login page and static assets.
- `GET /api/auth/me` and `POST /api/auth/login` returned 504.
- Web Nginx logged `upstream timed out while connecting to upstream` to an internal private IP on port 8080.
- API logs showed startup on port 8080 and Railway marked all 3 services online.
- A Web-only restart was performed as an immediate recovery attempt, but is not a durable fix.

## Fix
- Nginx `proxy_pass` now uses a hostname **variable** so Nginx resolves the private DNS name on new connections rather than pinning an IP at configuration load.
- DNS resolver is obtained from the running container's `/etc/resolv.conf` at startup.
- Startup script generates Nginx configuration and validates it using `nginx -t`.
- No database schema or secret changes.

## Validate after deployment
1. Inspect Web deployment logs for successful `nginx -t`.
2. Confirm `GET /login` returns 200.
3. Confirm `GET /api/auth/me` returns 401 (unauthenticated) or 200 (valid session), **never 504**.
4. Use an authorized test user to verify `POST /api/auth/login` without printing secrets.
5. Restart/redeploy API and repeat step 3 to prove DNS freshness.
6. Monitor 5xx and timeout rates after rollout.

## Rollback
Revert this PR and redeploy Web if startup validation fails. The API and PostgreSQL services are unchanged.
