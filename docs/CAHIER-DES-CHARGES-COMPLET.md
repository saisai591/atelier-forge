# AtelierOS Deploy - Cahier des charges complet

## 1. Objectif du logiciel

AtelierOS Deploy est une appliance atelier destinee aux entreprises de reconditionnement, services IT, ateliers de maintenance et integrateurs qui doivent auditer, tester, etiqueter, preparer et deployer rapidement des PC Windows par reseau PXE.

Le logiciel doit permettre a un technicien debutant de suivre un parcours simple, tout en laissant a un technicien confirme les outils avances: reseau, PXE, WIM, WinPE, pilotes, Unattend, impression etiquettes, sauvegarde et diagnostic.

## 2. Vision produit

AtelierOS Deploy doit devenir un produit installable chez un client avec:

- une appliance serveur prete a l'emploi;
- un dashboard accessible depuis le reseau atelier;
- un partage reseau Windows pour deposer ISO, WIM, pilotes et exports;
- un demarrage PXE fiable pour audit, tests et deploiement;
- un flux simple: brancher un PC, booter PXE, auditer, etiqueter, deployer ou vendre;
- une documentation integree dans l'interface;
- une sauvegarde/restauration permettant de migrer ou recuperer rapidement l'appliance.

## 3. Utilisateurs cibles

### Technicien debutant

- Ne doit pas comprendre les details PXE/DHCP/WIM.
- Doit voir uniquement les actions utiles: verifier serveur, lancer audit, imprimer etiquette, preparer image, creer cle USB.
- Doit etre guide par des statuts: Pret, A verifier, Bloque.

### Technicien confirme

- Doit acceder aux details reseau, logs, configurations, profils, images, pilotes, sauvegardes.
- Doit pouvoir diagnostiquer un Dell/HP/Lenovo qui ne boote pas.
- Doit pouvoir corriger la configuration sans SSH quand possible.

### Administrateur / installateur client

- Doit installer l'appliance, configurer le reseau, tester PXE, creer la premiere sauvegarde.
- Doit pouvoir exporter un rapport support.
- Doit pouvoir preparer un environnement vendable et reproductible.

## 4. Architecture cible

### Frontend

- React + TypeScript + Tailwind CSS.
- Interface responsive desktop, tablette et mobile.
- Mode Debutant / Expert.
- Recherche globale en haut.
- Assistant visuel activable/desactivable.
- Modules separes, pas une page infinie.

### Backend

- API FastAPI.
- Stockage JSON local pour profils, images, sauvegardes, kits USB et configurations.
- Endpoints REST pour PXE, WIM, audit, pilotes, Unattend, sauvegarde et outils.
- Execution de taches longues en arriere-plan pour WIM, checksum, extraction, conversion.

### Appliance

- VM Linux dans Proxmox.
- Services attendus:
  - `aos-dashboard`;
  - `aos-backend`;
  - `forge-dnsmasq`;
  - `forge-nginx-pxe`;
  - `forge-samba`.
- Adresse actuelle de reference: `192.168.1.57`.
- Proxmox actuel: `192.168.1.56`.

### Services reseau

- HTTP dashboard: port 80.
- API backend: port 8000.
- HTTP PXE: port 1950.
- TFTP: port 69 UDP.
- DHCP/proxyDHCP: ports standards PXE.
- SMB: port 445.

## 5. Modes reseau PXE

### Mode proxyDHCP

Le routeur ou la box donne les adresses IP. AtelierOS fournit uniquement l'information PXE/TFTP/HTTP.

Usage:

- reseau existant avec DHCP actif;
- installation non intrusive;
- test rapide chez un client.

Limite connue:

- certains Dell UEFI acceptent l'offre proxyPXE mais ne demandent jamais le fichier TFTP.

### Mode DHCP principal atelier

AtelierOS donne les IP et les informations PXE. C'est le mode recommande pour un reseau atelier dedie.

Usage:

- switch atelier isole;
- environnement de production;
- Dell qui restent bloques avant TFTP;
- parc de machines variees.

Risque:

- ne pas activer si une box ou un routeur distribue deja les IP sur le meme VLAN.

### Mode direct

Connexion directe serveur vers PC client avec une interface reseau dediee.

Usage:

- pas de switch disponible;
- diagnostic rapide;
- banc de test ponctuel.

## 6. Regles anti-regression

1. Ne jamais casser le boot PXE HP deja fonctionnel.
2. Garder HP/non-Dell UEFI sur `ipxe.efi`.
3. Garder Dell UEFI problematiques sur `snponly.efi`.
4. Ne pas redemarrer les services pendant un upload ISO/WIM.
5. Ne jamais supprimer ISO/WIM sans confirmation explicite.
6. Garder deux audits: texte rapide et graphique tests atelier.
7. Garder le chemin simple Images WIM: importer, creer WIM, declarer, definir par defaut, profil.
8. Toute action destructive doit etre limitee aux dossiers autorises.
9. Avant commit:
   - `npm run build`;
   - compilation Python des modules backend modifies;
   - tests anti-regression quand possible.
