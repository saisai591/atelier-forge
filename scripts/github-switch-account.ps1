param(
  [string]$GitUserName,
  [string]$GitUserEmail,
  [switch]$KeepExistingCredentials
)

$ErrorActionPreference = 'Stop'

function Step($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Step "Verification outils"
$git = Get-Command git -ErrorAction SilentlyContinue
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $git) { throw "Git n'est pas installe ou pas dans le PATH." }
if (-not $gh) { throw "GitHub CLI (gh) n'est pas installe ou pas dans le PATH." }
Write-Host "Git: $($git.Source)"
Write-Host "GitHub CLI: $($gh.Source)"

Step "Etat actuel"
git config --global --get user.name
git config --global --get user.email
gh auth status 2>$null

if (-not $KeepExistingCredentials) {
  Step "Deconnexion GitHub CLI"
  gh auth logout --hostname github.com --yes 2>$null

  Step "Nettoyage credentials GitHub Windows"
  $targets = @(
    'git:https://github.com',
    'git:https://github.com/',
    'https://github.com',
    'https://github.com/'
  )
  foreach ($target in $targets) {
    cmdkey /delete:$target 2>$null | Out-Null
  }
}

if ($GitUserName) {
  Step "Configuration git user.name"
  git config --global user.name "$GitUserName"
}

if ($GitUserEmail) {
  Step "Configuration git user.email"
  git config --global user.email "$GitUserEmail"
}

Step "Connexion au nouveau compte GitHub"
Write-Host "Une page navigateur ou un code de connexion GitHub va s'afficher."
Write-Host "Connecte-toi avec le compte GitHub voulu, pas le compte precedent."
gh auth login --hostname github.com --git-protocol https --web

Step "Verification finale"
gh auth status
Write-Host ""
Write-Host "Configuration globale Git:"
Write-Host "user.name  = $(git config --global --get user.name)"
Write-Host "user.email = $(git config --global --get user.email)"
Write-Host ""
Write-Host "Termine. Si un push echoue encore, relance ce script sans -KeepExistingCredentials."

