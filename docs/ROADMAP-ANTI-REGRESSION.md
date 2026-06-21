# AtelierOS - roadmap anti-regression

Objectif: garder une trace claire de ce qui est stable, de ce qui est pret localement, et de ce qui doit etre teste avant chaque redeploiement.

## Regles anti-regression

1. Ne pas redemarrer `aos-backend`, `aos-dashboard` ou les services PXE pendant un upload ISO/WIM.
2. Ne jamais supprimer un fichier ISO/WIM serveur sans confirmation explicite dans l'interface.
3. Ne pas casser le flux PXE fonctionnel: menu PXE, Audit rapide, retour Audit.
4. Ne pas remettre de login obligatoire tant que le logiciel est en phase de construction atelier.
5. Garder les deux modes d'audit: texte rapide et graphique tests atelier.
6. Toute modification WIM doit conserver le chemin simple: importer, preparer, declarer, definir par defaut.
7. Toute action destructive doit rester limitee aux dossiers autorises.
8. Chaque changement doit passer au minimum:
   - `npm run -s build`
   - `python -m py_compile` pour les fichiers backend modifies.

## Dernier etat verifie

- Dashboard web accessible sur `http://192.168.1.57/`.
- API backend accessible sur `http://192.168.1.57:8000/api/health`.
- Services VM actifs: `aos-dashboard`, `aos-backend`, `forge-nginx-pxe`.
- APK mobile installe et lance sur le terminal Android connecte.
- Bloc `Parametres > Premier demarrage client` ajoute avec score de preparation, copie des acces et export checklist.
- Deploiement backend synchronise maintenant les assets Ventoy/AOS DISK depuis le poste atelier vers `/app/assets/ventoy`.
- Kit USB de test genere dans le conteneur: `aos-usb-kit-complete-20260621-181505.zip`, avec `ventoy/AOS DISK.exe` inclus.
- Images WIM protege contre les doublons: declarer deux fois le meme chemin met a jour l'image existante.
- Images WIM indique maintenant les fichiers serveur deja declares et evite le bouton `Declarer` inutile.
- Images WIM fait defiler automatiquement vers l'espace de travail quand on ouvre une etape.
- Logs PXE enrichis avec diagnostics francais pour SMB, HTTP PXE, API, assets manquants et client sans IP.

## Pret localement, a deployer apres transfert

### Module Images WIM

- Listing des fichiers serveur ISO/WIM/ESD.
- Endpoint `GET /forge/pxe/media/files`.
- Endpoint `GET /forge/pxe/wim-builds`.
- Affichage nom, type, taille, date, chemin SMB.
- Bouton `Rafraichir`.
- Endpoint de suppression media.
- Bouton `Supprimer` avec confirmation.
- Suppression limitee a `deploy/iso`, `deploy/images`, `deploy/incoming`.
- Bouton `Declarer` pour WIM/ESD.
- Anti-doublon sur declaration WIM/ESD.
- Anti-doublon backend par chemin WIM/ESD: mise a jour de l'entree existante au lieu d'un doublon.
- Badge `Deja declare dans Image PXE` sur les fichiers serveur deja inventories.
- Defilement automatique vers l'espace de travail quand le technicien clique une etape.
- Bouton `Preparer WIM` pour ISO.
- Creation automatique d'un profil WIM depuis ISO.
- Anti-doublon sur profil WIM depuis ISO.
- Compteurs `ISO` et `WIM/ESD`.
- Liste des procedures WIM preparees:
  - reference;
  - version;
  - source;
  - chemin SMB;
  - manifest/script.
- Profils de deploiement complets:
  - image Windows;
  - profil Unattend optionnel;
  - packs drivers selectionnes;
  - mode standard, marketplace ou personnalise;
  - profil par defaut;
  - recherche globale.
