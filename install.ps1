#Requires -Version 5.1
<#
.SYNOPSIS
    CasApp - Instalador para Windows
.DESCRIPTION
    Instala todas las dependencias, configura la base de datos y
    levanta los tres servicios (API + Client App + Worker App) de CasApp.
.NOTES
    Ejecutar como: .\install.ps1
    Requiere conexion a Internet la primera vez.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step { param($msg) Write-Host "" ; Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [X]  $msg" -ForegroundColor Red; exit 1 }

Clear-Host
Write-Host "============================================================" -ForegroundColor Green
Write-Host "        CasApp - Instalador Windows v1.0                   " -ForegroundColor Green
Write-Host "    Plataforma de servicios del hogar on-demand            " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

# ============================================================
# 1. PREREQUISITOS
# ============================================================
Write-Step "Verificando prerequisitos..."

# -- Node.js --
function Install-NodeJs {
    Write-Warn "Node.js no encontrado. Descargando instalador..."
    $nodeUrl = "https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart"
    Remove-Item $nodeInstaller -Force
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
}

try {
    $nodeVer = node --version 2>$null
    $major = [int]($nodeVer -replace 'v(\d+)\..*','$1')
    if ($major -lt 18) {
        Write-Warn "Node.js $nodeVer es demasiado antiguo (minimo v18). Actualizando..."
        Install-NodeJs
    }
    Write-OK "Node.js $(node --version)"
} catch {
    Install-NodeJs
    Write-OK "Node.js $(node --version) instalado"
}

# -- pnpm --
try {
    $pnpmVer = pnpm --version 2>$null
    Write-OK "pnpm $pnpmVer"
} catch {
    Write-Warn "pnpm no encontrado. Instalando..."
    npm install -g pnpm --silent
    Write-OK "pnpm $(pnpm --version) instalado"
}

# -- Git --
try {
    $gitVer = git --version 2>$null
    Write-OK "$gitVer"
} catch {
    Write-Warn "Git no encontrado. Descargando..."
    $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe"
    $gitInstaller = "$env:TEMP\git-installer.exe"
    Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing
    Start-Process $gitInstaller -Wait -ArgumentList "/VERYSILENT /NORESTART"
    Remove-Item $gitInstaller -Force
    $env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
    Write-OK "Git instalado"
}

# -- PostgreSQL --
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if (-not $pgService) {
    Write-Warn "PostgreSQL no encontrado."
    $choice = Read-Host "  Queres instalarlo automaticamente? (S/N)"
    if ($choice -match '^[sS]') {
        $pgUrl = "https://sbp.enterprisedb.com/get/postgresql-16.3-1-windows-x64.exe"
        $pgInstaller = "$env:TEMP\pg-installer.exe"
        Write-Host "  Descargando PostgreSQL 16 (~300 MB)..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgInstaller -UseBasicParsing
        $pgPassword = "casapp1234"
        Start-Process $pgInstaller -Wait -ArgumentList `
            "--mode unattended --unattendedmodeui none --superpassword `"$pgPassword`" --serverport 5432"
        Remove-Item $pgInstaller -Force
        Write-OK "PostgreSQL instalado (usuario: postgres / password: $pgPassword)"
        $env:PGPASSWORD = $pgPassword
    } else {
        Write-Warn "Saltando PostgreSQL. Configuralo manualmente en el .env"
    }
} else {
    Write-OK "PostgreSQL detectado ($($pgService.Name))"
}

# ============================================================
# 2. VARIABLES DE ENTORNO
# ============================================================
Write-Step "Configurando variables de entorno..."

$envFile = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $ProjectRoot ".env.example") $envFile

    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

    $pgPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } else {
        Read-Host "  Ingresa el password de tu usuario postgres"
    }

    try {
        $vapidOutput = npx --yes web-push generate-vapid-keys --json 2>$null | ConvertFrom-Json
        $envContent = Get-Content $envFile -Raw
        $envContent = $envContent -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret"
        $envContent = $envContent -replace 'VAPID_PUBLIC_KEY=.*',  "VAPID_PUBLIC_KEY=$($vapidOutput.publicKey)"
        $envContent = $envContent -replace 'VAPID_PRIVATE_KEY=.*', "VAPID_PRIVATE_KEY=$($vapidOutput.privateKey)"
        Set-Content $envFile $envContent -Encoding UTF8
        Write-OK "Claves VAPID generadas y .env creado"
    } catch {
        $envContent = Get-Content $envFile -Raw
        $envContent = $envContent -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret"
        Set-Content $envFile $envContent -Encoding UTF8
        Write-OK ".env creado (VAPID keys: configurar manualmente)"
    }
} else {
    Write-OK ".env ya existe, conservando configuracion actual"
}

