@echo off
chcp 65001 >nul


REM 获取脚本所在目录（项目根目录）
REM %~dp0 返回的路径末尾已有反斜杠，如 D:\path\
set "PROJECT_ROOT=%~dp0"
REM 移除末尾的反斜杠（如果有）
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

REM 显示项目根目录（调试用）
echo 项目根目录: %PROJECT_ROOT%
echo.

echo [1/4] 检查环境...
echo.

REM 检查 uv 是否安装
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 uv 命令，请先安装 uv
    echo 运行: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    pause
    exit /b 1
)

REM 检查 pnpm 是否安装
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 pnpm 命令，请先安装 pnpm
    echo 运行: npm install -g pnpm
    pause
    exit /b 1
)

echo [2/4] 启动后端服务...
echo 后端地址: http://127.0.0.1:8000
echo.

REM 检查目录是否存在
set "BACKEND_DIR=%PROJECT_ROOT%\apps"
if not exist "%BACKEND_DIR%" (
    echo [错误] 找不到 apps 目录: %BACKEND_DIR%
    echo 当前项目根目录: %PROJECT_ROOT%
    pause
    exit /b 1
)

REM 显示调试信息
echo 后端目录: %BACKEND_DIR%

REM 创建临时批处理文件启动后端（使用更可靠的方法）
set "BACKEND_BAT=%TEMP%\start_backend_%RANDOM%.bat"
echo @echo off > "%BACKEND_BAT%"
echo chcp 65001 ^>nul >> "%BACKEND_BAT%"
echo cd /d "%BACKEND_DIR%" >> "%BACKEND_BAT%"
echo set PYTHONPATH=. >> "%BACKEND_BAT%"
echo uv run app.py >> "%BACKEND_BAT%"
echo pause >> "%BACKEND_BAT%"

REM 启动后端（在新窗口中）
if exist "%BACKEND_BAT%" (
    start "Backend Service" cmd /k "%BACKEND_BAT%"
) else (
    echo [错误] 无法创建临时批处理文件
    pause
    exit /b 1
)

REM 等待后端启动
timeout /t 3 /nobreak >nul

echo [3/4] 启动前端服务...
echo 前端地址: http://localhost:10617
echo.

REM 检查目录是否存在
set "FRONTEND_DIR=%PROJECT_ROOT%\playground"
if not exist "%FRONTEND_DIR%" (
    echo [错误] 找不到 playground 目录: %FRONTEND_DIR%
    echo 当前项目根目录: %PROJECT_ROOT%
    pause
    exit /b 1
)

REM 显示调试信息
echo 前端目录: %FRONTEND_DIR%

REM 创建临时批处理文件启动前端（使用更可靠的方法）
set "FRONTEND_BAT=%TEMP%\start_frontend_%RANDOM%.bat"
echo @echo off > "%FRONTEND_BAT%"
echo chcp 65001 ^>nul >> "%FRONTEND_BAT%"
echo cd /d "%FRONTEND_DIR%" >> "%FRONTEND_BAT%"
echo pnpm dev >> "%FRONTEND_BAT%"
echo pause >> "%FRONTEND_BAT%"

REM 启动前端（在新窗口中）
if exist "%FRONTEND_BAT%" (
    start "Frontend Service" cmd /k "%FRONTEND_BAT%"
) else (
    echo [错误] 无法创建临时批处理文件
    pause
    exit /b 1
)

REM 等待前端启动
echo [4/4] 等待服务启动...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   服务启动完成！
echo ========================================
echo 后端: http://127.0.0.1:8000
echo 前端: http://localhost:10617
echo.
echo 正在打开浏览器...
echo.

REM 打开浏览器
start http://localhost:10617

echo.
echo Tips: 
echo - 后端和前端服务已在独立窗口中运行
echo - 关闭对应的窗口即可停止服务
echo - 此窗口可以关闭，不会影响服务运行
echo.
REM Script ends here, window will stay open showing the messages
REM User can manually close the window