- Endpoints profils complets:
  - `GET /forge/pxe/deployment-profiles`;
  - `POST /forge/pxe/deployment-profiles`;
  - `POST /forge/pxe/deployment-profiles/{profile_id}/default`;
  - `DELETE /forge/pxe/deployment-profiles/{profile_id}`.

### Guide client

- Centre client AtelierOS.
- Avancement installation.
- Score diagnostic appliance.
- Voyants services dans Diagnostic.
- Recommandation automatique si service indisponible.
- Roadmap finalisation integree.
- Onglet FAQ complet:
  - categories Installation, Reseau/PXE, Audit/Tests, Images WIM, Pilotes, Unattend, Etiquettes, Sauvegarde, Mobile;
  - recherche par mot cle;
  - filtres par categorie;
  - procedures pas a pas;
  - marquage des points critiques.
- Rapport support client dans Guide > Diagnostic.
- Endpoint `GET /forge/pxe/system-report`.
- Export JSON du rapport support depuis l'interface.
- Copie d'un resume support lisible sans SSH.
- Compteurs support:
  - medias;
  - images WIM;
  - pilotes;
  - audits;
  - sauvegardes.
- Recommandations support automatiques.
- Diagnostic reseau lecture seule dans Parametres:
  - IP configuree;
  - IP detectee;
  - services API/SMB/PXE HTTP;
  - dossiers deploy;
  - recommandation de correction.
- Bloc `Premier demarrage client` dans Parametres:
  - score de preparation;
  - etat `Pret client`, `A verifier` ou `Bloque`;
  - copie rapide des acces;
  - export checklist livraison.

### Sauvegarde appliance

- Endpoint `GET /forge/pxe/backups`.
- Endpoint `POST /forge/pxe/backups`.
- Endpoint `POST /forge/pxe/backups/{filename}/restore`.
- Restauration en simulation par defaut.
- Restauration appliquee uniquement apres confirmation interface.
- Archive ZIP dans `deploy/exports/aos-backups`.
- Sauvegarde:
  - config PXE;
  - profils WIM;
  - images declarees;
  - packs pilotes declares;
  - profils Unattend;
  - audits recents;
  - manifest.
- Interface Guide > Sauvegarde.

### Audit atelier

- Pagination des retours machines.
- Suppression individuelle.
- Suppression de la page affichee.
- Export CSV inventaire depuis Audit.
- Historique machine par numero de serie ou MAC dans le detail audit.
- Ticket atelier automatique:
  - `Disque a controler`;
  - `Batterie a controler`;
  - `Tests a terminer`;
  - `Audit incomplet`;
  - `Drivers manquants`;
  - `Pret vente`.
- Endpoint `POST /forge/pxe/audits/prune`.
- Nettoyage des anciens audits avec conservation des derniers N.
- Simulation du nettoyage avant suppression definitive.
- Statut lisible `Audit complet` / `Audit incomplet`.
- Detection des tests atelier manquants:
  - pixels;
  - clavier;
  - USB;
  - audio;
  - micro;
  - camera.
- Distinction tests OK, NOK et manquants dans les tuiles machine.
- Export `PDF audit machine` depuis le detail audit pour dossier atelier ou client.
- Resume des champs materiel manquants avant impression etiquette.

### Etiquettes Brother

- Editeur etiquette depuis l'onglet Audit.
- Formats Brother disponibles:
  - QL-500 29 x 90 mm;
  - 62 mm continu;
  - 62 x 80 mm;
  - 62 x 100 mm;
  - DK-11202;
  - DK-11208;
  - DK-11209.
- QR code haute correction et code-barres CODE128.
- Diagnostic lisibilite dans l'editeur:
  - titre;
  - QR;
  - code-barres;
  - format/orientation.
- Bouton `Optimiser automatiquement`.
- Presets rapides:
  - QL-500 29x90 lisible;
  - QL 62x100 QR fort;
  - 62 mm continu.
