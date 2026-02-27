# AiDocPlus Windows Dev Environment Setup
# Run in a fresh Windows 11 ARM VM (PowerShell as Administrator)
# ================================================================
#
# LESSONS LEARNED:
# - Scripts on network paths (\\Mac\...) MUST be pure ASCII/English,
#   UTF-8 without BOM causes garbled text and parse errors in PowerShell.
# - VS Build Tools default install does NOT include C++ tools.
#   Must manually add "Desktop development with C++" workload.
# - ARM64 MSVC tools are NOT included by default even with C++ workload.
#   Must explicitly add "MSVC v143 ARM64/ARM64EC build tools" component.
# - ring crate on ARM64 Windows requires clang (not just MSVC cl.exe).
# - LLVM installed via winget does NOT add clang to PATH automatically.
# - Must use Developer PowerShell or Launch-VsDevShell.ps1 -Arch arm64
#   to get link.exe in PATH; plain PowerShell won't find it.
# ================================================================

$ErrorActionPreference = "Stop"

Write-Host "=== AiDocPlus Windows Environment Setup ===" -ForegroundColor Cyan
Write-Host ""

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
}

# -- 1. Git --
Write-Host "[1/7] Installing Git..." -ForegroundColor Yellow
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "  Git already installed: $(git --version)" -ForegroundColor Green
} else {
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    Refresh-Path
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "  WARNING: Git install may have failed (network issue)." -ForegroundColor Red
        Write-Host "  Download manually from https://git-scm.com/download/win (ARM64)" -ForegroundColor Red
    }
}

# -- 2. Node.js LTS --
Write-Host "[2/7] Installing Node.js LTS..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "  Node.js already installed: $(node --version)" -ForegroundColor Green
} else {
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Refresh-Path
}

# -- 3. pnpm --
Write-Host "[3/7] Installing pnpm..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "  pnpm already installed: $(pnpm --version)" -ForegroundColor Green
} else {
    npm install -g pnpm@10
}

# -- 4. Rust --
Write-Host "[4/7] Installing Rust..." -ForegroundColor Yellow
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    Write-Host "  Rust already installed: $(rustc --version)" -ForegroundColor Green
} else {
    winget install Rustlang.Rustup --accept-source-agreements --accept-package-agreements
    Write-Host "  WARNING: Restart terminal after Rust installation!" -ForegroundColor Red
}

# -- 5. NSIS (Windows installer generator) --
Write-Host "[5/7] Installing NSIS..." -ForegroundColor Yellow
if (Get-Command makensis -ErrorAction SilentlyContinue) {
    Write-Host "  NSIS already installed" -ForegroundColor Green
} else {
    winget install NSIS.NSIS --accept-source-agreements --accept-package-agreements
}

# -- 6. VS Build Tools --
Write-Host "[6/7] Installing VS Build Tools..." -ForegroundColor Yellow
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    Write-Host "  VS Build Tools already installed" -ForegroundColor Green
} else {
    winget install Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements --accept-package-agreements
}

# -- 7. LLVM/Clang (required by ring crate on ARM64) --
Write-Host "[7/7] Installing LLVM/Clang..." -ForegroundColor Yellow
if (Test-Path "C:\Program Files\LLVM\bin\clang.exe") {
    Write-Host "  LLVM already installed" -ForegroundColor Green
} else {
    winget install LLVM.LLVM --accept-source-agreements --accept-package-agreements
}

Write-Host ""
Write-Host "=== Environment Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT manual steps:" -ForegroundColor Red
Write-Host ""
Write-Host "  1. Open Visual Studio Installer -> Modify Build Tools 2022:" -ForegroundColor Yellow
Write-Host "     - Check 'Desktop development with C++' workload" -ForegroundColor White
Write-Host "     - In details panel, also check:" -ForegroundColor White
Write-Host "       'MSVC v143 ARM64/ARM64EC build tools'" -ForegroundColor White
Write-Host "     - Click 'Modify' to install" -ForegroundColor White
Write-Host ""
Write-Host "  2. Close and reopen terminal, then load VS ARM64 environment:" -ForegroundColor Yellow
Write-Host '     & "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\Launch-VsDevShell.ps1" -Arch arm64' -ForegroundColor White
Write-Host '     $env:PATH = "C:\Program Files\LLVM\bin;" + $env:PATH' -ForegroundColor White
Write-Host ""
Write-Host "  3. Verify:" -ForegroundColor Yellow
Write-Host "     cl.exe              # should say ARM64" -ForegroundColor White
Write-Host "     clang --version     # should work" -ForegroundColor White
Write-Host "     git --version" -ForegroundColor White
Write-Host "     node --version      # >= 18" -ForegroundColor White
Write-Host "     pnpm --version      # >= 9" -ForegroundColor White
Write-Host "     rustc --version     # >= 1.70" -ForegroundColor White
Write-Host ""
Write-Host "  4. Then run 02-build.ps1 to build" -ForegroundColor Yellow
