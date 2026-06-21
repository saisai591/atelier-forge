param(
  [string]$PrinterName = "Brother QL-500",
  [byte[]]$Bytes = @(0x0C)
)

$code = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@

Add-Type $code -ErrorAction Stop

$handle = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
  throw "OpenPrinter failed $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}

try {
  $doc = New-Object RawPrinterHelper+DOCINFOA
  $doc.pDocName = "AOS raw printer probe"
  $doc.pDataType = "RAW"
  if (-not [RawPrinterHelper]::StartDocPrinter($handle, 1, $doc)) {
    throw "StartDocPrinter failed $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  try {
    [void][RawPrinterHelper]::StartPagePrinter($handle)
    $written = 0
    if (-not [RawPrinterHelper]::WritePrinter($handle, $Bytes, $Bytes.Length, [ref]$written)) {
      throw "WritePrinter failed $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }
    [void][RawPrinterHelper]::EndPagePrinter($handle)
    "RawWritten=$written"
  } finally {
    [void][RawPrinterHelper]::EndDocPrinter($handle)
  }
} finally {
  [void][RawPrinterHelper]::ClosePrinter($handle)
}
