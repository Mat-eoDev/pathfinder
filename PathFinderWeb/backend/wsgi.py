#!/usr/bin/env python3
"""
WSGI Entry Point pour Production (Hostinger, Apache, etc.)
"""
import sys
import os

# Ajouter le chemin du répertoire backend au PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Importer l'application Flask
from app import app as application

# Application est l'objet WSGI utilisé par le serveur web
if __name__ == "__main__":
    # En production, ne jamais utiliser app.run()
    # Le serveur web (Apache/Nginx) gère le démarrage
    print("WSGI Entry Point - Utilisé par le serveur web en production")
    print(f"Python Path: {sys.path}")

