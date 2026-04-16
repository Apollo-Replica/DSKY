# Orange Pi Zero 2W Setup Guide

This guide walks you through setting up an Orange Pi Zero 2W from scratch to run the DSKY software. This is the recommended approach over using pre-built .img files, which may be out of date.

## Base OS

Flash the official **Orange Pi Zero 2W** image (Ubuntu Jammy, arm64) to your SD card using your preferred tool (e.g. balenaEtcher, dd).

Default credentials are typically `orangepi` / `orangepi`.

## Initial setup

After first boot, connect via SSH or a monitor and keyboard.

```bash
# Set hostname
sudo hostnamectl set-hostname dsky

# Update the system
sudo apt update && sudo apt upgrade -y
```

### Create a swap file

The Orange Pi Zero 2W has limited RAM. A swap file helps prevent out-of-memory issues during `npm install` and builds.

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile swap swap sw 0 0' | sudo tee -a /etc/fstab
```

### Disable unnecessary services

```bash
# Disable automatic updates (they can interfere with the DSKY at startup)
sudo systemctl disable --now apt-daily.timer
sudo systemctl disable --now apt-daily-upgrade.timer

# Disable update notifier
sudo apt remove update-manager update-notifier -y
```

## Install dependencies

```bash
sudo apt install -y git unclutter wmctrl xttitle x11vnc
```

### VirtualAGC (optional)

If you want to run the AGC simulator locally on the Orange Pi:

```bash
sudo apt-get install -y wx2.8-headers libwxgtk2.8-0 libsdl1.2debian libncurses5
```

Build VirtualAGC from source or use a pre-built release. The binaries should end up in `~/VirtualAGC/bin/` (notably `yaAGC`).

## Clone the DSKY repository

```bash
cd ~
git clone https://github.com/Apollo-Simulation-Peripheral-Lab/DSKY.git
cd DSKY/Programs/next-dsky
npm install
npm run build
```

## Display rotation

The DSKY display is mounted in portrait orientation, so the HDMI output needs to be rotated. This is done via an xrandr transform at login.

Create the autostart entry:

```bash
mkdir -p ~/.config/autostart

cat > ~/.config/autostart/rotate-display.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Rotate Display
Exec=/bin/bash -c "sleep 2 && xrandr --output HDMI-1 --transform 0,-1,544,1,0,0,0,0,1"
X-GNOME-Autostart-enabled=true
EOF
```

> The transform matrix `0,-1,544,1,0,0,0,0,1` rotates the display 90 degrees counterclockwise. The `544` value corresponds to the height of the 960x544 display. Adjust if using the 800x480 LCD (use `480` instead).

## Auto-start the DSKY on boot

Create a launcher script:

```bash
cat > ~/dsky.sh << 'EOF'
#!/bin/bash
~/DSKY/orangepi.sh
EOF
chmod +x ~/dsky.sh
```

Create the autostart entry:

```bash
cat > ~/.config/autostart/dsky.desktop << 'EOF'
[Desktop Entry]
Name=DSKY
GenericName=Starts DSKY environment
Comment=Should run on boot
Exec=x-terminal-emulator -e "/home/orangepi/dsky.sh"
Icon=accessories-calculator
Terminal=false
Type=Application
X-GNOME-Autostart-enabled=true
EOF
```

This will start `next-dsky` and open Chromium in fullscreen pointing to `http://localhost:3000` on every login.

## VNC access (optional)

To remotely view and control the Orange Pi's display:

```bash
# Set a VNC password
x11vnc -storepasswd

# Create a systemd service (more reliable than autostart desktop entries)
sudo tee /etc/systemd/system/x11vnc.service << 'EOF'
[Unit]
Description=x11vnc VNC server
After=display-manager.service

[Service]
Type=simple
ExecStart=/usr/bin/x11vnc -forever -usepw -display :0 -auth guess
User=orangepi
Restart=on-failure
RestartSec=3

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable x11vnc
sudo systemctl start x11vnc
```

## WiFi Connect (optional)

[wifi-connect](https://github.com/balena-os/wifi-connect) provides a captive portal for configuring WiFi on a headless device. The DSKY's configuration UI can trigger it.

```bash
# Install build dependencies
sudo apt install -y build-essential pkg-config libnm-dev libdbus-1-dev network-manager curl

# Install Rust
curl https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"

# Clone and build
git clone https://github.com/balena-os/wifi-connect.git ~/wifi-connect
cd ~/wifi-connect
cargo build --release

# Install the binary
sudo cp target/release/wifi-connect /usr/local/sbin/wifi-connect
```

The `orangepi.sh` launcher script already passes `--wifi-connect` to `next-dsky` when needed.

## Notes

- The Orange Pi connects to the PCB via USB serial (`/dev/ttyUSB0`).
- The `orangepi.sh` script handles starting `next-dsky` with the correct serial port, opening Chromium, and restarting on crash.
- `unclutter` is used to hide the mouse cursor after 3 seconds of inactivity.
- The fstab uses `noatime,commit=600` to reduce SD card writes.
