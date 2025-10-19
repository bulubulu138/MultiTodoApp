#!/usr/bin/env python3
"""
创建符合 electron-builder 要求的 .ico 文件
要求：必须包含 256x256 或更大的图标
"""

from PIL import Image
import os

def create_ico():
    """创建包含多个尺寸的 .ico 文件"""
    
    # 检查是否有源图片
    if os.path.exists('icon_512x512.png'):
        source = Image.open('icon_512x512.png')
        print(f"✓ 使用 icon_512x512.png 作为源图片")
    elif os.path.exists('icon_256x256.png'):
        source = Image.open('icon_256x256.png')
        print(f"✓ 使用 icon_256x256.png 作为源图片")
    elif os.path.exists('icon_preview.png'):
        source = Image.open('icon_preview.png')
        print(f"✓ 使用 icon_preview.png 作为源图片")
    else:
        print("❌ 未找到源图片文件")
        return False
    
    # 确保源图片是 RGBA 模式
    if source.mode != 'RGBA':
        source = source.convert('RGBA')
    
    # 创建多个尺寸的图标
    # electron-builder 要求必须包含 256x256
    sizes = [256, 128, 64, 48, 32, 16]
    images = []
    
    for size in sizes:
        img = source.resize((size, size), Image.Resampling.LANCZOS)
        images.append(img)
        print(f"  生成 {size}x{size} 图标")
    
    # 保存为 .ico 文件
    # 第一个图像是主图像，其他作为附加尺寸
    try:
        images[0].save(
            'icon.ico',
            format='ICO',
            sizes=[(img.width, img.height) for img in images],
            append_images=images[1:]
        )
        print(f"\n✅ 成功创建 icon.ico (包含 {len(sizes)} 个尺寸)")
        
        # 验证文件
        ico = Image.open('icon.ico')
        print(f"✓ 验证成功，ICO 文件大小: {os.path.getsize('icon.ico') / 1024:.2f} KB")
        return True
    except Exception as e:
        print(f"❌ 创建 ICO 文件失败: {e}")
        return False

if __name__ == '__main__':
    print("="*60)
    print("  创建 Electron Builder 兼容的 ICO 图标")
    print("="*60)
    print()
    
    # 切换到 assets 目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    if create_ico():
        print("\n🎉 图标创建完成！")
        print("现在可以重新运行 build_final.bat 进行打包")
    else:
        print("\n⚠️  图标创建失败")
        print("请确保 assets 目录中有 PNG 格式的源图片")


