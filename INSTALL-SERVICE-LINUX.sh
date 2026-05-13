#!/bin/bash
set -e

echo "============================================================"
echo "  QualiTrace Backend - Instalare Serviciu Linux"
echo "============================================================"
echo ""

# Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "[EROARE] Node.js nu este instalat!"
    echo "Instaleaza cu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi
echo "[OK] Node.js: $(node --version)"

# Instaleaza PM2
echo ""
echo "[1/4] Instalare PM2..."
sudo npm install -g pm2
echo "[OK] PM2 instalat"

# Instaleaza dependintele
echo ""
echo "[2/4] Instalare dependinte backend..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"
npm install --omit=dev
echo "[OK] Dependinte instalate"

# Creeaza folderul logs
mkdir -p logs

# Creeaza .env daca nu exista
if [ ! -f ".env" ]; then
    echo "[INFO] Creare fisier .env..."
    cp .env.example .env
    echo "[ATENTIE] Editeaza backend/.env si schimba JWT_SECRET!"
fi

# Creeaza folderul pentru baza de date
mkdir -p data

# Porneste cu PM2
echo ""
echo "[3/4] Pornire serviciu..."
pm2 start ecosystem.config.js
pm2 save
echo "[OK] Serviciu pornit"

# Auto-start la boot
echo ""
echo "[4/4] Configurare pornire automata la boot..."
pm2 startup systemd -u "$USER" --hp "$HOME"
# Ruleaza comanda afisata de PM2 (de obicei cere sudo)
STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>&1 | grep "sudo")
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
fi
pm2 save

echo ""
echo "============================================================"
echo "  INSTALARE COMPLETA!"
echo "  Backend ruleaza pe portul 3001"
echo ""
echo "  Comenzi utile:"
echo "    pm2 status                       - stare serviciu"
echo "    pm2 logs qualitrace-backend      - loguri live"
echo "    pm2 restart qualitrace-backend   - restart"
echo "    sudo systemctl status pm2-$USER  - status serviciu system"
echo "============================================================"
