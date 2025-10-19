@echo off
chcp 65001 >nul
echo =====================================
echo 多功能待办应用打包工具 - Windows
echo =====================================
echo.

echo [1/5] 清理旧构建...
if exist release rmdir /s /q release
if exist dist\main rmdir /s /q dist\main
if exist dist\renderer rmdir /s /q dist\renderer
if exist dist\shared rmdir /s /q dist\shared
if exist dist\index.html del /q dist\index.html
if exist dist\renderer.js del /q dist\renderer.js
if exist dist\renderer.js.map del /q dist\renderer.js.map

echo [2/5] 安装依赖...
call npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

echo [3/5] 重新编译sqlite3...
call npm run rebuild
if errorlevel 1 (
    echo ❌ 重新编译失败
    pause
    exit /b 1
)

echo [4/5] 构建应用...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo [5/5] 打包安装程序...
call npm run dist:win
if errorlevel 1 (
    echo ❌ 打包失败
    pause
    exit /b 1
)

echo.
echo =====================================
echo ✅ 构建完成！
echo =====================================
echo.
echo 📦 安装包位置: release\
dir release\*.exe /b
echo.
echo 💡 提示：
echo   - 安装包名称包含版本号
echo   - 卸载时会询问是否删除用户数据
echo   - 数据位置：%%APPDATA%%\多功能待办
echo.
pause

