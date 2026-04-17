# ESSEN Credentialing Platform — Deployment Plan

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Status**: Active — Production deployed  

---

## Deployment Overview

The ESSEN Credentialing Platform runs as two Docker containers on a shared VPS, fronted by Nginx with SSL. This document covers the current production deployment, the deployment process, environment configuration, and the future Azure cloud migration path.

---

## Production Environment

### Server Details

| Property | Value |
|----------|-------|
| **Server IP** | 69.62.70.191 |
| **SSH User** | hdpulse2000 |
| **Server Path** | `/var/www/E_Credentialing` |
| **OS** | Ubuntu 22.04 LTS |
| **Domain** | `credentialing.hdpulseai.com` |
| **SSL** | Let's Encrypt via Certbot (auto-renewal) |
| **Nginx** | Reverse proxy, site config at `/etc/nginx/sites-available/credentialing.hdpulseai.com` |

### Container Architecture

| Container | Image | Port | Health Check | Purpose |
|-----------|-------|------|-------------|---------|
| `ecred-web-prod` | `e_credentialing-ecred-web-prod` | 6015 | `http://localhost:6015/api/health` | Next.js web app (UI + API + Auth) |
| `ecred-worker-prod` | `e_credentialing-ecred-worker-prod` | 6025 | BullMQ connection test | BullMQ workers + Playwright bots |

### Shared Infrastructure (on same server)

| Service | Container | Network | Port | Used By |
|---------|-----------|---------|------|---------|
| PostgreSQL | `supabase_db_hdpulse2000` | `supabase_network_hdpulse2000` | 5432 | All sibling apps |
| Redis | `vms-redis-prod` | `supabase_network_hdpulse2000` | 6379 | All sibling apps |

### Network Configuration

```
Internet
    │
    ▼
Nginx (:80/:443)
    │ proxy_pass
    ▼
ecred-web-prod (:6015)
    │ Redis pub/sub
    ▼
ecred-worker-prod (:6025)
    │
    ▼
supabase_db_hdpulse2000 (:5432)
vms-redis-prod (:6379)
```

Both app containers join the `supabase_network_hdpulse2000` external Docker network to reach PostgreSQL and Redis.

---

## Deployment Process

### Standard Deployment (Push & Deploy)

The deployment is performed from the development machine using a Python paramiko script. **Native SSH does not work from this machine.**

```bash
# 1. Stage and commit all changes
git add -A
git commit -m "descriptive commit message"

# 2. Push to GitHub
git push origin master

# 3. Deploy to production
python .claude/deploy.py
```

The deploy script (`.claude/deploy.py`) performs these steps automatically:

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `git pull origin master` | Pull latest code on server |
| 2 | `docker compose -f docker-compose.prod.yml down` | Stop current containers |
| 3 | `docker compose -f docker-compose.prod.yml up -d --build` | Rebuild and start containers |
| 4 | `docker image prune -f` | Remove dangling images |
| 5 | `docker compose -f docker-compose.prod.yml ps` | Confirm container status |

**Typical deployment time**: 3–5 minutes (most time spent in Docker build).

### Database Migration Deployment

When Prisma schema changes are included:

```bash
# After standard deployment, run migrations
python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate deploy"
```

### Running Arbitrary Commands on Production

```bash
python .claude/deploy.py "<command>"
```

Examples:
```bash
# Check container logs
python .claude/deploy.py "docker logs ecred-web-prod --tail 50"

# Check database connectivity
python .claude/deploy.py "docker exec ecred-web-prod npx prisma db execute --stdin <<< 'SELECT 1'"

# Restart containers without rebuild
python .claude/deploy.py "cd /var/www/E_Credentialing && docker compose -f docker-compose.prod.yml restart"

# Seed database
python .claude/deploy.py "docker exec ecred-web-prod npm run db:seed"

# Check disk space
python .claude/deploy.py "df -h"
```

---

## Environment Configuration

### Production Environment Variables

