# 🚀 Guide de Déploiement PathFinder sur Hostinger

## ⚠️ Ce qui est Possible et Impossible

### ✅ **POSSIBLE sur Hostinger :**
1. **Frontend Web** (HTML/CSS/JavaScript) - ✅ Oui
2. **Base de données MySQL** - ✅ Oui (inclus)
3. **Backend Flask** - ⚠️ Possible uniquement avec plan **Business** ou **Cloud**

### ❌ **IMPOSSIBLE sur Hostinger :**
1. **Application MAUI** - ❌ Application desktop, ne peut pas être hébergée
   - Solution : Les utilisateurs téléchargent l'app depuis votre site
2. **Scans réseau** - ❌ Nécessitent des permissions système (ping, socket raw, etc.)
   - Les hébergeurs web bloquent ces fonctionnalités pour sécurité
3. **Pentest Engine** - ❌ Nécessite subprocess, socket raw, etc.

---

## 📋 Plan d'Action

### Option 1 : Hébergement Web Basique (Recommandé pour début)

**Ce que vous pouvez faire :**
- ✅ Héberger le dashboard web (frontend)
- ✅ Héberger l'API Flask (sur plan Business/Cloud uniquement)
- ✅ Base de données MySQL
- ❌ Les scans réseau doivent être faits depuis l'app MAUI locale

**Architecture :**
```
[Utilisateur] 
  ├─→ App MAUI (local) → Scans réseau
  └─→ Site Web (Hostinger) → Dashboard + API pour stocker résultats
```

### Option 2 : VPS (Meilleur pour fonctionnalités complètes)

Si vous voulez les scans réseau depuis le serveur, il faut un **VPS** :
- DigitalOcean, Linode, Vultr, OVH
- Contrôle total du serveur
- Peut exécuter les scans réseau

---

## 🔧 Configuration pour Hostinger

### 1. Préparer le Backend Flask

#### Créer `wsgi.py` pour production :

```python
# wsgi.py
import sys
import os

# Ajouter le chemin du backend
sys.path.insert(0, os.path.dirname(__file__))

from app import app as application

if __name__ == "__main__":
    application.run()
```

#### Modifier `app.py` pour production :

```python
# À la fin de app.py, remplacer :
if __name__ == '__main__':
    # Ne pas utiliser en production
    # app.run(debug=True, host='0.0.0.0', port=5001)
    pass
```

### 2. Configurer MySQL pour Hostinger

Les identifiants MySQL Hostinger sont disponibles dans le panneau hPanel :

```python
# Utiliser variables d'environnement
app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST', 'localhost')  # Ou l'IP fournie par Hostinger
app.config['MYSQL_PORT'] = int(os.getenv('MYSQL_PORT', '3306'))  # Port MySQL standard
app.config['MYSQL_USER'] = os.getenv('MYSQL_USER', 'u123456789_username')
app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD', 'votre_mot_de_passe')
app.config['MYSQL_DATABASE'] = os.getenv('MYSQL_DATABASE', 'u123456789_pathfinder')
# Supprimer MYSQL_UNIX_SOCKET (pas disponible sur Hostinger)
```

### 3. Désactiver les Fonctionnalités Système

Dans `app.py`, commenter ou désactiver :
- ✅ `pentest_engine` (impossible sur hébergement web)
- ✅ Les scans réseau depuis le serveur
- ✅ Les fonctions nécessitant subprocess

**Garder actif :**
- ✅ Authentification
- ✅ API pour recevoir les scans depuis l'app MAUI
- ✅ Dashboard web
- ✅ Stockage en base de données

### 4. Créer `.htaccess` pour Flask (si nécessaire)

```apache
# .htaccess pour Apache
RewriteEngine On
RewriteRule ^(.*)$ wsgi.py/$1 [QSA,L]
```

### 5. Fichiers à Uploader sur Hostinger

```
PathFinderWeb/
├── backend/
│   ├── app.py (modifié)
│   ├── wsgi.py (nouveau)
│   ├── security_recommendations.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── *.css
│   ├── *.js
│   └── favicon.svg
└── database/
    └── schema.sql
```

---

## 📦 Étapes de Déploiement

### Étape 1 : Préparer les Fichiers Locaux

1. **Créer un dossier de déploiement** :
```bash
mkdir pathfinder_deploy
cd pathfinder_deploy
```

2. **Copier les fichiers nécessaires** :
```bash
cp -r PathFinderWeb/backend backend
cp -r PathFinderWeb/frontend frontend
cp -r PathFinderWeb/database database
```

3. **Modifier la configuration MySQL** dans `backend/app.py`

### Étape 2 : Uploader sur Hostinger

1. **Via FTP (FileZilla)** ou **File Manager** dans hPanel
2. **Structure recommandée** :
```
public_html/
├── api/          → Backend Flask (backend/)
├── static/       → Frontend (frontend/)
└── database/     → Scripts SQL
```

