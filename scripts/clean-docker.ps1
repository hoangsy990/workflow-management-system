param(
  [switch]$IncludeUnusedImages
)

$ErrorActionPreference = "Stop"

Write-Output "Docker disk usage before cleanup:"
docker system df

Write-Output ""
Write-Output "Pruning Docker build cache..."
docker builder prune -af

if ($IncludeUnusedImages) {
  Write-Output ""
  Write-Output "Pruning unused images that are not used by containers..."
  docker image prune -af
}

Write-Output ""
Write-Output "Docker disk usage after cleanup:"
docker system df
