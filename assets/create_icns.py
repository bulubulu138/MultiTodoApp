#!/usr/bin/env python3
"""
macOS Icon Creation Script
Creates .icns files from PNG files for macOS app bundles.
"""

import os
import sys
import subprocess
import tempfile
import shutil

def create_iconset():
    """Create .iconset directory structure from existing PNG files."""

    # Required icon sizes for macOS .icns
    icon_sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),  # 32x32 from 16x16 scaled
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),  # 64x64 from 32x32 scaled
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),  # 256x256 from 128x128 scaled
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),  # 512x512 from 256x256 scaled
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png")   # 1024x1024 from 512x512 scaled
    ]

    # Create temporary iconset directory
    iconset_dir = "MultiTodo.iconset"
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir)

    print(f"Creating iconset in {iconset_dir}...")

    # Copy and rename icons to iconset structure
    for size, filename in icon_sizes:
        source_file = ""

        # Determine source file based on target filename
        if filename == "icon_16x16@2x.png":
            source_file = "icon_32x32.png"
        elif filename == "icon_32x32@2x.png":
            source_file = "icon_64x64.png"
        elif filename == "icon_128x128@2x.png":
            source_file = "icon_256x256.png"
        elif filename == "icon_256x256@2x.png":
            source_file = "icon_512x512.png"
        elif filename == "icon_512x512@2x.png":
            source_file = "icon_512x512.png"  # Use 512x512 as source for 1024x1024
        else:
            source_file = filename

        source_path = source_file
        target_path = os.path.join(iconset_dir, filename)

        if os.path.exists(source_path):
            shutil.copy2(source_path, target_path)
            print(f"Copied {source_path} -> {target_path}")
        else:
            print(f"Warning: {source_path} not found, skipping...")

    return iconset_dir

def create_icns_from_iconset(iconset_dir):
    """Convert .iconset to .icns using macOS iconutil."""

    icns_path = "icon.icns"

    print(f"Converting {iconset_dir} to {icns_path}...")

    try:
        # Use iconutil to create .icns file
        result = subprocess.run([
            "iconutil",
            "-c", "icns",
            iconset_dir
        ], capture_output=True, text=True)

        if result.returncode == 0:
            print(f"Successfully created {icns_path}")
            return True
        else:
            print(f"Error creating .icns file: {result.stderr}")
            return False

    except FileNotFoundError:
        print("Error: iconutil not found. This script must be run on macOS.")
        return False
    except Exception as e:
        print(f"Error creating .icns file: {e}")
        return False

def cleanup(iconset_dir):
    """Clean up temporary iconset directory."""
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
        print(f"Cleaned up {iconset_dir}")

def main():
    """Main function to create macOS .icns file."""

    print("Starting macOS icon creation...")

    # Change to assets directory
    assets_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(assets_dir)

    # Check if we're on macOS
    if sys.platform != "darwin":
        print("Error: This script can only be run on macOS.")
        return False

    # Check if required PNG files exist
    required_files = [
        "icon_16x16.png",
        "icon_32x32.png",
        "icon_128x128.png",
        "icon_256x256.png",
        "icon_512x512.png"
    ]

    missing_files = []
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)

    if missing_files:
        print(f"Error: Missing required PNG files: {missing_files}")
        return False

    # Create iconset
    iconset_dir = create_iconset()
    if not iconset_dir:
        print("Error: Failed to create iconset directory.")
        return False

    # Create .icns file
    success = create_icns_from_iconset(iconset_dir)

    # Cleanup
    cleanup(iconset_dir)

    if success:
        print("✅ macOS icon creation completed successfully!")
        print(f"Created: icon.icns in {assets_dir}")
        return True
    else:
        print("❌ macOS icon creation failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)