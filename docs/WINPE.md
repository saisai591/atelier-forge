# Construire WinPE et préparer les images Windows

WinPE (Windows Preinstallation Environment) est le mini-Windows qui démarre par
le réseau pour déployer le vrai Windows. **Cette étape se fait côté Windows**
(une seule fois), car les outils Microsoft (ADK) n'existent pas sous Linux.

## 1. Installer les outils Microsoft (sur un PC Windows)

1. Téléchargez et installez le **Windows ADK** (Assessment and Deployment Kit).
2. Installez aussi le **module complémentaire WinPE** (WinPE add-on) — c'est un
   second installeur séparé.
3. Ces deux paquets sont gratuits chez Microsoft.

## 2. Construire l'image WinPE

Ouvrez **« Environnement des outils de déploiement et de création d'images »**
(menu Démarrer, dossier Windows Kits) **en tant qu'administrateur**, placez-vous
dans le dossier `winpe` de ce dépôt, puis :

```powershell
.\build-winpe.ps1 -ServerIP 192.168.1.10 -SmbUser pxe -SmbPassword pxe `
    -OutDir C:\forge-media
```

Options utiles :

- `-WinpeDriversPath C:\pilotes-winpe` : injecte des pilotes **dans WinPE**
  (utile si une machine récente n'a pas de réseau/disque détecté dans WinPE —
  voir [DRIVERS.md](DRIVERS.md)).

Le script produit un dossier `media` (dans `-OutDir`).

## 3. Copier WinPE sur le serveur

Transférez le contenu de `C:\forge-media` vers le serveur, dans
`/var/lib/forge/http/winpe/media/`. Vous devez obtenir au final :

```
/var/lib/forge/http/winpe/wimboot                     (déjà présent)
/var/lib/forge/http/winpe/media/Boot/BCD
/var/lib/forge/http/winpe/media/Boot/boot.sdi
/var/lib/forge/http/winpe/media/sources/boot.wim
```

Exemple de transfert (depuis Windows, avec scp ou via le partage Samba) :

```powershell
# Via le partage Samba (le plus simple) :
net use Z: \\192.168.1.10\deploy /user:pxe pxe
robocopy C:\forge-media \\192.168.1.10\deploy\..\http\winpe\media /E
```

> Le plus simple en pratique : copiez `media` dans un sous-dossier du partage,
> puis sur le serveur déplacez-le dans `http/winpe/` (le partage et le HTTP sont
> deux dossiers différents).

Vérifiez ensuite : `sudo ./scripts/check-server.sh` doit afficher
« WinPE présent (boot.wim) ».

## 4. Préparer les images Windows à déployer

Atelier Forge déploie des fichiers **`install.wim`** (ou `install.esd` converti en wim).

1. Récupérez un **ISO Windows officiel** (Media Creation Tool / Microsoft).
2. Montez l'ISO, ouvrez le dossier `sources`, copiez `install.wim`.
   - Si c'est un `install.esd`, convertissez-le en wim :
     ```powershell
     dism /Export-Image /SourceImageFile:install.esd /SourceIndex:1 `
          /DestinationImageFile:install.wim /Compress:max /CheckIntegrity
     ```
3. Renommez clairement et déposez dans le partage :
   `\\192.168.1.10\deploy\images\win11.wim`, `win10.wim`, etc.

Au déploiement, le menu technicien WinPE liste les `.wim` présents et demande
quel **index** (édition : Famille, Pro…) installer.

## 5. Déployer

1. Branchez la machine cible en Ethernet, démarrez en PXE (`F12`).
2. Menu Atelier Forge → **« Environnement technicien WinPE »**.
3. Dans WinPE → **[1] Déployer Windows** : choisissez l'image, l'index, le
   disque, confirmez. Le script partitionne (UEFI ou BIOS détecté
   automatiquement), applique l'image, injecte les pilotes et installe le
   chargeur de démarrage.
4. Redémarrez (menu **[5]**), retirez le réseau PXE de la séquence de boot :
   Windows finalise son installation.

## ⚠️ Licences

Utilisez vos ISO officiels et une **licence valide par machine**. Pour le
reconditionnement professionnel, voyez le programme **MAR** ou des licences
OEM/COA appropriées. Atelier Forge ne gère pas l'activation.
