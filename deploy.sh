#!/usr/bin/env bash
# ==============================================================
#  TerraFlow AWLR — Script Update Deployment
#  Jalankan: sudo /var/www/terraflow/deploy.sh
# ==============================================================
set -euo pipefail

APP_DIR=/var/www/terraflow
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "==> [1/5] Menarik perubahan terbaru dari repository"
cd "$APP_DIR"
git pull --ff-only

echo "==> [2/5] Install dependensi backend"
cd "$BACKEND_DIR"
npm install --omit=dev

echo "==> [3/5] Build frontend (Vite)"
cd "$FRONTEND_DIR"
npm install
npm run build

echo "==> [4/5] Menjalankan migrasi database"
cd "$BACKEND_DIR"
npm run migrate

echo "==> [5/5] Restart service & reload nginx"
chown -R terraflow:terraflow "$APP_DIR"
systemctl restart terraflow
systemctl restart terraflow-mux
systemctl reload nginx

echo "==> Selesai. Status service:"
systemctl is-active terraflow
systemctl is-active terraflow-mux
systemctl is-active nginx
