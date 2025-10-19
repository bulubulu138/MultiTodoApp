@echo off
chcp 65001 >nul
echo ============================================================
echo   MultiTodo - GitHub 仓库设置向导
echo ============================================================
echo.

echo 此脚本将帮助你：
echo   1. 初始化 Git 仓库
echo   2. 提交所有文件
echo   3. 连接到 GitHub 远程仓库
echo   4. 推送代码（自动触发构建）
echo.
echo 按任意键继续，或按 Ctrl+C 取消...
pause >nul
echo.

REM 检查是否已经是 Git 仓库
if exist .git (
    echo [信息] Git 仓库已存在
) else (
    echo [1] 初始化 Git 仓库...
    git init
    if errorlevel 1 (
        echo ❌ 初始化失败！请确保已安装 Git
        echo    下载 Git: https://git-scm.com/download/win
        pause
        exit /b 1
    )
    echo ✅ Git 仓库初始化成功
)
echo.

REM 设置默认分支为 main
echo [2] 设置默认分支为 main...
git branch -M main 2>nul
echo ✅ 分支设置完成
echo.

REM 添加所有文件
echo [3] 添加所有文件到 Git...
git add .
if errorlevel 1 (
    echo ❌ 添加文件失败
    pause
    exit /b 1
)
echo ✅ 文件添加成功
echo.

REM 创建提交
echo [4] 创建提交...
git commit -m "Initial commit with GitHub Actions workflow for Windows and macOS builds"
if errorlevel 1 (
    echo ⚠️  提交可能已存在或没有更改
) else (
    echo ✅ 提交创建成功
)
echo.

REM 提示用户输入 GitHub 仓库地址
echo ============================================================
echo   请在 GitHub 上创建一个新仓库
echo ============================================================
echo.
echo 步骤：
echo   1. 访问 https://github.com/new
echo   2. 填写仓库名称（如: multi-todo-app）
echo   3. 选择 Public（推荐，免费无限构建时间）
echo   4. 不要勾选任何初始化选项（README, .gitignore, license）
echo   5. 点击 "Create repository"
echo   6. 复制仓库地址（形如: https://github.com/用户名/仓库名.git）
echo.
set /p REPO_URL="请输入你的 GitHub 仓库地址: "

if "%REPO_URL%"=="" (
    echo ❌ 未输入仓库地址
    pause
    exit /b 1
)

echo.
echo [5] 添加远程仓库...

REM 检查是否已有 origin
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REPO_URL%
    echo ✅ 远程仓库添加成功
) else (
    echo [信息] 远程仓库已存在，更新地址...
    git remote set-url origin %REPO_URL%
    echo ✅ 远程仓库地址已更新
)
echo.

REM 推送到 GitHub
echo [6] 推送代码到 GitHub...
echo    这可能需要你登录 GitHub...
echo.
git push -u origin main
if errorlevel 1 (
    echo.
    echo ❌ 推送失败！
    echo.
    echo 可能的原因：
    echo   1. 需要 GitHub 身份验证
    echo   2. 仓库地址不正确
    echo   3. 网络问题
    echo.
    echo 解决方案：
    echo   1. 确保已登录 GitHub（可能会弹出浏览器）
    echo   2. 或使用 Personal Access Token
    echo   3. 访问: https://github.com/settings/tokens
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   🎉 设置完成！
echo ============================================================
echo.
echo ✅ 代码已推送到 GitHub
echo ✅ GitHub Actions 将自动开始构建
echo.
echo 下一步：
echo   1. 访问你的 GitHub 仓库: %REPO_URL:.git=%
echo   2. 点击 "Actions" 标签
echo   3. 查看构建进度
echo   4. 等待约 15 分钟构建完成
echo   5. 在 "Artifacts" 部分下载安装包
echo.
echo 构建内容：
echo   📦 windows-installer - Windows 安装程序 (.exe)
echo   📦 macos-installers - macOS 安装包 (.dmg x2)
echo.
echo 详细说明请查看: GITHUB_ACTIONS_SETUP.md
echo.
pause

