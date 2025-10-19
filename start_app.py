#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
多功能待办工具 - 主启动脚本
提供完整的环境检查、依赖管理和应用启动功能
"""

import os
import sys
import time
import signal
import subprocess
import shutil
from typing import Optional

# ============================================================================
# 工具函数 (Utility Functions)
# ============================================================================

def print_header(text: str):
    """打印标题头"""
    print()
    print("=" * 80)
    print(f"  {text}")
    print("=" * 80)
    print()

def print_step(step_num: int, text: str):
    """打印步骤信息"""
    print()
    print(f"[步骤 {step_num}] {text}")
    print("-" * 80)

def print_success(text: str):
    """打印成功信息（绿色）"""
    print(f"\033[92m✓ {text}\033[0m")

def print_warning(text: str):
    """打印警告信息（黄色）"""
    print(f"\033[93m⚠ {text}\033[0m")

def print_error(text: str):
    """打印错误信息（红色）"""
    print(f"\033[91m✗ {text}\033[0m")

def print_info(text: str):
    """打印提示信息（蓝色）"""
    print(f"\033[94mℹ {text}\033[0m")

def run_command(command: str, cwd: str = None, capture_output: bool = True) -> tuple:
    """执行命令并返回结果"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=capture_output,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def check_command_exists(command: str) -> bool:
    """检查命令是否存在"""
    try:
        if os.name == 'nt':  # Windows
            result = subprocess.run(
                f'where {command}',
                shell=True,
                capture_output=True,
                text=True
            )
        else:  # Unix/Linux/Mac
            result = subprocess.run(
                f'which {command}',
                shell=True,
                capture_output=True,
                text=True
            )
        return result.returncode == 0
    except:
        return False

