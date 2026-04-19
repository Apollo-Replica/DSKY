#!/bin/bash

# setup-appliance-mode.sh
# Configures the Orange Pi for appliance-mode boot:
#   Power on -> black screen -> DSKY UI (no visible Linux)
#
# Run this ON the Orange Pi after completing the standard setup guide.
# Usage: cd ~/DSKY && bash Programs/orangepi-utilities/setup-appliance-mode.sh

set -e

echo "=== DSKY Appliance Mode Setup ==="
echo ""

# 1. Install minimal window manager
echo "[1/7] Installing openbox and feh..."
sudo apt install -y openbox feh

# 2. Silent kernel boot
echo "[2/7] Configuring silent boot..."
BOOT_ENV="/boot/orangepiEnv.txt"
BOOT_ARGS="quiet splash loglevel=0 logo.nologo vt.global_cursor_default=0 consoleblank=0"
if [ -f "$BOOT_ENV" ]; then
    if grep -q "^extraargs=" "$BOOT_ENV"; then
        if ! grep -q "quiet" "$BOOT_ENV"; then
            sudo sed -i "s/^extraargs=.*/& $BOOT_ARGS/" "$BOOT_ENV"
            echo "  Appended boot args to existing extraargs line."
        else
            echo "  Boot args already configured, skipping."
        fi
    else
        echo "extraargs=$BOOT_ARGS" | sudo tee -a "$BOOT_ENV" > /dev/null
        echo "  Added extraargs line."
    fi
else
    echo "  WARNING: $BOOT_ENV not found. You may need to set kernel boot args manually."
fi

# 3. Create custom X session and register it with LightDM
echo "[3/7] Configuring LightDM auto-login..."
sudo tee /usr/share/xsessions/dsky.desktop > /dev/null << 'EOF'
[Desktop Entry]
Name=DSKY
Exec=/home/orangepi/.xsession
Type=Application
EOF
echo "  Created /usr/share/xsessions/dsky.desktop"

sudo mkdir -p /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/50-appliance.conf > /dev/null << 'EOF'
[Seat:*]
autologin-user=orangepi
autologin-session=dsky
user-session=dsky
EOF
echo "  Created /etc/lightdm/lightdm.conf.d/50-appliance.conf"

# 4. Create custom X session (preserves local customizations on re-run)
echo "[4/7] Creating ~/.xsession..."
if [ -f ~/.xsession ]; then
    echo "  ~/.xsession already exists, leaving it alone."
else
    cat > ~/.xsession << 'EOF'
#!/bin/bash
# Add env overrides here (e.g. DSKY_DISPLAY=lcd480, HA_URL=..., HA_TOKEN=...)
openbox &
~/DSKY/orangepi.sh
EOF
    chmod +x ~/.xsession
    echo "  Created ~/.xsession"
fi

# 5. Remove old autostart entries (no longer needed)
echo "[5/7] Removing old autostart entries..."
for f in ~/.config/autostart/rotate-display.desktop ~/.config/autostart/dsky.desktop; do
    if [ -f "$f" ]; then
        rm -f "$f"
        echo "  Removed $(basename "$f")"
    fi
done

# 6. Configure silent getty (hide login text on tty1)
echo "[6/7] Configuring silent login prompt..."
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf > /dev/null << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --skip-login --noissue --autologin orangepi %I $TERM
EOF
sudo systemctl daemon-reload
echo "  Configured silent getty on tty1."

# 7. Install DSKY Plymouth watermark (replaces the Orange Pi logo on boot)
echo "[7/7] Installing DSKY boot logo..."
WATERMARK_SRC="$(dirname "$(readlink -f "$0")")/watermark.png"
WATERMARK_DST="/usr/share/plymouth/themes/orangepi/watermark.png"
if [ -f "$WATERMARK_SRC" ] && [ -d "$(dirname "$WATERMARK_DST")" ]; then
    [ -f "$WATERMARK_DST.orig" ] || sudo cp "$WATERMARK_DST" "$WATERMARK_DST.orig"
    sudo cp "$WATERMARK_SRC" "$WATERMARK_DST"
    sudo update-initramfs -u >/dev/null
    echo "  Installed $WATERMARK_SRC -> $WATERMARK_DST and rebuilt initramfs."
else
    echo "  SKIPPED: watermark.png or orangepi Plymouth theme not found."
fi

echo ""
echo "=== Done! ==="
echo ""
echo "Boot sequence will now be:"
echo "  Power on -> DSKY boot logo (Plymouth) -> splash image -> DSKY UI"
echo ""
echo "To customize the splash image, replace ~/DSKY/Programs/orangepi-utilities/splash.png"
echo "  (use portrait orientation matching your display, e.g. 544x960)"
echo "  If the file is missing, the screen stays black until ready."
echo ""
echo "Reboot to test:  sudo reboot"
echo ""
echo "To revert, restore the old autostart entries and remove ~/.xsession."
