# AtelierOS Deploy

AtelierOS Deploy est une appliance atelier pour audit, tests, etiquettes et deploiement Windows par PXE.

Le produit actuel tourne principalement autour de:

- une interface React dans `saas/frontend`;
- une API FastAPI dans `saas/backend`;
- une appliance VM exposee sur le reseau atelier;
- un agent PXE/Linux pour audit rapide et tests atelier;
- des scripts WinPE pour deploiement Windows;
- une app Android WebView pour terminal code-barres Unitech EA520.

## Etat du produit

Fonctionnel aujourd'hui:

- dashboard reseau accessible depuis l'atelier;
- audit PXE avec retour machine;
- tests atelier web: clavier, pixels, USB, camera, micro, audio;
- generation et edition d'etiquettes Brother;
- import ISO/WIM/ESD avec progression;
- detection des editions Windows dans ISO/WIM/ESD;
- conversion serveur ISO/WIM/ESD vers WIM;
- checksum SHA-256 ISO/WIM/ESD;
- profils Unattend et profils de deploiement;
- kits USB atelier autonomes;
- sauvegarde/restauration appliance;
- app mobile Android WebView.

Encore a finaliser:

- assistant reseau automatique complet;
- creation WIM guidee de bout en bout;
- gestion versions/rollback images;
- telechargement automatique drivers constructeur;
- mode mobile inventaire/scanner plus pousse;
- effacement securise integre avec certificat;
- licence/activation et guide client final.

## Dossiers importants

| Dossier | Role | Etat |
| --- | --- | --- |
| `saas/` | Produit principal: frontend React + backend FastAPI | Actif |
| `mobile/aos-mobile-webview/` | APK Android pour Unitech EA520 | Actif simple |
| `webtests/` | Interface web de tests atelier PXE | A garder / integrer |
| `winpe/` | Scripts WinPE audit/deploiement/effacement | A garder |
| `modules/` et `boot/` | Fragments de menu iPXE | A garder |
| `server/` | Ancienne architecture MicroOS/Podman/Quadlet | Legacy utile |
| `server/control-api/` | Ancienne API locale de controle machines | A fusionner ou archiver |
| `webcontrol/`, `webpxetest/`, `webtech/` | Prototypes HTML autonomes | A trier |
| `wipe/` | Effacement securise et certificats | A integrer |
| `labels/` | Ancien prototype etiquettes | Reference historique |
| `docs/` | Documentation et roadmap anti-regression | Actif |
| `scripts/` | Deploiement, impression, Android, maintenance | Actif |

Voir aussi `docs/APPLICATIONS-INVENTAIRE.md`.

## Deploiement appliance actuelle

Depuis le poste de developpement:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-aos-vm.ps1 -Backend
```

Pour un deploiement frontend seulement:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-aos-vm.ps1
```

Verification rapide:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri http://192.168.1.57/
Invoke-WebRequest -UseBasicParsing -Uri http://192.168.1.57:8000/api/health
```

## Android EA520

Projet:

```text
mobile/aos-mobile-webview
```

APK generes:

```text
dist-mobile/AOS-Mobile-EA520-debug.apk
dist-mobile/AOS-Mobile-EA520-release.apk
```

Installation:

```powershell
.\scripts\install-aos-mobile-ea520.ps1
```

## Regle anti-regression

Chaque modification doit rester compatible avec:

- le dashboard actuel;
- le boot PXE;
- le retour audit;
- les etiquettes;
- le deploiement sur `192.168.1.57`;
- la roadmap dans `docs/ROADMAP-ANTI-REGRESSION.md`.

Avant commit important:

```powershell
npm run build
python -m py_compile .\saas\backend\modules\atelier_forge\__init__.py .\saas\backend\modules\atelier_forge\schemas.py
```

## Licences Windows

AtelierOS Deploy ne fournit ni ISO Windows ni licence Windows. Les ISO doivent venir de sources Microsoft officielles et les licences restent a gerer par l'atelier/client.

## Licence

Code sous licence MIT. Voir `LICENSE`.
