param([Parameter(Mandatory=$true)][string]$Message)
cd "c:\Users\Administrator\Desktop\zephyrus-player-android"
git add -A
git commit --no-verify -m $Message
git push --no-verify origin main
Write-Host "Pushed: $Message" -ForegroundColor Green
