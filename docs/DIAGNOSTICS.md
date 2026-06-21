# Diagnostic matériel

Atelier Forge propose plusieurs niveaux de diagnostic depuis le menu de boot réseau.

## 1. Memtest86+ — test de la mémoire RAM

Menu Atelier Forge → **« Test mémoire RAM »**. C'est l'application **EFI** officielle de
Memtest86+, téléchargée par `download-assets.sh` dans
`/var/lib/forge/http/diag/memtest.efi`.

- Laissez tourner **au moins un passage complet** (idéalement plusieurs heures
  pour une RAM suspecte). Toute erreur = barrette défectueuse.
- **Machines BIOS legacy** : l'entrée Memtest du menu cible l'UEFI. Sur une
  vieille machine en BIOS pur, utilisez plutôt **SystemRescue** (qui embarque un
  Memtest) ou créez une clé USB Memtest dédiée.

## 2. Diagnostic disque rapide (depuis WinPE)

Menu Atelier Forge → **WinPE** → **[3] Diagnostic disque**. Affiche, sans rien
installer :

- l'état **SMART** / santé de chaque disque (`HealthStatus`) ;
- les **compteurs de fiabilité** : température, heures de fonctionnement, usure
  (très utile pour estimer la durée de vie restante d'un SSD avant revente) ;
- une vérification du système de fichiers (`chkdsk`).

C'est l'option la plus rapide et la plus stable au quotidien en atelier.

## 3. SystemRescue — diagnostic Linux approfondi (optionnel)

Pour aller plus loin (SMART détaillé `smartctl`, test de surface `badblocks`,
stress CPU, etc.). **Cette entrée est inactive tant que vous n'avez pas déposé
les fichiers** car SystemRescue est volumineux.

### Préparer SystemRescue pour le boot réseau

1. Téléchargez l'ISO **SystemRescue** (systemrescue.org) sur le serveur.
2. Montez-la et copiez le contenu vers `http/diag/sysresc/` :
   ```bash
   sudo mkdir -p /var/lib/forge/http/diag/sysresc
   sudo mount -o loop systemrescue-*.iso /mnt
   sudo cp -r /mnt/sysresc/* /var/lib/forge/http/diag/sysresc/   # nom du dossier selon la version
   sudo umount /mnt
   ```
3. Repérez le **noyau** et l'**initramfs** (sous `sysresc/boot/x86_64/`) et
   ajustez si besoin les chemins dans `boot/menu.ipxe` (entrée `:sysresc`), puis
   `sudo ./server/render-config.sh && sudo systemctl restart forge-nginx`.

> Les noms exacts des fichiers et paramètres `archiso` varient selon la version
> de SystemRescue : reportez-vous à la doc « PXE / netboot » de SystemRescue.

### Audit Linux

Une fois sous SystemRescue, vous pouvez lancer l'audit matériel et l'écrire sur
le partage :

```bash
mount -t cifs //SERVEUR/deploy /mnt -o user=pxe,pass=pxe
/mnt/scripts/labels/../audit.sh /mnt/audit     # ou copiez diag/audit.sh
```

(Voir aussi [AUDIT-ETIQUETTES.md](AUDIT-ETIQUETTES.md).)

## Console de test web (clavier, écran, batterie, périphériques)

Certains tests sont **interactifs/visuels** et se font le mieux dans un navigateur.
Atelier Forge sert une console à **`http://SERVEUR:1950/tests/`**, à ouvrir **sur la machine
cible** (en général après déploiement de Windows, pour la vérification finale) :

- 🖥️ **Test écran / pixels morts** : couleurs plein écran + dégradés (clic ou
  Espace pour changer, `F` plein écran, Échap pour quitter).
- ⌨️ **Test clavier** : chaque touche s'allume quand on l'appuie (détection par
  code physique, AZERTY/QWERTY indifférent) ; compteur « X / Y touches OK ».
- 🔋 **Batterie** (niveau, charge, autonomie), 📷 **webcam**, 🎤 **micro**
  (vu-mètre), 🔊 **haut-parleurs** (gauche/droite), 👆 **souris / tactile**.

Aucune installation : ce sont des pages HTML/JS servies par le serveur.

## Audit rapide (quelques secondes)

L'**audit rapide** (menu WinPE [2], ou `diag/audit.sh` sous Linux) ne fait que des
**lectures instantanées** — pas de test long. Il relève :

- 🔋 **batterie** : usure (capacité nominale vs réelle) ;
- 💾 **disques** : bus **SATA / NVMe / RAID-RST**, SSD/HDD, SMART, heures, usure ;
- 🧠 **RAM** : par barrette (slot, taille, fréquence, réf), slots utilisés ;
- ⚙️ **CPU** : cœurs/threads/fréquence, virtualisation ; **TPM** (éligibilité Win11).

> Si l'audit signale « contrôleur en mode RAID/RST », le disque NVMe peut être
> invisible au déploiement : voir [DRIVERS.md](DRIVERS.md) (Intel VMD/RST).

## Que tester avant revente (mémo atelier)

- [ ] RAM : Memtest, au moins 1 passage sans erreur
- [ ] Disque : SMART « Healthy », heures/usure raisonnables, pas d'erreurs
- [ ] Batterie (portables) : usure via `Get-CimInstance` ou `BatteryReport`
- [ ] Écran / clavier / ports : contrôle visuel + Windows une fois déployé
- [ ] Audit enregistré + étiquette imprimée
