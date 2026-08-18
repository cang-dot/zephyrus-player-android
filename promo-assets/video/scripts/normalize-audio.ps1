$ErrorActionPreference = 'Stop'

$targets = @(
    @{
        Raw = 'out/zephyrus-horizontal-v2-bgm-raw.mp4'
        Final = 'out/zephyrus-horizontal-v2-bgm.mp4'
    },
    @{
        Raw = 'out/zephyrus-horizontal-v2-nobgm-raw.mp4'
        Final = 'out/zephyrus-horizontal-v2-nobgm.mp4'
    }
)

foreach ($target in $targets) {
    if (-not (Test-Path -LiteralPath $target.Raw)) {
        throw "Missing raw render: $($target.Raw)"
    }

    $temporary = "$($target.Final).tmp.mp4"
    ffmpeg -y -hide_banner -loglevel warning `
        -i $target.Raw `
        -map 0:v:0 -map 0:a:0 `
        -c:v copy `
        -af 'loudnorm=I=-16:TP=-1.5:LRA=11' `
        -ar 48000 -c:a aac -b:a 320k `
        -movflags +faststart `
        $temporary

    if ($LASTEXITCODE -ne 0) {
        throw "Audio normalization failed: $($target.Raw)"
    }

    [System.IO.File]::Copy($temporary, $target.Final, $true)
    Remove-Item -LiteralPath $temporary -Force
}

foreach ($target in $targets) {
    Remove-Item -LiteralPath $target.Raw -Force
}
