#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
多功能待办应用打包工具
支持Windows和macOS平台
"""
import os
import sys
import subprocess
import platform
import shutil

def print_header(text):
    """打印标题头"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")

def print_success(text):
    """打印成功信息"""
    print(f"\033[92m✓ {text}\033[0m")

def print_error(text):
    """打印错误信息"""
    print(f"\033[91m✗ {text}\033[0m")

def print_info(text):
    """打印提示信息"""
    print(f"\033[94mℹ {text}\033[0m")

def run_command(cmd, description):
    """执行命令"""
    print(f"\n[执行] {description}...")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print_error(f"{description}失败")
        sys.exit(1)
    print_success(f"{description}完成")

def main():
    print_header("多功能待办应用打包工具")
    
    os_type = platform.system()
    print_info(f"检测到操作系统: {os_type}")
    
    if os_type not in ["Windows", "Darwin"]:
        print_error(f"不支持的操作系统: {os_type}")
        print_info("本工具仅支持 Windows 和 macOS")
        sys.exit(1)
    
    # 1. 清理
    print_header("步骤 1/5: 清理旧构建")
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
    
    # 2. 安装依赖
    print_header("步骤 2/5: 安装依赖")
    run_command("npm install", "安装依赖")
    
    # 3. 重新编译native模块
    print_header("步骤 3/5: 重新编译native模块")
    run_command("npm run rebuild", "重新编译sqlite3")
    
    # 4. 构建应用
    print_header("步骤 4/5: 构建应用")
    run_command("npm run build", "构建应用")
    
    # 5. 打包
    print_header("步骤 5/5: 打包安装程序")
    if os_type == "Windows":
        run_command("npm run dist:win", "打包Windows安装程序")
        print_header("✅ 打包完成！")
        print_info("📦 Windows安装包已生成")
        print_info("   位置: release\\")
        if os.path.exists('release'):
            exe_files = [f for f in os.listdir('release') if f.endswith('.exe')]
            for exe in exe_files:
                print_info(f"   - {exe}")
    
    elif os_type == "Darwin":
        run_command("npm run dist:mac", "打包macOS安装程序")
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
    print_info("数据存储位置:")
    if os_type == "Windows":
        print_info("   Windows: %APPDATA%\\多功能待办\\todo_app.db")
    elif os_type == "Darwin":
        print_info("   macOS: ~/Library/Application Support/多功能待办/todo_app.db")
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
        sys.exit(1)

