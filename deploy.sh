#!/usr/bin/env bash
# ==============================================================================
# TrueSendy Production VPS Deployment Script
# Target OS: Ubuntu 22.04 / 24.04 LTS or Debian 11 / 12
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting TrueSendy Production Deployment"
echo "=========================================================="

# 1. Check required tools
command -v docker >/dev/null 2>&1 || {
  echo "Error: docker is not installed. Please install Docker first."
  echo "Run: curl -fsSL https://get.docker.com | sh"
  exit 1
}

# 2. Check for docker compose / docker-compose
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "Error: docker compose plugin is not installed."
  exit 1
fi

# 3. Ensure .env file exists
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Warning: .env not found. Creating from .env.example..."
    cp .env.example .env
    echo "CRITICAL: Please edit .env with your actual database passwords, domain, and API keys before running!"
    exit 1
  else
    echo "Error: Neither .env nor .env.example found!"
    exit 1
  fi
fi

# 4. Pull latest git changes (if in git repo)
if [ -d .git ]; then
  echo "Pulling latest code from git repository..."
  git pull origin main || git pull origin master || true
fi

# 5. Build and pull containers
echo "Building and launching containers..."
$DOCKER_COMPOSE down --remove-orphans || true
$DOCKER_COMPOSE build --no-cache
$DOCKER_COMPOSE up -d postgres redis

# 6. Wait for PostgreSQL to be healthy
echo "Waiting for PostgreSQL database to be ready..."
until $DOCKER_COMPOSE exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; do
  sleep 2
done
echo "PostgreSQL is ready."

# 7. Run Prisma Database Migrations
echo "Applying database migrations..."
$DOCKER_COMPOSE run --rm api npx prisma db push || true

# 8. Start full application stack
echo "Starting all services (web, api, workers, nginx)..."
$DOCKER_COMPOSE up -d

# 9. Verify running containers
echo "=========================================================="
echo " TrueSendy Service Status"
echo "=========================================================="
$DOCKER_COMPOSE ps

echo ""
echo "Deployment completed successfully!"
echo "Web dashboard: http://YOUR_VPS_IP or https://yourdomain.com"
echo "API status: http://YOUR_VPS_IP/api"
