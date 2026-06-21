# Injection de pilotes

En reconditionnement, les machines sont très variées : il faut souvent fournir
des pilotes (chipset, réseau, stockage NVMe/RAID, etc.). Atelier Forge gère **deux
endroits** d'injection de pilotes, à ne pas confondre.

## 1. Pilotes injectés dans Windows déployé (cas le plus courant)

Ce sont les pilotes ajoutés à l'image Windows **au moment du déploiement**, pour
que le Windows installé fonctionne du premier coup.

- Déposez-les dans le partage : `\\SERVEUR\deploy\drivers\`
- Organisez-les en sous-dossiers (peu importe l'arborescence) ; chaque pilote
  doit contenir son fichier **`.inf`**.
- `deploy.cmd` exécute automatiquement :
  ```
  dism /Image:W:\ /Add-Driver /Driver:Z:\drivers /Recurse /ForceUnsigned
  ```
  `/Recurse` parcourt tous les sous-dossiers : vous pouvez constituer une
  bibliothèque (un dossier par marque/modèle, ou un fourre-tout générique).

**Conseil atelier** : gardez un dossier `drivers\generique\` (réseau Intel/Realtek,
chipset AMD/Intel, USB3, stockage Intel RST/NVMe) appliqué à toutes les machines,
et ajoutez des dossiers spécifiques par modèle si besoin.

### Où trouver les pilotes
- Outils constructeur : Dell Command | Deploy, HP Image Assistant / Driver Packs,
  Lenovo SCCM/Driver Packs — ils fournissent des **packs `.inf`** prêts pour DISM.
- Décompressez les exécutables fabricant pour récupérer les `.inf` (un `.exe` ne
  s'injecte pas avec DISM, seulement les `.inf`/`.sys`/`.cat`).

## 2. Pilotes injectés dans WinPE lui-même

Parfois WinPE **ne voit pas** la carte réseau ou le disque d'une machine très
récente (donc impossible de monter le partage ou de partitionner). Il faut alors
injecter ces pilotes **dans l'image WinPE**, à la construction :

```powershell
.\build-winpe.ps1 -ServerIP 192.168.1.10 `
    -WinpeDriversPath C:\pilotes-winpe
```

Mettez dans `C:\pilotes-winpe` uniquement les pilotes **réseau** et **stockage**
indispensables au démarrage. Inutile d'y mettre toute votre bibliothèque.

### Symptômes typiques
| Symptôme | Solution |
|----------|----------|
| WinPE démarre mais « partage indisponible » en boucle | pilote **réseau** manquant dans WinPE |
| `diskpart` ne liste aucun disque | pilote **stockage** (NVMe/RAID/Intel VMD) manquant dans WinPE |
| Windows déployé démarre sans réseau / écran générique | pilotes manquants dans `\deploy\drivers\` |

> Astuce Intel VMD (PC récents) : désactivez « Intel VMD/RST » dans le BIOS de la
> machine cible **ou** injectez le pilote VMD dans WinPE, sinon le disque NVMe
> est invisible.

## Vérifier les pilotes injectés (après coup)

Depuis WinPE, sur le Windows fraîchement appliqué (W:) :

```
dism /Image:W:\ /Get-Drivers
```
