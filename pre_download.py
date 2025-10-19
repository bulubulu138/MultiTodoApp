#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预下载打包所需的依赖文件
解决网络连接问题
"""
import os
import sys
import urllib.request
import platform

ELECTRON_VERSION = "27.3.11"
SQLITE3_VERSION = "5.1.7"

def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")

def download_file(url, dest_path, description):
    """下载文件并显示进度"""
    print(f"正在下载: {description}")
    print(f"URL: {url}")
    print(f"目标: {dest_path}")
    
    try:
        # 创建目录
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        
        # 下载文件
        def show_progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            percent = min(downloaded * 100 / total_size, 100)
            print(f"\r进度: {percent:.1f}%", end="", flush=True)
        
        urllib.request.urlretrieve(url, dest_path, show_progress)
        print(f"\n✅ 下载完成: {description}\n")
        return True
    except Exception as e:
        print(f"\n❌ 下载失败: {str(e)}\n")
        return False

def main():
    print_header("依赖预下载工具")
    
    os_type = platform.system()
    arch = "x64" if platform.machine() in ["AMD64", "x86_64"] else "arm64"
    
    print(f"操作系统: {os_type}")
    print(f"架构: {arch}")
    
    # Electron 下载地址
    if os_type == "Windows":
        electron_url = f"https://npmmirror.com/mirrors/electron/{ELECTRON_VERSION}/electron-v{ELECTRON_VERSION}-win32-{arch}.zip"
        electron_dest = f"cache/electron-v{ELECTRON_VERSION}-win32-{arch}.zip"
    elif os_type == "Darwin":
        electron_url = f"https://npmmirror.com/mirrors/electron/{ELECTRON_VERSION}/electron-v{ELECTRON_VERSION}-darwin-{arch}.zip"
        electron_dest = f"cache/electron-v{ELECTRON_VERSION}-darwin-{arch}.zip"
    else:
        print("不支持的操作系统")
        sys.exit(1)
    
    # 下载 Electron
    print_header("步骤 1/2: 下载 Electron")
    download_file(electron_url, electron_dest, f"Electron {ELECTRON_VERSION}")
    
    # 下载 sqlite3
    print_header("步骤 2/2: 下载 sqlite3")
    if os_type == "Windows":
        sqlite_url = f"https://npmmirror.com/mirrors/sqlite3/v{SQLITE3_VERSION}/napi-v6-win32-{arch}.tar.gz"
        sqlite_dest = f"cache/sqlite3-v{SQLITE3_VERSION}-napi-v6-win32-{arch}.tar.gz"
    else:
        sqlite_url = f"https://npmmirror.com/mirrors/sqlite3/v{SQLITE3_VERSION}/napi-v6-darwin-{arch}.tar.gz"
        sqlite_dest = f"cache/sqlite3-v{SQLITE3_VERSION}-napi-v6-darwin-{arch}.tar.gz"
    
    download_file(sqlite_url, sqlite_dest, f"sqlite3 {SQLITE3_VERSION}")
    
    print_header("下载完成！")
    print("✅ 所有依赖已下载到 cache/ 目录")
    print("\n下一步:")
    print("1. 将 cache/ 目录复制到打包环境")
    print("2. 配置环境变量指向本地缓存")
    print("3. 运行打包脚本")

if __name__ == "__main__":
    main()

