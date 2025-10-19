# macOS Build Instructions

## Overview
This document explains how to build MultiTodo for macOS.

## Important Notes

⚠️ **You are currently on Windows**

The `build_mac.sh` script can only run on macOS. To build for macOS:

### Option 1: Use a Mac Computer
1. Copy the entire `MultiTodoApp` folder to a Mac
2. Open Terminal on the Mac
3. Navigate to the project directory:
   ```bash
   cd /path/to/MultiTodoApp
   ```
4. Make the script executable:
   ```bash
   chmod +x build_mac.sh
   ```
5. Run the build:
   ```bash
   ./build_mac.sh
   ```

### Option 2: Use CI/CD (GitHub Actions)
Set up GitHub Actions to build on macOS automatically. Create `.github/workflows/build-macos.yml`:

```yaml
name: Build macOS
on: [push]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: chmod +x build_mac.sh
      - run: ./build_mac.sh
      - uses: actions/upload-artifact@v3
        with:
          name: macos-dmg
          path: release/*.dmg
```

### Option 3: Cross-Platform Build (Limited)
While electron-builder supports cross-platform building, building macOS .dmg files from Windows has limitations and often fails. It's recommended to use a real Mac or CI/CD.

## Files Created

The following files have been created for macOS building:

1. **`build_mac.sh`** - Main build script (Unix shell script)
   - Automatically creates icon.icns if missing
   - Cleans previous builds
   - Builds TypeScript code
   - Packages for x64 and arm64 architectures

2. **`assets/create_icns.py`** - Icon conversion script
   - Converts PNG icons to macOS .icns format
   - Requires Python 3
   - Only works on macOS (uses `iconutil` command)

3. **`BUILD_MACOS_GUIDE.md`** - Detailed build documentation
   - Prerequisites
   - Build steps
   - Code signing instructions
   - Troubleshooting guide

## What You Can Do on Windows

On Windows, you can:
- ✅ Edit the source code
- ✅ Test the Windows build (`build_final.bat`)
- ✅ Prepare files for macOS build
- ✅ Review the build scripts
- ❌ Cannot run `build_mac.sh` (requires macOS/Linux)
- ❌ Cannot create .icns icons (requires macOS `iconutil`)
- ❌ Cannot build .dmg installers (requires macOS)

## Quick Commands Reference

### On macOS:
```bash
# Make script executable (first time only)
chmod +x build_mac.sh

# Run the build
./build_mac.sh

# Create icon manually if needed
python3 assets/create_icns.py
```

### On Windows:
```powershell
# Build for Windows
.\build_final.bat

# View macOS files (without executing)
notepad build_mac.sh
notepad assets\create_icns.py
```

## Output Files

When successfully built on macOS, you'll get:
- `release/MultiTodo-1.0.0-x64.dmg` - For Intel Macs
- `release/MultiTodo-1.0.0-arm64.dmg` - For Apple Silicon (M1/M2/M3)

## Next Steps

1. ✅ **Windows build is complete** - You successfully built for Windows
2. 📝 **macOS files are ready** - All scripts are created
3. 🍎 **Need macOS** - To build for macOS, use a Mac or CI/CD

For detailed instructions, see `BUILD_MACOS_GUIDE.md`.

