param(
  [string]$PrinterName = "Brother QL-500",
  [ValidateSet("show", "force62continuous", "force62x100", "force62x100DieCut", "forcePaperCode")]
  [string]$Mode = "show",
  [int]$PaperCode = 259,
  [int]$WidthTenthMm = 620,
  [int]$LengthTenthMm = 1000
)

$code = @"
using System;
using System.Runtime.InteropServices;

public static class PrinterNative {
  [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern int DocumentProperties(IntPtr hwnd, IntPtr hPrinter, string pDeviceName, IntPtr pDevModeOutput, IntPtr pDevModeInput, int fMode);

  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool SetPrinter(IntPtr hPrinter, int Level, IntPtr pPrinter, int Command);
}

[StructLayout(LayoutKind.Sequential)]
public struct PRINTER_INFO_9 {
  public IntPtr pDevMode;
}

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct DEVMODE_HEAD {
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
  public string dmDeviceName;
  public ushort dmSpecVersion;
  public ushort dmDriverVersion;
  public ushort dmSize;
  public ushort dmDriverExtra;
  public uint dmFields;
  public short dmOrientation;
  public short dmPaperSize;
  public short dmPaperLength;
  public short dmPaperWidth;
}
"@

Add-Type $code -ErrorAction Stop

$DM_OUT_BUFFER = 2
$DM_IN_BUFFER = 8
$DM_ORIENTATION = 0x00000001
$DM_PAPERSIZE = 0x00000002
$DM_PAPERLENGTH = 0x00000004
$DM_PAPERWIDTH = 0x00000008
$DMPAPER_USER = 256

$handle = [IntPtr]::Zero
if (-not [PrinterNative]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
  throw "OpenPrinter failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}

try {
  $size = [PrinterNative]::DocumentProperties([IntPtr]::Zero, $handle, $PrinterName, [IntPtr]::Zero, [IntPtr]::Zero, 0)
  if ($size -lt 0) {
    throw "DocumentProperties size failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  $ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($size)
  try {
    $read = [PrinterNative]::DocumentProperties([IntPtr]::Zero, $handle, $PrinterName, $ptr, [IntPtr]::Zero, $DM_OUT_BUFFER)
    if ($read -lt 0) {
      throw "DocumentProperties read failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }
    $head = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][DEVMODE_HEAD])
    [pscustomobject]@{
      Phase = "Before"
      Device = $head.dmDeviceName
      Fields = ('0x{0:X8}' -f $head.dmFields)
      Orientation = $head.dmOrientation
      PaperSize = $head.dmPaperSize
      PaperWidthTenthMm = $head.dmPaperWidth
      PaperLengthTenthMm = $head.dmPaperLength
      DriverExtra = $head.dmDriverExtra
    }

    if ($Mode -ne "show") {
      $head.dmFields = $head.dmFields -bor $DM_ORIENTATION -bor $DM_PAPERSIZE -bor $DM_PAPERWIDTH -bor $DM_PAPERLENGTH
      $head.dmOrientation = 1
      $head.dmPaperWidth = [int16]$WidthTenthMm
      $head.dmPaperLength = [int16]$LengthTenthMm
      if ($Mode -eq "force62continuous") {
        $head.dmPaperSize = 259
      } elseif ($Mode -eq "force62x100DieCut") {
        $head.dmPaperSize = 275
      } elseif ($Mode -eq "forcePaperCode") {
        $head.dmPaperSize = [int16]$PaperCode
      } else {
        $head.dmPaperSize = $DMPAPER_USER
      }
      [Runtime.InteropServices.Marshal]::StructureToPtr($head, $ptr, $false)
      $apply = [PrinterNative]::DocumentProperties([IntPtr]::Zero, $handle, $PrinterName, $ptr, $ptr, $DM_IN_BUFFER -bor $DM_OUT_BUFFER)
      $info = New-Object PRINTER_INFO_9
      $info.pDevMode = $ptr
      $infoPtr = [Runtime.InteropServices.Marshal]::AllocHGlobal([Runtime.InteropServices.Marshal]::SizeOf([type][PRINTER_INFO_9]))
      try {
        [Runtime.InteropServices.Marshal]::StructureToPtr($info, $infoPtr, $false)
        $setOk = [PrinterNative]::SetPrinter($handle, 9, $infoPtr, 0)
        $setError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      } finally {
        [Runtime.InteropServices.Marshal]::FreeHGlobal($infoPtr)
      }
      $after = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][DEVMODE_HEAD])
      [pscustomobject]@{
        Phase = "After"
        ApplyResult = $apply
        SetPrinter = $setOk
        LastError = $setError
        Device = $after.dmDeviceName
        Fields = ('0x{0:X8}' -f $after.dmFields)
        Orientation = $after.dmOrientation
        PaperSize = $after.dmPaperSize
        PaperWidthTenthMm = $after.dmPaperWidth
        PaperLengthTenthMm = $after.dmPaperLength
        DriverExtra = $after.dmDriverExtra
      }
    }
  } finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
  }
} finally {
  [void][PrinterNative]::ClosePrinter($handle)
}
