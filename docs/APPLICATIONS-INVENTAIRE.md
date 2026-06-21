# Inventaire des applications et prototypes

Ce document separe les briques actives, les prototypes utiles et les dossiers legacy.

## Actif produit

### `saas/frontend`

- Type: application React/Vite.
- Role: interface principale AtelierOS Deploy.
- Etat: actif, deployee sur l'appliance.
- A faire:
  - continuer mode debutant/expert;
  - simplifier dashboard;
  - finaliser Image WIM;
  - finaliser etiquettes Brother;
  - ajouter licence/activation.

### `saas/backend`

- Type: API FastAPI.
- Role: API principale: PXE, audit, WIM, drivers, Unattend, sauvegardes, USB kits.
- Etat: actif, deployee sur l'appliance.
- A faire:
  - durcir les taches longues WIM avec progression fine;
  - ajouter gestion versions/rollback images;
  - preparer activation/licence;
  - exposer API mobile inventaire.

### `mobile/aos-mobile-webview`

- Type: APK Android WebView.
- Role: terminal mobile EA520 / scanner code-barres.
- Etat: fonctionnel mais simple.
- APK connus:
  - `dist-mobile/AOS-Mobile-EA520-debug.apk`;
  - `dist-mobile/AOS-Mobile-EA520-release.apk`.
- A faire:
  - ecran scanner/inventaire natif ou web dedie;
  - scan QR/code-barres vers fiche audit;
  - action imprimer etiquette depuis mobile;
  - configuration serveur par QR code;
  - signature release client stable.

### `webtests`

- Type: application HTML/CSS/JS statique.
- Role: tests atelier: clavier, pixels, USB, camera, micro, audio.
- Etat: utile, base PXE graphique.
- A faire:
  - garantir demarrage automatique depuis audit rapide graphique;
  - retour fiable vers dashboard Audit;
  - mode plein ecran adapte tablette/PC;
  - integration visuelle avec AtelierOS.

### `winpe`

- Type: scripts Windows PE.
- Role: audit/deploiement Windows, unattend, wipe.
- Etat: important, a garder.
- A faire:
  - solidifier build WinPE;
  - afficher progression deploiement;
  - remontee logs temps reel;
  - injection drivers depuis bibliotheque serveur.

### `modules` et `boot`

- Type: fragments iPXE.
- Role: menu PXE modulaire.
- Etat: utile, actif pour le boot.
- A faire:
  - harmoniser les noms AtelierOS;
  - supprimer anciens labels AOS Deploy V5 si necessaire;
  - documenter chaque entree.

## Legacy utile / a fusionner

### `server`

- Type: ancienne stack MicroOS/Podman/Quadlet.
- Role historique: dnsmasq, nginx, samba, cups, installateur MicroOS.
- Etat: legacy utile, pas la source principale de l'appliance actuelle.
- Decision:
  - garder en reference technique;
  - ne pas developper en priorite;
  - extraire les idees utiles vers `saas/backend` et scripts de deploiement VM.

### `server/control-api`

- Type: API FastAPI locale ancienne.
- Role: heartbeat machines, commandes, logs PXE, preview etiquettes.
- Etat: prototype a fusionner.
- Recouvrement actuel:
  - commandes machines deja presentes dans `atelier_forge`;
  - audits deja dans backend principal;
  - etiquettes gerees par frontend principal.
- Decision:
  - ne pas deployer comme deuxieme API;
  - fusionner uniquement les bonnes idees: endpoints commandes, logs PXE, preview label si manquant;
  - archiver ensuite.

### `webcontrol`

- Type: dashboard HTML autonome.
- Role: ancien tableau de bord.
- Etat: prototype remplace par React.
- Decision:
  - reference visuelle/fonctionnelle uniquement;
  - ne pas maintenir comme produit.

### `webpxetest`

- Type: page HTML autonome.
- Role: ancien test PXE.
- Etat: prototype.
- Decision:
  - comparer avec `webtests`;
  - garder les fonctions manquantes puis archiver.

### `webtech`

- Type: page HTML autonome.
- Role: interface technicien ancienne.
- Etat: prototype.
- Decision:
  - extraire les idees utiles vers React;
  - ne pas maintenir separement.

### `labels`

- Type: scripts/HTML etiquettes legacy.
- Role: generation etiquette historique.
- Etat: remplace par editeur React, mais reference utile.
- Decision:
  - garder temporairement;
  - supprimer quand l'impression Brother est stabilisee.

### `wipe`

- Type: scripts shell effacement securise + certificats.
- Role: effacement NIST/RGPD et certificat.
- Etat: fonctionnalite forte non encore produitisee dans l'interface.
- Decision:
  - a integrer dans onglet Outils ou Audit;
  - ajouter workflow: selection disque, confirmation, progression, certificat PDF/HTML, signature, verification.

## Dossiers techniques

### `docs`

- Documentation, guide client, roadmap anti-regression.
- Etat: actif.
- A faire:
  - maintenir `ROADMAP-ANTI-REGRESSION.md`;
  - creer guide final client;
  - ajouter FAQ produit.

### `scripts`

- Scripts deploiement VM, Brother, Android, GitHub, tests.
- Etat: actif.
- A faire:
  - separer scripts de production et scripts de debug;
  - ajouter un script `aos-healthcheck.ps1` unique;
  - documenter les scripts utiles client.

### `tests`

- Tests anti-regression shell historiques.
- Etat: a moderniser.
- A faire:
  - ajouter tests API pour endpoints critiques;
  - ajouter smoke test frontend;
  - ajouter test de build APK.

## Decisions recommandees

1. Ne pas developper `server/control-api` separement: fusionner dans `saas/backend`.
2. Ne pas maintenir plusieurs dashboards HTML: garder React comme interface unique.
3. Garder `webtests` comme brique PXE graphique mais l'habiller et le connecter au backend.
4. Faire de `mobile/aos-mobile-webview` une vraie app atelier mobile, centree scanner/inventaire.
5. Integrer `wipe` dans l'interface plus tard: c'est une fonctionnalite commerciale forte.
6. Nettoyer les noms: remplacer progressivement `Atelier Forge` et `AOS Deploy V5` par `AtelierOS Deploy`, sauf historique.

## Prochaines actions conseillees

1. Ajouter dans le dashboard un onglet mobile/inventaire EA520.
2. Fusionner les bonnes idees de `server/control-api` vers `atelier_forge`.
3. Lier `webtests` au backend actuel avec endpoint de retour test robuste.
4. Ajouter un module `Effacement securise` dans Outils.
5. Archiver les prototypes HTML remplaces une fois les fonctions recuperees.