- Test rouleau Brother integre dans l'editeur:
  - imprime une mire simple au format choisi;
  - rappelle echelle 100%;
  - permet de verifier le rouleau avant etiquette machine.

### Outils atelier

- Tuile `Cle USB atelier autonome` dans l'onglet Outils.
- Structure recommandee `AOS-USB`.
- Checklist avant livraison.
- Generation d'un README technicien.
- Copie et telechargement du README depuis l'interface.
- Endpoint `POST /forge/pxe/usb-kit`.
- Endpoint `GET /forge/pxe/usb-kit/{filename}/download`.
- Generation d'une archive ZIP dans `deploy/exports/aos-usb-kits`.
- Telechargement direct du ZIP depuis l'interface Outils.
- Historique des kits USB generes dans l'onglet Outils.
- Utilitaire Windows inclus:
  - `UTILITAIRE-CREER-CLE-BOOTABLE.bat`;
  - `UTILITAIRE-CREER-CLE-BOOTABLE.ps1`;
  - dossier `ventoy` integre au kit quand les assets sont disponibles;
  - lancement prioritaire de `ventoy/AOS DISK.exe`;
  - fallback sur `ventoy/Ventoy2Disk.exe`;
  - ouverture de la page officielle Ventoy si absent;
  - detection des cles USB par liste numerotee;
  - confirmation explicite `OUI` avant copie;
  - copie du dossier `AOS-USB` vers la lettre de cle choisie.
  - journal de creation dans `AOS-USB/logs`.
- Assistant debutant dans l'interface:
  - choix du profil `Multitool complet`, `Audit rapide`, `Deploiement Windows`;
  - etape 1 creer le kit Multitool;
  - etape 2 telecharger le ZIP;
  - etape 3 lancer l'utilitaire Windows en administrateur.
- Profil integre dans le manifest et dans `AOS-USB/profils/{profile}.txt`.
- Contenu du kit:
  - README;
  - manifest;
  - dossiers boot, images, drivers, tools, logs;
  - raccourcis URL dashboard, tests PXE et menu iPXE.
- Test serveur realise: `aos-usb-kit-20260621-022000.zip`.
- Test kit autonome realise: `aos-usb-kit-20260621-033542.zip` avec `ventoy/AOS DISK.exe` inclus.
- Test script securise realise: `aos-usb-kit-20260621-033936.zip` avec detection cle, confirmation OUI et log.
- Test profils realise: `complete`, `audit`, `deployment`, tous avec `ventoy/AOS DISK.exe`.
- Deploiement automatise des assets USB via `scripts/deploy-aos-vm.ps1 -Backend` quand le dossier local Ventoy/AOS DISK existe.

## Sequence apres fin upload ISO

1. Attendre que l'upload affiche 100% ou message de fin.
2. Ne pas relancer l'upload.
3. Verifier que le dashboard repond encore.
4. Deployer backend et frontend ensemble.
5. Redemarrer uniquement les services necessaires.
6. Ouvrir `Images WIM`.
7. Cliquer `Rafraichir`.
8. Verifier que l'ISO apparait.
9. Cliquer `Preparer WIM`.
10. Verifier qu'un profil WIM est cree.
11. Ne pas lancer de suppression fichier tant que la presence ISO n'est pas confirmee.

## Prochaines implementations prioritaires

### Priorite 1 - Vente client et stabilite atelier

1. Assistant reseau automatique: detecter IP, switch/direct, DHCP, PXE, SMB et proposer `Reparer`.
2. Assistant premier demarrage client: enrichir avec actions de correction automatique.
3. Mode Debutant / Expert: continuer a masquer les fonctions avancees en mode debutant.
4. Dashboard operationnel: continuer a reduire le bruit selon retours atelier.
5. Logs PXE lisibles en francais avec causes probables: enrichir ensuite avec les vrais logs dnsmasq/nginx si besoin.
6. Sauvegarde/restauration complete appliance.
7. Export PDF audit machine.
8. Historique machine par numero de serie.
9. Suppression/archivage automatique des anciens audits.
10. Test impression etiquette integre avec choix rouleau Brother.

