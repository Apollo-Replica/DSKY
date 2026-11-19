#!/bin/bash

# DSKY launcher for Orange Pi
# - Starts `next-dsky` (server + UI) and opens Chromium fullscreen
# - In appliance mode (default): sets up display, black screen until ready
# - Cron mode: re-opens Chromium if it crashed
#
# OTA updates:
#   The app installs updates into $DSKY_RELEASES_DIR/vX.Y.Z and points the
#   `current` symlink at the active release. This script always launches from
#   that symlink, and rolls it back if a freshly installed release crash-loops
#   (a release is "fresh" until the app removes its .pending-verify flag after
#   running healthily). If everything else fails, it falls back to the factory
#   install in ~/DSKY/Programs/next-dsky, which is never modified.
#
# Display overrides (env vars, set in ~/.xsession before calling this script):
#   DSKY_XRANDR_OUTPUT     xrandr output name        (default: HDMI-1)
#   DSKY_XRANDR_TRANSFORM  xrandr --transform matrix (default: 0,-1,544,1,0,0,0,0,1)
#                          For the 800x480 LCD use:  0,-1,480,1,0,0,0,0,1

XRANDR_OUTPUT="${DSKY_XRANDR_OUTPUT:-HDMI-1}"
XRANDR_TRANSFORM="${DSKY_XRANDR_TRANSFORM:-0,-1,544,1,0,0,0,0,1}"

FACTORY_DIR="$HOME/DSKY/Programs/next-dsky"
export DSKY_RELEASES_DIR="${DSKY_RELEASES_DIR:-$HOME/dsky-releases}"

# Max boot attempts for an unverified release before rolling back
MAX_UPDATE_ATTEMPTS=3
# Max seconds to wait for the app to respond on :3000 before restarting it
STARTUP_TIMEOUT=180

# Resolve the directory to launch the app from, handling rollback of a
# crash-looping fresh update. Echoes the app directory.
resolve_app_dir() {
    local current="$DSKY_RELEASES_DIR/current"

    if [ -L "$current" ]; then
        local target
        target="$(readlink -f "$current")"

        if [ -d "$target" ] && [ -f "$target/package.json" ]; then
            if [ -f "$target/.pending-verify" ]; then
                local attempts
                attempts="$(cat "$target/.update-attempts" 2>/dev/null || echo 0)"
                if [ "$attempts" -ge "$MAX_UPDATE_ATTEMPTS" ]; then
                    # Fresh update keeps crashing — roll back
                    local prev_file="$DSKY_RELEASES_DIR/previous"
                    local prev=""
                    [ -f "$prev_file" ] && prev="$(cat "$prev_file")"
                    if [ -n "$prev" ] && [ -d "$prev" ]; then
                        ln -sfn "$prev" "$current"
                    else
                        rm -f "$current"
                    fi
                    resolve_app_dir
                    return
                fi
                echo $((attempts + 1)) > "$target/.update-attempts"
            fi
            echo "$target"
            return
        fi

        # Broken symlink or empty release — fall back to factory
        rm -f "$current"
    fi

    echo "$FACTORY_DIR"
}

if [ "$1" = "cron" ]; then
    killall chromium-browser chromium &>/dev/null
    if [ $? -eq 0 ]; then
        export DISPLAY=:0
        chromium-browser --kiosk --start-fullscreen --incognito http://localhost:3000 >/dev/null 2>&1 &
        sleep 5
        wmctrl -a chromium
    fi

else
    # Black screen immediately, then rotate, then show splash
    xsetroot -solid black
    sleep 2
    xrandr --output "$XRANDR_OUTPUT" --transform "$XRANDR_TRANSFORM"

    # Now set the splash (after rotation so it uses the correct resolution)
    SPLASH=~/DSKY/Programs/orangepi-utilities/splash.png
    if [ -f "$SPLASH" ]; then
        feh --bg-fill --no-fehbg "$SPLASH"
    fi

    # Disable screen blanking and power management
    xset s off
    xset -dpms
    xset s noblank

    # Hide cursor immediately
    unclutter -idle 0 -root &>/dev/null &

    mkdir -p "$DSKY_RELEASES_DIR"

    while true; do
        APP_DIR="$(resolve_app_dir)"
        cd "$APP_DIR" || { sleep 5; continue; }
        echo "[orangepi.sh] Launching DSKY from $APP_DIR"
        npm start -- \
            -s /dev/ttyUSB0 \
            --shutdown 'shutdown -h now' \
            --reboot 'shutdown -r now' \
            --wifi-connect "$@" &
        next_pid=$!

        # Wait until the :3000 app is actually responding, with a timeout so a
        # hung start (e.g. a bad update) still triggers restart + rollback.
        app_ok=0
        for _ in $(seq 1 "$STARTUP_TIMEOUT"); do
            kill -0 "$next_pid" 2>/dev/null || break
            if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
                app_ok=1
                break
            fi
            sleep 1
        done

        if [ "$app_ok" = "1" ]; then
            killall chromium-browser chromium &>/dev/null
            chromium-browser --kiosk --start-fullscreen --incognito \
                --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
                --no-default-browser-check --no-first-run \
                http://localhost:3000/?view=screen >/dev/null 2>&1 &
            sleep 5
            wait "$next_pid"
        else
            echo "[orangepi.sh] App failed to start, restarting..."
            kill "$next_pid" 2>/dev/null
            wait "$next_pid" 2>/dev/null
            sleep 2
        fi
    done
fi
