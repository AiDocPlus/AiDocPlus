# AiDocPlus Windows Build Script
# Copy source from Mac shared folder and build Windows installer
# ================================================================
#
# PREREQUISITES:
# - Run 01-setup-env.ps1 first to install all tools
# - VS Build Tools with C++ Desktop + ARM64 tools installed
# - LLVM/Clang installed (winget install LLVM.LLVM)
#
# This script auto-loads VS ARM64 environment and LLVM PATH.
# No need to manually run Launch-VsDevShell.ps1 beforehand.
# ================================================================

param(
    [string]$SharedPath = "\\Mac\Home\Code\AiDocPlus",
    [string]$LocalPath = "C:\Dev\AiDocPlus",
    [switch]$SkipCopy,
    [switch]$DevMode
)

$ErrorActionPreference = "Stop"

Write-Host "=== AiDocPlus Windows Build ===" -ForegroundColor Cyan
Write-Host "  Shared folder: $SharedPath" -ForegroundColor Gray
Write-Host "  Local path:    $LocalPath" -ForegroundColor Gray
Write-Host ""

# -- 0. Auto-load VS ARM64 environment and LLVM --
$vsDevShell = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\Launch-VsDevShell.ps1"
if (Test-Path $vsDevShell) {
    if (-not (Get-Command cl.exe -ErrorAction SilentlyContinue)) {
        Write-Host "[0/5] Loading VS ARM64 build environment..." -ForegroundColor Yellow
        & $vsDevShell -Arch arm64 | Out-Null
        Write-Host "  OK - VS environment loaded" -ForegroundColor Green
    }
} else {
    Write-Host "  WARNING: VS Build Tools not found at expected path" -ForegroundColor Red
}

# Add LLVM to PATH if not already there
if (Test-Path "C:\Program Files\LLVM\bin\clang.exe") {
    if (-not ($env:PATH -like "*LLVM*")) {
        $env:PATH = "C:\Program Files\LLVM\bin;" + $env:PATH
    }
}

# -- 1. Verify environment --
Write-Host "[1/5] Checking dev environment..." -ForegroundColor Yellow
$missing = @()
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { $missing += "git" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "node" }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { $missing += "pnpm" }
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { $missing += "rustc" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { $missing += "cargo" }
if (-not (Get-Command cl.exe -ErrorAction SilentlyContinue)) { $missing += "cl.exe (VS Build Tools)" }
if (-not (Get-Command clang -ErrorAction SilentlyContinue)) { $missing += "clang (LLVM)" }

if ($missing.Count -gt 0) {
    Write-Host "  MISSING tools: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "  Please run 01-setup-env.ps1 first" -ForegroundColor Red
    exit 1
}

# Verify cl.exe is ARM64
$clOutput = (cl.exe 2>&1 | Select-Object -First 1) -join ""
if ($clOutput -notmatch "ARM64") {
    Write-Host "  WARNING: cl.exe is NOT ARM64 version!" -ForegroundColor Red
    Write-Host "  Current: $clOutput" -ForegroundColor Red
    Write-Host "  Please add ARM64 MSVC tools in VS Installer" -ForegroundColor Red
    exit 1
}

Write-Host "  OK - environment check passed" -ForegroundColor Green
Write-Host "     Node $(node --version) | pnpm $(pnpm --version) | Rust $(rustc --version)" -ForegroundColor Gray
Write-Host "     cl.exe: ARM64 | clang: $(clang --version 2>&1 | Select-Object -First 1)" -ForegroundColor Gray

# -- 2. Copy source from shared folder --
if (-not $SkipCopy) {
    Write-Host "[2/4] Copying source from shared folder..." -ForegroundColor Yellow

    if (-not (Test-Path $SharedPath)) {
        Write-Host "  ERROR: Shared folder not accessible: $SharedPath" -ForegroundColor Red
        Write-Host "  Make sure Parallels shared folders are enabled and assemble.sh has been run on Mac" -ForegroundColor Red
        exit 1
    }

    if (-not (Test-Path "C:\Dev")) {
        New-Item -ItemType Directory -Path "C:\Dev" | Out-Null
    }

    Write-Host "  Copying (excluding node_modules/target/.git)..." -ForegroundColor Gray
    robocopy $SharedPath $LocalPath /E /XD node_modules target .git .turbo .claude /XO /NFL /NDL /NJH /NJS /NC /NS /NP
    # robocopy exit codes 0-7 are success
    if ($LASTEXITCODE -gt 7) {
        Write-Host "  ERROR: Copy failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
    $LASTEXITCODE = 0
    Write-Host "  OK - source copied" -ForegroundColor Green
} else {
    Write-Host "[2/4] Skipping copy (-SkipCopy)" -ForegroundColor Gray
}

# -- 3. Install frontend dependencies --
Write-Host "[3/4] Installing dependencies (pnpm install)..." -ForegroundColor Yellow
Set-Location $LocalPath
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pnpm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK - dependencies installed" -ForegroundColor Green

# -- 4. Build --
Set-Location "$LocalPath\apps\desktop"

if ($DevMode) {
    Write-Host "[4/4] Starting dev mode (pnpm tauri dev)..." -ForegroundColor Yellow
    pnpm tauri dev
} else {
    Write-Host "[4/4] Building Windows installer (pnpm tauri build)..." -ForegroundColor Yellow
    pnpm tauri build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Build failed" -ForegroundColor Red
        exit 1
    }

    $bundleDir = "$LocalPath\apps\desktop\src-tauri\target\release\bundle\nsis"
    if (Test-Path $bundleDir) {
        Write-Host ""
        Write-Host "=== BUILD SUCCESS ===" -ForegroundColor Green
        Write-Host "Installer location:" -ForegroundColor Cyan
        Get-ChildItem $bundleDir -Filter "*.exe" | ForEach-Object {
            Write-Host "  $($_.FullName)" -ForegroundColor White
            Write-Host "  Size: $([math]::Round($_.Length / 1MB, 1)) MB" -ForegroundColor Gray
        }
    } else {
        Write-Host "  WARNING: Build completed but NSIS bundle dir not found" -ForegroundColor Yellow
        Write-Host "  Check: $bundleDir" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
