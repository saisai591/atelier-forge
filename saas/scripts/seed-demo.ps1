# Donnees de demo pour Atelier Forge (PowerShell natif).
# Necessite le backend demarre (docker compose up).
#   powershell -ExecutionPolicy Bypass -File scripts\seed-demo.ps1
param([string]$ApiUrl = "http://localhost:8000")
$ErrorActionPreference = "Stop"
$B = "$ApiUrl/api"

function PostJson($path, $body, $headers = @{}) {
  return Invoke-RestMethod -Method Post -Uri "$B$path" -Body ($body | ConvertTo-Json -Depth 6) `
    -ContentType "application/json" -Headers $headers
}
function PatchJson($path, $body, $headers = @{}) {
  return Invoke-RestMethod -Method Patch -Uri "$B$path" -Body ($body | ConvertTo-Json -Depth 6) `
    -ContentType "application/json" -Headers $headers
}

Write-Host "Creation de l'atelier + admin..."
PostJson "/tenants/" @{
  slug = "atelier"; name = "Atelier Forge"; business_type = "reconditionnement"
  branding = @{ display_name = "Atelier Forge" }
  enabled_modules = @("stock","commerce","accounting","whatsapp","atelier_forge","analytics")
  admin_email = "demo@forge.fr"; admin_password = "Demo1234!"; admin_full_name = "Said Demo"
} | Out-Null

$login = PostJson "/auth/login" @{ email = "demo@forge.fr"; password = "Demo1234!" }
$H = @{ Authorization = "Bearer $($login.access_token)" }
$key = (Invoke-RestMethod -Uri "$B/tenants/me/ingest-key" -Headers $H).ingest_key

PatchJson "/tenants/me/company" @{
  name = "Atelier Forge SARL"; address = "12 rue des Artisans"; zip_city = "75011 Paris"
  siret = "812 345 678 00012"; vat_number = "FR12812345678"; iban = "FR76 3000 4000 0100 0001"
  payment_terms = "Paiement a 30 jours"
} $H | Out-Null

Write-Host "Clients..."
$c1 = PostJson "/clients/" @{ type="grossiste"; company_name="Tech Resell SAS"; email="contact@techresell.fr"; phone="0612345678"; whatsapp="+33612345678"; discount_rate=15 } $H
PostJson "/clients/" @{ type="revendeur"; company_name="Boutique Info"; email="info@boutique.fr"; phone="0698765432"; discount_rate=10 } $H | Out-Null
PostJson "/clients/" @{ type="particulier"; first_name="Marie"; last_name="Dupont"; email="marie.dupont@gmail.com"; whatsapp="+33655443322" } $H | Out-Null
PostJson "/clients/" @{ type="semi_grossiste"; company_name="PC Pro Lyon"; email="achat@pcprolyon.fr"; discount_rate=12 } $H | Out-Null

Write-Host "Machines (pont PXE : audit + grade + certificat)..."
$kh = @{ "X-Forge-Key" = $key }
PostJson "/forge/ingest" @{ audit=@{ Fabricant="Dell"; Modele="Latitude 7420"; NumeroSerie="DET-7420"; CPU="Intel i7-1165G7"; RAM_Go=16; Batterie_Usure_pct=8; Disques=@(@{ dev="nvme0n1"; bus="nvme"; taille="512G"; sante="PASSED" }) }; certificate=@{ certificat_id="FORGE-2026-0042"; methode="NVMe Sanitize"; resultat="SUCCES"; date_fin="2026-06-18 10:00:00"; signature="BASE64SIG==" } } $kh | Out-Null
PostJson "/forge/ingest" @{ audit=@{ Fabricant="HP"; Modele="EliteBook 840 G7"; NumeroSerie="HP-840G7"; CPU="Intel i5-10310U"; RAM_Go=8; Batterie_Usure_pct=34; Disques=@(@{ dev="sda"; bus="sata"; taille="256G"; sante="PASSED" }) } } $kh | Out-Null
PostJson "/forge/ingest" @{ audit=@{ Fabricant="Lenovo"; Modele="ThinkPad T14"; NumeroSerie="LN-T14"; CPU="AMD Ryzen 5"; RAM_Go=16; Batterie_Usure_pct=52; Disques=@(@{ dev="nvme0n1"; bus="nvme"; taille="512G"; sante="Warning" }) } } $kh | Out-Null

Write-Host "Stock pret a vendre..."
$m1 = PostJson "/stock/" @{ brand="Dell"; model="Latitude 5520"; serial_number="DL-5520-A"; status="ready"; grade="A"; purchase_price=120; sale_price=289 } $H
$m2 = PostJson "/stock/" @{ brand="HP"; model="ProBook 450"; serial_number="HP-450-B"; status="ready"; grade="B"; purchase_price=90; sale_price=219 } $H

# Passer la Dell 7420 en pret
$diag = Invoke-RestMethod -Uri "$B/stock/?status=in_diagnosis" -Headers $H
$m3 = ($diag | Where-Object { $_.serial_number -eq "DET-7420" })[0]
PatchJson "/stock/$($m3.id)" @{ status="ready"; sale_price=420 } $H | Out-Null

Write-Host "Commandes..."
$ord = PostJson "/orders/" @{ client_id=$c1.id; shipping_address="15 av des Pros, 69003 Lyon"; lines=@(
  @{ stock_item_id=$m1.id; description="Dell Latitude 5520 grade A"; unit_price=289 },
  @{ stock_item_id=$m2.id; description="HP ProBook 450 grade B"; unit_price=219 }) } $H
PostJson "/orders/$($ord.id)/ship" @{ carrier="Chronopost"; tracking_number="XY987654321FR" } $H | Out-Null
PostJson "/orders/" @{ client_id=$c1.id; lines=@(@{ stock_item_id=$m3.id; description="Dell Latitude 7420 grade A"; unit_price=420 }) } $H | Out-Null

Write-Host "Factures..."
$i1 = PostJson "/invoices/" @{ client_id=$c1.id; lines=@(@{ description="Dell Latitude 5520"; unit_price_ht=240.83; vat_rate=20 }, @{ description="HP ProBook 450"; unit_price_ht=182.5; vat_rate=20 }) } $H
PostJson "/invoices/$($i1.id)/issue" @{} $H | Out-Null
PostJson "/invoices/$($i1.id)/pay" @{} $H | Out-Null
$i2 = PostJson "/invoices/" @{ client_id=$c1.id; lines=@(@{ description="Dell Latitude 7420"; unit_price_ht=350; vat_rate=20 }) } $H
PostJson "/invoices/$($i2.id)/issue" @{} $H | Out-Null

Write-Host "WhatsApp (mode console)..."
PostJson "/whatsapp/broadcast" @{ client_type="grossiste"; body="Nouveau lot de PC reconditionnes grade A disponible !" } $H | Out-Null
PostJson "/whatsapp/send" @{ to_number="+33655443322"; body="Bonjour Marie, votre commande est prete." } $H | Out-Null

Write-Host ""
Write-Host "SEED OK  ->  http://localhost:5173   (demo@forge.fr / Demo1234!)" -ForegroundColor Green
