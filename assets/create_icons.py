#!/usr/bin/env python3
"""
临时图标生成脚本
生成简单的待办应用图标
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon():
    """创建一个简单的待办图标"""
    # 创建 512x512 的图标（最大尺寸）
    size = 512
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆角矩形背景
    margin = 40
    radius = 80
    # 主背景 - 渐变蓝色
    draw.rounded_rectangle(
        [margin, margin, size-margin, size-margin],
        radius=radius,
        fill='#1890ff'
    )
    
    # 绘制复选框列表图标
    checkbox_size = 60
    checkbox_margin = 120
    text_offset = 80
    
    # 绘制三个复选框
    for i in range(3):
        y = checkbox_margin + i * 100
        # 复选框
        draw.rounded_rectangle(
            [checkbox_margin, y, checkbox_margin + checkbox_size, y + checkbox_size],
            radius=10,
            fill='white',
            outline='white',
            width=3
        )
        
        # 勾号（第一个和第三个）
        if i in [0, 2]:
            # 绘制勾号
            check_points = [
                (checkbox_margin + 15, y + 30),
                (checkbox_margin + 25, y + 45),
                (checkbox_margin + 45, y + 15)
            ]
            draw.line(check_points[:2], fill='#1890ff', width=8)
            draw.line(check_points[1:], fill='#1890ff', width=8)
        
        # 文本线条
        line_y = y + 20
        draw.rounded_rectangle(
            [checkbox_margin + text_offset, line_y, size - checkbox_margin, line_y + 20],
            radius=5,
            fill='white'
        )
    
    return img

def save_icon_sizes(img, base_path, format_type):
    """保存多种尺寸的图标"""
    sizes = [16, 32, 48, 64, 128, 256, 512]
    
    if format_type == 'ico':
        # Windows ICO 格式
        icon_images = []
        for size in sizes:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            icon_images.append(resized)
        icon_images[0].save(
            f"{base_path}.ico",
            format='ICO',
            sizes=[(s, s) for s in sizes]
        )
        print(f"✅ 已创建: {base_path}.ico")
    
    elif format_type == 'png':
        # 保存为 PNG 用于 macOS（需要额外工具转换为 icns）
        for size in sizes:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(f"{base_path}_{size}x{size}.png")
        print(f"✅ 已创建: {base_path}_*.png")
        print(f"ℹ  macOS需要使用以下命令将PNG转换为icns:")
        print(f"   mkdir icon.iconset")
        print(f"   # 复制各尺寸PNG到iconset目录")
        print(f"   iconutil -c icns icon.iconset")

def main():
    print("=" * 60)
    print("  多功能待办应用图标生成工具")
    print("=" * 60)
    print()
    
    # 检查是否安装 Pillow
    try:
        import PIL
        print("✅ PIL/Pillow 已安装")
    except ImportError:
        print("❌ 请先安装 Pillow: pip install Pillow")
        return
    
    print("📝 正在生成图标...")
    icon = create_icon()
    
    # 保存图标
    base_path = os.path.join(os.path.dirname(__file__), 'icon')
    
    # Windows ICO
    save_icon_sizes(icon, base_path, 'ico')
    
    # PNG for macOS (manual conversion needed)
    save_icon_sizes(icon, base_path, 'png')
    
    # 保存一个大的 PNG 预览
    icon.save(f"{base_path}_preview.png")
    print(f"✅ 已创建预览: {base_path}_preview.png")
    
    print()
    print("=" * 60)
    print("  图标生成完成！")
    print("=" * 60)
    print()
    print("📝 注意事项:")
    print("1. Windows: 已生成 icon.ico，可直接使用")
    print("2. macOS: 需要手动将PNG转换为icns格式")
    print("3. 建议使用专业工具（如Figma、Sketch）设计更精美的图标")

if __name__ == "__main__":
    main()

