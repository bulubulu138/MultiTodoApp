@echo off
chcp 65001 >nul
echo ============================================================
echo   清理环境并重新打包
echo ============================================================
echo.

echo [1/5] 终止所有相关进程...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM app-builder.exe 2>nul
echo   等待进程完全终止...
timeout /t 10 /nobreak >nul

echo [2/5] 清理旧的构建文件...
if exist release (
    echo   尝试删除 release 目录...
    rmdir /s /q release 2>nul
    if exist release (
        echo   无法删除，重命名为 release_old_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
        ren release release_old_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2% 2>nul
    )
)
if exist dist (
    echo   删除 dist 目录...
    rmdir /s /q dist 2>nul
)
echo   等待文件系统释放...
timeout /t 5 /nobreak >nul

echo [3/5] 构建应用...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo [4/5] 打包 Windows 安装程序...
call npx electron-builder --win
if errorlevel 1 (
    echo ❌ 打包失败
    pause
    exit /b 1
)

echo [5/5] 完成！
echo ============================================================
echo   安装包已生成：
echo ============================================================
dir release\*.exe /b
echo.
pause

