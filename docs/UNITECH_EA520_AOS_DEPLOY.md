# Unitech EA520 avec AOS Deploy V5

## Detection locale actuelle

Windows detecte le terminal:

- nom: `EA520`
- fabricant: `Unitech_Electronics`
- classe: `WPD`
- mode actuel: MTP / peripherique portable
- ADB: non detecte dans le PATH au moment du controle

Cela signifie que le PC voit le telephone, mais pas encore comme terminal
administrable Android.

## Capacites utiles

Le EA520 est un terminal Android industriel avec lecteur code-barres 1D/2D,
camera, NFC, Wi-Fi, Bluetooth et batterie amovible selon configuration. Il est
pertinent pour:

- reception de machines;
- scan etiquette QR/code-barres;
- inventaire stock;
- verification de statut;
- photos rapides;
- expedition.

Source constructeur consultee: Unitech EA520, terminal Android 11/13, ecran 5",
lecture 1D/2D, NFC, camera 13 MP, Wi-Fi/Bluetooth/4G selon variante.

## Strategie recommandee

### Phase 1 - Sans APK

Creer une page mobile dans AOS Deploy:

- URL: `http://IP_SERVEUR/mobile`
- interface tactile simple;
- scan dans un champ actif;
- redirection directe vers fiche machine;
- boutons: recu, audite, a reparer, pret vente, vendu.

Avantage: rapide, compatible, pas besoin de Play Store.

### Phase 2 - PWA

- bouton "Installer sur le terminal";
- QR code dans l'interface admin;
- ajout a l'ecran d'accueil;
- stockage session technicien;
- mode hors ligne leger si reseau coupe.

### Phase 3 - APK/MDM

Prevoir uniquement apres stabilisation:

- APK Android dedie;
- configuration scanner;
- mode kiosque;
- installation par ADB;
- mise a jour via MDM ou depot local.

## Preparation du terminal pour installation APK

1. Sur l'EA520, ouvrir Parametres.
2. Aller dans A propos du telephone.
3. Appuyer 7 fois sur Numero de build.
4. Revenir dans Systeme > Options pour les developpeurs.
5. Activer Debogage USB.
6. Brancher au PC.
7. Accepter l'empreinte RSA.
8. Relancer:

```powershell
.\scripts\detect-unitech-ea520.ps1
```

Quand `adb devices -l` affiche le terminal en `device`, on peut installer un APK.

