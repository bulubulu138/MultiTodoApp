#!/usr/bin/env python3
"""
健壮的 macOS 图标生成脚本
支持多种图标处理方法，具备全面的错误处理和自动修复功能
"""

import os
import sys
import subprocess
import tempfile
import shutil
import json
from pathlib import Path

class IconGenerator:
    def __init__(self):
        self.assets_dir = Path(__file__).parent
        self.required_sizes = [16, 32, 128, 256, 512, 1024]
        self.icon_mapping = {
            16: [("icon_16x16.png", "icon_16x16.png")],
            32: [("icon_32x32.png", "icon_16x16@2x.png"), ("icon_32x32.png", "icon_32x32.png")],
            128: [("icon_128x128.png", "icon_128x128.png")],
            256: [("icon_256x256.png", "icon_128x128@2x.png"), ("icon_256x256.png", "icon_256x256.png")],
            512: [("icon_512x512.png", "icon_256x256@2x.png"), ("icon_512x512.png", "icon_512x512.png")],
            1024: [("icon_512x512.png", "icon_512x512@2x.png")]
        }
        self.available_tools = []
        self.detected_issues = []

    def log(self, message, level="INFO"):
        """日志输出"""
        prefix = {
            "INFO": "✅",
            "WARNING": "⚠️",
            "ERROR": "❌",
            "DEBUG": "🔍"
        }.get(level, "📝")
        print(f"{prefix} {message}")

    def check_environment(self):
        """检查运行环境和可用工具"""
        self.log("检查运行环境和可用工具...")

        if sys.platform != "darwin":
            self.log("错误：此脚本只能在 macOS 上运行", "ERROR")
            return False

        # 检查可用工具
        tools = {
            "iconutil": "macOS 图标转换工具",
            "sips": "macOS 图像处理工具",
            "python3": "Python 环境"
        }

        for tool, description in tools.items():
            try:
                result = subprocess.run(["which", tool], capture_output=True, text=True)
                if result.returncode == 0:
                    self.available_tools.append(tool)
                    self.log(f"✓ {tool} 可用 - {description}")
                else:
                    self.log(f"✗ {tool} 不可用 - {description}", "WARNING")
            except Exception as e:
                self.log(f"✗ 检查 {tool} 时出错: {e}", "WARNING")

        return len(self.available_tools) > 0

    def scan_available_icons(self):
        """扫描可用的图标文件"""
        self.log("扫描可用图标文件...")

        available_icons = {}
        icon_files = list(self.assets_dir.glob("icon_*.png"))

        for icon_file in icon_files:
            # 解析文件名获取尺寸
            try:
                parts = icon_file.stem.split("_")
                if len(parts) >= 2:
                    size_str = parts[1]
                    if size_str.endswith("x1024"):
                        size = 1024
                    else:
                        size = int(size_str.split("x")[0])
                    available_icons[size] = str(icon_file)
                    self.log(f"✓ 发现 {size}x{size} 图标: {icon_file.name}")
            except (ValueError, IndexError):
                self.log(f"✗ 无法解析图标文件名: {icon_file.name}", "WARNING")

        return available_icons

    def generate_missing_icon(self, size, available_icons):
        """生成缺失的图标尺寸"""
        self.log(f"生成缺失的 {size}x{size} 图标...")

        # 找到最接近的可用图标作为源
        available_sizes = sorted(available_icons.keys(), reverse=True)
        source_size = None
        source_file = None

        for available_size in available_sizes:
            if available_size >= size:
                source_size = available_size
                source_file = available_icons[available_size]
                break

        if not source_size:
            # 使用最大的可用图标
            source_size = max(available_sizes)
            source_file = available_icons[source_size]

        self.log(f"使用 {source_size}x{source_size} 源图标生成 {size}x{size}")

        output_file = self.assets_dir / f"icon_{size}x{size}.png"

        # 方法1: 使用 sips
        if "sips" in self.available_tools:
            try:
                cmd = [
                    "sips", "-z", str(size), str(size),
                    source_file, "--out", str(output_file)
                ]
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0:
                    self.log(f"✓ 使用 sips 成功生成 {size}x{size} 图标")
                    return str(output_file)
                else:
                    self.log(f"sips 失败: {result.stderr}", "WARNING")
            except Exception as e:
                self.log(f"sips 处理出错: {e}", "WARNING")

        # 方法2: 使用 Python PIL (如果可用)
        try:
            from PIL import Image

            with Image.open(source_file) as img:
                # 确保图标是正方形
                width, height = img.size
                if width != height:
                    # 裁剪为正方形
                    size_min = min(width, height)
                    left = (width - size_min) // 2
                    top = (height - size_min) // 2
                    img = img.crop((left, top, left + size_min, top + size_min))

                # 调整大小
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                resized_img.save(output_file, "PNG")

            self.log(f"✓ 使用 PIL 成功生成 {size}x{size} 图标")
            return str(output_file)

        except ImportError:
            self.log("PIL (Pillow) 不可用，跳过 Python 图像处理", "DEBUG")
        except Exception as e:
            self.log(f"PIL 处理出错: {e}", "WARNING")

        self.detected_issues.append(f"无法生成 {size}x{size} 图标")
        return None

    def create_iconset(self, available_icons):
        """创建 iconset 目录结构"""
        self.log("创建 iconset 目录结构...")

        iconset_dir = self.assets_dir / "MultiTodo.iconset"

        # 清理旧的 iconset
        if iconset_dir.exists():
            shutil.rmtree(iconset_dir)
        iconset_dir.mkdir()

        # macOS .icns 需要的文件格式
        iconset_files = [
            ("icon_16x16.png", 16),
            ("icon_16x16@2x.png", 32),
            ("icon_32x32.png", 32),
            ("icon_32x32@2x.png", 64),
            ("icon_128x128.png", 128),
            ("icon_128x128@2x.png", 256),
            ("icon_256x256.png", 256),
            ("icon_256x256@2x.png", 512),
            ("icon_512x512.png", 512),
            ("icon_512x512@2x.png", 1024)
        ]

        generated_files = []

        for filename, target_size in iconset_files:
            target_path = iconset_dir / filename

            # 寻找合适的源图标
            source_file = None

            # 直接查找匹配的图标
            if str(target_size) in [str(s) for s in available_icons.keys()]:
                for size, path in available_icons.items():
                    if size == target_size:
                        source_file = path
                        break

            # 如果没有直接匹配，寻找最接近的图标
            if not source_file and available_icons:
                best_size = min(available_icons.keys(),
                              key=lambda x: abs(x - target_size))
                source_file = available_icons[best_size]
                self.log(f"使用 {best_size}x{best_size} 图标缩放到 {target_size}x{target_size}")

            if source_file and os.path.exists(source_file):
                try:
                    if target_size != self._get_image_size(source_file):
                        # 需要缩放
                        self._resize_image(source_file, target_path, target_size)
                    else:
                        # 直接复制
                        shutil.copy2(source_file, target_path)

                    generated_files.append(target_path)
                    self.log(f"✓ 创建 {filename}")

                except Exception as e:
                    self.log(f"✗ 创建 {filename} 失败: {e}", "ERROR")
                    return None
            else:
                self.log(f"✗ 无法为 {filename} 找到源图标", "ERROR")
                return None

        return iconset_dir, generated_files

    def _get_image_size(self, image_path):
        """获取图像尺寸"""
        try:
            if "sips" in self.available_tools:
                result = subprocess.run(
                    ["sips", "-g", "pixelWidth", "-g", "pixelHeight", image_path],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')
                    width = int(lines[0].split()[-1])
                    height = int(lines[1].split()[-1])
                    return max(width, height)

            # 备用方法：使用 PIL
            from PIL import Image
            with Image.open(image_path) as img:
                return max(img.size)
        except:
            return 0

    def _resize_image(self, source_path, target_path, target_size):
        """调整图像大小"""
        # 优先使用 sips
        if "sips" in self.available_tools:
            try:
                subprocess.run([
                    "sips", "-z", str(target_size), str(target_size),
                    source_path, "--out", str(target_path)
                ], check=True, capture_output=True)
                return
            except subprocess.CalledProcessError:
                pass

        # 备用：使用 PIL
        try:
            from PIL import Image
            with Image.open(source_path) as img:
                # 确保是正方形
                width, height = img.size
                if width != height:
                    size_min = min(width, height)
                    left = (width - size_min) // 2
                    top = (height - size_min) // 2
                    img = img.crop((left, top, left + size_min, top + size_min))

                resized_img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
                resized_img.save(target_path, "PNG")
        except Exception as e:
            raise Exception(f"无法调整图像大小: {e}")

    def create_icns_file(self, iconset_dir):
        """使用 iconutil 创建 .icns 文件"""
        self.log("使用 iconutil 创建 .icns 文件...")

        # 定义输出路径（必须在引用之前）
        icns_path = self.assets_dir / "icon.icns"

        # 调试信息
        self.log(f"当前工作目录: {os.getcwd()}")
        self.log(f"assets目录: {self.assets_dir}")
        self.log(f"iconset目录: {iconset_dir}")
        self.log(f"预期输出路径: {icns_path}")

        # 列出iconset内容
        if iconset_dir.exists():
            iconset_files = list(iconset_dir.glob("*"))
            self.log(f"iconset文件数量: {len(iconset_files)}")
            for f in iconset_files:
                self.log(f"  - {f.name} ({f.stat().st_size} bytes)")

        if "iconutil" not in self.available_tools:
            self.log("iconutil 不可用，无法创建 .icns 文件", "ERROR")
            return False

        try:
            result = subprocess.run([
                "iconutil", "-c", "icns", str(iconset_dir), "-o", str(icns_path)
            ], capture_output=True, text=True, cwd=self.assets_dir)

            if result.returncode == 0:
                self.log(f"✓ iconutil 命令执行成功")

                # 关键验证：检查文件是否真的创建了
                if not icns_path.exists():
                    self.log(f"❌ iconutil 报告成功但文件不存在: {icns_path}", "ERROR")
                    self.log(f"当前工作目录: {os.getcwd()}")
                    self.log(f"assets目录内容: {list(self.assets_dir.glob('*'))}")
                    return False

                # 验证文件有内容
                if icns_path.stat().st_size == 0:
                    self.log(f"❌ .icns 文件为空", "ERROR")
                    return False

                file_size = icns_path.stat().st_size
                self.log(f"✓ 成功创建 {icns_path} ({file_size:,} bytes)")
                return True
            else:
                self.log(f"❌ iconutil 失败: {result.stderr}", "ERROR")
                self.log(f"返回码: {result.returncode}")
                if result.stdout:
                    self.log(f"标准输出: {result.stdout}")
                return False

        except Exception as e:
            self.log(f"❌ 创建 .icns 文件时出错: {e}", "ERROR")
            return False

    def cleanup(self, iconset_dir=None):
        """清理临时文件"""
        if iconset_dir and iconset_dir.exists():
            try:
                shutil.rmtree(iconset_dir)
                self.log("✓ 清理临时文件")
            except Exception as e:
                self.log(f"⚠️ 清理临时文件失败: {e}", "WARNING")

    def generate_report(self):
        """生成处理报告"""
        report = {
            "status": "success" if not self.detected_issues else "warning",
            "available_tools": self.available_tools,
            "detected_issues": self.detected_issues,
            "recommendations": []
        }

        if self.detected_issues:
            report["recommendations"].extend([
                "确保所有必需的图标尺寸都存在",
                "考虑安装 PIL (Pillow) 包以获得更好的图像处理能力",
                "检查 macOS 系统是否完整安装了开发工具"
            ])

        # 保存报告
        report_file = self.assets_dir / "icon_generation_report.json"
        try:
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            self.log(f"✓ 生成报告: {report_file}")
        except Exception as e:
            self.log(f"⚠️ 保存报告失败: {e}", "WARNING")

        return report

    def run(self):
        """执行图标生成流程"""
        self.log("开始 macOS 图标生成流程...")

        try:
            # 检查环境
            if not self.check_environment():
                return False

            # 扫描可用图标
            available_icons = self.scan_available_icons()
            if not available_icons:
                self.log("❌ 未找到任何图标文件", "ERROR")
                return False

            # 生成缺失的图标
            self.log(f"可用图标尺寸: {list(available_icons.keys())}")
            missing_sizes = set(self.required_sizes) - set(available_icons.keys())

            if missing_sizes:
                self.log(f"需要生成的图标尺寸: {sorted(missing_sizes)}")
                for size in sorted(missing_sizes):
                    generated_file = self.generate_missing_icon(size, available_icons)
                    if generated_file:
                        available_icons[size] = generated_file
                    else:
                        self.log(f"⚠️ 无法生成 {size}x{size} 图标，继续处理...", "WARNING")

            # 创建 iconset
            result = self.create_iconset(available_icons)
            if not result:
                self.log("❌ 创建 iconset 失败", "ERROR")
                return False

            iconset_dir, generated_files = result
            self.log(f"✓ iconset 创建完成，包含 {len(generated_files)} 个文件")

            # 创建 .icns 文件
            success = self.create_icns_file(iconset_dir)

            # 清理
            self.cleanup(iconset_dir)

            # 生成报告
            report = self.generate_report()

            if success:
                self.log("🎉 macOS 图标生成完成！")
                return True
            else:
                self.log("❌ macOS 图标生成失败", "ERROR")
                return False

        except Exception as e:
            self.log(f"❌ 图标生成过程中出现未预期的错误: {e}", "ERROR")
            return False


def main():
    """主函数"""
    print("=" * 60)
    print("🍎 macOS 图标生成器")
    print("=" * 60)

    generator = IconGenerator()
    success = generator.run()

    if success:
        print("\n✅ 图标生成成功完成！")
        sys.exit(0)
    else:
        print("\n❌ 图标生成失败！")
        sys.exit(1)


if __name__ == "__main__":
    main()