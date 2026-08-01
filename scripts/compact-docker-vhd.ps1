param(
  [string]$DockerVhdPath = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx",
  [switch]$SkipPrune,
  [switch]$RestartCompose
)

$ErrorActionPreference = "Stop"

function Format-Size([long]$Bytes) {
  if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
  return "$Bytes B"
}

function Get-Size([string]$Path) {
  return (Get-Item -LiteralPath $Path).Length
}

if (!(Test-Path -LiteralPath $DockerVhdPath)) {
  throw "Docker VHDX not found: $DockerVhdPath"
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) {
  throw "Run this script from PowerShell as Administrator because diskpart compact vdisk requires elevated permissions."
}

$before = Get-Size $DockerVhdPath
Write-Output "Docker VHDX before compact: $(Format-Size $before)"

if (!$SkipPrune) {
  Write-Output "Pruning Docker build cache before compact..."
  docker builder prune -af
}

Write-Output "Stopping compose containers without deleting volumes..."
try {
  docker compose stop
} catch {
  Write-Warning "docker compose stop failed or Docker is already stopped: $($_.Exception.Message)"
}

Write-Output "Stopping WSL so Docker VHDX can be compacted..."
wsl --shutdown
Start-Sleep -Seconds 5

try {
  Write-Output "Enabling sparse mode for docker-desktop WSL distro when supported..."
  wsl --manage docker-desktop --set-sparse true
} catch {
  Write-Warning "WSL sparse mode was not applied: $($_.Exception.Message)"
}

$diskpartScript = New-TemporaryFile
@"
select vdisk file="$DockerVhdPath"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@ | Set-Content -LiteralPath $diskpartScript -Encoding ASCII

try {
  Write-Output "Compacting Docker VHDX with diskpart..."
  diskpart /s $diskpartScript
} finally {
  Remove-Item -LiteralPath $diskpartScript -Force -ErrorAction SilentlyContinue
}

$after = Get-Size $DockerVhdPath
Write-Output "Docker VHDX after compact: $(Format-Size $after)"

if ($RestartCompose) {
  $dockerDesktopPath = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
  if (Test-Path -LiteralPath $dockerDesktopPath) {
    Write-Output "Starting Docker Desktop..."
    Start-Process -FilePath $dockerDesktopPath -WindowStyle Hidden
  }

  Write-Output "Waiting for Docker engine..."
  for ($i = 0; $i -lt 60; $i++) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 3
  }

  docker compose up -d
  docker system df
}