10. Toute modification stable doit etre documentee et poussee sur Git.

## 7. Modules fonctionnels

### Dashboard

Objectif: afficher l'etat operationnel du serveur et guider l'action suivante.

Doit afficher:

- services actifs avec voyants;
- IP serveur;
- mode DHCP;
- etat PXE/SMB/API;
- assets PXE prets ou manquants;
- dernieres machines PXE;
- alertes importantes;
- action conseillee.

### Deploiements

Objectif: suivre les machines en cours de boot, audit ou deploiement.

Fonctions:

- liste machines;
- statut;
- progression;
- IP/MAC;
- actions distantes quand agent disponible;
- detection erreurs.

### Audit

Objectif: recuperer les informations machines et generer etiquettes/tickets.

Donnees attendues:

- marque;
- modele;
- numero de serie;
- CPU;
- RAM;
- disque;
- etat SMART;
- batterie;
- taux d'usure;
- ports USB;
- IP/MAC;
- tests clavier/pixels/USB/audio/micro/camera.

Fonctions:

- pagination;
- suppression individuelle;
- nettoyage anciens audits;
- export CSV;
- export PDF audit;
- generation etiquette;
- preparation drivers depuis audit;
- tickets atelier automatiques.

### Boot UEFI / PXE

Objectif: fournir un menu PXE modulaire.

Fonctions:

- audit rapide texte;
- audit graphique;
- WinPE;
- Memtest;
- SystemRescue;
- outils de diagnostic;
- menu iPXE modulaire;
- fallback Dell `snponly.efi`;
- chainload HTTP vers `/boot/menu.ipxe`.

### Images WIM

Objectif: transformer une ISO ou un fichier Windows en image exploitable pour deploiement.

Parcours cible:

1. Importer ISO/WIM/ESD.
2. Verifier presence serveur.
3. Lire editions Windows.
4. Choisir index.
5. Creer WIM.
6. Declarer image.
7. Definir image par defaut.
8. Associer Unattend et drivers.
9. Creer profil de deploiement.

Fonctions:

- upload avec progression;
- listing serveur;
- detection ISO/WIM/ESD;
- checksum SHA-256;
- suppression controlee;
- conversion ESD vers WIM;
- export index WIM;
- historique builds;
- anti-doublon;
- image par defaut;
- profils de deploiement.

### Pilotes

Objectif: stocker et reutiliser les drivers par marque/modele.

Fonctions:

- bibliotheque drivers;
- preparation drivers depuis audit;
- extraction archives;
- stockage serveur;
- liaison avec profils deploiement;
- detection drivers manquants.

Evolution:

- telechargement automatique constructeur quand possible;
- cache par modele;
- validation drivers avant deploiement.

### Unattend

Objectif: creer des profils d'installation automatisee Windows.

Fonctions:

- profils Standard;
- profils Marketplace;
- suppression OOBE selon besoin;
- generation XML;
- profil par defaut;
- association a une image ou un profil deploiement.

### Outils

Objectif: fournir les utilitaires atelier hors flux principal.

Fonctions:

- creation kit USB bootable Multitool;
- profils USB: complet, audit, deploiement;
- integration Ventoy/AOS DISK si disponible;
- README technicien;
- telechargement ZIP;
- historique kits;
- suppression kits.

### Guide

Objectif: rendre le produit vendable et autonome.

Fonctions:

- guide installation;
- diagnostic;
- FAQ;
- sauvegarde/restauration;
- rapport support;
- checklist premier demarrage client;
- export JSON support.

### Logs

Objectif: rendre les erreurs comprehensibles.

Fonctions:

- logs PXE;
- logs API;
- logs WinPE/TFTP;
- interpretation francaise des causes probables;
- aide directe: service KO, asset manquant, client sans IP, DHCP/PXE a verifier.

### Parametres

Objectif: configurer l'appliance sans SSH.

Fonctions:

- IP serveur;
- URL HTTP PXE;
- partage SMB;
- mode DHCP;
- ports;
- regeneration reseau;
- diagnostic lecture seule;
- activation/desactivation assistant;
- mode Debutant/Expert.

## 8. API principale

Endpoints importants:

