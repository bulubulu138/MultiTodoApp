# force_build.py
# 强制打包脚本 - 处理顽固的文件锁问题

import subprocess
import os
import time
import shutil
import sys
from pathlib import Path

def print_step(step, msg):
    print(f"\n{'='*60}")
    print(f"[{step}] {msg}")
    print('='*60)

def kill_processes():
    """终止所有相关进程"""
    print_step("1/6", "终止相关进程")
    processes = ["electron.exe", "node.exe", "app-builder.exe"]
    for proc in processes:
        try:
            subprocess.run(f'taskkill /F /IM {proc}', 
                         shell=True, 
                         capture_output=True,
                         timeout=10)
            print(f"  ✓ 已终止: {proc}")
        except:
            pass
    
    print("  等待进程完全终止...")
    time.sleep(10)

def clean_directories():
    """清理构建目录"""
    print_step("2/6", "清理旧的构建文件")
    
    # 处理 release 目录
    if os.path.exists("release"):
        print("  尝试删除 release 目录...")
        try:
            shutil.rmtree("release", ignore_errors=False)
            print("  ✓ release 目录已删除")
        except Exception as e:
            print(f"  ⚠ 无法删除，尝试重命名: {e}")
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            new_name = f"release_old_{timestamp}"
            try:
                os.rename("release", new_name)
                print(f"  ✓ 已重命名为: {new_name}")
            except Exception as e2:
                print(f"  ❌ 重命名也失败: {e2}")
                print("  将继续尝试打包...")
    
    # 删除 dist 目录
    if os.path.exists("dist"):
        print("  删除 dist 目录...")
        try:
            shutil.rmtree("dist", ignore_errors=True)
            print("  ✓ dist 目录已删除")
        except:
            pass
    
    print("  等待文件系统释放...")
    time.sleep(5)

def build_app():
    """构建应用"""
    print_step("3/6", "构建应用")
    result = subprocess.run("npm run build", 
                          shell=True,
                          capture_output=False)
    if result.returncode != 0:
        print("❌ 构建失败")
        sys.exit(1)
    print("✓ 构建完成")

def package_app():
    """打包应用"""
    print_step("4/6", "打包 Windows 安装程序")
    result = subprocess.run("npx electron-builder --win", 
                          shell=True,
                          capture_output=False)
    if result.returncode != 0:
        print("❌ 打包失败")
        return False
    print("✓ 打包完成")
    return True

def check_output():
    """检查输出"""
    print_step("5/6", "检查输出文件")
    release_dir = Path("release")
    if not release_dir.exists():
        print("❌ release 目录不存在")
        return False
    
    exe_files = list(release_dir.glob("**/*.exe"))
    if exe_files:
        print(f"\n✅ 找到 {len(exe_files)} 个安装程序:")
        for exe in exe_files:
            size_mb = exe.stat().st_size / (1024 * 1024)
            print(f"  📦 {exe.name} ({size_mb:.2f} MB)")
            print(f"     路径: {exe.absolute()}")
        return True
    else:
        print("❌ 未找到 .exe 安装程序")
        return False

def main():
    print("\n" + "="*60)
    print("  多功能待办 - 强制打包工具")
    print("="*60)
    
    # 确保在正确的目录
    if not os.path.exists("package.json"):
        print("❌ 错误: 请在 MultiTodoApp 目录中运行此脚本")
        sys.exit(1)
    
    try:
        kill_processes()
        clean_directories()
        build_app()
        
        # 尝试打包,如果失败则重试
        max_retries = 2
        for attempt in range(max_retries):
            if attempt > 0:
                print_step(f"重试 {attempt}/{max_retries}", "再次尝试打包")
                time.sleep(5)
                # 再次清理
                if os.path.exists("release"):
                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                    try:
                        os.rename("release", f"release_failed_{timestamp}")
                    except:
                        pass
                time.sleep(3)
            
            if package_app():
                break
        
        print_step("6/6", "完成")
        if check_output():
            print("\n🎉 打包成功!")
        else:
            print("\n⚠ 打包过程完成,但未找到安装程序")
            print("请检查 release 目录的内容")
    
    except KeyboardInterrupt:
        print("\n\n用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()


