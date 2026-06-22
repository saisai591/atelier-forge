# AtelierOS Deploy - Guide complet des modules et outils

## 1. Acces rapides

Dashboard:

```text
http://192.168.1.57/
```

API:

```text
http://192.168.1.57:8000
```

Menu PXE HTTP:

```text
http://192.168.1.57:1950/boot/menu.ipxe
```

Partage Windows:

```text
\\192.168.1.57\deploy
```

## 2. Navigation principale

Menus disponibles:

- Dashboard;
- Deploiements;
- Audit;
- Boot UEFI;
- Images WIM;
- Pilotes;
- Outils;
- Guide;
- Logs;
- Parametres.

En mode Debutant, les modules doivent rester centres sur les actions utiles. En mode Expert, tous les details techniques sont visibles.

## 3. Dashboard

### Role

Le Dashboard sert a savoir immediatement si l'atelier peut travailler.

### Ce qu'il faut regarder

- Voyants services reseau.
- IP serveur.
- Assets PXE.
- Machines connues.
- Alertes.
- Action conseillee.

### Interpretation

- Vert: pret.
- Orange: action a verifier.
- Rouge: bloquant.

### Actions typiques

- Si IP incorrecte: aller dans Parametres puis Regenerer reseau.
- Si HTTP PXE KO: verifier `forge-nginx-pxe`.
- Si SMB KO: verifier `forge-samba`.
- Si WinPE manque: aller dans Images WIM / Assets PXE.

## 4. Deploiements

### Role

Suivre les machines connectees ou en cours de travail.

### Informations affichees

- machine;
- IP;
- MAC;
- statut;
- progression;
- tache courante;
- erreurs;
- dernier contact.

### Actions disponibles ou prevues

- redemarrer;
- eteindre;
- relancer audit;
- ouvrir tests;
- lancer deploiement;
- suivre progression.

### Bon usage

Ne pas relancer deux actions sur la meme machine si elle est deja en cours de transfert ou d'installation.

## 5. Audit

### Role

Centraliser les retours machines PXE et preparer l'etiquetage.

### Donnees affichees

- marque;
- modele;
- numero de serie;
- processeur;
- RAM;
- disque;
- batterie;
- usure batterie;
- IP/MAC;
- tests atelier.

### Tuiles et tickets

Le module doit signaler:

- infos manquantes;
- disque a controler;
- batterie a controler;
- tests a terminer;
- audit incomplet;
- drivers manquants;
- pret vente.

### Actions

- ouvrir detail audit;
- supprimer audit;
- nettoyer anciens audits;
- exporter CSV;
- exporter PDF;
- preparer drivers depuis audit;
- imprimer etiquette.

### Etiquette depuis Audit

Le technicien doit verifier avant impression:

- marque/modele sans doublon;
- numero de serie;
- CPU/RAM/disque;
- batterie si portable;
- QR lisible;
- code-barres lisible;
- format Brother correct.

## 6. Boot UEFI / PXE

### Role

Controle du menu de demarrage reseau.

### Chargeurs

- BIOS: `undionly.kpxe`;
- UEFI 32: `ipxe32.efi`;
- UEFI 64 non-Dell: `ipxe.efi`;
- Dell UEFI cible: `snponly.efi`.

### Menu HTTP

Une fois iPXE charge, le client recupere:

```text
http://192.168.1.57:1950/boot/menu.ipxe
```

### Options machine

Pour un Dell:

- Integrated NIC: `Enabled w/PXE`;
- UEFI Network Stack: active;
- Secure Boot: desactive pour test;
- Boot mode: UEFI;
- Boot: UEFI IPv4.

### Diagnostic rapide

Si le serveur voit la MAC mais aucun TFTP:

- en proxyDHCP: passer en DHCP principal atelier ou configurer options 66/67;
- verifier Secure Boot;
- verifier UEFI Network Stack;
- tester autre port/cable/switch.

## 7. Images WIM

### Role

Preparer les images Windows deployables.

### Parcours debutant

1. Cliquer Importer.
2. Choisir ISO/WIM/ESD.
3. Attendre upload.
4. Cliquer Editions si besoin.
5. Cliquer Creer WIM.
6. Definir image par defaut.
7. Associer Unattend et drivers.
8. Creer profil pret.

