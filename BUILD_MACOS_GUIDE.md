# macOS Build Guide for MultiTodo

This guide explains how to build the MultiTodo application for macOS.

## Prerequisites

Before building, ensure you have:

1. **macOS Computer** (required for building .dmg installer)
2. **Node.js** (v16 or later)
3. **Python 3** (for icon generation)
4. **Xcode Command Line Tools** (run: `xcode-select --install`)

## Quick Start

Simply run the build script:

```bash
./build_mac.sh
```

The script will automatically:
1. ✓ Check and create macOS icon (.icns) if needed
2. ✓ Clean old build artifacts
3. ✓ Build the TypeScript application
4. ✓ Package for both Intel (x64) and Apple Silicon (arm64)
5. ✓ Create .dmg installer files

## What Gets Built

The build process creates:
- `release/MultiTodo-1.0.0-x64.dmg` - For Intel Macs
- `release/MultiTodo-1.0.0-arm64.dmg` - For Apple Silicon Macs (M1/M2/M3)

## Manual Icon Creation (If Needed)

If `icon.icns` doesn't exist, run:

```bash
python3 assets/create_icns.py
```

This creates the macOS icon from existing PNG files.

## Distribution Notes

### For Personal Use
The .dmg files work immediately on your own Mac.

### For Public Distribution
To distribute to other users without security warnings:

1. **Get Apple Developer Account** ($99/year)
   - Sign up at https://developer.apple.com

2. **Sign the Application**
   ```bash
   codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" \
     release/mac/MultiTodo.app
   ```

3. **Notarize with Apple**
   ```bash
   # Create a .zip of the app
   ditto -c -k --keepParent release/mac/MultiTodo.app MultiTodo.zip
   
   # Submit for notarization
   xcrun notarytool submit MultiTodo.zip \
     --apple-id "your@email.com" \
     --password "app-specific-password" \
     --team-id "TEAM_ID" \
     --wait
   
   # Staple the notarization ticket
   xcrun stapler staple release/mac/MultiTodo.app
   ```

4. **Rebuild the DMG** after signing and notarizing

### Without Code Signing
Users will see "unidentified developer" warning. They can bypass it by:
1. Right-click the app
2. Select "Open"
3. Click "Open" in the dialog

## Troubleshooting

### Icon Not Created
```bash
# Install Python dependencies if needed
pip3 install Pillow

# Manually create icon
python3 assets/create_icns.py
```

### Build Fails
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules
npm install

# Try again
./build_mac.sh
```

### Permission Denied
```bash
# Make script executable
chmod +x build_mac.sh
```

## Build Configuration

The macOS build is configured in `package.json`:

```json
{
  "build": {
    "mac": {
      "target": ["dmg"],
      "arch": ["x64", "arm64"],
      "icon": "assets/icon.icns",
      "category": "public.app-category.productivity"
    }
  }
}
```

## Files Created

```
MultiTodoApp/
├── build_mac.sh              # Main build script
├── assets/
│   ├── create_icns.py        # Icon creation script
│   ├── icon.icns             # macOS icon (auto-generated)
│   └── entitlements.mac.plist # App permissions
└── release/
    ├── MultiTodo-1.0.0-x64.dmg      # Intel Mac installer
    └── MultiTodo-1.0.0-arm64.dmg    # Apple Silicon installer
```

## Comparison with Windows Build

| Feature | Windows | macOS |
|---------|---------|-------|
| Build Script | `build_final.bat` | `build_mac.sh` |
| Installer Format | `.exe` (NSIS) | `.dmg` |
| Icon Format | `.ico` | `.icns` |
| Architectures | x64 | x64 + arm64 |
| Admin Required | Yes | No |
| Code Signing | Optional | Recommended |

## Next Steps

1. ✅ Build successfully with `./build_mac.sh`
2. Test the .dmg installer on your Mac
3. (Optional) Set up code signing for distribution
4. (Optional) Create a universal binary (combines x64 and arm64)

## Support

For issues or questions:
- Check the build log output
- Verify all prerequisites are installed
- Try cleaning and rebuilding