### Étape 3 : Configurer la Base de Données

1. **Créer la base MySQL** via phpMyAdmin dans hPanel
2. **Importer le schéma** :
```sql
-- Exécuter database/schema.sql via phpMyAdmin
```

### Étape 4 : Installer les Dépendances Python

**Si Hostinger supporte Python (plan Business/Cloud)** :
1. **Via SSH** :
```bash
cd ~/domains/votre-domaine.com/public_html/api
pip3 install -r requirements.txt --user
```

2. **Ou utiliser Python venv** :
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Étape 5 : Configurer le Serveur Web

**Pour Apache (Hostinger)** :
- Configurer WSGI via `.htaccess`
- Ou utiliser Passenger (si disponible)

**Pour Nginx** (si VPS) :
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Étape 6 : Variables d'Environnement

Dans hPanel ou `.env` :
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=u123456789_user
MYSQL_PASSWORD=votre_mot_de_passe
MYSQL_DATABASE=u123456789_pathfinder
SECRET_KEY=votre_secret_key_unique
```

---

## 🔒 Sécurité pour Production

### Modifications Requises :

1. **Désactiver Debug Mode** :
```python
app.run(debug=False)  # JAMAIS True en production
```

2. **Changer SECRET_KEY** :
```python
SECRET_KEY = os.getenv('SECRET_KEY', 'GENERER-UNE-CLE-ALEATOIRE-LONGUE')
```

3. **HTTPS Obligatoire** :
- Activer SSL dans hPanel (gratuit avec Let's Encrypt)
- Forcer HTTPS dans l'application

4. **Limiter CORS** :
```python
CORS(app, origins=['https://votre-domaine.com'])
```

---

## 🎯 Fonctionnalités Disponibles après Déploiement

### ✅ **Fonctionnel :**
- ✅ Authentification utilisateurs
- ✅ Dashboard web avec graphiques
- ✅ API pour recevoir les scans depuis l'app MAUI
- ✅ Stockage des résultats en MySQL
- ✅ Visualisation de l'historique

### ❌ **Non Fonctionnel (nécessite VPS) :**
- ❌ Scans réseau depuis le serveur
- ❌ Pentest engine
- ❌ Network mapping serveur-side
- ❌ Packet capture

**Solution** : Les utilisateurs utilisent l'app MAUI pour scanner, puis envoient les résultats au serveur.

---

## 📱 Application MAUI

L'app MAUI ne peut **PAS** être hébergée. Solution :

1. **Compiler les builds** :
   - Windows : `.exe`
   - macOS : `.dmg`
   - Android : `.apk`
   - iOS : `.ipa` (via App Store)

2. **Les héberger pour téléchargement** :
   - Dossier `PathFinderWeb/downloads/` sur votre site
   - Lien de téléchargement sur le site

3. **Configurer l'URL API dans l'app** :
```csharp
// Dans MainPage.xaml.cs
private const string API_URL = "https://votre-domaine.com/api";
```

---

## 🚨 Limitations Hostinger

### Plans Web Standard :
- ❌ Pas de support Python/Flask
- ✅ Seulement PHP, HTML, MySQL

### Plans Business/Cloud :
- ✅ Support Python possible
- ✅ MySQL inclus
- ⚠️ Restrictions sécurité (pas de subprocess, socket raw)

### VPS (Recommandé pour fonctionnalités complètes) :
- ✅ Contrôle total
- ✅ Toutes les fonctionnalités
- 💰 Plus cher (~5-10€/mois)

---

## 🔄 Alternatives à Hostinger

Si Hostinger ne suffit pas :

1. **DigitalOcean Droplet** (~5$/mois)
   - VPS complet
   - Toutes fonctionnalités

2. **Railway.app** (PaaS)
   - Déploiement Flask facile
   - MySQL inclus

3. **Render.com** (PaaS)
   - Gratuit pour commencer
   - Support Flask

4. **Heroku** (PaaS)
   - Gratuit avec limitations
   - Support Flask

---

## ✅ Checklist de Déploiement

- [ ] Créer base MySQL sur Hostinger
- [ ] Importer schéma SQL
- [ ] Modifier configuration MySQL dans `app.py`
- [ ] Désactiver fonctionnalités système (pentest_engine)
- [ ] Créer `wsgi.py`
- [ ] Uploader fichiers via FTP
- [ ] Installer dépendances Python (si supporté)
- [ ] Configurer SSL/HTTPS
- [ ] Tester connexion API
- [ ] Configurer app MAUI avec nouvelle URL API
- [ ] Uploader builds MAUI pour téléchargement

---

## 🆘 Support

Si vous rencontrez des problèmes :
1. Vérifier les logs d'erreur dans hPanel
2. Tester l'API : `curl https://votre-domaine.com/api/health`
3. Vérifier les permissions fichiers
4. Contacter support Hostinger pour Python/Flask

