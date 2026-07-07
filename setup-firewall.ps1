# Run this script as Administrator:
# Right-click PowerShell → "Run as Administrator" then:
#   powershell -ExecutionPolicy Bypass -File .\setup-firewall.ps1

$ruleName = "LiarsBar-Backend"
$port = 3001

# Remove existing rule with the same name (if any)
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

# Create new inbound rule allowing TCP port 3001 on all profiles
New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $port `
    -Action Allow `
    -Profile Any `
    -Description "Allow inbound traffic to Liar's Bar backend (port $port)"

Write-Host "✅ Firewall rule '$ruleName' created – TCP port $port allowed (Private + Public)."