def get_command_version(command: str, version_flag: str = '--version') -> str:
    """获取命令版本"""
    try:
        result = subprocess.run(
            f'{command} {version_flag}',
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        if result.returncode == 0:
            # 提取版本号（通常在第一行）
            version = result.stdout.strip().split('\n')[0]
            # 移除可能的命令名前缀
            version = version.replace(command, '').strip()
            return version
        return "未知"
    except:
        return "未知"

def check_file_exists(filepath: str) -> bool:
    """检查文件是否存在"""
    return os.path.isfile(filepath)

def check_directory_exists(dirpath: str) -> bool:
    """检查目录是否存在"""
    return os.path.isdir(dirpath)

def get_project_root() -> str:
    """获取项目根目录"""
    return os.path.dirname(os.path.abspath(__file__))

def confirm_action(prompt: str) -> bool:
    """确认操作"""
    try:
        response = input(f"{prompt} (y/n): ").strip().lower()
        return response in ['y', 'yes', '是']
    except:
        return False

def wait_with_dots(text: str, seconds: int):
    """带动画的等待"""
    print(f"{text}", end="", flush=True)
    for i in range(seconds):
        time.sleep(1)
        print(".", end="", flush=True)
    print()

# ============================================================================
# 环境检查器 (Environment Checker)
# ============================================================================

class EnvironmentChecker:
    """环境检查器"""
    
    def __init__(self):
        self.checks_passed = 0
        self.checks_failed = 0
    
    def check_python(self) -> bool:
        """检查Python环境"""
        print_step(1, "检查Python环境")
        
        # 检查Python版本
        version = sys.version_info
        version_str = f"{version.major}.{version.minor}.{version.micro}"
        
        if version.major >= 3 and version.minor >= 7:
            print_success(f"Python版本: {version_str}")
            self.checks_passed += 1
            return True
        else:
            print_error(f"Python版本过低: {version_str} (需要 3.7+)")
            print_info("请从 https://www.python.org/downloads/ 下载并安装Python 3.7或更高版本")
            self.checks_failed += 1
            return False
    
    def check_nodejs(self) -> bool:
        """检查Node.js环境"""
        print_step(2, "检查Node.js环境")
        
        if not check_command_exists('node'):
            print_error("Node.js未安装")
            print_info("请从 https://nodejs.org 下载并安装Node.js")
            self.checks_failed += 1
            return False
        
        version = get_command_version('node', '--version')
        print_success(f"Node.js版本: {version}")
        self.checks_passed += 1
        return True
    
    def check_npm(self) -> bool:
        """检查npm环境"""
        print_step(3, "检查npm环境")
        
        if not check_command_exists('npm'):
            print_error("npm未安装")
            print_info("npm通常随Node.js一起安装，请重新安装Node.js")
            self.checks_failed += 1
            return False
        
        version = get_command_version('npm', '--version')
        print_success(f"npm版本: {version}")
        self.checks_passed += 1
        return True
    
    def check_project_files(self) -> bool:
        """检查项目文件"""
        print_step(4, "检查项目文件")
        
        project_root = get_project_root()
        required_files = [
            'package.json',
            'tsconfig.json',
            'webpack.renderer.config.js'
        ]
        
        all_exist = True
        for filename in required_files:
            filepath = os.path.join(project_root, filename)
            if check_file_exists(filepath):
                print_success(f"找到文件: {filename}")
            else:
                print_error(f"缺少文件: {filename}")
                all_exist = False
        
        # 检查源代码目录
        src_dir = os.path.join(project_root, 'src')
        if check_directory_exists(src_dir):
            print_success("找到源代码目录: src/")
        else:
            print_error("缺少源代码目录: src/")
            all_exist = False
        
        if all_exist:
            self.checks_passed += 1
        else:
            self.checks_failed += 1
        
        return all_exist
    
    def check_dependencies(self) -> bool:
        """检查依赖安装"""
        print_step(5, "检查依赖安装")
        
        project_root = get_project_root()
        node_modules = os.path.join(project_root, 'node_modules')
        
        if check_directory_exists(node_modules):
            print_success("依赖已安装 (node_modules目录存在)")
            self.checks_passed += 1
            return True
        else:
            print_warning("依赖未安装")
            print_info("运行应用时会自动安装依赖")
            self.checks_failed += 1
            return False
    
    def run_full_check(self) -> bool:
        """运行完整的环境检查"""
        print_header("环境检查")
        
        self.checks_passed = 0
        self.checks_failed = 0
        
        # 运行所有检查
        self.check_python()
        self.check_nodejs()
        self.check_npm()
        self.check_project_files()
        self.check_dependencies()
        
        # 显示总结
        print()
        print("=" * 80)
        print("检查完成")
        print("=" * 80)
        print_success(f"通过: {self.checks_passed} 项")
        if self.checks_failed > 0:
            print_error(f"失败: {self.checks_failed} 项")
        print()
        
        return self.checks_failed == 0

# ============================================================================
# 应用启动器 (Application Launcher)
# ============================================================================

class AppLauncher:
    """应用启动器"""
    
    def __init__(self):
        self.project_root = get_project_root()
        self.dev_process = None
        self.use_dev_mode = False
        self.fast_mode = False
        
    def setup_signal_handlers(self):
        """设置信号处理器"""
        def signal_handler(signum, frame):
            print_info("\n正在关闭应用...")
            self.cleanup()
            sys.exit(0)
            
        signal.signal(signal.SIGINT, signal_handler)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, signal_handler)
    
    def cleanup(self):
        """清理资源"""
        if self.dev_process and self.dev_process.poll() is None:
            print_info("正在终止开发服务器...")
            try:
                self.dev_process.terminate()
                self.dev_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print_warning("强制终止开发服务器...")
                self.dev_process.kill()
            except:
                pass
    
    def _kill_node_processes(self):
        """清理可能占用端口的Node.js进程（优化版）"""
        try:
            if os.name == 'nt':  # Windows
                # 仅清理占用特定端口的进程，而不是所有 node.exe
                result = subprocess.run(
                    ['netstat', '-ano'], 
                    capture_output=True, 
                    text=True
                )
                # 查找占用 3000 端口的进程
                for line in result.stdout.split('\n'):
                    if ':3000' in line and 'LISTENING' in line:
                        parts = line.split()
                        if parts:
                            pid = parts[-1]
                            print_info(f"清理占用端口3000的进程 (PID: {pid})...")
                            subprocess.run(['taskkill', '/F', '/PID', pid], 
                             capture_output=True, text=True)
                            time.sleep(0.5)
                            break
            else:  # Unix/Linux/Mac
                # 查找并清理占用 3000 端口的进程
                result = subprocess.run(['lsof', '-ti:3000'], 
                                      capture_output=True, text=True)
                if result.stdout.strip():
                    pid = result.stdout.strip()
                    print_info(f"清理占用端口3000的进程 (PID: {pid})...")
                    subprocess.run(['kill', '-9', pid], 
                             capture_output=True, text=True)
                    time.sleep(0.5)
        except:
            pass  # 忽略错误，可能没有需要终止的进程
    
    def _get_latest_mtime(self, directory: str, extensions: list) -> float:
        """获取目录中指定扩展名文件的最新修改时间"""
        latest_mtime = 0
        try:
            for root, dirs, files in os.walk(directory):
                # 跳过 node_modules 和 dist
                dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', '__pycache__', '.git']]
                
                for file in files:
                    if any(file.endswith(ext) for ext in extensions):
                        filepath = os.path.join(root, file)
                        try:
                            mtime = os.path.getmtime(filepath)
                            latest_mtime = max(latest_mtime, mtime)
                        except:
                            pass
        except Exception as e:
            print_warning(f"检查文件时间时出错: {str(e)}")
        return latest_mtime
    
    def _should_rebuild_main(self) -> bool:
        """检查是否需要重新构建主进程"""
        main_js = os.path.join(self.project_root, 'dist', 'main', 'main.js')
        
        # 如果构建文件不存在，必须重新构建
        if not os.path.exists(main_js):
            return True
        
        # 获取构建文件的修改时间
        build_mtime = os.path.getmtime(main_js)
        
        # 获取源文件的最新修改时间
        src_main = os.path.join(self.project_root, 'src', 'main')
        src_mtime = self._get_latest_mtime(src_main, ['.ts', '.js'])
        
        # 如果源文件比构建文件新，需要重新构建
        return src_mtime > build_mtime
    
    def _should_rebuild_renderer(self) -> bool:
        """检查是否需要重新构建渲染进程"""
        renderer_js = os.path.join(self.project_root, 'dist', 'renderer.js')
        
        # 如果构建文件不存在，必须重新构建
        if not os.path.exists(renderer_js):
            return True
        
        # 获取构建文件的修改时间
        build_mtime = os.path.getmtime(renderer_js)
        
        # 获取源文件的最新修改时间
        src_renderer = os.path.join(self.project_root, 'src', 'renderer')
        src_mtime = self._get_latest_mtime(src_renderer, ['.ts', '.tsx', '.js', '.jsx', '.css'])
        
        # 同时检查 webpack 配置文件
        webpack_config = os.path.join(self.project_root, 'webpack.renderer.config.js')
        if os.path.exists(webpack_config):
            webpack_mtime = os.path.getmtime(webpack_config)
            src_mtime = max(src_mtime, webpack_mtime)
        
        # 如果源文件比构建文件新，需要重新构建
        return src_mtime > build_mtime
    
    def check_environment(self) -> bool:
        """快速环境检查"""
        print_step(1, "快速环境检查")
        
        # 检查Python
        if sys.version_info < (3, 7):
            print_error("Python版本过低，需要3.7+")
            return False
        print_success(f"Python版本: {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
        
        # 检查Node.js
        if not check_command_exists('node'):
            print_error("Node.js未安装")
            print_info("请从 https://nodejs.org 下载并安装Node.js")
            return False
        
        node_version = get_command_version('node', '--version')
        print_success(f"Node.js版本: {node_version}")
        
        # 检查npm
        if not check_command_exists('npm'):
            print_error("npm未安装")
            return False
        
        npm_version = get_command_version('npm', '--version')
        print_success(f"npm版本: {npm_version}")
        
        # 检查项目文件
        package_json = os.path.join(self.project_root, 'package.json')
        if not check_file_exists(package_json):
            print_error("package.json文件不存在")
            return False
        print_success("项目文件检查通过")
        
        return True
    
    def install_dependencies(self) -> bool:
        """安装依赖"""
        print_step(2, "检查和安装依赖")
        
        node_modules = os.path.join(self.project_root, 'node_modules')
        
        if check_directory_exists(node_modules):
            print_success("依赖已安装")
            print_info("跳过依赖重新安装 (如需重新安装，请删除 node_modules 文件夹)")
            return True
        else:
            print_info("依赖未安装，开始安装...")
            return self._run_npm_install()
    
    def _run_npm_install(self) -> bool:
        """执行npm install"""
        print_info("正在安装依赖包，这可能需要几分钟时间...")
        print_warning("请保持网络连接，不要关闭此窗口")
        
        # 显示进度提示
        print_info("安装进度将在下方显示：")
        print()
        
        try:
            # 先清理可能的端口占用
            self._kill_node_processes()
            
            # 在Windows上需要使用shell=True来正确执行npm命令
            if os.name == 'nt':  # Windows
                cmd = 'npm install'
                process = subprocess.Popen(
                    cmd,
                    shell=True,
                    cwd=self.project_root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    encoding='utf-8',
                    errors='replace'
                )
            else:  # Unix/Linux/Mac
                process = subprocess.Popen(
                    ['npm', 'install'],
                    cwd=self.project_root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    encoding='utf-8',
                    errors='replace'
                )
            
            # 实时显示输出
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    print(output.strip())
            
            return_code = process.poll()
            
            if return_code == 0:
                print_success("依赖安装完成！")
                return True
            else:
                print_error(f"依赖安装失败 (返回码: {return_code})")
                return False
                
        except Exception as e:
            print_error(f"安装依赖时出错: {str(e)}")
            return False
    
    def build_and_start_production(self) -> bool:
        """构建并启动生产模式应用（增量构建优化）"""
        print_step(3, "构建并启动应用 (生产模式)")
        
        # 清理可能的端口占用（优化后只清理特定端口）
        self._kill_node_processes()
        
        # 检查是否需要重新构建
        need_build_main = self._should_rebuild_main()
        need_build_renderer = self._should_rebuild_renderer()
        
        if not need_build_main and not need_build_renderer:
            print_success("检测到构建文件已是最新，跳过构建步骤")
            print_info("💡 提示: 使用增量构建可大幅加速启动（~5秒）")
        else:
            print_info("检测到源文件变化，开始构建...")
            if need_build_main:
                print_info("  ✓ 需要构建主进程")
            if need_build_renderer:
                print_info("  ✓ 需要构建渲染进程")
        print()
        
        # 构建主进程（仅在需要时）
        if need_build_main:
        print_info("编译主进程...")
        result = subprocess.run(
            'npm run build:main',
            shell=True,
            cwd=self.project_root,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        if result.returncode != 0:
            print_error("主进程编译失败")
            print_error(result.stderr)
            return False
        
        print_success("主进程编译完成")
        else:
            print_info("✓ 主进程构建文件已是最新，跳过编译")
        
        # 构建渲染进程（仅在需要时）
        if need_build_renderer:
        print_info("构建渲染进程...")
        result = subprocess.run(
            'npm run build:renderer',
            shell=True,
            cwd=self.project_root,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        if result.returncode != 0:
            print_error("渲染进程构建失败")
            print_error(result.stderr)
            
            # 同时输出 stdout（可能包含有用信息）
            if result.stdout:
                print()
                print("=== 构建输出 ===")
                print(result.stdout)
            
            # 保存详细错误到文件
            error_log = os.path.join(self.project_root, 'build_error.log')
            try:
                with open(error_log, 'w', encoding='utf-8') as f:
                    f.write("=" * 80 + "\n")
                    f.write("渲染进程构建错误日志\n")
                    f.write("=" * 80 + "\n\n")
                    f.write("=== STDERR ===\n")
                    f.write(result.stderr if result.stderr else "(无错误输出)")
                    f.write("\n\n=== STDOUT ===\n")
                    f.write(result.stdout if result.stdout else "(无标准输出)")
                    f.write("\n\n=== 返回码 ===\n")
                    f.write(str(result.returncode))
                    f.write("\n")
                print()
                print_info(f"详细错误已保存到: {error_log}")
                print_info("请查看该文件获取完整的构建错误信息")
            except Exception as e:
                print_warning(f"无法保存错误日志: {str(e)}")
            
            return False
        
        print_success("渲染进程构建完成")
        else:
            print_info("✓ 渲染进程构建文件已是最新，跳过构建")
        
        # 检查构建文件
        main_js = os.path.join(self.project_root, 'dist', 'main', 'main.js')
        renderer_js = os.path.join(self.project_root, 'dist', 'renderer.js')
        index_html = os.path.join(self.project_root, 'dist', 'index.html')
        
        if not check_file_exists(main_js):
            print_error("主进程文件不存在")
            return False
        
        if not check_file_exists(renderer_js):
            print_error("渲染进程文件不存在")
            return False
        
        if not check_file_exists(index_html):
            print_error("HTML文件不存在")
            return False
        
        print_success("所有构建文件检查通过")
        print()
        
        try:
            # 启动Electron应用 (生产模式)
            print_info("启动Electron应用...")
            
            # 设置环境变量
            env = os.environ.copy()
            env['NODE_ENV'] = 'production'
            
            if os.name == 'nt':  # Windows
                cmd = 'npx electron dist/main/main.js'
                self.dev_process = subprocess.Popen(
                    cmd,
                    shell=True,
                    cwd=self.project_root,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    encoding='utf-8',
                    errors='replace'
                )
            else:  # Unix/Linux/Mac
                self.dev_process = subprocess.Popen(
                    ['npx', 'electron', 'dist/main/main.js'],
                    cwd=self.project_root,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    encoding='utf-8',
                    errors='replace'
                )
            
            print_success("Electron应用已启动！")
            print_info("正在等待应用窗口打开...")
            print()
            
            # 监控输出
            startup_timeout = 30  # 30秒超时
            start_time = time.time()
            app_started = False
            
            while True:
                # 检查超时
                if time.time() - start_time > startup_timeout:
                    print_error("应用启动超时")
                    return False
                
                # 检查进程是否还在运行
                if self.dev_process.poll() is not None:
                    return_code = self.dev_process.returncode
                    if return_code == 0:
                        print_info("应用正常退出")
                        return True
                    else:
                        print_error(f"应用意外退出 (返回码: {return_code})")
                        return False
                
                # 读取输出
                try:
                    output = self.dev_process.stdout.readline()
                    if output:
                        line = output.strip()
                        if line:
                            print(line)
                        
                        # 检查启动成功的标志
                        if any(keyword in line.lower() for keyword in ['ready', 'initialized', 'database', 'window created']):
                            if not app_started:
                                print_success("应用初始化完成！")
                                app_started = True
                        
                        # 检查错误
                        if any(keyword in line.lower() for keyword in ['error', 'failed', 'cannot']):
                            if 'error' in line.lower() and 'gpu' not in line.lower():  # 忽略GPU错误
                                print_error(f"启动错误: {line}")
                                
                except:
                    time.sleep(0.1)
                    continue
                    
        except KeyboardInterrupt:
            print_info("\n用户取消启动")
            return False
        except Exception as e:
            print_error(f"启动应用时出错: {str(e)}")
            return False
    
    def start_development_server(self) -> bool:
        """启动开发服务器 (原有方法保留)"""
        print_step(3, "启动开发服务器")
        
        # 清理可能的端口占用
        self._kill_node_processes()
        
        print_info("正在启动开发服务器...")
        print_info("这将会:")
        print_info("  1. 编译TypeScript代码")
        print_info("  2. 启动Webpack开发服务器")
        print_info("  3. 打开Electron应用窗口")
        print()
        
        wait_with_dots("准备启动", 2)
        
        try:
            # 启动开发服务器
            if os.name == 'nt':  # Windows
                cmd = 'npm run dev'
                self.dev_process = subprocess.Popen(
                    cmd,
                    shell=True,
                    cwd=self.project_root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    encoding='utf-8',
                    errors='replace'
                )
            else:  # Unix/Linux/Mac
                self.dev_process = subprocess.Popen(
                    ['npm', 'run', 'dev'],
                    cwd=self.project_root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    encoding='utf-8',
                    errors='replace'
                )
            
            print_success("开发服务器已启动！")
            print_info("正在等待应用窗口打开...")
            print()
            
            # 监控输出
            startup_timeout = 60  # 60秒超时
            start_time = time.time()
            app_started = False
            
            while True:
                # 检查超时
                if time.time() - start_time > startup_timeout:
                    print_error("应用启动超时")
                    return False
                
                # 检查进程是否还在运行
                if self.dev_process.poll() is not None:
                    print_error("开发服务器意外退出")
                    return False
                
                # 读取输出
                try:
                    output = self.dev_process.stdout.readline()
                    if output:
                        line = output.strip()
                        print(line)
                        
                        # 检查启动成功的标志
                        if any(keyword in line.lower() for keyword in ['compiled successfully', 'webpack compiled', 'ready']):
                            if not app_started:
                                print_success("应用编译完成！")
                                app_started = True
                        
                        # 检查错误
                        if any(keyword in line.lower() for keyword in ['error', 'failed', 'cannot']):
                            if 'error' in line.lower():
                                print_error(f"启动错误: {line}")
                                
                except:
                    time.sleep(0.1)
                    continue
                    
        except KeyboardInterrupt:
            print_info("\n用户取消启动")
            return False
        except Exception as e:
            print_error(f"启动开发服务器时出错: {str(e)}")
            return False
    
    def wait_for_exit(self):
        """等待用户退出"""
        try:
            print()
            print_success("应用正在运行中...")
            print_info("使用说明:")
            print_info("  - 应用窗口应该已经打开")
            print_info("  - 可以正常使用多功能待办工具")
            print_info("  - 按 Ctrl+C 退出应用")
            print()
            
            # 等待进程结束或用户中断
            while self.dev_process and self.dev_process.poll() is None:
                time.sleep(1)
                
            if self.dev_process:
                return_code = self.dev_process.returncode
                if return_code == 0:
                    print_info("应用正常退出")
                else:
                    print_warning(f"应用退出 (返回码: {return_code})")
                    
        except KeyboardInterrupt:
            print_info("\n正在关闭应用...")
            self.cleanup()
    
    def run_full_check(self) -> bool:
        """运行完整的环境检查"""
        print_info("正在运行完整的环境检查...")
        checker = EnvironmentChecker()
        return checker.run_full_check()
    
    def launch(self):
        """启动应用"""
        print_header("多功能待办工具 - 启动器")
        
        # 设置信号处理
        self.setup_signal_handlers()
        
        try:
            # 快速模式：跳过检查，直接启动
            if self.fast_mode:
                print_warning("⚡ 快速启动模式：跳过环境和依赖检查")
                print_info("假设已完成环境配置和依赖安装")
                print()
            else:
            # 快速环境检查
            if not self.check_environment():
                print_error("环境检查失败")
                
                if confirm_action("是否要运行详细的环境检查？"):
                    self.run_full_check()
                return False
            
            # 安装依赖
            if not self.install_dependencies():
                print_error("依赖安装失败")
                return False
            
            # 根据模式启动应用
            if self.use_dev_mode:
                # 开发模式 - 保留原有的开发服务器逻辑
                if not self.start_development_server():
                    print_error("启动开发服务器失败")
                    return False
            else:
                # 生产模式 - 使用构建后的文件
                if not self.build_and_start_production():
                    print_error("构建或启动应用失败")
                    return False
            
            # 等待退出
            self.wait_for_exit()
            
            return True
            
        except KeyboardInterrupt:
            print_info("\n启动已取消")
            return False
        except Exception as e:
            print_error(f"启动过程中出现错误: {str(e)}")
            return False
        finally:
            self.cleanup()

def show_help():
    """显示帮助信息"""
    print_header("多功能待办工具 - 帮助")
    print()
    print_info("使用方法:")
    print_info("  python start_app.py              # 启动应用 (生产模式)")
    print_info("  python start_app.py --dev        # 启动开发模式 (webpack dev server)")
    print_info("  python start_app.py --fast       # 快速启动模式 (跳过检查)")
    print_info("  python start_app.py --check      # 只运行环境检查")
    print_info("  python start_app.py --help       # 显示此帮助")
    print()
    print_info("功能说明:")
    print_info("  1. 自动检查开发环境")
    print_info("  2. 自动安装项目依赖")
    print_info("  3. 智能增量构建 (仅构建变化的文件)")
    print_info("  4. 构建并启动应用 (默认生产模式)")
    print_info("  5. 打开应用窗口")
    print()
    print_info("模式说明:")
    print_info("  - 生产模式: 智能增量构建，首次~1分钟，后续~5秒")
    print_info("  - 快速模式: 跳过环境检查，直接启动，~3-5秒")
    print_info("  - 开发模式: 使用webpack dev server，支持热重载")
    print()
    print_info("性能优化:")
    print_info("  ✓ 增量构建: 仅在源文件变化时重新构建")
    print_info("  ✓ 智能端口清理: 只清理必要的占用进程")
    print_info("  ✓ 快速启动: --fast 模式可将启动时间缩短到3-5秒")
    print()
    print_info("注意事项:")
    print_info("  - 首次运行需要安装依赖，可能需要几分钟")
    print_info("  - 后续启动会自动使用缓存，大幅加速")
    print_info("  - 确保网络连接正常")
    print_info("  - 使用 Ctrl+C 可以安全退出")

def main():
    """主函数"""
    # 解析命令行参数
    dev_mode = False
    fast_mode = False
    
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ['--help', '-h', 'help']:
            show_help()
            return
        elif arg in ['--check', '-c', 'check']:
            checker = EnvironmentChecker()
            success = checker.run_full_check()
            sys.exit(0 if success else 1)
        elif arg in ['--dev', '-d', 'dev']:
            dev_mode = True
            print_warning("使用开发模式启动 (可能遇到webpack连接问题)")
        elif arg in ['--fast', '-f', 'fast']:
            fast_mode = True
            print_success("⚡ 快速启动模式")
    
    # 启动应用
    launcher = AppLauncher()
    launcher.use_dev_mode = dev_mode
    launcher.fast_mode = fast_mode
    success = launcher.launch()
    
    if success:
        print_success("应用已成功关闭")
    else:
        print_error("应用启动失败")
        print_info("可以尝试:")
        print_info("  1. 运行 'python start_app.py --check' 检查环境")
        print_info("  2. 查看上面的错误信息")
        print_info("  3. 联系开发者获取帮助")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
