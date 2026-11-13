# TrueSendy - Cold Email Outreach & Sender Infrastructure

TrueSendy is an enterprise-grade cold email SaaS platform engineered for multi-inbox rotation, deliverability preservation, AI reply categorization, proxy pooling, and automated background queues.

---

## Architecture Overview

```
                      +-------------------+
                      |   NGINX Gateway   | (Port 80/443)
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
   +---------v---------+                 +---------v---------+
   |   Next.js 14 App  |                 |  Express API Core |
   |    (web:3000)     |                 |    (api:5000)     |
   +-------------------+                 +----+----+---------+
                                              |    |
                      +-----------------------+    +-----------------------+
                      |                                                    |
             +--------v--------+                                  +--------v--------+
             | PostgreSQL 16   |                                  | Redis 7 BullMQ  |
             +-----------------+                                  +----+---+---+----+
                                                                       |   |   |
                    +--------------------------------------------------+   |   +-------------------+
                    |                                                      |                       |
          +---------v---------+                                  +---------v---------+   +---------v---------+
          |   Worker Sender   |                                  |    Worker IMAP    |   |   Worker System   |
          | (Inbox Rotation)  |                                  |  (Bounce Monitor) |   | (Webshare Sync)   |
          +-------------------+                                  +-------------------+   +-------------------+
```

---

## 1. Preparing for GitHub

### Step 1: Install Git (if not yet installed)
If Git is not installed on your Windows machine:
- Download and install [Git for Windows](https://git-scm.com/download/win), or install via winget / command line:
  ```powershell
  winget install --id Git.Git -e --source winget
  ```

### Step 2: Initialize Git and Commit
A `.gitignore` file has already been prepared to prevent committing sensitive files (like `.env`, `node_modules`, and SSL keys).

In PowerShell inside this project folder (`d:\Truesendy Email Sending webapp`):

```bash
# 1. Initialize local repository
git init

# 2. Stage all project files (verifies .gitignore excludes secrets)
git add .

# 3. Create initial commit
git commit -m "feat: initial commit of TrueSendy cold email platform"

# 4. Set default branch to main
git branch -M main
```

### Step 3: Create GitHub Repository and Push
1. Go to [GitHub.com](https://github.com/new) and click **New Repository**.
2. Name your repository (e.g. `truesendy-email-engine`). Keep it **Private** if it contains proprietary business logic.
3. Link your local project and push:
   ```bash
   git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
   git push -u origin main
   ```

---

## 2. Deploying to a VPS (Ubuntu / Debian)

### Recommended Minimum VPS Specs
- **CPU**: 2 vCPUs
- **RAM**: 4 GB (minimum 2 GB with swap)
- **Disk**: 40 GB SSD / NVMe
- **OS**: Ubuntu 22.04 LTS or 24.04 LTS

---

### Step 1: Connect to VPS and Install Docker

SSH into your VPS:
```bash
ssh root@YOUR_VPS_IP
```

Update system packages and install Docker & Git:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban

# Install Docker Engine & Docker Compose Plugin
curl -fsSL https://get.docker.com | sh

# Enable Docker on system boot
sudo systemctl enable docker
sudo systemctl start docker
```

---

### Step 2: Configure Firewall (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### Step 3: Clone Project onto VPS

```bash
# Clone your private repository
git clone https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git /var/www/truesendy

cd /var/www/truesendy
```

---

### Step 4: Configure Environment Variables (`.env`)

Copy the template and fill in your production values:
```bash
cp .env.example .env
nano .env
```

Key variables to configure:
- `POSTGRES_PASSWORD`: Strong random string (e.g., `openssl rand -hex 16`)
- `ENCRYPTION_KEY`: 32-byte hex string (e.g., `openssl rand -hex 32`)
- `TRACKING_SECRET`: Random HMAC secret
- `APP_PRIMARY_DOMAIN`: Your primary domain (e.g., `truesendy.com`)
- `OPENAI_API_KEY`: API key for sentiment/reply categorizer
- `WEBSHARE_DOWNLOAD_URL`: Your Webshare proxy export URL

---

### Step 5: Launch Services with Docker Compose

Run the included automated deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```

Or run Docker Compose manually:
```bash
# 1. Build and start PostgreSQL and Redis first
docker compose up -d postgres redis

# 2. Run Prisma database push/migrations
docker compose run --rm api npx prisma db push

# 3. Build and launch all services
docker compose up -d --build
```

---

### Step 6: Setup Free Let's Encrypt SSL (Certbot)

To secure `yourdomain.com` with HTTPS using Certbot on the host or inside Nginx:

```bash
sudo apt install -y certbot python3-certbot-nginx

# Stop Docker Nginx temporarily to allow standalone Certbot, or use webroot
docker compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d app.yourdomain.com

# Mount SSL certificates into nginx and restart
docker compose up -d nginx
```

---

### Step 7: Useful Maintenance Commands

```bash
# View live logs of all services
docker compose logs -f

# View live logs of email sender worker
docker compose logs -f worker-sender

# Check queue status and Redis health
docker compose exec redis redis-cli ping

# Restart single service
docker compose restart worker-sender

# Pull updates and rebuild
git pull
./deploy.sh
```
