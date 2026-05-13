#Requires -Version 3
$ErrorActionPreference = 'Stop'

$root    = $PSScriptRoot
$beDir   = Join-Path $root "backend"
$out     = Join-Path $root "qualitrace-backend-deploy.zip"
$tmp     = "C:\qt_tmp"   # cale scurta - evita limita MAX_PATH (260 char) cu node_modules

Write-Host "============================================================"
Write-Host "  QualiTrace - Creare pachet deployment backend"
Write-Host "============================================================"
Write-Host ""

# Curata folderul temporar
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path "$tmp\backend" -Force | Out-Null

# Copiaza fisierele de instalare
Copy-Item (Join-Path $root "INSTALL-SERVICE-WINDOWS.bat") $tmp
Copy-Item (Join-Path $root "INSTALL-SERVICE-WINDOWS.ps1") $tmp
Write-Host "[OK] INSTALL-SERVICE-WINDOWS.bat + .ps1"

Copy-Item (Join-Path $beDir "package.json")        "$tmp\backend"
Copy-Item (Join-Path $beDir ".env.example")        "$tmp\backend"
Copy-Item (Join-Path $beDir "ecosystem.config.js") "$tmp\backend"
Write-Host "[OK] backend/package.json, .env.example, ecosystem.config.js"

Copy-Item (Join-Path $beDir "src") "$tmp\backend" -Recurse
Write-Host "[OK] backend/src/"

# --- npm install in folderul TEMP (nu in workspace!) ---
# Root-ul are workspaces config, asa ca npm hoisteaza la root si nu in backend/
# Instaland in temp/ (fara workspace config) obtinem un node_modules portabil
Write-Host "[..] npm install in temp (poate dura 30-60 sec la prima rulare)..." -ForegroundColor Yellow
Push-Location "$tmp\backend"
& npm install --omit=dev
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install a esuat (exit code $LASTEXITCODE)" }
Pop-Location
$nmCount = (Get-ChildItem "$tmp\backend\node_modules" -Recurse -File -ErrorAction SilentlyContinue).Count
Write-Host "[OK] node_modules/ construit in temp ($nmCount fisiere, fara compilare pe server)"

# Sterge zip-ul vechi
if (Test-Path $out) { Remove-Item $out }

# Creeaza arhiva
Compress-Archive -Path "$tmp\*" -DestinationPath $out -Force
Write-Host "[OK] Arhiva creata"

# Curata temporar
Remove-Item $tmp -Recurse -Force

$sizeMB = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host ""
Write-Host "============================================================"
Write-Host "  GATA! Arhiva creata ($sizeMB MB):"
Write-Host "  $out"
Write-Host ""
Write-Host "  Pe server (ca Administrator):"
Write-Host "  1. Instaleaza Node.js LTS (nodejs.org)"
Write-Host "  2. Extrage zip-ul (ex: C:\QualiTrace\)"
Write-Host "  3. Ruleaza INSTALL-SERVICE-WINDOWS.bat ca Administrator"
Write-Host "  4. Editeaza backend\.env si schimba JWT_SECRET"
Write-Host "============================================================"
