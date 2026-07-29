param(
  [string]$AndroidSdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$AndroidStudioJbr = "C:\Program Files\Android\Android Studio\jbr",
  [string]$NdkVersion = "28.2.13676358"
)

$ErrorActionPreference = "Stop"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$ndkHome = Join-Path $AndroidSdkRoot "ndk\$NdkVersion"
$cmdlineTools = Join-Path $AndroidSdkRoot "cmdline-tools\latest\bin"
$platformTools = Join-Path $AndroidSdkRoot "platform-tools"
$emulatorTools = Join-Path $AndroidSdkRoot "emulator"

$requiredPaths = @(
  $cargoBin,
  (Join-Path $AndroidStudioJbr "bin"),
  $AndroidSdkRoot,
  $cmdlineTools,
  $platformTools,
  $ndkHome
)

foreach ($path in $requiredPaths) {
  if (!(Test-Path $path)) {
    throw "Missing mobile build environment path: $path"
  }
}

$env:JAVA_HOME = $AndroidStudioJbr
$env:ANDROID_HOME = $AndroidSdkRoot
$env:ANDROID_SDK_ROOT = $AndroidSdkRoot
$env:NDK_HOME = $ndkHome
$env:PATH = @(
  (Join-Path $AndroidStudioJbr "bin"),
  $cmdlineTools,
  $platformTools,
  $emulatorTools,
  $cargoBin,
  $env:PATH
) -join ";"

Write-Output "JAVA_HOME=$env:JAVA_HOME"
Write-Output "ANDROID_HOME=$env:ANDROID_HOME"
Write-Output "NDK_HOME=$env:NDK_HOME"
