# Verifier que la bonne interface est installee

## 1. Depuis le navigateur

Ouvrir:

```text
http://IP_DU_SERVEUR/
```

La bonne interface doit afficher:

- sidebar avec Dashboard, Deploiements, Audit, Boot UEFI, Images WIM, Pilotes, Outils, Guide, Logs, Parametres;
- mode Debutant / Expert;
- recherche globale;
- assistant AtelierOS;
- Dashboard operationnel;
- module Images WIM moderne;
- module Audit avec etiquettes;
- Parametres avec regeneration reseau et mode DHCP.

## 2. Depuis le serveur

```bash
systemctl status aos-dashboard
find /opt/aos-dashboard -maxdepth 2 -type f | sort | head -30
curl -fsS http://127.0.0.1/ >/dev/null && echo OK
```

Fichiers obligatoires:

```text
/opt/aos-dashboard/index.html
/opt/aos-dashboard/spa_server.py
/opt/aos-dashboard/assets/index-*.js
/opt/aos-dashboard/assets/index-*.css
```

## 3. Cause la plus frequente

L'ancien installateur installe le socle PXE mais ne force pas toujours le build React moderne.

Solution:

```bash
cd atelier-forge
sudo bash scripts/repair-dashboard-ui.sh
```

## 4. Verification Git

```bash
git pull
git log -1 --oneline
```

Le depot doit etre a jour avant de reparer l'interface.
