# Installation appliance moderne AtelierOS

Cette procedure garantit que le serveur affiche la nouvelle interface React AtelierOS et pas l'ancienne interface/prototype.

## Installation recommandee

Sur le serveur Linux:

```bash
git clone https://github.com/saisai591/atelier-forge.git
cd atelier-forge
sudo bash scripts/install-atelieros-appliance.sh
```

## Reparer seulement l'interface

Si le PXE/SMB existe deja mais que l'interface est basique ou ancienne:

```bash
cd atelier-forge
sudo bash scripts/repair-dashboard-ui.sh
```

Le script:

- compile `saas/frontend`;
- copie le build dans `/opt/aos-dashboard`;
- restaure `/opt/aos-dashboard/spa_server.py`;
- repare le service `aos-dashboard`;
- verifie que HTTP repond.

## Verification attendue

```bash
systemctl is-active aos-dashboard
ls -la /opt/aos-dashboard
ls -la /opt/aos-dashboard/assets
curl -I http://127.0.0.1/
```

Resultat attendu:

- `aos-dashboard` actif;
- `/opt/aos-dashboard/index.html` existe;
- `/opt/aos-dashboard/assets/index-*.js` existe;
- `/opt/aos-dashboard/spa_server.py` existe;
- `curl` retourne HTTP 200.

## Symptomes d'une mauvaise installation

- page tres basique;
- anciennes pages HTML seules;
- page blanche;
- service `aos-dashboard` en redemarrage permanent;
- erreur `can't open file '/opt/aos-dashboard/spa_server.py'`;
- dossier `/opt/aos-dashboard/assets` absent.

Correction:

```bash
sudo bash scripts/repair-dashboard-ui.sh
```
