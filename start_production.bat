@echo off
chcp 65001 >nul
echo ============================================================
echo  生产模式启动 - 避免开发服务器问题
echo ============================================================

cd /d "D:\多功能待办\MultiTodoApp"

echo.
echo [步骤 1] 清理环境...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im electron.exe >nul 2>&1
timeout /t 2 >nul

echo.
echo [步骤 2] 完整构建应用...
echo 编译主进程...
npm run build:main
if %errorlevel% neq 0 (
    echo ✗ 主进程编译失败！
    pause
    exit /b 1
)

echo 构建渲染进程...
npm run build:renderer
if %errorlevel% neq 0 (
    echo ✗ 渲染进程构建失败！
    pause
    exit /b 1
)

echo.
echo [步骤 3] 检查构建输出...
if exist "dist\main\main.js" (
    echo ✓ 主进程文件存在
) else (
    echo ✗ 主进程文件不存在
    pause
    exit /b 1
)

if exist "dist\renderer.js" (
    echo ✓ 渲染进程文件存在
) else (
    echo ✗ 渲染进程文件不存在
    pause
    exit /b 1
)

if exist "dist\index.html" (
    echo ✓ HTML文件存在
) else (
    echo ✗ HTML文件不存在
    pause
    exit /b 1
)

echo.
echo [步骤 4] 启动应用 (生产模式)...
echo 启动Electron应用...
set NODE_ENV=production
electron dist/main/main.js

echo.
echo 应用已关闭。
pause
