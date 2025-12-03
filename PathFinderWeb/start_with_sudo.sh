#!/bin/bash
# PathFinder - Lancement avec privilèges sudo (pour pentest complet)

cd "$(dirname "$0")/backend"

echo "🎯 PathFinder Web Dashboard - Mode Pentest Complet"
echo "========================================================"
echo ""
echo "⚠️  Mode sudo activé pour:"
echo "  - Packet Sniffer (tcpdump)"
echo "  - MAC Spoofing (ifconfig)"
echo "  - Toutes les fonctions pentest"
echo ""
echo "🔐 Mot de passe admin macOS requis..."
echo ""

# Lancer avec sudo
sudo python3 app.py