### Priorite 2 - Deploiement Windows complet

1. Createur WIM guide: ISO -> extraction -> drivers -> profil -> WIM pret.
2. Bibliotheque drivers par marque/modele.
3. Telechargement auto drivers depuis constructeur quand possible.
4. Profils de deploiement: Standard, Marketplace, Atelier, Diagnostic.
5. Validation avant deploiement: image OK, drivers OK, unattend OK, reseau OK.
6. Generateur cle USB bootable multitool depuis l'interface.
7. Import ISO/WIM avec vraie progression.
8. Controle checksum ISO/WIM.
9. Gestion versions images Windows.
10. Rollback / desactivation d'une image problematique.

Etat local:
- Action principale automatique dans Images WIM selon etat du pipeline.
- Validation avant profil complet: image selectionnee, image ready, Unattend, drivers critiques.

### Priorite 3 - Inventaire et vente atelier

1. Application mobile Android pour scanner QR/code-barres.
2. Mode inventaire mobile: scanner machine -> voir audit -> imprimer etiquette.
3. Tickets atelier: `a tester`, `batterie HS`, `drivers manquants`, `pret vente`.
4. Export CSV/Excel inventaire.
5. API marketplace: Prestashop, Shopify, Odoo ou autre connecteur.
6. Generateur annonce produit depuis audit.
7. Estimation automatique prix selon CPU/RAM/SSD/batterie.
8. Photos machine liees au numero de serie.
9. Grade automatique configurable.
10. Controle qualite final avant sortie atelier.

### Priorite 4 - PXE et tests machine

1. Agent WinPE plus robuste avec retour temps reel.
2. Interface graphique PXE legere pour tests.
3. Commandes depuis dashboard: reboot, shutdown, relancer audit, ouvrir tests.
4. Test clavier visuel complet.
5. Test pixels plein ecran.
6. Test webcam/micro/USB integre.
7. Rapport test signe horodate.
8. Detection batterie detaillee avec taux d'usure.
9. Detection sante SSD/NVMe.
10. Detection chargeur secteur pour laptops.

### Priorite 5 - Produit commercial

1. Installation client en une commande.
2. Mise a jour automatique de l'appliance.
3. Page licence / activation.
4. Gestion utilisateurs et roles.
5. Branding client: logo, nom atelier, modele etiquette.
6. FAQ integree.
7. Guide depannage integre.
8. Diagnostic automatique `envoyer rapport support`.
9. Monitoring espace disque serveur.
10. Alertes: stockage plein, service PXE KO, WIM manquant, drivers manquants.

1. Extraction reelle ISO vers `install.wim` ou `install.esd`.
2. Conversion ESD vers WIM.
3. Lecture des index Windows disponibles.
4. Declaration automatique du WIM genere.
5. Definition image par defaut.
6. Journal de creation WIM: commencer par historiser les procedures serveur generees.
7. Progression creation WIM: a brancher quand l'execution serveur DISM sera automatisee.
8. Profil de deploiement complet: image + Unattend + drivers.
9. Restauration appliance: ajouter import d'une archive externe depuis l'interface.
10. Assistant reseau: proposer un mode correction automatique plus guide apres diagnostic.

## Checklist avant vente client

- Dashboard accessible depuis le reseau.
- Services API/PXE/SMB verts.
- Partage `deploy` visible depuis Windows.
- Upload ISO/WIM teste.
- ISO transformee en WIM exploitable.
- Image par defaut definie.
- Boot PXE client teste.
- Audit rapide remonte dans l'interface.
- Tests atelier graphiques valides.
- Etiquette imprimee sur Brother.
- Mobile EA520 configure par QR.
- Sauvegarde appliance creee.
- Guide client lisible depuis l'interface.
