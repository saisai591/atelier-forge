# Notes Final Group pour AtelierOS

Ces notes servent a garder les idees utiles vues dans `C:\Users\Admin\Documents\FINAL GROUP`.
Ne pas copier les anciens projets directement sans validation. La regle est de reprendre les concepts utiles et de les reintegrer proprement dans l'architecture actuelle.

## Structure observee

- `00-vue-globale-atelieros`: vision globale et routage de travail.
- `01-os-deploy`: module technique Deploy, PXE, WinPE, audit, deploiement.
- `02-erp-atelieros`: ERP metier prevu pour stock, atelier, mobile, API et licences.
- `03-wordpress-woocommerce`: site public, boutique, paiement, portail client.
- `04-marketing-publicite`: contenus marketing et analyse marche.
- `05-control-center`: verification globale, coherence, backups.
- `06-modules-separes`: prototypes et briques a reintegrer.
- `08-erpos`: axe ERP/licences/modules/pricing.

## Decision produit

AtelierOS doit devenir une plateforme modulaire:

- `Deploy`: moteur technique.
- `Audit`: tests, rapports, etiquettes machine.
- `Atelier ERP`: receptions, palettes, techniciens, stock, tickets.
- `Vente`: preparation annonce, prix, exports, documents client.
- `Connecteurs`: WooCommerce, marketplace, ERP externe, API.
- `Mobile/PDA`: scan, inventaire, reception, sortie palette.

## Modules a prevoir

### Import fournisseur

- Glisser-deposer Excel, CSV, XML.
- Mapping intelligent de colonnes.
- Mapping memorise par fournisseur.
- Creation automatique de reception, palettes et fiches items.

### Reception atelier

- Arrivage fournisseur.
- Palettes entrantes.
- Scan code-barres ou numero de serie.
- Ecarts entre fichier et reception reelle.
- Etiquettes palette interne.

### Terminaux atelier

- PDA Android.
- Tablettes Android.
- iPad.
- Douchettes USB/Bluetooth.
- Terminaux code-barres type Unitech.

Le flux doit rester utilisable sans clavier complet.

### Sortie client

- Preparation palettes client.
- Affectation items par scan.
- Etiquette palette client.
- BL / bordereau de livraison PDF.
- Liste de colisage.
- Documents transporteur.

## Regle anti-regression

Ne pas transformer `Deploy` en ERP complet. `Deploy` reste le moteur technique.
Les fonctions reception, stock, palettes, vente et transport appartiennent au module `Atelier ERP`, connecte a Deploy par audit, QR code, numero de serie et API.