### Types acceptes

- `.iso`;
- `.wim`;
- `.esd`.

### Fonctions

- upload avec progression;
- listing fichiers serveur;
- checksum;
- suppression controlee;
- lecture indexes Windows;
- conversion ESD vers WIM;
- export index WIM;
- historique builds;
- declaration image;
- image par defaut;
- profils de deploiement.

### Dossiers utilises

```text
deploy/iso
deploy/images
deploy/incoming
```

### Regles

- ne pas supprimer une ISO sans confirmation;
- ne pas redemarrer pendant upload;
- utiliser noms simples sans accents si possible;
- toujours definir une image par defaut avant deploiement.

## 8. Pilotes

### Role

Stocker et reutiliser les drivers pour les machines similaires.

### Parcours

1. Audit machine.
2. Identifier marque/modele.
3. Preparer drivers depuis audit.
4. Stocker dans bibliotheque.
5. Associer au profil de deploiement.

### Dossier

```text
deploy/drivers
```

### Evolutions attendues

- telechargement automatique HP/Dell/Lenovo quand possible;
- cache drivers par modele;
- validation avant deploiement;
- integration automatique dans WIM ou installation post-deploiement.

## 9. Unattend

### Role

Automatiser l'installation Windows.

### Profils

- Standard atelier;
- Marketplace;
- personnalise.

### Options attendues

- langue;
- clavier;
- fuseau horaire;
- compte/local/OOBE selon profil;
- activation options Windows;
- scripts post-installation;
- association drivers.

### Actions

- creer profil;
- generer XML;
- definir par defaut;
- supprimer profil;
- associer a un profil de deploiement.

## 10. Profils de deploiement

### Role

Assembler image + Unattend + drivers + mode.

### Profils cibles

- Standard;
- Marketplace;
- Atelier;
- Diagnostic.

### Validation avant deploiement

Le profil est pret si:

- image WIM/ESD declaree;
- image par defaut definie;
- Unattend choisi si necessaire;
- drivers critiques disponibles;
- PXE HTTP disponible;
- SMB disponible.

## 11. Outils

### Cle USB bootable Multitool

Objectif: creer une cle de secours pour techniciens.

Flux:

1. Choisir profil: complet, audit, deploiement.
2. Generer kit USB.
3. Telecharger ZIP.
4. Extraire sur Windows.
5. Lancer l'utilitaire en administrateur.
6. Installer Ventoy/AOS DISK sur la cle.
7. Copier le dossier `AOS-USB`.

Contenu:

- README;
- manifest;
- scripts;
- dossiers boot/images/drivers/tools/logs;
- raccourcis dashboard/PXE;
- Ventoy/AOS DISK si assets disponibles.

### Usage terrain

La cle sert si:

- le reseau client est instable;
- PXE impossible;
- besoin d'audit hors ligne;
- besoin de secours WinPE.

## 12. Guide

### Onglets

- Installation;
- Diagnostic;
- FAQ;
- Sauvegarde.

### Installation

Doit aider a:

- brancher serveur;
- trouver l'IP;
- ouvrir dashboard;
- ouvrir partage SMB;
- importer premiere image;
- tester premier PC PXE.

### Diagnostic

Doit afficher:

- services;
- IP configuree;
- IP detectee;
- stockage;
- recommandations;
- export rapport support.

### FAQ

Categories:

- installation;
- reseau/PXE;
- audit/tests;
- Images WIM;
- pilotes;
- Unattend;
- etiquettes;
- sauvegarde;
- mobile.

### Sauvegarde

Actions:

- creer sauvegarde;
- telecharger sauvegarde;
- simulation restauration;
- restauration confirmee;
- suppression sauvegarde.

## 13. Logs

### Role

Comprendre rapidement les problemes.

### Sources

- dnsmasq;
- nginx PXE;
- backend API;
- WinPE;
- TFTP.

### Exemples d'interpretation

Client vu mais pas de TFTP:

- DHCP/proxyDHCP;
- Dell firmware;
- option 66/67 absente;
- UEFI Network Stack absent.

TFTP OK mais pas HTTP:

- nginx PXE;
- URL menu;
- firewall;
- IP serveur incorrecte.

