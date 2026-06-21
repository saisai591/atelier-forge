# AOS Deploy V5 - compte rendu projet

Date: 2026-06-20

## 1. Objectif du logiciel

AOS Deploy V5 est une appliance atelier pour preparer, auditer, tester,
deployer et etiqueter des PC par demarrage reseau PXE.

Le but commercial est simple:

- le client installe une VM ou une appliance prete a l'emploi;
- le serveur expose un dashboard web sur le reseau;
- les techniciens demarrent les machines en PXE;
- le logiciel guide les actions sans competence avancee;
- les audits, pilotes, images Windows, etiquettes et logs remontent au serveur.

## 2. Ce qui est deja en place

### Appliance et reseau

- VM AOS Deploy V5 fonctionnelle sur Proxmox.
- Adresse actuelle du logiciel: `http://192.168.1.57/`.
- Serveur PXE direct atelier: `192.168.50.2`.
- Partage reseau prevu pour depot ISO/WIM/pilotes: `\\192.168.50.2\deploy`.
- Services principaux actifs:
  - `aos-dashboard`
  - `aos-backend`
  - `forge-nginx-pxe`
- Le PXE demarre et affiche le menu.
- Les tests et audits PXE ont ete iteres pour arriver a un demarrage plus direct.

### Dashboard

- Interface React/Tailwind sombre type "Titanium Dark".
- Navigation par modules:
  - Dashboard
  - Deployments
  - Audit
  - Boot UEFI
  - Images WIM
  - Pilotes
  - Logs
  - Parametres
- Login temporairement retire pour travailler plus vite.
- Mode debutant / technicien confirme a prevoir comme logique principale.
- Cartes de supervision et services actifs avec indicateurs visuels.
- Retour API affiche plus clairement quand le backend repond mal.

### Audit et etiquettes

- Onglet Audit cree.
- Retour machine PXE visible dans l'interface.
- Detail machine: modele, numero de serie, CPU, RAM, disque, batterie, etat tests.
- Tests atelier prevus:
  - pixels
  - clavier
  - USB
  - audio
  - micro
  - camera
- Editeur d'etiquette integre.
- QR code et code-barres ajoutes.
- Format Brother QL-500 / rouleau 29 x 90 mm optimise.
- Rendu etiquette rendu plus lisible et mieux cadre.

### Impression Brother

- Imprimante locale detectee: `Brother QL-500`.
- Probleme de rouleau analyse.
- Format fonctionnel confirme avec rouleau 29 x 90 mm.
- Scripts Windows ajoutes pour diagnostiquer/configurer/tester:
  - `scripts/brother-devmode.ps1`
  - `scripts/brother-paper-codes.ps1`
  - `scripts/configure-brother-ql.ps1`
  - `scripts/print-brother-gdi-test.ps1`
  - `scripts/print-brother-label.ps1`
  - `scripts/send-raw-printer.ps1`

### WinPE / WIM / pilotes

- Onglet Images WIM present.
- Logique de createur WIM prevue.
- Options Unattend commencees.
- Deux modes de deploiement souhaites:
  - standard: installation automatisee avec unattend;
  - marketplace: OOBE simplifie, pas de compte preconfigure, pilotes installes.
- Idee de telechargement et stockage de pilotes par modele identifiee.

### PXE et tests atelier

- Menu PXE avec audit rapide.
- Besoin confirme: quand le technicien choisit Audit rapide, il ne doit plus rien taper.
- L'interface graphique de test doit se lancer directement.
- Deux modes doivent rester disponibles:
  - mode graphique: tests clavier/camera/micro/USB/pixels;
  - mode texte: audit rapide robuste et leger.

## 3. Ce qui reste a finaliser en priorite

### Priorite 1 - Stabilite appliance

1. Packager l'installation en script unique:
   - creation VM ou installation bare-metal;
   - configuration IP;
   - installation services;
   - verification automatique.
2. Ajouter un vrai assistant premier demarrage dans l'interface:
   - choix reseau;
   - detection routeur/switch/direct;
   - verification PXE;
   - test SMB;
   - test impression.
3. Ajouter une page "Etat systeme" claire:
   - IP serveur;
   - interface PXE;
   - DHCP/proxyDHCP;
   - TFTP;
   - HTTP PXE;
   - SMB;
   - backend API;
   - stockage deploy;
   - imprimante.

### Priorite 2 - Audit fiable

1. Normaliser le format JSON audit.
2. Separer audit rapide et audit complet:
   - rapide: etiquettes et tri atelier;
   - complet: SMART, batterie, RAM, ports, camera, audio.
3. Ajouter un statut par machine:
   - detectee;
   - audit en cours;
   - tests recus;
   - prete etiquette;
   - prete deploiement;
   - erreur.
4. Ajouter les commandes distantes:
   - redemarrer;
   - eteindre;
   - relancer audit;
   - lancer test graphique;
   - deployer image standard;
   - deployer image marketplace.

### Priorite 3 - Images Windows et pilotes

1. Onglet "Parcourir / Importer":
   - depot ISO;
   - extraction install.wim/install.esd;
   - conversion ESD vers WIM;
   - verification hash;
   - choix image par defaut.
2. Gestion pilotes:
   - detecter modele exact;
   - telecharger pack constructeur quand possible;
   - stocker par marque/modele;
   - associer au profil de deploiement;
   - injection automatique.
3. Assistant Unattend:
   - langue/clavier;
   - partitionnement;
   - nom machine;
   - compte local ou OOBE;
   - suppression OOBE marketplace;
   - activation scripts post-install.

### Priorite 4 - Impression et etiquettes

