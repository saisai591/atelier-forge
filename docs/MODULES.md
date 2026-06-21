# Menu modulaire — ajouter / retirer des entrées

Le menu de boot iPXE d'Atelier Forge est **modulaire** : il est assemblé
automatiquement à partir de petits fichiers, un par entrée. Ajouter une fonction
au menu = **déposer un fichier**, sans jamais toucher au cœur du projet.

## Comment c'est assemblé

`render-config.sh` construit `menu.ipxe` dans cet ordre :

```
boot/menu.head.ipxe        en-tête (#!ipxe, titre du menu)
  + (entrées des modules)  lignes "item ..." extraites des modules activés
boot/menu.choose.ipxe      sélecteur (choose / goto)
  + (corps des modules)    le code iPXE de chaque module
boot/menu.tail.ipxe        gestion des erreurs (:failed)
```

Les modules sont les fichiers **`modules/NN-nom.ipxe`** (triés par nom, d'où le
préfixe numérique `NN` qui fixe l'ordre d'affichage).

## Anatomie d'un module

```ipxe
# section: Diagnostic
# item: memtest    Test mémoire RAM  (Memtest86+, UEFI)
# enabled: yes
:memtest
echo Chargement de Memtest86+ ...
chain ${base}/diag/memtest.efi || goto failed
```

Trois métadonnées (commentaires lus par `render-config.sh`) :

| Métadonnée | Rôle |
|------------|------|
| `# section:` | Titre de groupe (un séparateur s'affiche quand la section change). Optionnel. |
| `# item:` | `<clé> <texte>` — la **clé** doit être identique au label `:clé` du corps. |
| `# enabled:` | `yes` (par défaut) ou `no` pour désactiver sans supprimer. |

Le **corps** (à partir de `:clé`) est du code iPXE classique. La variable
`${base}` vaut `http://SERVEUR:1950`.

## Ajouter une entrée

```bash
cp modules/00-exemple.ipxe.example modules/50-monoutil.ipxe
# éditez les 3 métadonnées + le corps
sudo ./server/render-config.sh
sudo systemctl restart forge-nginx
```

Le fichier `*.example` est ignoré ; seuls les `*.ipxe` sont pris en compte.

## Désactiver / retirer une entrée

- **Désactiver** : passez `# enabled: no` dans le module, puis régénérez.
- **Retirer** : supprimez le fichier `modules/NN-xxx.ipxe`, puis régénérez.

## Idées de modules futurs (ports déjà réservés)

- Tableau de bord d'inventaire (port **1952** réservé)
- Collecte d'audit / API interne (port **1953** réservé)
- Clonage / capture d'image, antivirus hors-ligne, mise à jour BIOS, etc.