Environment variables are stored in `/var/www/E_Credentialing/.env` on the production server. This file is **not** committed to Git.

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@supabase_db_hdpulse2000:5432/e_credentialing_db` |
| `REDIS_HOST` | Redis hostname | `vms-redis-prod` |
| `REDIS_PORT` | Redis port | `6379` |
| `NEXTAUTH_SECRET` | Auth.js session encryption key | `<openssl rand -base64 32>` |
| `NEXTAUTH_URL` | Auth.js callback URL | `https://credentialing.hdpulseai.com` |
| `NEXT_PUBLIC_APP_URL` | Public application URL | `https://credentialing.hdpulseai.com` |
| `AUTH_TRUST_HOST` | Trust proxy headers for Auth.js | `true` |
| `AZURE_AD_TENANT_ID` | Essen's Azure AD tenant | `<tenant-id>` |
| `AZURE_AD_CLIENT_ID` | App registration client ID | `<client-id>` |
| `AZURE_AD_CLIENT_SECRET` | App registration client secret | `<client-secret>` |
| `ENCRYPTION_KEY` | AES-256-GCM key for PHI | `<32-byte base64>` |
| `SENDGRID_API_KEY` | Email delivery API key | `SG.xxxxx` |
| `NODE_ENV` | Environment | `production` |

### Docker Compose Configuration

Production uses `docker-compose.prod.yml` which:
- Uses multi-stage Dockerfiles (`Dockerfile.web.prod`, `Dockerfile.worker.prod`)
- Connects to `supabase_network_hdpulse2000` external network
- Maps ports `6015:6015` (web) and `6025:6025` (worker)
- Sets environment variables with fallback defaults (`${VAR:-default}`)
- Configures health checks for both containers
- Sets restart policy to `unless-stopped`

---

## Nginx Configuration

### Site Config

Located at `/etc/nginx/sites-available/credentialing.hdpulseai.com`:

```nginx
server {
    listen 443 ssl http2;
    server_name credentialing.hdpulseai.com;

    ssl_certificate /etc/letsencrypt/live/credentialing.hdpulseai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/credentialing.hdpulseai.com/privkey.pem;

    location / {
        proxy_pass http://localhost:6015;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name credentialing.hdpulseai.com;
    return 301 https://$host$request_uri;
}
```

### SSL Certificate Renewal

Certbot is configured for automatic renewal. To manually renew:

```bash
python .claude/deploy.py "certbot renew --nginx"
```

---

## Rollback Procedure

### Quick Rollback (< 5 minutes)

If a deployment breaks the application:

```bash
# 1. Identify the last working commit
python .claude/deploy.py "cd /var/www/E_Credentialing && git log --oneline -5"

# 2. Revert to previous commit
python .claude/deploy.py "cd /var/www/E_Credentialing && git checkout <commit-hash> -- ."

# 3. Rebuild containers
python .claude/deploy.py "cd /var/www/E_Credentialing && docker compose -f docker-compose.prod.yml up -d --build"
```

### Database Rollback

If a Prisma migration causes issues:

```bash
# Check migration status
python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate status"

# Prisma does not support automatic rollback — create a compensating migration
# or restore from database backup
```

### Full Rollback to PARCS

During the transition period (Phase 4 of implementation):
1. PARCS remains archived and accessible for 30 days after full rollout
2. Staff accounts can be re-enabled in PARCS within hours
3. K: drive PCD folders remain read-only for 90 days

---

## Monitoring & Health Checks

### Container Health

```bash
# Check container status
python .claude/deploy.py "docker compose -f docker-compose.prod.yml ps"

# Check container resource usage
python .claude/deploy.py "docker stats --no-stream ecred-web-prod ecred-worker-prod"

# Check container logs (last 100 lines)
python .claude/deploy.py "docker logs ecred-web-prod --tail 100"
python .claude/deploy.py "docker logs ecred-worker-prod --tail 100"
```

### Application Health

```bash
# Health check endpoint
python .claude/deploy.py "curl -s http://localhost:6015/api/health"

# Check database connectivity
python .claude/deploy.py "docker exec ecred-web-prod node -e \"const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => { console.log('DB OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })\""
```

### Disk Space

```bash
python .claude/deploy.py "df -h"
python .claude/deploy.py "docker system df"
```

### SSL Certificate Status

```bash
python .claude/deploy.py "certbot certificates"
```

---

## Backup Strategy

### Database Backups

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Full database dump | Daily (2:00 AM UTC) | 30 days | `pg_dump` via cron |
| Transaction log | Continuous | 7 days | PostgreSQL WAL |
| Pre-migration snapshot | Before each migration | 90 days | `pg_dump` manual |

```bash
# Manual backup
python .claude/deploy.py "docker exec supabase_db_hdpulse2000 pg_dump -U postgres e_credentialing_db | gzip > /var/backups/ecred_$(date +%Y%m%d).sql.gz"

# Restore from backup
python .claude/deploy.py "gunzip -c /var/backups/ecred_20260415.sql.gz | docker exec -i supabase_db_hdpulse2000 psql -U postgres e_credentialing_db"
```

