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
sudo apt install -y git wmctrl xttitle x11vnc
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

## Configure appliance-mode boot

Appliance mode boots the Orange Pi straight to the DSKY UI — no desktop, no login prompt, no visible Linux. A helper script does all the setup:

```bash
cd ~/DSKY
bash Programs/orangepi-utilities/setup-appliance-mode.sh
sudo reboot
```

What the script does:

- Installs `openbox` and `feh` (minimal WM + splash loader).
- Sets silent kernel boot args in `/boot/orangepiEnv.txt` (`quiet splash loglevel=0`, hides console cursor and blanking).
- Registers a custom `dsky` X session and configures LightDM to auto-login the `orangepi` user into it.
- Creates `~/.xsession`, which launches `openbox` and runs `~/DSKY/orangepi.sh`.
- Silences the `getty@tty1` login banner.

After reboot: power on → splash image (or black screen) → DSKY UI.

The splash image lives at `~/DSKY/Programs/orangepi-utilities/splash.png`. Use portrait orientation matching your display (e.g. 544×960). If the file is missing the screen stays black until the UI is ready.

## Display rotation

The DSKY display is mounted in portrait orientation, so the HDMI output needs to be rotated 90° counterclockwise. `orangepi.sh` applies an xrandr transform automatically at startup.

The default transform is `0,-1,544,1,0,0,0,0,1`, where `544` is the height of the recommended 960×544 AMOLED display. Override via environment variables in `~/.xsession` (created by the appliance-mode script) only if your display differs:

```bash
#!/bin/bash
export DSKY_XRANDR_OUTPUT=HDMI-1                    # default: HDMI-1
export DSKY_XRANDR_TRANSFORM=0,-1,544,1,0,0,0,0,1   # match your display height
openbox &
~/DSKY/orangepi.sh
```

> The legacy 800×480 LCD variant uses `480` in place of `544` in the transform. Also set `DSKY_DISPLAY=lcd480` in `Programs/next-dsky/.env` so the UI switches to the LCD chassis color and CSS class.

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
- The `orangepi.sh` script handles display rotation, splash, starting `next-dsky` with the correct serial port, opening Chromium fullscreen, and restarting on crash.
- `unclutter` is launched by `orangepi.sh` to hide the mouse cursor immediately.
- The fstab uses `noatime,commit=600` to reduce SD card writes.
- To revert appliance mode: remove `~/.xsession`, `/etc/lightdm/lightdm.conf.d/50-appliance.conf`, `/usr/share/xsessions/dsky.desktop`, and `/etc/systemd/system/getty@tty1.service.d/override.conf`, then reboot.
