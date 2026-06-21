# Audit matériel & impression d'étiquettes

Objectif : pour chaque machine reconditionnée, produire un **rapport d'inventaire**
(traçabilité) et imprimer une **étiquette** (asset / vitrine de revente).

## 1. Lancer un audit

Deux moyens, au choix :

- **Sous WinPE** (recommandé, rapide) : menu Atelier Forge → WinPE → **[2] Audit
  matériel**. Le script `audit.ps1` collecte : fabricant, modèle, **n° de
  série**, CPU, RAM, disques + **SMART** (santé, température, heures, usure),
  adresse MAC.
- **Sous Linux** (SystemRescue) : `diag/audit.sh` produit le même type de
  rapport JSON.

Chaque audit écrit **deux fichiers** dans le partage, sous
`\\SERVEUR\deploy\audit\` :

- `<serie>_<date>.txt` — lisible directement ;
- `<serie>_<date>.json` — exploitable (étiquettes, inventaire, export tableur).

Côté serveur : `/var/lib/forge/deploy/audit/`.

## 2. Impression d'étiquettes

Le type d'imprimante se règle dans `server/config.env`
(`LABEL_PRINTER_TYPE`) puis `sudo ./server/render-config.sh`.

### Option A — Imprimante Zebra réseau (ZPL) — la plus simple

```ini
LABEL_PRINTER_TYPE="zpl"
LABEL_ZPL_HOST="192.168.1.50"
LABEL_ZPL_PORT="9100"
```

Avec ce réglage, l'audit WinPE **imprime l'étiquette automatiquement** à la fin
(`audit.ps1` envoie le ZPL directement à l'imprimante sur le port 9100). Aucun
pilote requis : c'est le mode le plus robuste pour un atelier.

L'étiquette contient : fabricant + modèle, CPU, RAM et un **code-barres du
numéro de série**.

### Option B — Imprimante CUPS (Brother QL, Dymo…)

```ini
LABEL_PRINTER_TYPE="cups"
LABEL_CUPS_QUEUE="EtiquettesAtelier"
```

`install.sh` démarre alors un conteneur **CUPS** (`forge-cups`, interface
`http://SERVEUR:1951`). Ajoutez-y votre imprimante et le pilote correspondant
(voir le Containerfile `server/containers/cups/`). L'impression se fait ensuite
**depuis le serveur** à partir du rapport JSON :

```bash
cd labels
./make-label.sh /var/lib/forge/deploy/audit/<serie>_<date>.json
```

### Option C — Pas d'impression automatique

```ini
LABEL_PRINTER_TYPE="none"
```

`make-label.sh ... --html` génère une **étiquette HTML** imprimable (gabarit
`labels/label-template.html`, format ~62 mm adaptable). Pratique pour imprimer
manuellement ou ajuster la mise en page.

## 3. Personnaliser l'étiquette

- **ZPL** : modifiez le bloc `^XA … ^XZ` dans `winpe/scripts/audit.ps1`
  (impression directe) et/ou `labels/make-label.sh` (impression serveur).
- **HTML/CUPS** : modifiez `labels/label-template.html` (taille `@page`, champs).

Champs disponibles (jetons HTML) : `@FAB@`, `@MOD@`, `@SER@`, `@CPU@`, `@RAM@`.

## 4. Inventaire / export

Les `.json` d'audit sont faciles à regrouper, par exemple :

```bash
jq -s '.' /var/lib/forge/deploy/audit/*.json > inventaire.json
```

Vous pouvez ensuite les importer dans un tableur ou un logiciel de gestion de
stock pour suivre votre parc reconditionné.
