#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
多功能待办应用打包工具（增强版）
解决网络问题和依赖冲突
"""
import os
import sys
import subprocess
import platform
import shutil
import time

def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")

def print_success(text):
    print(f"\033[92m✓ {text}\033[0m")

def print_error(text):
    print(f"\033[91m✗ {text}\033[0m")

def print_info(text):
    print(f"\033[94mℹ {text}\033[0m")

def print_warning(text):
    print(f"\033[93m⚠ {text}\033[0m")

def run_command(cmd, description, retry=3):
    """执行命令，支持重试"""
    for attempt in range(retry):
        if attempt > 0:
            print_warning(f"重试第 {attempt} 次...")
            time.sleep(2)
        
        print(f"\n[执行] {description}...")
        result = subprocess.run(cmd, shell=True)
        
        if result.returncode == 0:
            print_success(f"{description}完成")
            return True
    
    print_error(f"{description}失败（已重试{retry}次）")
    return False

def setup_mirrors():
    """配置国内镜像源"""
    print_header("配置镜像源")
    
    # 创建 .npmrc 文件
    npmrc_content = """# Electron 镜像源
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

# npm 镜像源
registry=https://registry.npmmirror.com

# sqlite3 镜像源
SQLITE3_BINARY_SITE=https://npmmirror.com/mirrors/sqlite3/

# 其他镜像源
node_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/
sass_binary_site=https://npmmirror.com/mirrors/node-sass/
"""
    
    with open('.npmrc', 'w', encoding='utf-8') as f:
        f.write(npmrc_content)
    
    print_success("镜像源配置完成")
    
    # 设置环境变量
    os.environ['ELECTRON_MIRROR'] = 'https://npmmirror.com/mirrors/electron/'
    os.environ['ELECTRON_BUILDER_BINARIES_MIRROR'] = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
    os.environ['SQLITE3_BINARY_SITE'] = 'https://npmmirror.com/mirrors/sqlite3/'
    
    print_info("环境变量已设置")

def check_network():
    """检查网络连接"""
    print_header("检查网络连接")
    
    test_urls = [
        ("淘宝镜像", "https://registry.npmmirror.com"),
        ("GitHub", "https://github.com")
    ]
    
    for name, url in test_urls:
        try:
            import urllib.request
            urllib.request.urlopen(url, timeout=5)
            print_success(f"{name}: 连接正常")
        except:
            print_warning(f"{name}: 连接失败")

def upgrade_sqlite3():
    """升级 sqlite3 到兼容版本"""
    print_header("检查 sqlite3 版本")
    
    print_info("检查 sqlite3 版本...")
    try:
        result = subprocess.run(
            "npm list sqlite3 --depth=0",
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        if result.stdout and "5.1.7" in result.stdout:
            print_warning("检测到 sqlite3@5.1.7，建议升级")
            print_info("尝试升级到最新版本以解决兼容性问题...")
            return run_command(
                "npm install sqlite3@latest --save",
                "升级 sqlite3",
                retry=3
            )
        else:
            print_success("sqlite3 版本检查通过")
    except Exception as e:
        print_warning(f"无法检查 sqlite3 版本: {str(e)}")
        print_info("跳过版本检查，继续打包...")
    return True

def main():
    print_header("多功能待办应用打包工具（增强版）")
    
    os_type = platform.system()
    print_info(f"检测到操作系统: {os_type}")
    
    if os_type not in ["Windows", "Darwin"]:
        print_error(f"不支持的操作系统: {os_type}")
        sys.exit(1)
    
    # 0. 检查网络
    check_network()
    
    # 1. 配置镜像源
    setup_mirrors()
    
    # 2. 清理
    print_header("步骤 1/6: 清理旧构建")
    dirs_to_clean = ['release']
    files_to_clean = [
        'dist/main',
        'dist/renderer', 
        'dist/shared',
        'dist/index.html',
        'dist/renderer.js',
        'dist/renderer.js.map'
    ]
    
    for dir_path in dirs_to_clean:
        if os.path.exists(dir_path):
            shutil.rmtree(dir_path)
            print_info(f"已删除: {dir_path}/")
    
    for file_path in files_to_clean:
        if os.path.exists(file_path):
            if os.path.isdir(file_path):
                shutil.rmtree(file_path)
            else:
                os.remove(file_path)
            print_info(f"已删除: {file_path}")
    
    print_success("清理完成")
    
    # 3. 升级 sqlite3（自动）
    upgrade_sqlite3()
    
    # 4. 安装依赖
    print_header("步骤 2/6: 安装依赖")
    if not run_command("npm install", "安装依赖", retry=3):
        print_error("依赖安装失败，请检查网络连接和镜像源配置")
        sys.exit(1)
    
    # 5. 重新编译native模块
    print_header("步骤 3/6: 重新编译native模块")
    if not run_command("npm run rebuild", "重新编译sqlite3", retry=2):
        print_warning("sqlite3编译失败，尝试使用预编译版本")
    
    # 6. 构建应用
    print_header("步骤 4/6: 构建应用")
    if not run_command("npm run build", "构建应用", retry=2):
        print_error("构建失败")
        sys.exit(1)
    
    # 7. 打包
    print_header("步骤 5/6: 打包安装程序")
    if os_type == "Windows":
        if not run_command("npm run dist:win", "打包Windows安装程序", retry=2):
            print_error("打包失败")
            sys.exit(1)
        
        print_header("✅ 打包完成！")
        print_info("📦 Windows安装包已生成")
        print_info("   位置: release\\")
        if os.path.exists('release'):
            exe_files = [f for f in os.listdir('release') if f.endswith('.exe')]
            for exe in exe_files:
                print_info(f"   - {exe}")
    
    elif os_type == "Darwin":
        if not run_command("npm run dist:mac", "打包macOS安装程序", retry=2):
            print_error("打包失败")
            sys.exit(1)
        
        print_header("✅ 打包完成！")
        print_info("📦 macOS安装包已生成")
        print_info("   位置: release/")
        if os.path.exists('release'):
            dmg_files = [f for f in os.listdir('release') if f.endswith('.dmg')]
            for dmg in dmg_files:
                print_info(f"   - {dmg}")
    
    print()
    print_header("使用说明")
    print_info("1. 安装包位于 release/ 目录")
    print_info("2. 用户数据会保存在系统用户目录中")
    print_info("3. 升级时数据会自动保留")
    print_info("4. 卸载时可选择是否删除数据")
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print_error("用户取消操作")
        sys.exit(1)
    except Exception as e:
        print()
        print_error(f"发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

