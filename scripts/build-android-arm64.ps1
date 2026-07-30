param(
  [string]$AndroidSdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$AndroidStudioJbr = "C:\Program Files\Android\Android Studio\jbr",
  [string]$NdkVersion = "28.2.13676358",
  [string]$ApiUrl = $env:VITE_API_URL,
  [bool]$AllowHttpCleartext = $true
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
$androidBuildGradle = Join-Path $androidDir "app\build.gradle.kts"
$sourceSo = Join-Path $tauriDir "target\aarch64-linux-android\release\libworkflow_management_system_lib.so"
$jniDir = Join-Path $androidDir "app\src\main\jniLibs\arm64-v8a"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\arm64\release\app-arm64-release-unsigned.apk"

if ($ApiUrl) {
  $env:VITE_API_URL = $ApiUrl
  Write-Output "Android VITE_API_URL: $ApiUrl"
}

Push-Location $webDir
try {
  if (!(Test-Path $androidDir)) {
    pnpm exec tauri android init --ci
  }

  if ($AllowHttpCleartext -and (Test-Path $androidBuildGradle)) {
    $gradleContent = Get-Content -Raw -LiteralPath $androidBuildGradle
    $gradleContent = $gradleContent -replace 'manifestPlaceholders\["usesCleartextTraffic"\] = "false"', 'manifestPlaceholders["usesCleartextTraffic"] = "true"'
    Set-Content -LiteralPath $androidBuildGradle -Value $gradleContent -Encoding UTF8
    Write-Warning "Android release unsigned test build allows HTTP cleartext traffic. Do not use this setting for production."
  }

} finally {
  Pop-Location
}

if ($LASTEXITCODE -ne 0) {
  Write-Warning "Tauri Android build failed, likely because Windows symlink creation is disabled. Copying the native library and running Gradle directly for arm64 APK."
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
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle fallback failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

if (!(Test-Path $apkPath)) {
  throw "APK not found after build: $apkPath"
}

Write-Output "Android APK: $apkPath"
