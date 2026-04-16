# Nginx site config for ESSEN Credentialing Platform
#
# Deploy to production server:
#   sudo cp credentialing.hdpulseai.com /etc/nginx/sites-available/credentialing.hdpulseai.com
#   sudo ln -s /etc/nginx/sites-available/credentialing.hdpulseai.com /etc/nginx/sites-enabled/
#   sudo certbot --nginx -d credentialing.hdpulseai.com
#   sudo nginx -t && sudo systemctl reload nginx
#
# Note: Certbot will automatically add SSL lines to this file.

server {
    server_name credentialing.hdpulseai.com;
    listen 80;
    listen [::]:80;

    # ── ACME challenge (Let's Encrypt) ────────────────────────────────────
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # ── Auth routes (rate-limit at nginx level) ───────────────────────────
    location /api/auth/ {
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Document upload (large body) ─────────────────────────────────────
    location /api/upload {
        client_max_body_size 50M;
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_request_buffering off;
    }

    # ── All API routes (tRPC, webhooks, health) ───────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # ── Socket.io (real-time bot status) ─────────────────────────────────
    location /socket.io/ {
        proxy_pass http://127.0.0.1:6015;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    # ── Next.js static assets ─────────────────────────────────────────────
    location /_next/static/ {
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── Static files ──────────────────────────────────────────────────────
    location ~* \.(js|css)$ {
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        expires 7d;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|avif|webp)$ {
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── All other routes → Next.js App Router ────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:6015;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
