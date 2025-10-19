@echo off
chcp 65001 >nul
echo ============================================================
echo   多功能待办 - 最终打包尝试
echo ============================================================
echo.

echo [1] 终止进程...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM app-builder.exe >nul 2>&1
echo     等待10秒...
timeout /t 10 /nobreak >nul

echo [2] 重命名旧目录...
if exist release (
    set timestamp=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
    set timestamp=%timestamp: =0%
    ren release release_old_!timestamp! 2>nul
    if errorlevel 1 (
        echo     警告: 无法重命名release目录
    ) else (
        echo     已重命名release目录
    )
)
if exist dist (
    rmdir /s /q dist 2>nul
)
echo     等待5秒...
timeout /t 5 /nobreak >nul

echo [3] 构建应用...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo [4] 打包安装程序 (这将需要几分钟)...
call npx electron-builder --win
if errorlevel 1 (
    echo ❌ 打包失败,查看上面的错误信息
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   检查输出...
echo ============================================================
if exist release\*.exe (
    dir release\*.exe /b
    echo.
    echo ✅ 打包成功!
) else (
    echo ⚠ 未找到 .exe 文件
    echo.
    echo release 目录内容:
    dir release /s /b | findstr /i ".exe .yaml .asar"
)
echo.
pause


