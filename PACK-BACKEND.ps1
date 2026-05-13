#Requires -Version 3
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$out  = Join-Path $root "qualitrace-backend-deploy.zip"
$tmp  = Join-Path $env:TEMP "qualitrace_pack"

Write-Host "============================================================"
Write-Host "  QualiTrace - Creare pachet deployment backend"
Write-Host "============================================================"
Write-Host ""

# Curata folderul temporar
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path "$tmp\backend" -Force | Out-Null

# Copiaza fisierele
Copy-Item (Join-Path $root "INSTALL-SERVICE-WINDOWS.bat") $tmp
Write-Host "[OK] INSTALL-SERVICE-WINDOWS.bat"

Copy-Item (Join-Path $root "backend\package.json")        "$tmp\backend"
Copy-Item (Join-Path $root "backend\.env.example")        "$tmp\backend"
Copy-Item (Join-Path $root "backend\ecosystem.config.js") "$tmp\backend"
Write-Host "[OK] backend/package.json, .env.example, ecosystem.config.js"

Copy-Item (Join-Path $root "backend\src") "$tmp\backend" -Recurse
Write-Host "[OK] backend/src/"

# Sterge zip-ul vechi
if (Test-Path $out) { Remove-Item $out }

# Creeaza arhiva
Compress-Archive -Path "$tmp\*" -DestinationPath $out -Force
Write-Host "[OK] Arhiva creata"

# Curata temporar
Remove-Item $tmp -Recurse -Force

$size = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host ""
Write-Host "============================================================"
Write-Host "  GATA! Arhiva creata ($size KB):"
Write-Host "  $out"
Write-Host ""
Write-Host "  Pe server (ca Administrator):"
Write-Host "  1. Instaleaza Node.js LTS (nodejs.org)"
Write-Host "  2. Extrage zip-ul (ex: C:\QualiTrace\)"
Write-Host "  3. Ruleaza INSTALL-SERVICE-WINDOWS.bat ca Administrator"
Write-Host "  4. Editeaza backend\.env si schimba JWT_SECRET"
Write-Host "============================================================"
