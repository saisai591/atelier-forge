# Installation du serveur Atelier Forge (openSUSE MicroOS)

## 1. Pré-requis

- Une machine dédiée sous **openSUSE MicroOS** (une tour reconditionnée fait
  très bien l'affaire), avec **Podman** (présent par défaut).
- Une **adresse IP fixe** sur le réseau de l'atelier.
- Connexion filaire **Ethernet** entre le serveur et les machines à traiter
  (le PXE ne fonctionne pas en Wi-Fi).
- Accès Internet sur le serveur pour le premier `install.sh` (téléchargement
  d'iPXE, wimboot, Memtest).

### Donner une IP fixe au serveur

Repérez l'interface : `ip -brief address`. Puis, avec NetworkManager
(présent sur MicroOS) :

```bash
nmcli con mod "votre-connexion" ipv4.addresses 192.168.1.10/24 \
    ipv4.gateway 192.168.1.1 ipv4.dns 192.168.1.1 ipv4.method manual
nmcli con up "votre-connexion"
```

## 2. Récupérer Atelier Forge et configurer

```bash
git clone <ce-depot> atelier-forge
cd atelier-forge/server
cp config.env.example config.env
vi config.env
```

Renseignez au minimum :

| Variable | Exemple | Rôle |
|----------|---------|------|
| `SERVER_IP` | `192.168.1.10` | IP fixe du serveur |
| `PXE_INTERFACE` | `eth0` / `enp3s0` | interface réseau |
| `SUBNET` | `192.168.1.0` | sous-réseau (mode proxy) |
| `DHCP_MODE` | `proxy` | **proxy** = cohabite avec la box (recommandé) |

> **Mode `proxy` vs `standalone`** : gardez `proxy` si votre atelier a déjà une
> box/un routeur qui distribue les IP. N'utilisez `standalone` que sur un
> réseau totalement isolé, sinon vous créez des conflits DHCP.

### Ports utilisés

| Service | Port | Configurable |
|---------|------|--------------|
| DHCP / proxyDHCP | 67/68 + 4011 UDP | ❌ imposé par la norme PXE |
| TFTP | 69 UDP | ❌ imposé par la norme PXE |
| HTTP (menus iPXE, WinPE, console de test) | **1950** (`HTTP_PORT`) | ✅ |
| Samba / SMB | 445 | ❌ exigé par WinPE |
| CUPS (option étiquettes) | 1951 (`CUPS_PORT`) | ✅ |

> Les ports du **démarrage PXE** (DHCP, TFTP) et **SMB** ne peuvent pas être
> déplacés : ils sont câblés dans le firmware réseau / WinPE. Seuls **HTTP** et
> **CUPS** sont libres ; HTTP est réservé à partir de **1950**. iPXE chaîne
> automatiquement sur `http://SERVEUR:1950/...`.

## 3. Installer

```bash
sudo ./install.sh
```

Le script construit les conteneurs, génère les configs, télécharge les
binaires, installe les unités **Quadlet** et démarre tout.

> MicroOS est immuable : **rien n'est installé dans le système**. Si jamais
> Podman manquait : `transactional-update pkg install podman` puis `reboot`.

## 4. Vérifier

```bash
sudo ./scripts/check-server.sh
```

Vous devez voir les services `forge-dnsmasq`, `forge-nginx`, `forge-samba`
actifs et le menu iPXE accessible.

Commandes utiles :

```bash
systemctl status forge-dnsmasq.service
journalctl -u forge-dnsmasq -f      # voir les requêtes PXE en direct
podman ps                            # conteneurs en cours
```

## 5. Étapes suivantes (une seule fois)

1. **Construire WinPE** côté Windows → [WINPE.md](WINPE.md), puis copier le
   dossier `media` dans `/var/lib/forge/http/winpe/`.
2. **Déposer les pilotes** → [DRIVERS.md](DRIVERS.md).
3. **Déposer vos images Windows** (`install.wim`) dans
   `/var/lib/forge/deploy/images/`.
4. **Tester** : démarrez une machine cible, appuyez sur la touche de boot
   réseau (souvent `F12`, parfois `F8`/`F9`/`F11`), choisissez la carte
   réseau / « UEFI PXE », et le menu Atelier Forge doit apparaître.

## Mise à jour de la configuration

Après modification de `config.env` ou des menus/scripts :

```bash
cd server
sudo ./render-config.sh          # régénère configs + menus + scripts du partage
sudo systemctl restart forge-dnsmasq forge-nginx forge-samba
```

Pas besoin de reconstruire WinPE : les scripts technicien sont sur le partage.

## Désinstallation

```bash
sudo ./server/uninstall.sh           # garde les données
sudo ./server/uninstall.sh --purge   # supprime aussi /var/lib/forge
```
