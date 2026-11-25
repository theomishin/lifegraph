# LifeGraph for Windows: one-command install. In PowerShell:
#   irm https://raw.githubusercontent.com/theomishin/lifegraph/main/install.ps1 | iex
#
# What it does, all on this PC:
#   1. Puts the LifeGraph door in %USERPROFILE%\.lifegraph-app
#   2. Creates your LifeGraph folder at %USERPROFILE%\LifeGraph (a plain folder: sync it however you like)
#   3. Connects the door to Claude Desktop, Claude Code, Codex, Cursor, Gemini CLI and LM Studio
#   4. Starts the mailbox in the background (Task Scheduler, no window) so file-only apps can ask too
# No accounts, no servers, no administrator rights needed. Safe to run again.

function Install-LifeGraph {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  $env:NPM_CONFIG_UPDATE_NOTIFIER = 'false'
  $oldEncoding = [Console]::OutputEncoding
  try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }  # show the doctor's check marks

  $App = Join-Path $HOME '.lifegraph-app'
  $Vault = Join-Path $HOME 'LifeGraph'
  $script:Step = 'starting'
  function Say($msg) { Write-Host $msg -ForegroundColor Cyan; $script:Step = $msg }
  function Indent { process { "  $_" } }
  function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" } }

  try {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
      Write-Host 'LifeGraph needs Node.js 20 or newer. Install it from https://nodejs.org (the LTS button), open a new PowerShell window, then run this again.'
      return
    }
    $Node = $nodeCmd.Source
    $major = [int](& $Node -p "process.versions.node.split('.')[0]")
    if ($major -lt 20) {
      Write-Host "Your Node.js is version $major. LifeGraph needs 20 or newer: install the LTS from https://nodejs.org, then run this again."
      return
    }
    # npm.cmd, not npm: the npm.ps1 shim is blocked on PCs that don't allow PowerShell scripts.
    $Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $Npm) { Write-Host 'npm is missing (it normally comes with Node.js). Reinstall Node.js from https://nodejs.org.'; return }
    $Npm = $Npm.Source
    if ((Test-Path $Vault) -and -not (Test-Path $Vault -PathType Container)) {
      Write-Host "$Vault exists but is not a folder. Rename it, then run this again."; return
    }

    Say '1/4 Installing the door'
    New-Item -ItemType Directory -Force -Path $App | Out-Null
    $Src = Join-Path $App 'src'
    $here = $PSScriptRoot
    if ($here -and (Test-Path (Join-Path $here 'door\package.json'))) {
      # Run from a checkout of the repository: install that copy.
      if (Test-Path $Src) { Remove-Item -Recurse -Force $Src }
      robocopy $here $Src /E /XD node_modules dist .git /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "copying the door failed (robocopy $LASTEXITCODE)" }
      $global:LASTEXITCODE = 0
    } else {
      $tmp = Join-Path ([IO.Path]::GetTempPath()) ("lifegraph-" + [guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $tmp | Out-Null
      $zip = Join-Path $tmp 'lifegraph.zip'
      Invoke-WebRequest -UseBasicParsing -Uri 'https://codeload.github.com/theomishin/lifegraph/zip/refs/heads/main' -OutFile $zip
      Expand-Archive -Path $zip -DestinationPath $tmp -Force
      $inner = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
      if (Test-Path $Src) { Remove-Item -Recurse -Force $Src }
      Move-Item -Path $inner.FullName -Destination $Src
      Remove-Item -Recurse -Force $tmp
    }
    Push-Location (Join-Path $Src 'door')
    try {
      & $Npm ci --no-audit --no-fund --loglevel=error; Check 'npm ci'
      & $Npm run build --silent; Check 'building the door'
      & $Npm prune --omit=dev --no-audit --no-fund --loglevel=error; Check 'npm prune'
    } finally { Pop-Location }

    $Bin = Join-Path $App 'bin'
    New-Item -ItemType Directory -Force -Path $Bin | Out-Null
    $Cli = Join-Path $Src 'door\dist\cli.js'
    Set-Content -Path (Join-Path $Bin 'lifegraph.cmd') -Encoding ASCII -Value "@echo off`r`n`"$Node`" `"%~dp0..\src\door\dist\cli.js`" %*"
    # Put `lifegraph` on the PATH for new windows (uninstall.ps1 removes it).
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $userPath) { $userPath = '' }
    if (($userPath -split ';') -notcontains $Bin) {
      [Environment]::SetEnvironmentVariable('Path', (($userPath.TrimEnd(';') + ';' + $Bin).TrimStart(';')), 'User')
    }
    if (($env:Path -split ';') -notcontains $Bin) { $env:Path = "$env:Path;$Bin" }

    Say '2/4 Setting up your LifeGraph folder'
    if (Test-Path $Vault) {
      Write-Host "  Using your existing $Vault"
    } else {
      & $Node $Cli init $Vault | Out-Null; Check 'creating the folder'
      Write-Host "  Created $Vault, a plain folder. Sync it however you like (OneDrive, Syncthing, Dropbox, git), or not at all."
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $Vault 'mailbox'), (Join-Path $Vault 'inbox') | Out-Null

    Say '3/4 Connecting your AI apps'
    & $Node $Cli connect --vault $Vault | Indent; Check 'connecting apps'

    Say '4/4 Starting the mailbox in the background'
    & $Node $Cli service install --vault $Vault | Indent
    $global:LASTEXITCODE = 0  # the mailbox is optional; doctor says what to do if it didn't start

    Write-Host ''
    Say 'Checking everything works'
    & $Node $Cli doctor --vault $Vault | Indent
    $global:LASTEXITCODE = 0

    Write-Host ''
    Say 'Done.'
    Write-Host 'Restart your AI apps, then say to each one: "Read my LifeGraph and fill it from what you remember about me."'
    Write-Host "The full prompt is in $(Join-Path $Src 'prompts\fill-from-memory.md')"
    Write-Host 'Command line: open a new PowerShell window and type: lifegraph help'
  } catch {
    Write-Host ''
    Write-Host "Install stopped during: $script:Step" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)"
    Write-Host 'Your notes were not changed. Fix the error above and run the installer again; it is safe to re-run.'
    $global:LASTEXITCODE = 1
  } finally {
    try { [Console]::OutputEncoding = $oldEncoding } catch { }
  }
}

Install-LifeGraph
