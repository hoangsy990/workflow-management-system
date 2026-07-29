param(
  [string]$AndroidSdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$AndroidStudioJbr = "C:\Program Files\Android\Android Studio\jbr",
  [string]$NdkVersion = "28.2.13676358"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot "mobile-env.ps1") `
  -AndroidSdkRoot $AndroidSdkRoot `
  -AndroidStudioJbr $AndroidStudioJbr `
  -NdkVersion $NdkVersion | Write-Output

$webDir = Join-Path $repoRoot "apps\web"
$tauriDir = Join-Path $webDir "src-tauri"
$androidDir = Join-Path $tauriDir "gen\android"
$sourceSo = Join-Path $tauriDir "target\aarch64-linux-android\release\libworkflow_management_system_lib.so"
$jniDir = Join-Path $androidDir "app\src\main\jniLibs\arm64-v8a"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\arm64\release\app-arm64-release-unsigned.apk"

Push-Location $webDir
try {
  if (!(Test-Path $androidDir)) {
    pnpm exec tauri android init --ci
  }

  pnpm exec tauri android build --target aarch64 --apk --ci
} catch {
  $message = $_.Exception.Message
  if ($message -notmatch "symbolic link" -and $message -notmatch "Symbolic") {
    throw
  }

  Write-Warning "Windows symlink creation is disabled. Copying the native library and running Gradle directly for arm64 APK."
  if (!(Test-Path $sourceSo)) {
    throw "Built native library not found: $sourceSo"
  }
  if (!(Test-Path $jniDir)) {
    New-Item -ItemType Directory -Path $jniDir | Out-Null
  }
  Copy-Item -LiteralPath $sourceSo -Destination (Join-Path $jniDir "libworkflow_management_system_lib.so") -Force

  Push-Location $androidDir
  try {
    .\gradlew.bat assembleArm64Release -x rustBuildArm64Release --no-daemon
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

if (!(Test-Path $apkPath)) {
  throw "APK not found after build: $apkPath"
}

Write-Output "Android APK: $apkPath"