# ============================================================
# 3. BASE DE DATOS
# ============================================================
Write-Step "Configurando base de datos PostgreSQL..."

$pgPaths = @(
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin"
)
foreach ($p in $pgPaths) {
    if (Test-Path "$p\psql.exe") {
        $env:PATH = "$p;" + $env:PATH
        break
    }
}

$createDbScript = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'casapp') THEN CREATE USER casapp WITH PASSWORD 'casapp'; END IF; END `$`$; SELECT 'CREATE DATABASE casapp_db OWNER casapp' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'casapp_db')\gexec GRANT ALL PRIVILEGES ON DATABASE casapp_db TO casapp;"

try {
    $createDbScript | psql -U postgres -h localhost -p 5432 2>$null
    Write-OK "Base de datos 'casapp_db' y usuario 'casapp' listos"
} catch {
    Write-Warn "No se pudo configurar la BD automaticamente. Ejecuta manualmente:"
    Write-Warn "  createdb casapp_db -U postgres"
}

# ============================================================
# 4. DEPENDENCIAS
# ============================================================
Write-Step "Instalando dependencias (puede tardar unos minutos)..."
pnpm install --frozen-lockfile
Write-OK "Dependencias instaladas"

# ============================================================
# 5. PRISMA
# ============================================================
Write-Step "Aplicando schema de base de datos..."
pnpm db:generate
pnpm db:push
Write-OK "Schema aplicado"

$seedChoice = Read-Host "  Queres cargar datos de ejemplo? (S/N)"
if ($seedChoice -match '^[sS]') {
    pnpm db:seed
    Write-OK "Datos de ejemplo cargados"
}

# ============================================================
# 6. SCRIPTS DE INICIO
# ============================================================
Write-Step "Creando accesos directos..."

$startPs1 = @'
Set-Location $PSScriptRoot
Write-Host "Iniciando CasApp..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$PSScriptRoot'; pnpm dev:api`"" -WindowStyle Normal
Start-Sleep 3
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$PSScriptRoot'; pnpm dev:client`"" -WindowStyle Normal
Start-Sleep 1
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$PSScriptRoot'; pnpm dev:worker`"" -WindowStyle Normal
Write-Host ""
Write-Host "  API:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Cliente:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Trabajador: http://localhost:5174" -ForegroundColor Cyan
'@
Set-Content (Join-Path $ProjectRoot "start.ps1") $startPs1 -Encoding UTF8

$startBat = "@echo off`r`npowershell.exe -ExecutionPolicy Bypass -File `"%~dp0start.ps1`"`r`n"
Set-Content (Join-Path $ProjectRoot "start.bat") $startBat -Encoding ASCII

try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut("$env:USERPROFILE\Desktop\CasApp.lnk")
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$(Join-Path $ProjectRoot 'start.ps1')`""
    $shortcut.WorkingDirectory = $ProjectRoot
    $shortcut.Description = "Iniciar CasApp"
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Write-OK "Acceso directo 'CasApp' creado en el escritorio"
} catch {
    Write-Warn "No se pudo crear el acceso directo. Usa start.bat manualmente."
}

# ============================================================
# RESUMEN FINAL
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Instalacion completada!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para iniciar CasApp:" -ForegroundColor White
Write-Host "    - Doble clic en CasApp del escritorio" -ForegroundColor White
Write-Host "    - O ejecutar: .\start.bat" -ForegroundColor White
Write-Host ""
Write-Host "  URLs cuando este corriendo:" -ForegroundColor White
Write-Host "    API:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "    Cliente:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "    Trabajador: http://localhost:5174" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Credenciales de prueba (si cargaste el seed):" -ForegroundColor White
Write-Host "    Admin:      admin@casapp.ar / password123" -ForegroundColor White
Write-Host "    Cliente:    cliente@test.com / password123" -ForegroundColor White
Write-Host "    Trabajador: trabajador@test.com / password123" -ForegroundColor White
Write-Host ""
Write-Host "  Configuracion: editar .env" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
