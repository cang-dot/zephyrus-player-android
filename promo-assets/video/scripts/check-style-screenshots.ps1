$ErrorActionPreference = 'Stop'

$required = @(
    'default.jpg',
    'stage.jpg',
    'star-chart.jpg',
    'frenzy.jpg',
    'eerie.jpg',
    'aged.jpg',
    'rain.jpg',
    'smoke.jpg'
)

$directory = Join-Path $PSScriptRoot '..\public\screenshots\styles'
$missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $directory $_)) })

if ($missing.Count -gt 0) {
    throw "Missing real style screenshots: $($missing -join ', ')"
}

if (Get-ChildItem -LiteralPath $directory -File | Where-Object { $_.BaseName -eq 'magazine' }) {
    throw 'A magazine screenshot must not be included. The magazine style is excluded from this video.'
}

Write-Host 'Real style screenshots are complete; magazine style is excluded.'
