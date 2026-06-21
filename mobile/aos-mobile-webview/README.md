# AOS Mobile WebView APK

APK leger pour Unitech EA520.

Il ouvre directement:

```text
http://192.168.1.57/mobile
```

## Build

```powershell
cd mobile\aos-mobile-webview
gradle assembleDebug
```

APK genere:

```text
app\build\outputs\apk\debug\app-debug.apk
```

## Installation EA520

```powershell
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell monkey -p fr.aosdeploy.mobile 1
```
