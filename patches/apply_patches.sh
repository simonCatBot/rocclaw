#!/bin/bash
# Apply camera/audio fixes to reachy_mini v1.6.0
# Run this on the robot (or wherever the daemon runs)
#
# Fixes applied:
# 1. device_detection.py: GstValueArray api.v4l2.path now properly
#    unwrapped to single device path instead of str(list)
# 2. media_server.py: ReSpeaker USB check before alsasrc creation
# 3. media_server.py: Queue element between audiosrc and webrtcsink
# 4. media_server.py: RESOURCE_ERROR_NOT_FOUND handled as transient
# 5. media_server.py: osxaudiosrc excluded from provide-clock override

set -e

# Find the reachy_mini package location
PKG_DIR=$(python3 -c "import reachy_mini; print(reachy_mini.__file__.rsplit('/', 1)[0])" 2>/dev/null || echo "")

if [ -z "$PKG_DIR" ]; then
    echo "ERROR: reachy_mini package not found. Is it installed?"
    echo "Try: pip install reachy-mini"
    exit 1
fi

MEDIA_DIR="$PKG_DIR/media"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Patching reachy_mini at: $PKG_DIR"
echo "Media directory: $MEDIA_DIR"
echo ""

# Check version
VERSION=$(python3 -c "import reachy_mini; print(reachy_mini.__version__)" 2>/dev/null || echo "unknown")
echo "Current version: $VERSION"
echo ""

# Apply device_detection.py patch
echo "Applying device_detection.py patch..."
patch --backup -p1 "$MEDIA_DIR/device_detection.py" "$SCRIPT_DIR/reachy-mini-1.6.0-device-detection-fix.patch" || {
    echo "WARNING: device_detection.py patch may have already been applied or failed."
    echo "Checking if fix is already in place..."
    if grep -q "single-element list is unwrapped" "$MEDIA_DIR/device_detection.py"; then
        echo "  -> Fix already present, skipping."
    else
        echo "  -> Manual application may be needed."
    fi
}

# Apply media_server.py patch
echo ""
echo "Applying media_server.py patch..."
patch --backup -p1 "$MEDIA_DIR/media_server.py" "$SCRIPT_DIR/reachy-mini-1.6.0-camera-audio-fix.patch" || {
    echo "WARNING: media_server.py patch may have already been applied or failed."
    echo "Checking if fix is already in place..."
    if grep -q "init_respeaker_usb" "$MEDIA_DIR/media_server.py"; then
        echo "  -> Audio fix already present, skipping."
    else
        echo "  -> Manual application may be needed."
    fi
}

# Clear pycache to force recompilation
echo ""
echo "Clearing __pycache__ to force recompilation..."
find "$PKG_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
echo "Done."

echo ""
echo "========================================="
echo "Patches applied. Restart the daemon with:"
echo "  reachy-mini-daemon"
echo "========================================="
# Also install required GStreamer Python bindings if missing
echo ""
echo "Checking GStreamer Python bindings..."
python3 -c "import gi; gi.require_version('GstApp', '1.0')" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "WARNING: GstApp Python bindings are missing."
    echo "  Install with: sudo apt install -y gir1.2-gst-plugins-base-1.0"
fi
python3 -c "import gi; gi.require_version('GstWebRTC', '1.0')" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "WARNING: GstWebRTC Python bindings are missing."
    echo "  Install with: sudo apt install -y gir1.2-gst-plugins-bad-1.0"
fi
