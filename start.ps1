# 论文批量读取系统 - 启动脚本 (PowerShell)
# 编码: UTF-8

# 设置错误处理：遇到错误时继续执行，但显示错误信息
$ErrorActionPreference = "Continue"

# 捕获所有错误，避免脚本闪退
trap {
    Write-Host "发生错误: $_" -ForegroundColor Red
    Write-Host "错误位置: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
    Write-Host "按 Enter 退出..."
    Read-Host
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  论文批量读取系统 - 启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录（项目根目录）
if ($PSScriptRoot) {
    $ProjectRoot = $PSScriptRoot
} else {
    # 如果直接运行脚本，使用当前目录
    $ProjectRoot = Get-Location
}
Set-Location $ProjectRoot

Write-Host "项目根目录: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

Write-Host "[1/4] 检查环境..." -ForegroundColor Yellow
Write-Host ""

# 检查 uv 是否安装
try {
    $null = Get-Command uv -ErrorAction Stop
    Write-Host "✓ uv 已安装" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 uv 命令" -ForegroundColor Red
    Write-Host "  请运行: powershell -ExecutionPolicy ByPass -c `"irm https://astral.sh/uv/install.ps1 | iex`"" -ForegroundColor Yellow
    Read-Host "按 Enter 退出"
    exit 1
}

# 检查 pnpm 是否安装
try {
    $null = Get-Command pnpm -ErrorAction Stop
    Write-Host "✓ pnpm 已安装" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 pnpm 命令" -ForegroundColor Red
    Write-Host "  请运行: npm install -g pnpm" -ForegroundColor Yellow
    Read-Host "按 Enter 退出"
    exit 1
}

Write-Host ""
Write-Host "[2/4] 启动后端服务..." -ForegroundColor Yellow
Write-Host "后端地址: http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host ""

# 检查目录是否存在
$BackendDir = Join-Path $ProjectRoot "apps"
if (-not (Test-Path $BackendDir)) {
    Write-Host "✗ 找不到 apps 目录: $BackendDir" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 启动后端（在新窗口中）
# 使用 -WorkingDirectory 参数直接指定工作目录，避免路径问题
$BackendScriptContent = @"
`$env:PYTHONPATH = '.'
uv run app.py
Write-Host "`n按任意键关闭此窗口..." -ForegroundColor Yellow
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

try {
    $BackendScriptFile = "$env:TEMP\start_backend_$(Get-Date -Format 'yyyyMMddHHmmss').ps1"
    $BackendScriptContent | Out-File -FilePath $BackendScriptFile -Encoding UTF8 -ErrorAction Stop
    
    $BackendDirResolved = (Resolve-Path $BackendDir).Path
    Write-Host "后端目录: $BackendDirResolved" -ForegroundColor Gray
    
    Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$BackendScriptFile`"" -WorkingDirectory $BackendDirResolved -WindowStyle Normal -ErrorAction Stop
    Write-Host "✓ 后端服务已启动" -ForegroundColor Green
} catch {
    Write-Host "✗ 启动后端服务失败: $_" -ForegroundColor Red
    Write-Host "错误详情: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 等待后端启动
Start-Sleep -Seconds 3

Write-Host "[3/4] 启动前端服务..." -ForegroundColor Yellow
Write-Host "前端地址: http://localhost:10617" -ForegroundColor Gray
Write-Host ""

# 检查目录是否存在
$FrontendDir = Join-Path $ProjectRoot "playground"
if (-not (Test-Path $FrontendDir)) {
    Write-Host "✗ 找不到 playground 目录: $FrontendDir" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 启动前端（在新窗口中）
# 使用 -WorkingDirectory 参数直接指定工作目录，避免路径问题
$FrontendScriptContent = @"
pnpm dev
Write-Host "`n按任意键关闭此窗口..." -ForegroundColor Yellow
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@

try {
    $FrontendScriptFile = "$env:TEMP\start_frontend_$(Get-Date -Format 'yyyyMMddHHmmss').ps1"
    $FrontendScriptContent | Out-File -FilePath $FrontendScriptFile -Encoding UTF8 -ErrorAction Stop
    
    $FrontendDirResolved = (Resolve-Path $FrontendDir).Path
    Write-Host "前端目录: $FrontendDirResolved" -ForegroundColor Gray
    
    Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$FrontendScriptFile`"" -WorkingDirectory $FrontendDirResolved -WindowStyle Normal -ErrorAction Stop
    Write-Host "✓ 前端服务已启动" -ForegroundColor Green
} catch {
    Write-Host "✗ 启动前端服务失败: $_" -ForegroundColor Red
    Write-Host "错误详情: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 等待前端启动
Write-Host "[4/4] 等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查服务是否就绪
Write-Host ""
Write-Host "检查服务状态..." -ForegroundColor Yellow

$BackendReady = $false
$FrontendReady = $false
$MaxAttempts = 10
$Attempt = 0

while ($Attempt -lt $MaxAttempts -and (-not $BackendReady -or -not $FrontendReady)) {
    $Attempt++
    
    # 检查后端
    if (-not $BackendReady) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response -and $response.StatusCode -eq 200) {
                $BackendReady = $true
                Write-Host "✓ 后端服务已就绪" -ForegroundColor Green
            }
        } catch {
            # 继续等待，不显示错误
        }
    }
    
    # 检查前端
    if (-not $FrontendReady) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:10617" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response -and $response.StatusCode -eq 200) {
                $FrontendReady = $true
                Write-Host "✓ 前端服务已就绪" -ForegroundColor Green
            }
        } catch {
            # 继续等待，不显示错误
        }
    }
    
    if (-not $BackendReady -or -not $FrontendReady) {
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  服务启动完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "后端: http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host "前端: http://localhost:10617" -ForegroundColor Gray
Write-Host ""

if ($BackendReady -and $FrontendReady) {
    Write-Host "正在打开浏览器..." -ForegroundColor Yellow
    Start-Process "http://localhost:10617"
    Write-Host "✓ 浏览器已打开" -ForegroundColor Green
} else {
    Write-Host "⚠ 部分服务可能尚未完全启动，请稍候手动访问" -ForegroundColor Yellow
    if (-not $BackendReady) {
        Write-Host "  后端: http://127.0.0.1:8000" -ForegroundColor Gray
    }
    if (-not $FrontendReady) {
        Write-Host "  前端: http://localhost:10617" -ForegroundColor Gray
    }
    Start-Process "http://localhost:10617"
}

Write-Host ""
Write-Host "提示:" -ForegroundColor Cyan
Write-Host "- 后端和前端服务已在独立窗口中运行" -ForegroundColor Gray
Write-Host "- 关闭对应的窗口即可停止服务" -ForegroundColor Gray
Write-Host ""

Read-Host "按 Enter 关闭此窗口（不会停止服务）"

