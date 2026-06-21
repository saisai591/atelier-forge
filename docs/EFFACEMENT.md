# Effacement sécurisé & certificats signés (type Blancco)

Avant de revendre une machine récupérée, il faut **effacer de façon prouvée** les
données de l'ancien propriétaire (obligation **RGPD**). Atelier Forge fournit un système
d'effacement conforme à la norme **NIST SP 800-88 Rev.1** et un **certificat signé
numériquement** (infalsifiable et vérifiable).

## ⚠️ Honnêteté sur la comparaison avec Blancco

| | Atelier Forge | Blancco (commercial) |
|---|---|---|
| Effacement matériel (Secure Erase / Sanitize / Crypto) | ✅ | ✅ |
| Conforme NIST 800-88 | ✅ | ✅ |
| Certificat **signé numériquement** + vérifiable | ✅ | ✅ |
| **Accréditation par un organisme tiers** (ADISA, Common Criteria…) | ❌ | ✅ |
| Coût | gratuit / open-source | licence payante |

➡️ Le certificat Atelier Forge est **auto-émis** par votre atelier : il est techniquement
solide, signé et infalsifiable, suffisant pour la **revente courante** (particuliers,
TPE) et la traçabilité RGPD. Pour des marchés **B2B/publics** exigeant une
accréditation tierce, un outil commercial accrédité reste nécessaire.

## Méthodes d'effacement (de la plus forte à la plus simple)

`secure-erase.sh` choisit automatiquement (`ERASE_METHOD="auto"`) la meilleure
méthode supportée par chaque disque :

1. **NVMe Sanitize / Format (SES)** — SSD NVMe. Purge au niveau du contrôleur.
2. **ATA Secure Erase (enhanced)** — SSD/HDD SATA. Commande firmware du disque.
3. **Crypto Erase** (`ERASE_METHOD="crypto"`) — destruction/renouvellement de la
   **clé de chiffrement** du disque (NVMe SES=2, SED Opal). Quasi instantané.
4. **Réécriture** (repli) — `nwipe`/`shred`/`dd`, 1 passe de zéros (méthode *Clear*),
   pour les disques ne supportant pas l'effacement matériel.

> Pour les SSD, l'effacement **matériel** est préférable à la réécriture (l'usure
> et le sur-provisionnement rendent la réécriture incomplète). Atelier Forge le privilégie.

## Mode d'emploi

### 1. Configurer (sur le serveur)

Dans `server/config.env` :

```ini
ERASE_METHOD="auto"
COMPANY_NAME="Mon Atelier"
COMPANY_CONTACT="contact@exemple.fr"
SIGN_CERTS="yes"      # signature cryptographique des certificats
AUTO_SIGN="yes"       # signature automatique dès qu'un certificat arrive
```

Puis `sudo ./server/install.sh` (génère la paire de clés et publie la clé
publique sur `http://SERVEUR:1950/forge-public-key.pem`).

### 2. Effacer une machine

**Méthode recommandée (effacement matériel) — via SystemRescue :**

1. Menu PXE → **« Effacement matériel des disques »** (démarre SystemRescue).
2. Dans SystemRescue, montez le partage et lancez le script :
   ```bash
   mount -t cifs //SERVEUR/deploy /mnt/deploy -o user=pxe,pass=pxe
   bash /mnt/deploy/wipe/secure-erase.sh
   ```
3. Le script liste les disques (**protège** automatiquement le disque système du
   live), demande lequel effacer, exige la confirmation `EFFACER`, efface, puis
   écrit le **certificat** dans `/mnt/deploy/certificates/`.

> Option avancée : tester sans rien effacer avec `--dry-run`, ou cibler un disque
> avec `--device sdb`, ou forcer une méthode avec `--method crypto`.

**Repli rapide — via WinPE :** menu PXE → WinPE → **[4] Effacement sécurisé**
(utilise `diskpart clean all`, réécriture de zéros — surtout pour disques durs).

### 3. Signature automatique du certificat

Avec `AUTO_SIGN="yes"`, dès qu'un certificat `.json` arrive dans le dossier des
certificats, le serveur le **signe** automatiquement (unité systemd
`forge-sign.path`) et génère :

- `*.signed.json` — certificat signé (contient `signature` + `signature_token`) ;
- `*.signed.html` — certificat **imprimable** (avec QR code si `qrencode` présent) ;
- `*.signed.pdf` — si `wkhtmltopdf` est installé.

La **clé privée ne quitte jamais le serveur** ; elle n'est ni sur le partage ni
dans WinPE.

### 4. Vérifier un certificat (vous ou un acheteur)

N'importe qui peut vérifier l'authenticité avec la **clé publique** :

```bash
# Récupérer la clé publique de l'atelier :
curl -O http://SERVEUR:1950/forge-public-key.pem
# Vérifier :
./wipe/verify-certificate.sh certificat.signed.json forge-public-key.pem
```

- Certificat authentique et intact → **CERTIFICAT VALIDE [OK]**
- Document modifié (même un seul caractère) → **CERTIFICAT INVALIDE [X]**

C'est ce qui rend le certificat **infalsifiable** : modifier le n° de série, la
date ou le résultat casse la signature.

## Workflow conseillé en atelier

```
1. Audit matériel        (menu WinPE [2])   -> inventaire + étiquette
2. Effacement sécurisé   (menu PXE Linux)   -> certificat signé
3. Déploiement Windows   (menu WinPE [1])   -> machine prête à revendre
```

Conservez le certificat `.signed.pdf` (ou son token) avec le dossier de la
machine : c'est votre preuve d'effacement RGPD.

## Détails techniques de la signature

- Paire de clés **RSA 3072 bits** générée à l'installation (`KEYS_DIR`,
  permissions `600` sur la clé privée).
- La signature porte sur une **chaîne canonique** déterministe :
  `certificat_id | n° série | modèle | méthode | résultat | date_fin`,
  signée en **SHA-256 / RSA** (`openssl dgst`).
- Le **token** affiché est un condensé (SHA-256 tronqué) de la signature, pratique
  pour une référence courte / un QR code.
- Vérification : `openssl dgst -verify` avec la clé publique. Aucune dépendance à
  `jq` (compatible MicroOS immuable).
