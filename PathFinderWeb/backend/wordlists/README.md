# 📚 PathFinder - Wordlists pour Hash Cracking

## Wordlists Disponibles

### 1. `common_passwords.txt` (500 passwords)
✅ **Inclus dans le repo**
- Top 500 mots de passe les plus courants
- Idéal pour tests rapides (<1 seconde)
- Inclut : admin123, password123, root123, etc.

### 2. `rockyou.txt` (14,344,391 passwords) 
⚠️ **À télécharger** (133 MB - non inclus dans Git)
- La wordlist de référence en pentest
- Provient de la fuite RockYou (2009)
- Couvre 99% des mots de passe courants

**Téléchargement automatique** :
```bash
cd PathFinderWeb/backend/wordlists
curl -L -o rockyou.txt https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt
```

**Vérification** :
```bash
wc -l rockyou.txt
# Doit afficher: 14344391 rockyou.txt
```

---

## Utilisation dans PathFinder

### Mode Pentest (`http://localhost:5001/#admin`)

1. Onglet **Outils** → Hash Cracker Pro
2. Sélectionner wordlist :
   - **Common (500)** : Tests rapides (< 1s)
   - **Top 10k** : Premiers 10,000 de rockyou (< 10s)
   - **RockYou (14M)** : Scan complet (10s - 5min)
3. Ajuster "Max tentatives" (défaut : 100,000)

### Performances Attendues

| Wordlist | Taille | Durée Moyenne | Cracking Rate |
|----------|--------|---------------|---------------|
| Common | 500 | < 1s | ~500 hash/s |
| Top 10k | 10,000 | 5-10s | ~2,000 hash/s |
| RockYou (100k) | 100,000 | 30s - 1min | ~3,000 hash/s |
| RockYou (1M) | 1,000,000 | 5-10min | ~3,000 hash/s |
| RockYou (14M) | 14,344,391 | 1-2h | ~3,000 hash/s |

⚠️ **Note** : Durée varie selon :
- Position du mot de passe dans la liste
- Type de hash (SHA256 plus lent que MD5)
- Puissance CPU

---

## Wordlists Additionnelles (Optionnel)

### SecLists (Collection complète)
```bash
git clone https://github.com/danielmiessler/SecLists.git
cp SecLists/Passwords/Common-Credentials/10-million-password-list-top-1000000.txt ./top1m.txt
```

### Custom Wordlists
Créer vos propres wordlists :
```bash
# Mots de passe spécifiques à votre organisation
echo "company2024" >> custom.txt
echo "Company@123" >> custom.txt
```

---

## Exemples de Hash à Tester

### Hashes Faibles (seront crackés)
```
MD5:
- 5f4dcc3b5aa765d61d8327deb882cf99 → "password"
- e10adc3949ba59abbe56e057f20f883e → "123456"

SHA256:
- 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9 → "admin123"
- ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae → "test123"
```

### Hashes Forts (résisteront)
```
SHA256:
- 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918 → "admin" (trouvé rapidement)
- Généré avec mot de passe aléatoire 16+ caractères → non trouvable
```

---

## Génération de Hashes pour Tests

```python
import hashlib

# Créer hash pour test
password = "admin123"
hash_sha256 = hashlib.sha256(password.encode()).hexdigest()
print(f"SHA256({password}) = {hash_sha256}")
```

Ou en ligne de commande :
```bash
echo -n "admin123" | shasum -a 256
# 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
```

---

## Sécurité et Éthique

⚠️ **Ces wordlists sont pour** :
- Tests sur vos propres systèmes
- Audits de sécurité autorisés
- Formation en cybersécurité
- Démonstrations académiques

❌ **NE PAS UTILISER pour** :
- Cracker des hashes non-autorisés
- Accès non-légitimes
- Activités illégales

---

## Alternatives Professionnelles

### Hashcat (GPU)
```bash
# Cracking GPU (10-100x plus rapide)
hashcat -m 1000 -a 0 hash.txt rockyou.txt
```

### John the Ripper
```bash
john --wordlist=rockyou.txt --format=raw-sha256 hash.txt
```

---

🎯 **PathFinder Hash Cracker - Powered by RockYou**

