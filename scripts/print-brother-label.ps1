param(
  [string]$PrinterName = "Brother QL-500",
  [string]$Text = "AOS DEPLOY TEST 62MM",
  [string]$Serial = "TEST-QL-62",
  [switch]$SendToPrinter
)

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root ".tmp"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$html = Join-Path $outDir "brother-ql-62-test.html"
$safeText = [System.Security.SecurityElement]::Escape($Text)
$safeSerial = [System.Security.SecurityElement]::Escape($Serial)

@"
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Brother QL 62mm test</title>
  <style>
    @page { size: 62mm 100mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: white; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .label {
      width: 62mm;
      height: 100mm;
      padding: 3mm;
      border: .5mm solid #000;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 2mm;
      overflow: hidden;
    }
    .brand { font-size: 7pt; font-weight: 900; letter-spacing: .4pt; text-transform: uppercase; }
    h1 { margin: 1mm 0 0; font-size: 18pt; line-height: 1.05; font-weight: 900; overflow-wrap: anywhere; }
    .box { border: .35mm solid #000; padding: 2mm; font-size: 11pt; font-weight: 900; overflow-wrap: anywhere; }
    .serial { border-top: .4mm solid #000; padding-top: 2mm; font-family: Consolas, monospace; font-size: 12pt; font-weight: 900; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <section class="label">
    <div>
      <div class="brand">AOS DEPLOY - BROTHER QL TEST</div>
      <h1>$safeText</h1>
    </div>
    <div class="box">Format force Windows: 62mm x 100mm<br/>Echelle impression: 100%</div>
    <div class="serial">SN: $safeSerial</div>
  </section>
</body>
</html>
"@ | Set-Content -Path $html -Encoding UTF8

if ($SendToPrinter) {
  Start-Process -FilePath $html -Verb Print
} else {
  Write-Output $html
}
