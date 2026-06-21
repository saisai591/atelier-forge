param(
  [string]$PrinterName = "Brother QL-500",
  [string]$Title = "AOS DEPLOY",
  [string]$Subtitle = "TEST 62MM CONTINU",
  [string]$Serial = "QL500-62-TEST",
  [int]$PaperCode = 259
)

Add-Type -AssemblyName System.Drawing

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $PrinterName
if (-not $doc.PrinterSettings.IsValid) {
  throw "Imprimante invalide: $PrinterName"
}

# Use the driver's native 62mm media. Creating a custom PaperSize can make
# Brother QL drivers accept the job but never feed the label.
$paper = $doc.PrinterSettings.PaperSizes |
  Where-Object { $_.RawKind -eq $PaperCode } |
  Select-Object -First 1
if (-not $paper) {
  $paper = New-Object System.Drawing.Printing.PaperSize("Brother paper $PaperCode", 244, 394)
  $paper.RawKind = $PaperCode
}
$doc.DefaultPageSettings.PaperSize = $paper
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.DefaultPageSettings.Landscape = $false
$doc.DocumentName = "AOS Deploy Brother QL 62mm test"
$paperWidthMm = [Math]::Max(1, $paper.Width * 25.4 / 100)
$paperHeightMm = [Math]::Max(1, $paper.Height * 25.4 / 100)

$handler = [System.Drawing.Printing.PrintPageEventHandler]{
  param($sender, $event)
  $g = $event.Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  $g.Clear([System.Drawing.Color]::White)

  $black = [System.Drawing.Brushes]::Black
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 0.45)
  $fontBrand = New-Object System.Drawing.Font("Arial", 7, [System.Drawing.FontStyle]::Bold)
  $fontTitle = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
  $fontMono = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Bold)

  $w = $paperWidthMm
  $h = $paperHeightMm
  $g.DrawRectangle($pen, 1.5, 1.5, $w - 3, $h - 3)
  $g.DrawString("AOS DEPLOY - BROTHER QL", $fontBrand, $black, 3, 3)
  $g.DrawString($Title, $fontTitle, $black, 3, 8)
  $g.DrawLine($pen, 3, [Math]::Min(27, $h * 0.34), $w - 3, [Math]::Min(27, $h * 0.34))
  $g.DrawString($Subtitle, $fontBody, $black, 3, [Math]::Min(33, $h * 0.42))
  $g.DrawString("Code papier: $PaperCode", $fontBody, $black, 3, [Math]::Min(43, $h * 0.54))
  $g.DrawLine($pen, 3, $h - 18, $w - 3, $h - 18)
  $g.DrawString("SN: $Serial", $fontMono, $black, 3, $h - 14)

  $event.HasMorePages = $false
}

$doc.add_PrintPage($handler)
$doc.Print()
$doc.Dispose()
Write-Output "PrintSent=$PrinterName"
