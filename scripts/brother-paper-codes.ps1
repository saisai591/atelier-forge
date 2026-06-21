param(
  [string]$PrinterName = "Brother QL-500",
  [string]$PortName = ""
)

$code = @"
using System;
using System.Runtime.InteropServices;

public static class DeviceCapsNative {
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern int DeviceCapabilities(string pDevice, string pPort, short fwCapability, IntPtr pOutput, IntPtr pDevMode);
}
"@

Add-Type $code -ErrorAction Stop

if (-not $PortName) {
  $printer = Get-CimInstance Win32_Printer -Filter "Name='$PrinterName'"
  $PortName = $printer.PortName
}

$DC_PAPERNAMES = 16
$DC_PAPERS = 2
$DC_PAPERSIZE = 3

$count = [DeviceCapsNative]::DeviceCapabilities($PrinterName, $PortName, $DC_PAPERNAMES, [IntPtr]::Zero, [IntPtr]::Zero)
if ($count -le 0) {
  throw "DeviceCapabilities returned no paper names. LastError=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}

$namesPtr = [Runtime.InteropServices.Marshal]::AllocHGlobal($count * 64 * 2)
$papersPtr = [Runtime.InteropServices.Marshal]::AllocHGlobal($count * 2)
$sizesPtr = [Runtime.InteropServices.Marshal]::AllocHGlobal($count * 8)
try {
  [void][DeviceCapsNative]::DeviceCapabilities($PrinterName, $PortName, $DC_PAPERNAMES, $namesPtr, [IntPtr]::Zero)
  [void][DeviceCapsNative]::DeviceCapabilities($PrinterName, $PortName, $DC_PAPERS, $papersPtr, [IntPtr]::Zero)
  [void][DeviceCapsNative]::DeviceCapabilities($PrinterName, $PortName, $DC_PAPERSIZE, $sizesPtr, [IntPtr]::Zero)
  for ($i = 0; $i -lt $count; $i++) {
    $namePtr = [IntPtr]($namesPtr.ToInt64() + ($i * 64 * 2))
    $name = [Runtime.InteropServices.Marshal]::PtrToStringUni($namePtr, 64).Trim([char]0).Trim()
    $paper = [Runtime.InteropServices.Marshal]::ReadInt16($papersPtr, $i * 2)
    $x = [Runtime.InteropServices.Marshal]::ReadInt32($sizesPtr, $i * 8)
    $y = [Runtime.InteropServices.Marshal]::ReadInt32($sizesPtr, ($i * 8) + 4)
    [pscustomobject]@{
      Index = $i
      Code = $paper
      Name = $name
      WidthTenthMm = $x
      LengthTenthMm = $y
    }
  }
} finally {
  [Runtime.InteropServices.Marshal]::FreeHGlobal($namesPtr)
  [Runtime.InteropServices.Marshal]::FreeHGlobal($papersPtr)
  [Runtime.InteropServices.Marshal]::FreeHGlobal($sizesPtr)
}
