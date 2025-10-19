#!/bin/bash
# MultiTodo - macOS Build Script
# Similar to build_final.bat for Windows

set -e  # Exit on error

echo "============================================================"
echo "  MultiTodo - macOS Packaging"
echo "============================================================"
echo ""

# Step 0: Check if icon.icns exists, if not create it
echo "[0] Checking macOS icon..."
if [ ! -f "assets/icon.icns" ]; then
    echo "    icon.icns not found, creating it..."
    python3 assets/create_icns.py
    if [ $? -ne 0 ]; then
        echo "    ❌ Failed to create icon.icns"
        echo "    Please run: python3 assets/create_icns.py"
        exit 1
    fi
else
    echo "    ✓ icon.icns exists"
fi
echo ""

# Step 1: Kill any running processes
echo "[1] Terminating processes..."
pkill -f "Electron" 2>/dev/null || true
pkill -f "node" 2>/dev/null || true
pkill -f "app-builder" 2>/dev/null || true
echo "    Waiting 3 seconds..."
sleep 3
echo ""

# Step 2: Clean old build artifacts
echo "[2] Cleaning old build artifacts..."
if [ -d "release" ]; then
    timestamp=$(date +%Y%m%d_%H%M%S)
    mv release "release_old_${timestamp}" 2>/dev/null || true
    echo "    ✓ Renamed old release directory"
fi

if [ -d "dist" ]; then
    rm -rf dist
    echo "    ✓ Removed dist directory"
fi
echo "    Waiting 2 seconds..."
sleep 2
echo ""

# Step 3: Build the application
echo "[3] Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo ""

# Step 4: Package for macOS
echo "[4] Packaging for macOS (this will take a few minutes)..."
echo "    Building for both x64 and arm64 architectures..."
npx electron-builder --mac
if [ $? -ne 0 ]; then
    echo "❌ Packaging failed, check error messages above"
    exit 1
fi
echo ""

# Step 5: Display results
echo "============================================================"
echo "  Checking output..."
echo "============================================================"

if ls release/*.dmg 1> /dev/null 2>&1; then
    echo "✅ Packaging successful!"
    echo ""
    echo "Created files:"
    ls -lh release/*.dmg
    echo ""
    echo "Distribution files location: ./release/"
    echo ""
    echo "Files created:"
    for file in release/*.dmg; do
        if [ -f "$file" ]; then
            size=$(ls -lh "$file" | awk '{print $5}')
            echo "  - $(basename "$file") ($size)"
        fi
    done
else
    echo "⚠️  No .dmg files found"
    echo ""
    echo "Release directory contents:"
    ls -la release/ 2>/dev/null || echo "  (release directory not found)"
fi

echo ""
echo "============================================================"
echo "  Build process completed!"
echo "============================================================"
echo ""
echo "Note: If you plan to distribute this app:"
echo "  1. Sign the app with Apple Developer certificate"
echo "  2. Notarize the app with Apple"
echo "  3. Without signing, users will see 'unidentified developer' warning"
echo ""

