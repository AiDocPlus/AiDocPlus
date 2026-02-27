# AiDocPlus Windows Build Guide

Build Windows ARM64 installer in a Parallels Desktop Windows 11 ARM VM.

## Prerequisites

- Mac: run `bash scripts/assemble.sh` to assemble the build target
- Parallels: enable shared folders (VM Config -> Options -> Sharing)

## Quick Start (from scratch)

### 1. Set execution policy (once per terminal)

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. Install dev tools

```powershell
& "\\Mac\Home\Code\AiDocPlus-Main\scripts\windows\01-setup-env.ps1"
```

Installs: Git, Node.js, pnpm, Rust, NSIS, VS Build Tools, LLVM/Clang.

### 3. Manual steps (script cannot automate these)

Open **Visual Studio Installer** -> Modify **Build Tools 2022**:
- Check **"Desktop development with C++"** workload
- In the details panel on the right, also check:
  **"MSVC v143 - VS 2022 C++ ARM64/ARM64EC build tools"**
- Click **Modify** to install

**Restart terminal** after this step.

### 4. Build

```powershell
& "\\Mac\Home\Code\AiDocPlus-Main\scripts\windows\02-build.ps1"
```

The script auto-loads VS ARM64 environment and LLVM PATH, then:
copies source to `C:\Dev\AiDocPlus` -> `pnpm install` -> `pnpm tauri build`.

### Common options

```powershell
# Skip copy, build only (source unchanged)
& "...\02-build.ps1" -SkipCopy

# Dev mode (hot reload, no installer)
& "...\02-build.ps1" -DevMode

# Custom paths
& "...\02-build.ps1" -SharedPath "Z:\AiDocPlus" -LocalPath "D:\Build\AiDocPlus"
```

### 5. Build output

```
C:\Dev\AiDocPlus\apps\desktop\src-tauri\target\release\bundle\nsis\AiDocPlus_*_arm64-setup.exe
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| PowerShell script shows garbled Chinese text | Scripts on `\\Mac\...` network paths must be pure ASCII. Already fixed. |
| `pnpm` or other tool "not recognized" | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first |
| `link.exe not found` | VS environment not loaded. `02-build.ps1` auto-loads it, or manually: `& "C:\...\Launch-VsDevShell.ps1" -Arch arm64` |
| `cl.exe` says "x86" not "ARM64" | ARM64 MSVC tools not installed. Open VS Installer, add ARM64 build tools component |
| `__CxxFrameHandler3` link error | Same as above - x86 cl.exe linking ARM64 code |
| `ring` crate: `clang not found` | LLVM not installed or not in PATH. `02-build.ps1` auto-adds it, or: `$env:PATH = "C:\Program Files\LLVM\bin;" + $env:PATH` |
| Git install fails (network error) | Download manually from https://git-scm.com/download/win (ARM64 version) |
| `robocopy` errors | Exit codes 0-7 are success for robocopy; only 8+ is a real error |
| First build very slow | Normal - full Rust compilation takes 15-30 min. Subsequent builds use cache. |

## Architecture Notes

- **Target**: `aarch64-pc-windows-msvc` (ARM64 Windows)
- **Installer**: NSIS `.exe` (configured in `tauri.conf.json`)
- **Key dependency**: `ring` crate (via rustls) requires `clang` on ARM64 Windows
- Builds in Parallels VM produce ARM64 binaries only; x64 would need cross-compilation
