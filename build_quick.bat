@echo off
chcp 65001 >nul
echo ========================================
echo 多功能待办 - 快速打包（使用镜像源）
echo ========================================
echo.

echo ✓ 配置国内镜像源...
rem 环境变量已通过 .npmrc 文件配置

echo.
echo [1/4] 清理旧构建...
if exist release rmdir /s /q release 2>nul
if exist dist\main rmdir /s /q dist\main 2>nul
if exist dist\renderer rmdir /s /q dist\renderer 2>nul

echo [2/4] 安装依赖...
call npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

echo [3/4] 构建应用...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo [4/4] 打包安装程序...
call npm run dist:win
if errorlevel 1 (
    echo ❌ 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 打包完成！
echo ========================================
echo.
echo 📦 安装包位置: release\
dir release\*.exe /b 2>nul
echo.
pause

