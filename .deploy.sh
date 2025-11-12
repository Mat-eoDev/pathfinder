#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$ROOT_DIR/PathFinderWeb"
ENV_FILE="$ROOT_DIR/.deploy.env"
SERVICE_NAME="pathfinder"

usage() {
  cat <<'USAGE'
Usage: ./.deploy.sh <setup|deploy|update|restart|status>

Commands:
  setup    Prépare entièrement le serveur (packages, services, nginx) puis déploie l'application.
  deploy   Synchronise le code, installe les dépendances et (ré)importe le schéma MySQL si nécessaire.
  update   Alias pour deploy (utile pour les mises à jour).
  restart  Redémarre uniquement le service Gunicorn + Nginx.
  status   Affiche l'état du service systemd et le statut Nginx.

Configuration:
  Créez un fichier .deploy.env à la racine contenant au minimum les variables suivantes :
    DEPLOY_HOST=xxx
    DEPLOY_USER=xxx
    DEPLOY_PORT=22
    DEPLOY_BASE_DIR=/opt/pathfinder
    DEPLOY_DOMAIN=dashboard.mondomaine.com
    PATHFINDER_SECRET_KEY=change-me
    PATHFINDER_MYSQL_HOST=localhost
    PATHFINDER_MYSQL_PORT=3306
    PATHFINDER_MYSQL_USER=pathfinder
    PATHFINDER_MYSQL_PASSWORD=***
    PATHFINDER_MYSQL_DATABASE=pathfinder

  (Optionnel)
    DEPLOY_APP_USER=pathfinder
    DEPLOY_BACKEND_PORT=8000

Prérequis locaux : ssh, rsync, scp, mysql (client).
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

COMMAND="$1"
shift || true

if [[ ! -f "$ENV_FILE" ]]; then
  echo ":: Fichier $ENV_FILE introuvable. Créez-le (voir usage)." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(
  DEPLOY_HOST
  DEPLOY_USER
  DEPLOY_BASE_DIR
  DEPLOY_DOMAIN
  PATHFINDER_SECRET_KEY
  PATHFINDER_MYSQL_HOST
  PATHFINDER_MYSQL_PORT
  PATHFINDER_MYSQL_USER
  PATHFINDER_MYSQL_PASSWORD
  PATHFINDER_MYSQL_DATABASE
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo ":: Variable $var absente de $ENV_FILE" >&2
    exit 1
  fi
done

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_APP_USER="${DEPLOY_APP_USER:-$DEPLOY_USER}"
DEPLOY_BACKEND_PORT="${DEPLOY_BACKEND_PORT:-8000}"
SSH_OPTS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
SSH_PREFIX=("${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}")
SSH_CMD=(ssh "${SSH_PREFIX[@]}")
SCP_CMD=(scp "${SSH_OPTS[@]}")
RSYNC_EXCLUDES=(
  --exclude=".git"
  --exclude="node_modules"
  --exclude="bin"
  --exclude="obj"
  --exclude="*.log"
  --exclude="*.pyc"
  --exclude="__pycache__"
  --exclude=".DS_Store"
  --exclude=".venv"
)

require_commands() {
  local missing=0
  for cmd in ssh scp rsync mysql; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo ":: Commande $cmd manquante sur la machine locale." >&2
      missing=1
    fi
  done
  if [[ $missing -eq 1 ]]; then
    exit 1
  fi
}

remote_exec() {
  "${SSH_CMD[@]}" "$@"
}

remote_sudo() {
  "${SSH_CMD[@]}" "sudo bash -c '$*'"
}

push_backend_env() {
  local tmp_file
  tmp_file="$(mktemp)"
  cat >"$tmp_file" <<EOF
PATHFINDER_SECRET_KEY=${PATHFINDER_SECRET_KEY}
PATHFINDER_MYSQL_HOST=${PATHFINDER_MYSQL_HOST}
PATHFINDER_MYSQL_PORT=${PATHFINDER_MYSQL_PORT}
PATHFINDER_MYSQL_USER=${PATHFINDER_MYSQL_USER}
PATHFINDER_MYSQL_PASSWORD=${PATHFINDER_MYSQL_PASSWORD}
PATHFINDER_MYSQL_DATABASE=${PATHFINDER_MYSQL_DATABASE}
EOF
  "${SCP_CMD[@]}" "$tmp_file" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/pathfinder-backend.env"
  remote_sudo "mkdir -p ${DEPLOY_BASE_DIR}"
  remote_sudo "mv /tmp/pathfinder-backend.env ${DEPLOY_BASE_DIR}/.backend.env && chown ${DEPLOY_APP_USER}:${DEPLOY_APP_USER} ${DEPLOY_BASE_DIR}/.backend.env"
  rm -f "$tmp_file"
}

sync_code() {
  echo ":: Synchronisation du code vers ${DEPLOY_HOST}:${DEPLOY_BASE_DIR}"
  remote_sudo "mkdir -p ${DEPLOY_BASE_DIR}"
  rsync -az --delete "${RSYNC_EXCLUDES[@]}" "$PROJECT_DIR/" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_BASE_DIR}/"
}

install_python_env() {
  remote_sudo "apt-get update"
  remote_sudo "apt-get install -y python3 python3-venv python3-pip"
  remote_sudo "test -d ${DEPLOY_BASE_DIR}/venv || sudo -u ${DEPLOY_APP_USER} python3 -m venv ${DEPLOY_BASE_DIR}/venv"
  remote_sudo "cd ${DEPLOY_BASE_DIR}/backend && sudo -u ${DEPLOY_APP_USER} ${DEPLOY_BASE_DIR}/venv/bin/pip install --upgrade pip"
  remote_sudo "cd ${DEPLOY_BASE_DIR}/backend && sudo -u ${DEPLOY_APP_USER} ${DEPLOY_BASE_DIR}/venv/bin/pip install -r requirements.txt"
}

setup_database() {
  echo ":: Vérification / création de la base de données"
  remote_exec "mysql -h ${PATHFINDER_MYSQL_HOST} -P ${PATHFINDER_MYSQL_PORT} -u ${PATHFINDER_MYSQL_USER} -p'${PATHFINDER_MYSQL_PASSWORD}' -e 'CREATE DATABASE IF NOT EXISTS ${PATHFINDER_MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"
  remote_exec "mysql -h ${PATHFINDER_MYSQL_HOST} -P ${PATHFINDER_MYSQL_PORT} -u ${PATHFINDER_MYSQL_USER} -p'${PATHFINDER_MYSQL_PASSWORD}' ${PATHFINDER_MYSQL_DATABASE} < ${DEPLOY_BASE_DIR}/database/schema.sql"
}

configure_systemd() {
  local service_file="/tmp/${SERVICE_NAME}.service"
  cat <<EOF >"$service_file"
[Unit]
Description=PathFinder Flask API
After=network.target

[Service]
Type=simple
User=${DEPLOY_APP_USER}
WorkingDirectory=${DEPLOY_BASE_DIR}/backend
EnvironmentFile=${DEPLOY_BASE_DIR}/.backend.env
ExecStart=${DEPLOY_BASE_DIR}/venv/bin/gunicorn --bind 127.0.0.1:${DEPLOY_BACKEND_PORT} app:app
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF
  "${SCP_CMD[@]}" "$service_file" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/${SERVICE_NAME}.service"
  remote_sudo "mv /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service"
  remote_sudo "systemctl daemon-reload"
  remote_sudo "systemctl enable ${SERVICE_NAME}.service"
  rm -f "$service_file"
}

configure_nginx() {
  local nginx_tmp="/tmp/${SERVICE_NAME}.nginx"
  cat <<EOF >"$nginx_tmp"
server {
    listen 80;
    server_name ${DEPLOY_DOMAIN};

    location /api/ {
        proxy_pass http://127.0.0.1:${DEPLOY_BACKEND_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root ${DEPLOY_BASE_DIR}/frontend;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  "${SCP_CMD[@]}" "$nginx_tmp" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/${SERVICE_NAME}.nginx"
  remote_sudo "mv /tmp/${SERVICE_NAME}.nginx /etc/nginx/sites-available/${SERVICE_NAME}.conf"
  remote_sudo "ln -sf /etc/nginx/sites-available/${SERVICE_NAME}.conf /etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
  remote_sudo "rm -f /etc/nginx/sites-enabled/default"
  remote_sudo "nginx -t"
  remote_sudo "systemctl restart nginx"
  rm -f "$nginx_tmp"
}

setup_server() {
  echo ":: Installation des prérequis serveur"
  remote_sudo "apt-get update"
  remote_sudo "apt-get install -y python3 python3-venv python3-pip git rsync nginx mysql-client ufw"

  # Création éventuelle de l'utilisateur applicatif
  if [[ "$DEPLOY_APP_USER" != "$DEPLOY_USER" ]]; then
    remote_sudo "id -u ${DEPLOY_APP_USER} >/dev/null 2>&1 || useradd -m -s /bin/bash ${DEPLOY_APP_USER}"
  fi

  remote_sudo "mkdir -p ${DEPLOY_BASE_DIR}"
  remote_sudo "chown -R ${DEPLOY_APP_USER}:${DEPLOY_APP_USER} ${DEPLOY_BASE_DIR}"

  sync_code
  push_backend_env
  install_python_env
  setup_database
  configure_systemd
  configure_nginx
  remote_sudo "systemctl restart ${SERVICE_NAME}.service"

  echo ":: Setup terminé. Pensez à lancer certbot si HTTPS nécessaire."
}

deploy() {
  sync_code
  push_backend_env
  install_python_env
  setup_database
  remote_sudo "systemctl restart ${SERVICE_NAME}.service"
  echo ":: Déploiement terminé."
}

restart_services() {
  remote_sudo "systemctl restart ${SERVICE_NAME}.service"
  remote_sudo "systemctl restart nginx"
}

check_status() {
  remote_sudo "systemctl status ${SERVICE_NAME}.service --no-pager"
  remote_sudo "systemctl status nginx --no-pager"
}

require_commands

case "$COMMAND" in
  setup)
    setup_server
    ;;
  deploy|update)
    deploy
    ;;
  restart)
    restart_services
    ;;
  status)
    check_status
    ;;
  *)
    usage
    exit 1
    ;;
esac

