#Requires -Version 5
Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

$beDir    = Join-Path $PSScriptRoot "backend"
$taskName = "QualiTrace Backend"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  QualiTrace Backend - Instalare Serviciu Windows Server"    -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Verifica Administrator ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[EROARE] Rulati scriptul ca Administrator!" -ForegroundColor Red
    Read-Host "Apasa Enter pentru a iesi"
    exit 1
}
Write-Host "[OK] Rulare ca Administrator"

# --- Verifica Node.js ---
$nodeCmd  = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCmd) { $nodeCmd.Source } else { $null }
if (-not $nodePath) {
    Write-Host "[EROARE] Node.js nu este instalat!" -ForegroundColor Red
    Write-Host "        Descarca de la: https://nodejs.org  (versiunea LTS)"
    Read-Host "Apasa Enter pentru a iesi"
    exit 1
}
Write-Host "[OK] Node.js: $(node --version)  ($nodePath)"

# --- npm install (sare daca node_modules e deja inclus in pachet) ---
Write-Host ""
$nodeModules = Join-Path $beDir "node_modules"
if (Test-Path (Join-Path $nodeModules "better-sqlite3")) {
    Write-Host "[1/3] Dependinte pre-instalate (node_modules inclus in pachet)" -ForegroundColor Green
} else {
    Write-Host "[1/3] Instalare dependinte backend..." -ForegroundColor Yellow
    Push-Location $beDir
    try {
        & npm install --omit=dev
        if ($LASTEXITCODE -ne 0) { throw "npm install a esuat (exit code $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
    Write-Host "[OK] Dependinte instalate"
}

# --- Creeaza foldere ---
New-Item -ItemType Directory -Path (Join-Path $beDir "logs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $beDir "data")  -Force | Out-Null

# --- Creeaza .env daca nu exista ---
$envFile     = Join-Path $beDir ".env"
$envExample  = Join-Path $beDir ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "[ATENTIE] Editeaza $envFile si schimba JWT_SECRET!" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Fisier .env existent"
}

# --- Creeaza start-service.ps1 (script-ul care ruleaza node in bucla) ---
$startScriptPath = Join-Path $beDir "start-service.ps1"
$indexJs   = Join-Path $beDir "src\index.js"
$logOut    = Join-Path $beDir "logs\out.log"
$logErr    = Join-Path $beDir "logs\error.log"
$pidFile   = Join-Path $beDir "logs\pid.txt"

$startScriptContent = @"
# QualiTrace Backend - Service runner (auto-generated, nu edita manual)
`$nodeExe = '$($nodePath -replace "\\","\\\\") '
`$workDir = '$($beDir    -replace "\\","\\\\") '
`$indexJs = '$($indexJs  -replace "\\","\\\\") '
`$logOut  = '$($logOut   -replace "\\","\\\\") '
`$logErr  = '$($logErr   -replace "\\","\\\\") '
`$pidFile = '$($pidFile  -replace "\\","\\\\") '

`$nodeExe = `$nodeExe.Trim()
`$workDir = `$workDir.Trim()
`$indexJs = `$indexJs.Trim()
`$logOut  = `$logOut.Trim()
`$logErr  = `$logErr.Trim()
`$pidFile = `$pidFile.Trim()

while (`$true) {
    try {
        `$env:NODE_ENV = 'production'
        `$env:PORT     = '3001'
        `$proc = Start-Process -FilePath `$nodeExe ``
            -ArgumentList `$indexJs ``
            -WorkingDirectory `$workDir ``
            -RedirectStandardOutput `$logOut ``
            -RedirectStandardError  `$logErr ``
            -NoNewWindow -PassThru
        `$proc.Id | Out-File `$pidFile -Encoding ASCII
        Wait-Process -Id `$proc.Id -ErrorAction SilentlyContinue
    } catch {
        Add-Content `$logErr "`$(Get-Date) ERROR: `$_"
    }
    Start-Sleep -Seconds 5
}
"@
Set-Content -Path $startScriptPath -Value $startScriptContent -Encoding UTF8
Write-Host "[OK] start-service.ps1 creat"

# --- Inregistreaza Task Scheduler ---
Write-Host ""
Write-Host "[2/3] Inregistrare Task Scheduler..." -ForegroundColor Yellow

# Sterge task vechi daca exista
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action    = New-ScheduledTaskAction `
    -Execute  "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$startScriptPath`""

$trigger   = New-ScheduledTaskTrigger -AtStartup

$settings  = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances  IgnoreNew `
    -RestartCount       5 `
    -RestartInterval    (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal `
    -UserId    "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel  Highest

Register-ScheduledTask `
    -TaskName  $taskName `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "[OK] Task '$taskName' inregistrat (SYSTEM, AtStartup)"

# --- Porneste imediat ---
Write-Host ""
Write-Host "[3/3] Pornire imediata..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 4

$taskState = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "[OK] Stare task: $taskState"

# --- Verifica port ---
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3001/api/operations" -UseBasicParsing -TimeoutSec 6
    Write-Host "[OK] Backend raspunde pe portul 3001" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Backend pornit - poate dura cateva secunde (verifica logs\out.log)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  INSTALARE COMPLETA!" -ForegroundColor Green
Write-Host "  Serviciul porneste automat la reboot (fara login)"
Write-Host "  Backend: http://localhost:3001"
Write-Host ""
Write-Host "  Comenzi utile (PowerShell ca Admin):"
Write-Host "    Get-ScheduledTask '$taskName'           - stare"
Write-Host "    Start-ScheduledTask '$taskName'         - pornire"
Write-Host "    Stop-ScheduledTask  '$taskName'         - oprire"
Write-Host "    Get-Content '$beDir\logs\out.log' -Tail 30  - loguri"
Write-Host ""
Write-Host "  Fisier configurare: $beDir\.env"
Write-Host "  Baza de date:       $beDir\data\qualitrace.db"
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Apasa Enter pentru a inchide"
