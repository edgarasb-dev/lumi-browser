#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
ICON_DIR="$BUILD_DIR/AppIcon.icon"
ASSETS_DIR="$ICON_DIR/Assets"
APPICONSET_DIR="$BUILD_DIR/Assets.xcassets/AppIcon.appiconset"
TMP_DIR="$(mktemp -d /tmp/lumi_icon_build.XXXXXX)"

trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== Building Multi-Layered macOS Liquid Glass Icon for Lumi ==="

# 1. Prepare AppIcon.icon package
mkdir -p "$ASSETS_DIR"
cp "$ROOT_DIR/src/renderer/public/assets/logo-mark.png" "$ASSETS_DIR/logo-mark.png"

cat << 'EOF' > "$ICON_DIR/icon.json"
{
  "fill": {
    "linear-gradient": [
      "extended-srgb:0.98000,0.98000,0.99000,1.00000",
      "extended-srgb:0.92000,0.93000,0.95000,1.00000"
    ]
  },
  "fill-specializations": [
    {
      "appearance": "dark",
      "value": {
        "linear-gradient": [
          "extended-srgb:0.12000,0.13000,0.15000,1.00000",
          "extended-srgb:0.06000,0.07000,0.08000,1.00000"
        ]
      }
    }
  ],
  "groups": [
    {
      "name": "Foreground",
      "layers": [
        {
          "name": "Logo",
          "image-name": "logo-mark.png"
        }
      ],
      "shadow": {
        "kind": "neutral",
        "opacity": 0.35
      }
    }
  ],
  "supported-platforms": {
    "squares": [
      "macOS"
    ]
  }
}
EOF

echo "✓ Created $ICON_DIR/icon.json"

# 2. Compile Assets.car with actool
echo "Compiling Assets.car with actool..."
xcrun actool "$ICON_DIR" \
  --compile "$BUILD_DIR" \
  --app-icon AppIcon \
  --platform macosx \
  --minimum-deployment-target 26.0 \
  --target-device mac \
  --output-partial-info-plist "$TMP_DIR/partial.plist" \
  --include-all-app-icons

echo "✓ Compiled Assets.car into $BUILD_DIR/Assets.car"

# 3. Export high-res master renditions using ictool
ICTOOL="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"

echo "Exporting renditions with ictool..."
"$ICTOOL" "$ICON_DIR" --export-image --output-file "$BUILD_DIR/icon_light.png" --platform macOS --rendition Default --width 1024 --height 1024 --scale 1
"$ICTOOL" "$ICON_DIR" --export-image --output-file "$BUILD_DIR/icon_dark.png" --platform macOS --rendition Dark --width 1024 --height 1024 --scale 1
"$ICTOOL" "$ICON_DIR" --export-image --output-file "$BUILD_DIR/icon_tinted.png" --platform macOS --rendition TintedDark --width 1024 --height 1024 --scale 1 --tint-color 0.25 --tint-strength 0.75
cp "$BUILD_DIR/icon_dark.png" "$BUILD_DIR/icon.png"

echo "✓ Exported icon_light.png, icon_dark.png, icon_tinted.png, icon.png"

# 4. Generate all required resolutions in Assets.xcassets/AppIcon.appiconset
echo "Generating AppIcon.appiconset raster files..."
mkdir -p "$APPICONSET_DIR"

SIZES=(16 32 64 128 256 512 1024)
for s in "${SIZES[@]}"; do
  sips -z "$s" "$s" "$BUILD_DIR/icon_light.png" --out "$APPICONSET_DIR/icon_light_$s.png" >/dev/null
  sips -z "$s" "$s" "$BUILD_DIR/icon_dark.png" --out "$APPICONSET_DIR/icon_dark_$s.png" >/dev/null
  sips -z "$s" "$s" "$BUILD_DIR/icon_tinted.png" --out "$APPICONSET_DIR/icon_tinted_$s.png" >/dev/null
done

echo "✓ Updated all sizes in $APPICONSET_DIR"

# 5. Build icon.icns from iconset
echo "Compiling icon.icns..."
ICONSET="$TMP_DIR/AppIcon.iconset"
mkdir -p "$ICONSET"

sips -z 16 16 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$BUILD_DIR/icon_dark.png" --out "$ICONSET/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$ICONSET" -o "$BUILD_DIR/icon.icns"
cp "$BUILD_DIR/icon.icns" "$BUILD_DIR/volume-icon.icns"

echo "✓ Compiled $BUILD_DIR/icon.icns and volume-icon.icns"
echo "=== Successfully built macOS Liquid Glass icon assets ==="
