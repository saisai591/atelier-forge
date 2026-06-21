#!/usr/bin/env bash
# Données de démo pour Atelier Forge. Nécessite le backend démarré.
#   bash scripts/seed-demo.sh            (API sur http://localhost:8000)
#   API_URL=http://host:8000 bash scripts/seed-demo.sh
set -e
B="${API_URL:-http://localhost:8000}/api"
curl -s -X POST $B/tenants/ -H "Content-Type: application/json" -d '{
  "slug":"atelier","name":"Atelier Forge","business_type":"reconditionnement",
  "branding":{"display_name":"Atelier Forge"},
  "enabled_modules":["stock","commerce","accounting","whatsapp","atelier_forge","analytics"],
  "admin_email":"demo@forge.fr","admin_password":"Demo1234!","admin_full_name":"Said Demo"}' >/dev/null

TOKEN=$(curl -s -X POST $B/auth/login -H "Content-Type: application/json" -d '{"email":"demo@forge.fr","password":"Demo1234!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
A="Authorization: Bearer $TOKEN"
KEY=$(curl -s -H "$A" $B/tenants/me/ingest-key | python3 -c "import sys,json;print(json.load(sys.stdin)['ingest_key'])")

# Identité société (pour PDF)
curl -s -X PATCH $B/tenants/me/company -H "$A" -H "Content-Type: application/json" -d '{"name":"Atelier Forge SARL","address":"12 rue des Artisans","zip_city":"75011 Paris","siret":"812 345 678 00012","vat_number":"FR12812345678","iban":"FR76 3000 4000 0100 0001","payment_terms":"Paiement a 30 jours"}' >/dev/null

# Clients
C1=$(curl -s -X POST $B/clients/ -H "$A" -H "Content-Type: application/json" -d '{"type":"grossiste","company_name":"Tech Resell SAS","email":"contact@techresell.fr","phone":"0612345678","whatsapp":"+33612345678","discount_rate":15}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST $B/clients/ -H "$A" -H "Content-Type: application/json" -d '{"type":"revendeur","company_name":"Boutique Info","email":"info@boutique.fr","phone":"0698765432","discount_rate":10}' >/dev/null
curl -s -X POST $B/clients/ -H "$A" -H "Content-Type: application/json" -d '{"type":"particulier","first_name":"Marie","last_name":"Dupont","email":"marie.dupont@gmail.com","whatsapp":"+33655443322"}' >/dev/null
curl -s -X POST $B/clients/ -H "$A" -H "Content-Type: application/json" -d '{"type":"semi_grossiste","company_name":"PC Pro Lyon","email":"achat@pcprolyon.fr","discount_rate":12}' >/dev/null

# Machines via pont PXE (audit + grade auto + certificat)
curl -s -X POST $B/forge/ingest -H "X-Forge-Key: $KEY" -H "Content-Type: application/json" -d '{"audit":{"Fabricant":"Dell","Modele":"Latitude 7420","NumeroSerie":"DET-7420","CPU":"Intel i7-1165G7","RAM_Go":16,"Batterie_Usure_pct":8,"Disques":[{"dev":"nvme0n1","bus":"nvme","taille":"512G","sante":"PASSED"}]},"certificate":{"certificat_id":"FORGE-2026-0042","methode":"NVMe Sanitize","resultat":"SUCCES","date_fin":"2026-06-18 10:00:00","signature":"BASE64SIG=="}}' >/dev/null
curl -s -X POST $B/forge/ingest -H "X-Forge-Key: $KEY" -H "Content-Type: application/json" -d '{"audit":{"Fabricant":"HP","Modele":"EliteBook 840 G7","NumeroSerie":"HP-840G7","CPU":"Intel i5-10310U","RAM_Go":8,"Batterie_Usure_pct":34,"Disques":[{"dev":"sda","bus":"sata","taille":"256G","sante":"PASSED"}]}}' >/dev/null
curl -s -X POST $B/forge/ingest -H "X-Forge-Key: $KEY" -H "Content-Type: application/json" -d '{"audit":{"Fabricant":"Lenovo","Modele":"ThinkPad T14","NumeroSerie":"LN-T14","CPU":"AMD Ryzen 5","RAM_Go":16,"Batterie_Usure_pct":52,"Disques":[{"dev":"nvme0n1","bus":"nvme","taille":"512G","sante":"Warning"}]}}' >/dev/null

# Machines stock direct (prêtes à vendre)
M1=$(curl -s -X POST $B/stock/ -H "$A" -H "Content-Type: application/json" -d '{"brand":"Dell","model":"Latitude 5520","serial_number":"DL-5520-A","status":"ready","grade":"A","purchase_price":120,"sale_price":289}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
M2=$(curl -s -X POST $B/stock/ -H "$A" -H "Content-Type: application/json" -d '{"brand":"HP","model":"ProBook 450","serial_number":"HP-450-B","status":"ready","grade":"B","purchase_price":90,"sale_price":219}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

# Mettre la Dell 7420 en ready aussi
M3=$(curl -s -H "$A" "$B/stock/?status=in_diagnosis" | python3 -c "import sys,json;d=json.load(sys.stdin);print([x['id'] for x in d if x['serial_number']=='DET-7420'][0])")
curl -s -X PATCH $B/stock/$M3 -H "$A" -H "Content-Type: application/json" -d '{"status":"ready","sale_price":420}' >/dev/null

# Commande grossiste (2 machines) -> expédiée
ORD=$(curl -s -X POST $B/orders/ -H "$A" -H "Content-Type: application/json" -d "{\"client_id\":\"$C1\",\"shipping_address\":\"15 av des Pros, 69003 Lyon\",\"lines\":[{\"stock_item_id\":\"$M1\",\"description\":\"Dell Latitude 5520 grade A\",\"unit_price\":289},{\"stock_item_id\":\"$M2\",\"description\":\"HP ProBook 450 grade B\",\"unit_price\":219}]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST $B/orders/$ORD/ship -H "$A" -H "Content-Type: application/json" -d '{"carrier":"Chronopost","tracking_number":"XY987654321FR"}' >/dev/null

# Une commande en devis
curl -s -X POST $B/orders/ -H "$A" -H "Content-Type: application/json" -d "{\"client_id\":\"$C1\",\"lines\":[{\"stock_item_id\":\"$M3\",\"description\":\"Dell Latitude 7420 grade A\",\"unit_price\":420}]}" >/dev/null

# Factures : une payée, une émise
I1=$(curl -s -X POST $B/invoices/ -H "$A" -H "Content-Type: application/json" -d "{\"client_id\":\"$C1\",\"lines\":[{\"description\":\"Dell Latitude 5520\",\"unit_price_ht\":240.83,\"vat_rate\":20},{\"description\":\"HP ProBook 450\",\"unit_price_ht\":182.5,\"vat_rate\":20}]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST $B/invoices/$I1/issue -H "$A" >/dev/null
curl -s -X POST $B/invoices/$I1/pay -H "$A" >/dev/null
I2=$(curl -s -X POST $B/invoices/ -H "$A" -H "Content-Type: application/json" -d "{\"client_id\":\"$C1\",\"lines\":[{\"description\":\"Dell Latitude 7420\",\"unit_price_ht\":350,\"vat_rate\":20}]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -X POST $B/invoices/$I2/issue -H "$A" >/dev/null

# Diffusion WhatsApp (mode console)
curl -s -X POST $B/whatsapp/broadcast -H "$A" -H "Content-Type: application/json" -d '{"client_type":"grossiste","body":"Nouveau lot de PC reconditionnes grade A disponible !"}' >/dev/null
curl -s -X POST $B/whatsapp/send -H "$A" -H "Content-Type: application/json" -d '{"to_number":"+33655443322","body":"Bonjour Marie, votre commande est prete."}' >/dev/null

echo "SEED OK"
