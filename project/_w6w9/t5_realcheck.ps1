# T5 真机(Edge headless)双路径验证: 默认路径 vs ?render=2d
# 复制到 ASCII 临时目录(避免中文路径), 抓控制台日志 + 截图大小
$ErrorActionPreference = "Continue"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$tmp  = Join-Path $env:TEMP "t5check"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Copy-Item "掠食竞赛_2D.html" (Join-Path $tmp "sim2d.html") -Force
$file = "file:///" + ((Join-Path $tmp "sim2d.html") -replace '\\','/')

function Run-Case([string]$name, [string]$url, [string]$shot) {
  $shotPath = Join-Path $tmp $shot
  Remove-Item $shotPath -ErrorAction SilentlyContinue
  $logPath = Join-Path $tmp ($shot + ".log")
  $args = @("--headless=new", "--no-sandbox", "--disable-gpu", "--enable-logging=stderr",
            "--user-data-dir=$tmp\ud_$shot", "--window-size=1280,760", "--virtual-time-budget=9000",
            "--screenshot=$shotPath", $url)
  $out = & $edge @args 2>&1 | Out-String
  Set-Content -Path $logPath -Value $out -Encoding UTF8
  $size = if (Test-Path $shotPath) { (Get-Item $shotPath).Length } else { -1 }
  $ref  = ($out -split "`n" | Select-String -Pattern "ReferenceError|Uncaught|is not defined|TypeError" | Select-Object -First 6 | ForEach-Object { $_.Line.Trim() })
  $info = ($out -split "`n" | Select-String -Pattern "WebGL 实例化渲染已启用|render=2d|WebGPU|自检|回退" | Select-Object -First 6 | ForEach-Object { $_.Line.Trim() })
  Write-Output "===== $name ====="
  Write-Output "url      : $url"
  Write-Output "截图大小 : $size B $(if ($size -gt 80000) {'(非空白 ✓)'} elseif ($size -gt 0) {'(疑似空白 ✗)'} else {'(无截图 ✗)'})"
  Write-Output "错误行   : $(if ($ref) { $ref -join ' || ' } else { '0 条 ✓' })"
  Write-Output "信息行   : $($info -join ' || ')"
}

Run-Case "默认路径" $file "default.png"
Run-Case "强制 Canvas2D" ($file + "?render=2d") "render2d.png"