### File Storage Backups

Azure Blob Storage provides built-in redundancy (LRS in dev, GRS in production). For the current VPS deployment, document files are stored within the application's volume and should be backed up alongside the database.

---

## Security Checklist (Pre-Deploy)

Before each deployment, verify:

- [ ] No `.env` files or secrets committed to Git
- [ ] No hardcoded credentials in source code
- [ ] `NEXTAUTH_SECRET` is set and unique per environment
- [ ] `ENCRYPTION_KEY` is set (32-byte base64)
- [ ] `AUTH_TRUST_HOST=true` is set for proxy deployments
- [ ] SSL certificate is valid (not expired)
- [ ] Container images are built from clean source (no dev dependencies in production)
- [ ] `NODE_ENV=production` is set
- [ ] Database connection uses correct production hostname
- [ ] Redis connection uses correct production hostname

---

## Future: Azure Cloud Migration

The long-term target is migrating from the VPS to Azure Container Apps for improved scalability, managed services, and alignment with Essen's Azure infrastructure.

### Migration Path

| Current (VPS) | Future (Azure) |
|---------------|---------------|
| Docker Compose on VPS | Azure Container Apps |
| Shared PostgreSQL on VPS | Azure Database for PostgreSQL (Flexible Server) |
| Shared Redis on VPS | Azure Cache for Redis |
| Nginx + Certbot | Azure Front Door (CDN + WAF + SSL) |
| Manual deploy script | GitHub Actions CI/CD |
| File system volumes | Azure Blob Storage (native) |
| `deploy.py` (paramiko) | `az containerapp update` |

### Azure Resource Requirements

| Resource | SKU | Estimated Monthly Cost |
|----------|-----|----------------------|
| Container Apps (web) | Consumption | ~$30 |
| Container Apps (worker) | Consumption | ~$50 |
| PostgreSQL Flexible Server | Burstable B1ms | ~$25 |
| Azure Cache for Redis | C0 Basic | ~$16 |
| Blob Storage (100GB) | Standard LRS | ~$2 |
| Key Vault | Standard | ~$3 |
| AI Document Intelligence | S0 | Pay-per-use |
| Application Insights | Workspace-based | ~$10 |
| **Total estimated** | | **~$140/month** |

### Migration Timeline

Targeted for Q2 2027, after the platform has been in production on VPS for 6+ months and operational patterns are well understood.

---

## Troubleshooting Guide

### Container Won't Start

```bash
# Check logs for error
python .claude/deploy.py "docker logs ecred-web-prod --tail 50"

# Common causes:
# - DATABASE_URL incorrect → fix in .env
# - Port already in use → check for conflicting containers
# - Build failure → check Dockerfile changes
```

### Database Connection Error

```bash
# Verify database container is running
python .claude/deploy.py "docker ps | grep supabase_db"

# Test connectivity from app container
python .claude/deploy.py "docker exec ecred-web-prod node -e \"require('net').createConnection(5432, 'supabase_db_hdpulse2000').on('connect', () => { console.log('OK'); process.exit(0) })\""

# Check if database exists
python .claude/deploy.py "docker exec supabase_db_hdpulse2000 psql -U postgres -l | grep e_credentialing"
```

### Redis Connection Error

```bash
# Verify Redis container is running
python .claude/deploy.py "docker ps | grep redis"

# Test connectivity
python .claude/deploy.py "docker exec ecred-web-prod node -e \"require('net').createConnection(6379, 'vms-redis-prod').on('connect', () => { console.log('OK'); process.exit(0) })\""
```

### SSL Certificate Issues

```bash
# Check certificate status
python .claude/deploy.py "certbot certificates"

# Force renewal
python .claude/deploy.py "certbot renew --force-renewal --nginx"

# Test Nginx config
python .claude/deploy.py "nginx -t"

# Reload Nginx
python .claude/deploy.py "echo 'HDPulseVPS((()))' | sudo -S systemctl reload nginx"
```

### Worker Bots Not Running

```bash
# Check worker container logs
python .claude/deploy.py "docker logs ecred-worker-prod --tail 100"

# Common causes:
# - Redis not reachable → check REDIS_HOST
# - Module not found → check tsc-alias ran in build
# - Playwright browser not installed → check Dockerfile
```
