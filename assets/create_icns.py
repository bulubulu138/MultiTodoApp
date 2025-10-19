#!/usr/bin/env python3
"""
Create macOS .icns icon file from PNG images
"""
import os
import subprocess
import sys
from pathlib import Path

def create_icns():
    """Create .icns file from existing PNG icons"""
    
    script_dir = Path(__file__).parent
    
    # Check if we have the required PNG files
    required_sizes = [16, 32, 128, 256, 512]
    png_files = {}
    
    for size in required_sizes:
        png_path = script_dir / f"icon_{size}x{size}.png"
        if not png_path.exists():
            print(f"❌ Missing required icon: {png_path}")
            return False
        png_files[size] = png_path
    
    print("✓ Found all required PNG icons")
    
    # Create iconset directory
    iconset_dir = script_dir / "MultiTodo.iconset"
    iconset_dir.mkdir(exist_ok=True)
    print(f"✓ Created iconset directory: {iconset_dir}")
    
    # Copy and rename PNG files to iconset format
    icon_mapping = {
        16: ["icon_16x16.png", "icon_16x16@2x.png"],  # 16x16 and 32x32
        32: ["icon_32x32.png", "icon_32x32@2x.png"],  # 32x32 and 64x64
        128: ["icon_128x128.png", "icon_128x128@2x.png"],  # 128x128 and 256x256
        256: ["icon_256x256.png", "icon_256x256@2x.png"],  # 256x256 and 512x512
        512: ["icon_512x512.png", "icon_512x512@2x.png"],  # 512x512 and 1024x1024
    }
    
    try:
        import shutil
        
        # Copy 16x16
        shutil.copy(png_files[16], iconset_dir / "icon_16x16.png")
        shutil.copy(png_files[32], iconset_dir / "icon_16x16@2x.png")
        
        # Copy 32x32
        shutil.copy(png_files[32], iconset_dir / "icon_32x32.png")
        if 64 in png_files:
            shutil.copy(png_files[64], iconset_dir / "icon_32x32@2x.png")
        else:
            shutil.copy(png_files[32], iconset_dir / "icon_32x32@2x.png")
        
        # Copy 128x128
        shutil.copy(png_files[128], iconset_dir / "icon_128x128.png")
        shutil.copy(png_files[256], iconset_dir / "icon_128x128@2x.png")
        
        # Copy 256x256
        shutil.copy(png_files[256], iconset_dir / "icon_256x256.png")
        shutil.copy(png_files[512], iconset_dir / "icon_256x256@2x.png")
        
        # Copy 512x512
        shutil.copy(png_files[512], iconset_dir / "icon_512x512.png")
        shutil.copy(png_files[512], iconset_dir / "icon_512x512@2x.png")
        
        print("✓ Copied all icon files to iconset")
        
    except Exception as e:
        print(f"❌ Error copying files: {e}")
        return False
    
    # Check if we're on macOS
    if sys.platform != 'darwin':
        print("\n⚠️  Warning: Not running on macOS")
        print("   The iconset directory has been created, but iconutil is not available.")
        print("   To create the .icns file, run this on a Mac:")
        print(f"   iconutil -c icns {iconset_dir}")
        return True
    
    # Use iconutil to create .icns file (macOS only)
    icns_path = script_dir / "icon.icns"
    try:
        result = subprocess.run(
            ["iconutil", "-c", "icns", str(iconset_dir), "-o", str(icns_path)],
            check=True,
            capture_output=True,
            text=True
        )
        print(f"✓ Created icon.icns successfully: {icns_path}")
        
        # Clean up iconset directory
        shutil.rmtree(iconset_dir)
        print("✓ Cleaned up temporary iconset directory")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running iconutil: {e}")
        print(f"   stdout: {e.stdout}")
        print(f"   stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ iconutil command not found (requires macOS)")
        return False

if __name__ == "__main__":
    print("============================================================")
    print("  MultiTodo - Create macOS Icon (.icns)")
    print("============================================================")
    print()
    
    success = create_icns()
    
    if success:
        print("\n✅ Icon creation completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Icon creation failed")
        sys.exit(1)

