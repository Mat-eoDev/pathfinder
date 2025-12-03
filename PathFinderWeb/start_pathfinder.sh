#!/bin/bash

# Script de lancement PathFinder Web Dashboard

echo "🎯 PathFinder Web Dashboard - Démarrage"
echo "========================================"
echo ""

# Vérifier MySQL
echo "🗄️  Vérification de MySQL..."
if ! pgrep -x "mysqld" > /dev/null; then
    echo "⚠️  MySQL n'est pas démarré. Tentative de démarrage..."
    brew services start mysql 2>/dev/null || mysql.server start 2>/dev/null
    sleep 3
fi

if pgrep -x "mysqld" > /dev/null; then
    echo "✅ MySQL est actif"
else
    echo "❌ MySQL n'est pas démarré. Lance-le manuellement:"
    echo "   brew services start mysql"
    echo "   ou: mysql.server start"
    exit 1
fi

# Vérifier la base de données
echo ""
echo "🗄️  Vérification de la base de données..."
if mysql -u root -e "USE pathfinder;" 2>/dev/null; then
    echo "✅ Base de données 'pathfinder' trouvée"
else
    echo "⚠️  Base de données non trouvée. Création..."
    mysql -u root < database/schema.sql
    if [ $? -eq 0 ]; then
        echo "✅ Base de données créée avec succès"
    else
        echo "❌ Erreur lors de la création de la base de données"
        echo "   Lance manuellement: mysql -u root < database/schema.sql"
        exit 1
    fi
fi

# Vérifier les dépendances Python
echo ""
echo "🐍 Vérification des dépendances Python..."
cd backend

if ! pip3 show flask &> /dev/null; then
    echo "⚠️  Dépendances manquantes. Installation..."
    pip3 install -r c
fi

echo "✅ Dépendances Python OK"

# Lancer le serveur Flask
echo ""
echo "🚀 Lancement du serveur Flask..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Dashboard Web: http://localhost:5000"
echo "🔑 Compte test: admin@pathfinder.local / admin123"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Pour arrêter: Ctrl+C"
echo ""

python3 app.py

