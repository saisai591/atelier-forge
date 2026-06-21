# Tester le PXE — serveur en VM bridgée sur un PC Windows (mode proxyDHCP)

Objectif : faire tourner le serveur **Atelier Forge** dans une machine virtuelle
Linux sur ton PC Windows **sans toucher à Windows**, et démarrer en PXE de
**vraies machines** du réseau de l'atelier.

Scénario couvert : le réseau a déjà une **box/un routeur** (DHCP existant) →
mode **proxyDHCP** (le serveur cohabite, ne distribue pas d'IP, ne casse rien).

## 0. Pré-requis IMPORTANTS

- Le PC hôte doit être en **Ethernet (câble)**. Le mode pont ne fait pas passer
  le PXE de façon fiable en **Wi-Fi**.
- La machine à tester est branchée au **même réseau filaire** (même switch/box).

## 1. Relever les infos réseau (sur Windows)

Dans PowerShell :

```powershell
ipconfig
```

Note, pour ta carte Ethernet :
- **Adresse IPv4** (ex. `192.168.1.25`)
- **Masque** (ex. `255.255.255.0`)
- **Passerelle** (ex. `192.168.1.1`)

Choisis une **IP fixe libre** pour le serveur dans le même sous-réseau, de
préférence **hors de la plage distribuée par la box** (souvent `.100`→`.200`).
Exemple retenu ici : **`192.168.1.10`**.

## 2. Installer VirtualBox

Télécharge et installe VirtualBox : https://www.virtualbox.org/

## 3. Créer la VM serveur (openSUSE MicroOS)

- Image : openSUSE MicroOS → https://get.opensuse.org/microos/
  (variante « self-install / DVD »).
- VM : **2 vCPU**, **4 Go RAM**, **20 Go disque**.
- **Réseau** (le point crucial) : Configuration → Réseau → Carte 1 :
  - **Mode d'accès réseau : Accès par pont (Bridged Adapter)**
  - **Nom** : ta carte **Ethernet** physique
  - Avancé → **Mode promiscuité : Autoriser tout (Allow All)**

Installe MicroOS, crée un utilisateur, et connecte-toi en console.

> Astuce : openSUSE Leap fonctionne aussi (il suffit de Podman + systemd), mais
> MicroOS est la cible recommandée du projet.

## 4. Fixer l'IP statique du serveur dans la VM

Vérifie le nom de l'interface :

```bash
ip -brief address
```

(souvent `eth0` ou `enp0s3`). Configure l'IP fixe `192.168.1.10` sur cette
interface (via NetworkManager `nmtui`, ou la méthode de ta distrib).

Vérifie que la VM voit le réseau :

```bash
ping -c2 192.168.1.1     # la box
```

## 5. Installer Atelier Forge dans la VM

```bash
sudo zypper install -y git        # (MicroOS: via toolbox, ou git déjà présent)
git clone https://github.com/saisai591/ss.git atelier-forge
cd atelier-forge/server
cp config.env.example config.env
```

Édite `config.env` :

```
SERVER_IP="192.168.1.10"     # l'IP fixe choisie à l'étape 1
PXE_INTERFACE="eth0"         # le nom vu via : ip -brief address
SUBNET="192.168.1.0"         # ton sous-réseau (les 3 premiers octets + .0)
DHCP_MODE="proxy"            # box présente -> proxyDHCP (cohabite)
```

Lance l'installation :

```bash
sudo ./install.sh
```

Le script construit les conteneurs (dnsmasq, nginx, samba), génère les menus,
télécharge iPXE/wimboot/Memtest, ouvre le pare-feu et démarre les services.

## 6. Démarrer une machine cible en PXE

- Branche la machine à tester sur le **même réseau filaire**.
- Allume-la et appuie sur la touche du **menu de démarrage** (souvent **F12**,
  parfois **F8/F9/F11/Échap** selon la marque).
- Choisis **« Boot réseau » / « PXE » / « Network »**.
- Tu dois voir apparaître le **menu Atelier Forge** :
  Déployer Windows · Memtest · Audit matériel · Effacement sécurisé · etc.

## 7. Dépannage rapide

| Symptôme | Piste |
|---|---|
| La cible ne reçoit pas le PXE | Hôte en **Wi-Fi** → passe en **Ethernet**. Vérifie **Promiscuité = Allow All** sur la carte bridgée. |
| « No boot filename received » | Le serveur n'est pas vu : vérifie `SERVER_IP`, `PXE_INTERFACE`, et que la cible est sur le **même sous-réseau**. |
| Le menu s'affiche mais Windows ne se déploie pas | Normal tant que tu n'as pas déposé `install.wim` + pilotes (voir `docs/WINPE.md` et `docs/DRIVERS.md`). |
| Conflit d'IP | Choisis une `SERVER_IP` **hors** de la plage DHCP de la box. |
| Vérifier les services | Sur la VM : `sudo systemctl status forge-dnsmasq forge-nginx forge-samba` |

## 8. Et après

- Déposer les images Windows + pilotes : `docs/WINPE.md`, `docs/DRIVERS.md`
- Effacement sécurisé & certificats : `docs/EFFACEMENT.md`
- Ajouter/retirer des entrées de menu : `docs/MODULES.md`
