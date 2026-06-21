# Dépannage

## Méthode générale

```bash
sudo ./scripts/check-server.sh          # état global
journalctl -u forge-dnsmasq -f          # requêtes PXE/DHCP en direct
journalctl -u forge-nginx -f            # accès HTTP
podman ps                               # conteneurs actifs
podman logs forge-dnsmasq               # logs d'un conteneur
```

## La machine cible ne démarre pas en réseau (pas de menu)

1. **Câble & port** : le PXE exige l'**Ethernet** (pas de Wi-Fi). Vérifiez la
   liaison.
2. **BIOS de la cible** : activez « Network/PXE boot », et choisissez le bon mode
   (UEFI **ou** Legacy/CSM) cohérent avec l'OS visé. Touche de boot : souvent
   `F12`.
3. **Secure Boot** : peut bloquer iPXE. Désactivez-le sur la cible pour les tests
   (réactivez après si besoin), ou utilisez un iPXE signé.
4. **Le serveur reçoit-il la requête ?**
   ```bash
   journalctl -u forge-dnsmasq -f
   ```
   Démarrez la cible : vous devez voir des lignes `DHCP`/`PXE`/`TFTP`.
   - **Rien** → problème réseau/VLAN entre la cible et le serveur, ou mauvaise
     `PXE_INTERFACE` dans `config.env`.
5. **Deux serveurs DHCP ?** En mode `proxy`, dnsmasq cohabite avec la box. Si vous
   aviez mis `standalone` par erreur sur un réseau avec box, vous créez un
   conflit : repassez en `proxy`, `render-config.sh`, redémarrez le service.

## iPXE se charge puis boucle / revient au début

- Vérifie que le menu est accessible :
  ```bash
  curl http://SERVER_IP/boot/menu.ipxe
  ```
  Doit renvoyer le script (et pas une erreur 404/HTML).
- Si 404 : `render-config.sh` n'a pas généré le menu, ou nginx ne sert pas le bon
  dossier. Relancez `sudo ./server/render-config.sh` puis
  `sudo systemctl restart forge-nginx`.

## « Partage indisponible » en boucle dans WinPE

- Pilote **réseau** manquant dans WinPE → injectez-le (voir [DRIVERS.md](DRIVERS.md)).
- Identifiants `SMB_USER`/`SMB_PASSWORD` différents entre `config.env` et le
  WinPE construit : reconstruisez WinPE avec les bons identifiants, ou alignez
  `config.env` puis `render-config.sh`.
- Testez le partage depuis une autre machine : `\\SERVER_IP\deploy`.
- Vérifiez le conteneur Samba : `podman logs forge-samba`.

## diskpart ne voit aucun disque

- Pilote **stockage** manquant dans WinPE (NVMe/RAID/Intel VMD). Injectez-le, ou
  désactivez « Intel VMD/RST » dans le BIOS de la cible. Voir [DRIVERS.md](DRIVERS.md).

## Le déploiement échoue à `dism /Apply-Image`

- Image absente/corrompue : vérifiez `Z:\images\*.wim` et l'**index** choisi
  (`dism /Get-ImageInfo /ImageFile:Z:\images\votreimage.wim`).
- Disque non partitionné/formaté : relancez le déploiement (l'étape diskpart doit
  réussir avant l'application).

## Windows déployé ne démarre pas (après reboot)

- Mauvais firmware : une image appliquée en **GPT/UEFI** ne démarre pas en
  **BIOS/MBR** et inversement. `deploy.cmd` détecte le firmware ; assurez-vous
  que le BIOS de la cible est dans le **même mode** au déploiement et au boot
  final.
- Pensez à **retirer le boot PXE** de la séquence après déploiement, sinon la
  machine repart sur le réseau.

## Memtest ne se lance pas

- Le fichier `http/diag/memtest.efi` est-il présent ? Sinon relancez
  `sudo ./server/download-assets.sh` (vérifiez l'accès Internet, et l'URL/version
  en haut du script si Memtest a changé de version).
- Machine **BIOS legacy** : l'entrée vise l'UEFI → utilisez SystemRescue.

## Les téléchargements d'install.sh échouent

- Accès Internet du serveur ? `curl -I https://boot.ipxe.org/ipxe.efi`
- Politique réseau de l'environnement bloquant les domaines ? Les URL sont en
  haut de `server/download-assets.sh` : récupérez les fichiers manuellement et
  placez-les aux emplacements indiqués, puis relancez `check-server.sh`.

## Réinitialiser proprement

```bash
sudo ./server/uninstall.sh        # arrête tout, garde les données
sudo ./server/install.sh          # réinstalle
```