1. Ajouter profils imprimante:
   - Brother QL-500 29 x 90;
   - Brother QL-820NWB 62 mm;
   - portrait/paysage;
   - test alignement.
2. Generer PDF fiable sans dependre du navigateur.
3. Ajouter editeur d'etiquette avec gabarits:
   - revente;
   - stock interne;
   - batterie a surveiller;
   - disque a remplacer;
   - grade A/B/C.
4. Ajouter impression en lot depuis la liste d'audits.

## 4. Ameliorations UX recommandees

### Mode debutant

Interface guidee avec gros boutons:

1. Brancher un PC.
2. Demarrer en PXE.
3. Lancer audit rapide.
4. Faire tests atelier.
5. Imprimer etiquette.
6. Choisir deploiement.
7. Valider fin de preparation.

Le mode debutant doit masquer:

- les chemins internes;
- les logs bruts;
- les options dangereuses;
- les reglages reseau avances.

### Mode admin

Mode complet pour toi ou un technicien confirme:

- configuration reseau;
- services;
- logs;
- stockage;
- profils WIM;
- profils unattend;
- pilotes;
- commandes distantes;
- sauvegarde/restauration;
- mise a jour appliance.

### Tableau de bord intelligent

Remplacer les cartes trop abstraites par une lecture atelier:

- "Serveur pret pour PXE"
- "Partage reseau accessible"
- "Imprimante etiquette prete"
- "Dernier PC audite"
- "Machines en attente d'etiquette"
- "Machines pretes a deployer"
- "Erreurs a traiter"

## 5. Installation client a integrer dans le logiciel

Prevoir un onglet "Guide d'installation" directement dans le dashboard.

### Assistant recommande

1. Bienvenue
   - expliquer le role du serveur;
   - choisir mode atelier simple ou avance.
2. Reseau
   - detecter interfaces;
   - choisir mode avec box/switch ou cable direct;
   - verifier IP.
3. Stockage
   - creer partage `deploy`;
   - afficher chemin Windows;
   - bouton copier chemin.
4. PXE
   - verifier DHCP/TFTP/HTTP;
   - afficher comment booter un PC.
5. Images Windows
   - importer ISO;
   - extraire WIM;
   - choisir profil.
6. Pilotes
   - creer dossier drivers;
   - importer pack;
   - lier au modele.
7. Impression
   - detecter Brother;
   - imprimer etiquette test;
   - calibrer format.
8. Test final
   - checklist automatique;
   - statut "pret a vendre/utiliser".

### FAQ future

Questions a integrer:

- Le PC ne voit pas le PXE.
- Le menu PXE demarre mais WinPE ne charge pas.
- L'audit ne remonte pas.
- Le partage reseau n'apparait pas dans Windows.
- L'imprimante dit mauvais rouleau.
- Comment ajouter une ISO Windows.
- Comment ajouter des pilotes.
- Quelle difference entre deploiement standard et marketplace.
- Comment sauvegarder le serveur.
- Comment mettre a jour AOS Deploy.

## 6. Idee telephone Unitech EA520

Le PC detecte un appareil:

- modele visible Windows: `EA520`
- fabricant: `Unitech_Electronics`
- classe: `WPD`
- mode actuel: MTP / stockage portable
- ADB non detecte pour l'instant

L'Unitech EA520 est un terminal Android industriel avec lecteur 1D/2D, NFC,
camera, Wi-Fi, Bluetooth et 4G selon configuration. Il est adapte comme outil
atelier mobile.

### Usage ideal avec AOS Deploy

1. Scanner une etiquette PC.
2. Ouvrir directement la fiche machine dans AOS Deploy.
3. Changer le statut:
   - recu;
   - audite;
   - a reparer;
   - pret vente;
   - vendu.
4. Scanner un QR code de poste atelier.
5. Declencher une action:
   - imprimer etiquette;
   - relancer audit;
   - associer chargeur;
   - ajouter photo;
   - verifier stock.

### Solution simple recommandee

Ne pas commencer par une grosse application native.

Phase 1:

- creer une interface web mobile responsive dans AOS Deploy;
- generer un QR code "Installer le terminal";
- le terminal ouvre `http://IP_DU_SERVEUR/mobile`;
- ajout a l'ecran d'accueil Android comme PWA;
- le lecteur code-barres envoie les scans comme saisie clavier.

Phase 2:

- ajouter login technicien;
- mode inventaire;
- mode reception;
- mode expedition;
- scan etiquette et navigation automatique.

Phase 3:

- APK Android dedie;
- configuration scanner;
- mode kiosque;
- deploiement par ADB ou MDM.

## 7. Roadmap commerciale

### Version 1 vendable atelier

- installateur appliance;
- dashboard clair;
- PXE stable;
- audit rapide fiable;
- etiquettes imprimables;
- stockage reseau visible;
- import ISO/WIM;
- guide integre;
- sauvegarde/restauration;
- logs lisibles.

### Version 2 production

- drivers auto par modele;
- commandes distantes machines PXE;
- profils marketplace;
- impression en lot;
- application mobile/PWA Unitech;
- rapports PDF;
- mise a jour depuis interface.

### Version 3 entreprise

- multi-sites;
- comptes et roles;
- licence client;
- telemetry sante serveur;
- support distant;
- portail client;
- synchronisation cloud optionnelle.

## 8. Prochaine action conseillee

1. Integrer l'onglet "Guide" dans l'interface.
2. Creer la page "Etat systeme" avec pastilles services.
3. Creer la page mobile `/mobile` pour Unitech.
4. Finaliser import ISO/WIM.
5. Stabiliser audit rapide et remontes tests.
6. Ajouter impression PDF serveur pour etiquettes.

