# Removes the LifeGraph door, the background mailbox and the app connections (Windows).
# Your LifeGraph folder and its notes are left exactly where they are.
#   irm https://raw.githubusercontent.com/theomishin/lifegraph/main/uninstall.ps1 | iex

function Uninstall-LifeGraph {
  $App = Join-Path $HOME '.lifegraph-app'
  $Bin = Join-Path $App 'bin'
  $Cli = Join-Path $App 'src\door\dist\cli.js'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node -and (Test-Path $Cli)) {
    & $node.Source $Cli service uninstall
    & $node.Source $Cli disconnect
  } else {
    cmd /c "schtasks /Delete /F /TN LifeGraphMailbox >nul 2>&1"
    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\LifeGraph mailbox.vbs')
    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $env:LOCALAPPDATA 'LifeGraph\mailbox.vbs')
  }
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if ($userPath -and (($userPath -split ';') -contains $Bin)) {
    [Environment]::SetEnvironmentVariable('Path', ((($userPath -split ';') | Where-Object { $_ -and $_ -ne $Bin }) -join ';'), 'User')
  }
  Start-Sleep -Milliseconds 500  # let the stopped mailbox let go of its files
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $App
  if (Test-Path $App) { Write-Host "Couldn't remove all of $App (a file is in use). Delete it by hand after restarting." }
  Write-Host "LifeGraph is uninstalled. Your notes are still in $(Join-Path $HOME 'LifeGraph')."
}

Uninstall-LifeGraph
