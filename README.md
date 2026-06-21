# Atelier Forge — Déploiement Windows, diagnostic & audit pour atelier de reconditionnement

Boîte à outils **PXE / boot réseau** clé en main, conçue pour tourner sur
**openSUSE MicroOS** (système immuable) avec **Podman + Quadlet**.

Objectif : sur un parc de machines récupérées, pouvoir en un seul boot réseau
(touche `F12` / `F8` / `F9` selon le BIOS) :

1. **Déployer Windows** automatiquement (avec **injection de pilotes**) ;
2. **Diagnostiquer le matériel** : audit rapide (batterie, disques SATA/NVMe/RST,
   RAM, CPU, TPM) + tests (Memtest, écran/pixels, clavier, webcam… via console web) ;
3. **Auditer** chaque machine (inventaire matériel) et générer un rapport ;
4. **Imprimer une étiquette** d'inventaire/asset pour la revente ;
5. **Effacer les disques de façon sécurisée** (NIST 800-88) avec **certificat
   signé numériquement** et vérifiable (conformité RGPD avant revente).

## Pourquoi MicroOS + Podman/Quadlet

- **Système immuable** : la racine est en lecture seule → le serveur reste
  stable, on ne le « casse » pas par une mauvaise manip.
- **Services en conteneurs** : dnsmasq, nginx et Samba tournent isolés, gérés
  par **systemd via Quadlet**, redémarrage automatique en cas de coupure.
- **Évolutif** : ajouter une fonction (impression d'étiquettes via CUPS,
  collecte d'audit…) = ajouter un conteneur, **sans toucher au système ni
  redémarrer**.

## Architecture (stabilité avant tout)

| Composant | Rôle | Conteneur |
|-----------|------|-----------|
| **dnsmasq** (proxyDHCP + TFTP) | Indique aux machines où démarrer, sert le chargeur iPXE | `forge-dnsmasq` (réseau hôte) |
| **iPXE** | Chargeur réseau → bascule sur HTTP (rapide/fiable) | servi par nginx |
| **nginx** | Sert menus iPXE, WinPE (wimboot), outils de diagnostic | `forge-nginx` |
| **Samba** | Partage les images Windows + reçoit les rapports d'audit | `forge-samba` |
| **CUPS** *(option)* | Impression des étiquettes d'inventaire | `forge-cups` |

Le mode **proxyDHCP** de dnsmasq **n'attribue pas d'IP** : il cohabite avec la
box/routeur de l'atelier sans casser le réseau existant.

```
[ Machine cible ] --PXE/DHCP--> [ Serveur MicroOS / Atelier Forge ]
   1. "Où démarrer ?"  ->  dnsmasq (proxyDHCP) répond : charge iPXE (TFTP)
   2. iPXE redemande   ->  nginx sert le menu via HTTP
                         +-------------------------------------------+
                         |  MENU iPXE                                |
                         |  - Déployer Windows (WinPE + pilotes)     |
                         |  - Memtest86+ (RAM)                       |
                         |  - SystemRescue (disques/SMART/CPU)       |
                         |  - Audit matériel  -> rapport + étiquette |
                         |  - Effacement sécurisé -> certificat signé|
                         |  - Démarrer le disque local               |
                         +-------------------------------------------+
```

## Installation rapide (sur le serveur MicroOS)

```bash
# Sur la machine serveur sous openSUSE MicroOS, en root :
git clone <ce-depot> atelier-forge && cd atelier-forge/server
cp config.env.example config.env
vi config.env                  # IP du serveur, interface réseau, imprimante...
./install.sh                   # construit les conteneurs et installe les unités Quadlet
```

`install.sh` :
1. construit les images Podman (dnsmasq, samba) et récupère nginx ;
2. génère les configurations + menus iPXE à partir de `config.env` ;
3. télécharge iPXE, wimboot et Memtest86+ ;
4. installe les unités **Quadlet** dans `/etc/containers/systemd/` et démarre tout.

> MicroOS étant immuable, **aucun paquet n'est installé dans l'OS** : tout passe
> par Podman. Podman est déjà présent sur MicroOS.

Ensuite, **une seule fois côté Windows**, construisez l'image WinPE et déposez
vos `install.wim` + pilotes (voir [`docs/WINPE.md`](docs/WINPE.md) et
[`docs/DRIVERS.md`](docs/DRIVERS.md)).

## Documentation

- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — installation détaillée (MicroOS/Podman)
- [`docs/WINPE.md`](docs/WINPE.md) — construire WinPE et préparer les images Windows
- [`docs/DRIVERS.md`](docs/DRIVERS.md) — injection de pilotes (réseau, stockage, chipset)
- [`docs/DIAGNOSTICS.md`](docs/DIAGNOSTICS.md) — Memtest, SystemRescue, diagnostic WinPE
- [`docs/AUDIT-ETIQUETTES.md`](docs/AUDIT-ETIQUETTES.md) — audit matériel & impression d'étiquettes
- [`docs/EFFACEMENT.md`](docs/EFFACEMENT.md) — effacement sécurisé & certificats signés (RGPD)
- [`docs/MODULES.md`](docs/MODULES.md) — menu modulaire : ajouter/retirer des entrées
- [`docs/DEPANNAGE.md`](docs/DEPANNAGE.md) — problèmes courants
- [`docs/ROADMAP-ANTI-REGRESSION.md`](docs/ROADMAP-ANTI-REGRESSION.md) — suivi projet, garde-fous et sequence de redeploiement

## Arborescence

```
atelier-forge/
├── server/
│   ├── install.sh / uninstall.sh
│   ├── render-config.sh        Génère configs + menus depuis config.env
│   ├── download-assets.sh      Récupère iPXE, wimboot, Memtest86+
│   ├── containers/             Containerfiles (dnsmasq, samba, cups)
│   └── quadlet/                Unités systemd Quadlet (.container)
├── boot/                       Fragments du menu iPXE (head / choose / tail)
├── modules/                    Modules de menu (1 fichier = 1 entrée, drop-in)
├── winpe/                      Scripts WinPE (déploiement, pilotes, audit, effacement)
├── diag/                       Scripts d'audit Linux (SystemRescue)
├── wipe/                       Effacement sécurisé + certificats signés
├── labels/                     Génération/impression d'étiquettes
├── webtests/                   Console de test web (écran, clavier, batterie…)
├── tests/                      Suite anti-régression
├── scripts/                    Vérification / maintenance
└── docs/                       Documentation (FR)
```

## ⚠️ Licences Windows — important

Cet outil **ne fournit ni Windows ni aucune licence**. Vous devez utiliser vos
propres ISO Microsoft officiels et disposer d'une **licence valide par machine
revendue**. Pour le reconditionnement professionnel, voyez le programme
**Microsoft Authorized Refurbisher (MAR)** ou les licences OEM/COA adaptées.
Atelier Forge est un outil **technique** ; la conformité des licences reste de votre
responsabilité.

## Licence

Code sous licence MIT (voir [`LICENSE`](LICENSE)).