HTTP OK mais audit absent:

- agent non lance;
- backend inaccessible;
- reseau client perdu;
- script audit en erreur.

## 14. Parametres

### Reseau

Champs:

- IP serveur;
- URL HTTP PXE;
- partage SMB;
- mode DHCP;
- ports;
- WinPE pret.

Modes:

- Proxy DHCP;
- DHCP principal atelier;
- Standalone DHCP.

### Regeneration reseau

Utiliser apres:

- changement de switch;
- changement routeur;
- changement IP;
- passage direct/switch;
- PXE devenu muet.

La regeneration doit:

- detecter IP LAN;
- mettre a jour URL;
- mettre a jour SMB;
- regenerer PXE si possible;
- redemarrer services reseau.

## 15. Assistant visuel

### Role

Conseiller le technicien selon le module actif.

### Parametre

L'assistant doit etre activable/desactivable dans les parametres ou l'interface.

### Conseils typiques

- Dashboard: corriger services avant test.
- Audit: imprimer etiquette seulement si infos completes.
- Images: definir image par defaut avant profil.
- Parametres: regenerer reseau si IP changee.
- Logs: lire cause probable avant modifier.

## 16. Mobile EA520

### Role

Terminal code-barres pour inventaire atelier.

### Usage actuel

- installer APK;
- ouvrir dashboard;
- scanner QR/code-barres via interface web.

### Usage cible

- scanner etiquette;
- ouvrir fiche machine;
- voir audit;
- changer statut atelier;
- declencher impression;
- ajouter photos;
- preparer annonce.

## 17. Procedures de test

### Test serveur

1. Ouvrir dashboard.
2. Verifier services verts.
3. Ouvrir partage SMB.
4. Ouvrir menu PXE HTTP.
5. Lancer diagnostic reseau.

### Test PXE HP

1. Boot UEFI IPv4.
2. Verifier `ipxe.efi`.
3. Verifier `autoexec.ipxe`.
4. Verifier `GET /boot/menu.ipxe`.
5. Lancer Audit rapide.

### Test PXE Dell

1. Activer Integrated NIC `Enabled w/PXE`.
2. Activer UEFI Network Stack.
3. Desactiver Secure Boot pour test.
4. Boot UEFI IPv4.
5. Verifier `snponly.efi`.
6. Si pas de TFTP, passer DHCP principal atelier ou options 66/67.

### Test etiquettes

1. Choisir audit complet.
2. Selectionner format Brother.
3. Verifier preview.
4. Verifier QR.
5. Verifier code-barres.
6. Imprimer mire.
7. Imprimer etiquette.

### Test WIM

1. Importer ISO.
2. Lire editions.
3. Choisir index.
4. Creer WIM.
5. Declarer image.
6. Definir par defaut.
7. Creer profil.

## 18. Maintenance

### Commandes utiles

Sur appliance:

```bash
systemctl status aos-dashboard aos-backend forge-dnsmasq forge-nginx-pxe forge-samba
podman logs forge-dnsmasq
podman logs forge-nginx-pxe
```

Depuis Windows:

```powershell
Invoke-WebRequest http://192.168.1.57/
Invoke-WebRequest http://192.168.1.57:1950/boot/menu.ipxe
```

### Avant changement important

1. Creer sauvegarde appliance.
2. Verifier aucun upload en cours.
3. Noter IP/mode DHCP.
4. Appliquer changement.
5. Tester dashboard.
6. Tester PXE.

## 19. Limites connues

- Dell UEFI peut bloquer en proxyDHCP.
- Le mode DHCP principal ne doit pas etre active sur un reseau avec DHCP existant.
- Telechargement drivers constructeur pas encore completement automatise.
- Licence/activation commerciale pas encore finalisee.
- Installation client en une commande encore a finaliser.

## 20. Checklist livraison client

- Dashboard accessible.
- API active.
- PXE HTTP actif.
- SMB accessible depuis Windows.
- Mode DHCP choisi et documente.
- Premier PC HP teste.
- Premier PC Dell teste.
- Audit remonte.
- Etiquette imprimee.
- Image Windows par defaut definie.
- Profil Unattend cree.
- Sauvegarde appliance creee.
- Guide client ouvert et compris.

