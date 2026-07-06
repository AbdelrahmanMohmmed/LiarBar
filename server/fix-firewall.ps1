param(
  [switch]$Remove
)

$ruleName = "LiarsBar-Backend-3001"
$port = 3001

# --- Admin check ---
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "[!] This script must be run as Administrator." -ForegroundColor Red
  Write-Host "    Right-click PowerShell and select 'Run as Administrator'." -ForegroundColor Yellow
  exit 1
}

# --- Remove mode ---
if ($Remove) {
  Write-Host "[-] Removing firewall rule '$ruleName' ..." -ForegroundColor Cyan
  Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($?) {
    Write-Host "[+] Rule removed successfully." -ForegroundColor Green
  } else {
    Write-Host "[!] Rule not found or already removed." -ForegroundColor Yellow
  }
  exit 0
}

# --- Check existing rule ---
Write-Host "[*] Checking for existing rule '$ruleName' ..." -ForegroundColor Cyan
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existing) {
  Write-Host "[+] Rule already exists. Details:" -ForegroundColor Green
  $existing | Format-List DisplayName, Enabled, Direction, Action, Profile
  exit 0
}

# --- Create rule ---
Write-Host "[*] Creating inbound firewall rule for TCP port $port ..." -ForegroundColor Cyan

try {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $port `
    -Action Allow `
    -Profile Private, Public `
    -ErrorAction Stop

  Write-Host "[+] Rule '$ruleName' created successfully." -ForegroundColor Green
  Write-Host "    Protocol : TCP" -ForegroundColor Gray
  Write-Host "    Port     : $port" -ForegroundColor Gray
  Write-Host "    Profile  : Private, Public" -ForegroundColor Gray
} catch {
  Write-Host "[!] Failed to create rule: $_" -ForegroundColor Red
  exit 1
}

# --- Verify it is active ---
$verify = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($verify -and $verify.Enabled -eq $true) {
  Write-Host "[+] Rule is active and enabled." -ForegroundColor Green
} else {
  Write-Host "[!] Rule exists but may be disabled. Enable it in wf.msc." -ForegroundColor Yellow
}