- `GET /forge/pxe/status`;
- `GET /forge/pxe/config`;
- `PATCH /forge/pxe/config`;
- `GET /forge/pxe/network/diagnostic`;
- `POST /forge/pxe/network/resync`;
- `GET /forge/pxe/system-report`;
- `GET /forge/pxe/audits`;
- `DELETE /forge/pxe/audits/{id}`;
- `POST /forge/pxe/audits/prune`;
- `POST /forge/pxe/audits/{id}/prepare-drivers`;
- `GET /forge/pxe/media/files`;
- `POST /forge/pxe/media/upload`;
- `POST /forge/pxe/media/indexes`;
- `POST /forge/pxe/media/build-wim`;
- `GET /forge/pxe/wim-images`;
- `POST /forge/pxe/wim-images`;
- `POST /forge/pxe/wim-images/{id}/default`;
- `DELETE /forge/pxe/wim-images/{id}`;
- `GET /forge/pxe/unattend-profiles`;
- `POST /forge/pxe/unattend-profiles`;
- `GET /forge/pxe/unattend-profiles/{id}/xml`;
- `GET /forge/pxe/driver-packs`;
- `POST /forge/pxe/driver-packs`;
- `POST /forge/pxe/actions`;
- `GET /forge/pxe/backups`;
- `POST /forge/pxe/backups`;
- `POST /forge/pxe/backups/{filename}/restore`;
- `GET /forge/pxe/usb-kit`;
- `POST /forge/pxe/usb-kit`.

## 9. Stockage reseau

Partage Windows:

```text
\\SERVEUR\deploy
```

Dossiers:

- `iso/`: ISO Windows et outils;
- `images/`: WIM/ESD prets;
- `drivers/`: pilotes;
- `audit/`: retours machines et etiquettes;
- `incoming/`: depot temporaire;
- `exports/`: sauvegardes, rapports, kits USB;
- `logs/`: journaux;
- `certificates/`: certificats effacement.

## 10. Impression etiquettes

Formats cibles:

- Brother QL-500 29 x 90 mm;
- Brother QL 62 mm continu;
- 62 x 80 mm;
- 62 x 100 mm;
- DK-11202;
- DK-11208;
- DK-11209.

Informations obligatoires:

- marque + modele sans doublon;
- numero de serie;
- CPU;
- RAM;
- disque;
- batterie/usure si portable;
- QR code lisible;
- code-barres CODE128.

Contraintes:

- lisible sur petit format;
- pas de texte coupe;
- pas de double marque;
- contraste fort;
- marge QR suffisante;
- impression a l'echelle 100%.

## 11. Application mobile

Objectif: exploiter un terminal code-barres Unitech EA520.

Fonctions actuelles:

- APK WebView;
- acces dashboard;
- usage scanner QR/code-barres via l'interface web.

Objectif futur:

- mode inventaire mobile;
- scanner etiquette;
- ouvrir fiche machine;
- voir audit;
- declencher impression;
- ajouter photos;
- connecter marketplace.

## 12. Sauvegarde et restauration

La sauvegarde doit inclure:

- configuration PXE;
- images declarees;
- recettes WIM;
- profils Unattend;
- packs drivers declares;
- audits recents;
- manifest.

La restauration doit:

- demarrer en simulation;
- lister ce qui sera restaure;
- appliquer uniquement apres confirmation;
- ne pas ecraser les gros ISO/WIM sans action explicite.

## 13. Exigences de securite

- Pas de suppression silencieuse de fichiers critiques.
- Actions destructives confirmees.
- Separation utilisateur/technicien a finaliser.
- Licence/activation a prevoir.
- Secrets et mots de passe hors Git.
- Sauvegarde avant changement reseau important.

## 14. Exigences commerciales

Le produit vendu doit inclure:

- guide installation client;
- FAQ integree;
- assistant premier demarrage;
- diagnostic support exportable;
- sauvegarde/restauration;
- mode debutant;
- mise a jour appliance;
- licence/activation;
- branding client.

## 15. Reste a finaliser avant vente

Priorite haute:

1. Assistant reseau automatique complet.
2. Mode DHCP principal atelier guide et securise.
3. Creation WIM de bout en bout avec progression fine.
4. Drivers constructeur automatiques.
5. Rapport PDF audit final.
6. Impression Brother fiable multi-formats.
7. Guide client final dans l'interface.
8. Sauvegarde/restauration testee en condition reelle.
9. Mise a jour automatique.
10. Licence/activation.

Priorite moyenne:

1. Application mobile inventaire.
2. Tickets atelier complets.
3. Photos machine.
4. Estimation prix.
5. Generation annonce marketplace.
6. Export Excel.
7. Connecteurs Odoo/Shopify/Prestashop.

## 16. Definition du produit pret client

AtelierOS Deploy est pret client quand:

- dashboard accessible;
- partage SMB visible depuis Windows;
- ISO importee et transformee en WIM;
- image par defaut definie;
- boot PXE teste sur au moins HP et Dell;
- audit remonte dans l'interface;
- etiquette imprimee correctement;
- sauvegarde creee;
- guide client disponible;
- mode debutant utilisable sans aide externe.

