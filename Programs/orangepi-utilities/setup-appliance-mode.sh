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
echo "[1/6] Installing openbox and feh..."
sudo apt install -y openbox feh

# 2. Silent kernel boot
echo "[2/6] Configuring silent boot..."
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

# 3. Configure LightDM for auto-login with custom session
echo "[3/6] Configuring LightDM auto-login..."
sudo mkdir -p /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/50-appliance.conf > /dev/null << 'EOF'
[Seat:*]
autologin-user=orangepi
autologin-session=default
user-session=default
EOF
echo "  Created /etc/lightdm/lightdm.conf.d/50-appliance.conf"

# 4. Create custom X session
echo "[4/6] Creating ~/.xsession..."
cat > ~/.xsession << 'EOF'
#!/bin/bash
openbox &
~/DSKY/orangepi.sh
EOF
chmod +x ~/.xsession
echo "  Created ~/.xsession"

# 5. Remove old autostart entries (no longer needed)
echo "[5/6] Removing old autostart entries..."
rm -f ~/.config/autostart/rotate-display.desktop && echo "  Removed rotate-display.desktop" || true
rm -f ~/.config/autostart/dsky.desktop && echo "  Removed dsky.desktop" || true

# 6. Configure silent getty (hide login text on tty1)
echo "[6/6] Configuring silent login prompt..."
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf > /dev/null << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --skip-login --noissue --autologin orangepi %I $TERM
EOF
sudo systemctl daemon-reload
echo "  Configured silent getty on tty1."

echo ""
echo "=== Done! ==="
echo ""
echo "Boot sequence will now be:"
echo "  Power on -> splash image (or black screen) -> DSKY UI"
echo ""
echo "To customize the splash image, replace ~/DSKY/Programs/orangepi-utilities/splash.jpeg"
echo "  (use portrait orientation matching your display, e.g. 544x960)"
echo "  If the file is missing, the screen stays black until ready."
echo ""
echo "Reboot to test:  sudo reboot"
echo ""
echo "To revert, restore the old autostart entries and remove ~/.xsession."
