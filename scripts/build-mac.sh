#!/bin/bash

# macOS 构建和签名脚本
# 用于修复 macOS 应用闪退问题

set -e  # 遇到错误立即退出

echo "======================================"
echo "MultiTodo macOS 构建脚本"
echo "======================================"
echo ""

# 检查是否在 macOS 上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ 错误：此脚本必须在 macOS 上运行"
    exit 1
fi

# 检查 Python 3
echo "🔍 检查 Python 3..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误：未找到 Python 3"
    echo "请先安装 Python 3: https://www.python.org/downloads/"
    exit 1
fi

# 步骤 1: 生成 icon.icns
echo ""
echo "📦 步骤 1/5: 生成 macOS 图标文件..."
if [ ! -f "assets/icon.icns" ]; then
    echo "正在生成 icon.icns..."
    cd assets
    python3 create_icns.py
    cd ..

    if [ ! -f "assets/icon.icns" ]; then
        echo "❌ 错误：icon.icns 生成失败"
        exit 1
    fi
    echo "✅ icon.icns 生成成功"
else
    echo "✅ icon.icns 已存在，跳过"
fi

# 步骤 2: 安装依赖
echo ""
echo "📦 步骤 2/5: 安装依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在运行 npm install..."
    npm install
    echo "✅ 依赖安装完成"
else
    echo "✅ node_modules 已存在，跳过"
fi

# 步骤 3: 重建原生模块
echo ""
echo "🔧 步骤 3/5: 重建原生模块 (better-sqlite3)..."
echo "正在为当前架构 $(uname -m) 重新编译原生模块..."
npm run rebuild

echo "正在验证原生模块..."
npm run verify
echo "✅ 原生模块重建完成"

# 步骤 4: 构建
echo ""
echo "🔨 步骤 4/5: 构建应用..."
npm run build
echo "✅ 构建完成"

# 步骤 5: 打包
echo ""
echo "📦 步骤 5/5: 创建 macOS 安装包..."
npm run dist:mac
echo "✅ 打包完成"

# 步骤 6: Ad-hoc 签名
echo ""
echo "🔐 应用签名 (Ad-hoc)..."

# 查找生成的 .app 文件
APP_FILE=$(find release -name "MultiTodo.app" -maxdepth 2 | head -n 1)

if [ -z "$APP_FILE" ]; then
    echo "⚠️  警告：未找到 MultiTodo.app，跳过签名"
    echo "请检查 release 目录中的构建结果"
else
    echo "找到应用: $APP_FILE"
    echo "正在签名..."

    # 删除旧签名（如果有）
    codesign --remove-signature "$APP_FILE" 2>/dev/null || true

    # 应用新的 ad-hoc 签名
    codesign --force --deep --sign - "$APP_FILE"

    # 验证签名
    if codesign --verify --verbose "$APP_FILE" 2>&1 | grep -q "valid on disk"; then
        echo "✅ 签名验证成功"
    else
        echo "⚠️  签名验证失败，但应用可能仍可运行"
    fi
fi

# 总结
echo ""
echo "======================================"
echo "✅ 构建完成！"
echo "======================================"
echo ""
echo "构建产物位置："
if [ -n "$APP_FILE" ]; then
    echo "  应用: $APP_FILE"
fi
echo "  DMG: $(find release -name "*.dmg" | head -n 1)"
echo ""
echo "运行应用："
echo "  1. 双击 .app 文件"
echo "  2. 如果被阻止，右键点击 → 选择'打开' → 点击'打开'"
echo "  3. 或从命令行运行查看日志："
if [ -n "$APP_FILE" ]; then
    echo "     $APP_FILE/Contents/MacOS/MultiTodo"
fi
echo ""
echo "调试信息："
echo "  查看崩溃日志: ~/Library/Logs/DiagnosticReports/"
echo "  查看系统日志: log show --predicate 'eventMessage contains \"MultiTodo\"' --last 5m"
echo ""
