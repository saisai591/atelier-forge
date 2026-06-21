# AOS Deploy V5 - guide installation client

Ce guide est la base du parcours client qui sera integre dans le logiciel.

## 1. Objectif

AOS Deploy V5 transforme un serveur ou une VM en appliance atelier pour:

- demarrer des PC en PXE;
- auditer rapidement les machines;
- tester clavier, ecran, USB, camera, micro et audio;
- importer ISO/WIM Windows;
- preparer les pilotes par modele;
- deployer Windows;
- imprimer des etiquettes;
- scanner les machines avec un terminal Unitech EA520.

## 2. Materiel conseille

### Serveur

- Proxmox ou machine dediee.
- 4 CPU minimum.
- 8 Go RAM minimum.
- 80 Go disque minimum, plus si beaucoup d'ISO/WIM.
- 1 port Ethernet minimum.
- Ideal: 2 ports Ethernet, un pour le reseau atelier et un pour le lien direct PXE.

### Atelier

- Switch gigabit recommande.
- Cable Ethernet pour chaque PC a preparer.
- Imprimante Brother QL-500 ou QL-820NWB.
- Terminal Unitech EA520 pour scan code-barres.

## 3. Premier demarrage

1. Brancher le serveur au reseau.
2. Ouvrir le dashboard:

```text
http://IP_DU_SERVEUR/
```

3. Aller dans l'onglet `Guide`.
4. Verifier que les services sont verts:

- API
- HTTP PXE
- SMB
- WinPE/assets

5. Aller dans `Parametres` puis verifier le bloc `Diagnostic lecture seule`:

- IP configuree = IP detectee;
- services API, SMB et HTTP PXE en ligne;
- dossiers `deploy` presents;
- recommandation sans action destructive.

6. Ouvrir le partage reseau:

```text
\\IP_DU_SERVEUR\deploy
```

## 4. Stockage reseau

Le partage `deploy` doit contenir:

```text
deploy\
  audit\
  certificates\
  drivers\
  exports\
  images\
  incoming\
  iso\
  logs\
  scripts\
  wipe\
```

Utilisation:

- deposer les ISO dans `iso`;
- deposer ou generer les WIM dans `images`;
- deposer les packs pilotes dans `drivers`;
- lire les audits dans `audit`;
- retrouver les exports dans `exports`.

## 5. Test PXE

1. Brancher un PC client en Ethernet.
2. Appuyer sur la touche boot menu du PC:
   - Dell: souvent `F12`
   - HP: souvent `F9`
   - Lenovo: souvent `F12`
3. Choisir `UEFI PXE` ou la carte reseau.
4. Le menu AOS Deploy doit apparaitre.
5. Lancer `Audit rapide`.
6. Verifier le retour dans l'onglet `Audit`.

## 6. Import ISO / WIM

Objectif final:

1. Glisser/deposer une ISO Windows dans l'interface.
2. Extraire automatiquement `install.wim` ou `install.esd`.
3. Convertir ESD vers WIM si besoin.
4. Choisir l'image par defaut.
5. Associer un profil Unattend.

Etat actuel:

- structure et onglet Images WIM presents;
- upload media avec progression;
- verification fichier existant avant upload;
- listing serveur ISO/WIM/ESD prepare;
- declaration WIM/ESD depuis fichier serveur preparee;
- preparation profil WIM depuis ISO preparee;
- createur WIM commence;
- profils Unattend presents;
- extraction ISO et conversion ESD vers WIM a finaliser.

## 7. Pilotes

Objectif final:

1. Auditer une machine.
2. Identifier marque/modele.
3. Telecharger ou deposer le pack pilote.
4. Stocker dans:

```text
\\IP_DU_SERVEUR\deploy\drivers\MARQUE\MODELE
```

5. Reutiliser le pack pour les prochaines machines identiques.

## 8. Imprimante etiquette

Imprimantes supportees en priorite:

- Brother QL-500;
- Brother QL-820NWB.

Formats:

- 29 x 90 mm;
- 62 mm continu;
- 62 x 100 mm.

Workflow:

1. Ouvrir `Audit`.
2. Selectionner une machine.
3. Ouvrir `Editeur etiquette`.
4. Choisir format Brother.
5. Verifier preview.
6. Imprimer.

## 9. Terminal Unitech EA520

Le terminal sert a:

- scanner une etiquette;
- ouvrir la fiche machine;
- changer le statut atelier;
- preparer inventaire/expedition.

Installation APK:

```powershell
.\scripts\install-aos-mobile-ea520.ps1 -ServerUrl http://IP_DU_SERVEUR/mobile
```

APK disponibles:

```text
dist-mobile\AOS-Mobile-EA520-debug.apk
dist-mobile\AOS-Mobile-EA520-release.apk
```

Le QR dans l'onglet Guide configure l'application via:

```text
aosdeploy://configure?url=http://IP_DU_SERVEUR/mobile
```

## 10. Sauvegarde appliance

Etat actuel:

- creation archive ZIP preparee dans `deploy\exports\aos-backups`;
- sauvegarde config PXE preparee;
- sauvegarde profils WIM/Unattend preparee;
- sauvegarde images et packs pilotes declares preparee;
- sauvegarde audits recents preparee.
- restauration depuis archive preparee;
- simulation de restauration disponible avant application;
- application de restauration protegee par confirmation interface.

A finaliser avant vente:

- import d'une archive externe depuis l'interface;
- sauvegarde planifiee;
- export complet base de donnees;
- verification integrite archive.

## 11. FAQ integree

L'onglet `Guide > FAQ` contient une base de connaissance utilisable par le client:

- recherche par mot cle;
- filtres par categorie;
- procedures pas a pas;
- points critiques marques visuellement;
- categories installation, reseau/PXE, audit/tests, images WIM, pilotes, Unattend, etiquettes, sauvegarde et mobile EA520.

Objectif: un technicien non confirme doit pouvoir retrouver une procedure sans SSH et sans documentation externe.

## 12. Rapport support

Dans `Guide > Diagnostic`, le bouton `Generer rapport` cree un resume support avec:

- IP configuree et IP detectee;
- mode PXE;
- etat des services;
- nombre de medias, images, pilotes, audits et sauvegardes;
- recommandations automatiques.

Deux sorties sont disponibles:

- `Copier resume`: texte court a envoyer au support;
- `Export JSON`: fichier complet pour analyse technique.

## 13. Cle USB atelier autonome

Dans `Outils`, la tuile `Cle USB atelier autonome` sert a preparer une cle de secours type Ventoy.

La tuile fournit:

- structure recommandee `AOS-USB`;
- checklist avant livraison;
- procedure technicien;
- README genere avec URL dashboard, serveur PXE/tests et partage reseau;
- boutons `Copier README` et `Telecharger README`.
- bouton `Generer kit ZIP` pour produire une archive prete a extraire sur la cle.
- bouton `Telecharger ZIP` apres generation pour recuperer directement le kit depuis le navigateur.
- historique des kits USB deja generes;
- utilitaire Windows `UTILITAIRE-CREER-CLE-BOOTABLE.bat`;
- script PowerShell `UTILITAIRE-CREER-CLE-BOOTABLE.ps1` pour lancer Ventoy puis copier `AOS-USB` sur la cle.
- dossier `ventoy` integre si les assets AOS DISK/Ventoy sont presents sur l'appliance.

Le ZIP est cree dans:

```text
\\SERVEUR\deploy\exports\aos-usb-kits
```

Contenu attendu:

- `UTILITAIRE-CREER-CLE-BOOTABLE.bat`;
- `UTILITAIRE-CREER-CLE-BOOTABLE.ps1`;
- `ventoy/AOS DISK.exe`;
- fichiers Ventoy necessaires au boot USB;
- `AOS-USB/README.txt`;
- `AOS-USB/manifest.json`;
- `AOS-USB/boot`;
- `AOS-USB/images`;
- `AOS-USB/drivers`;
- `AOS-USB/tools`;
- `AOS-USB/logs`;
- raccourcis Windows vers dashboard, tests PXE et menu iPXE.

Cette cle sert de secours quand le reseau client n'est pas stable ou quand un technicien doit intervenir sans documentation externe.

## 14. Maintenance audits

Quand beaucoup de PC sont audites, l'onglet `Audit` permet:

- pagination 10 / 25 / 50;
- suppression d'une tuile;
- suppression de la page affichee;
- nettoyage des anciens audits en gardant les 50 derniers;
- simulation du nettoyage avant suppression definitive.

## 15. Checklist avant livraison client

- [ ] IP serveur configuree.
- [ ] Dashboard accessible.
- [ ] Services verts.
- [ ] Partage `deploy` accessible depuis Windows.
- [ ] Menu PXE visible sur un PC test.
- [ ] Audit rapide remonte dans le dashboard.
- [ ] Imprimante etiquette testee.
- [ ] APK EA520 installe.
- [ ] QR mobile scanne.
- [ ] Sauvegarde initiale creee.
