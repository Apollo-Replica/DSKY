#!/bin/bash

# DSKY launcher for Orange Pi
# - Starts `next-dsky` (server + UI) and opens Chromium fullscreen
# - In appliance mode (default): sets up display, black screen until ready
# - Cron mode: re-opens Chromium if it crashed

if [ "$1" = "cron" ]; then
    killall chromium-browser chromium &>/dev/null
    if [ $? -eq 0 ]; then
        export DISPLAY=:0
        chromium-browser --start-fullscreen --incognito http://localhost:3000 >/dev/null 2>&1 &
        sleep 5
        wmctrl -a chromium
    fi

else
    # Black screen immediately, then rotate, then show splash
    xsetroot -solid black
    sleep 2
    xrandr --output HDMI-1 --transform 0,-1,544,1,0,0,0,0,1

    # Now set the splash (after rotation so it uses the correct resolution)
    SPLASH=~/DSKY/Programs/orangepi-utilities/splash.jpeg
    if [ -f "$SPLASH" ]; then
        feh --bg-fill --no-fehbg "$SPLASH"
    fi

    # Hide cursor immediately
    unclutter -idle 0 -root &>/dev/null &

    while true; do
        cd ~/DSKY/Programs/next-dsky
        npm start -- \
            -s /dev/ttyUSB0 \
            --shutdown 'shutdown -h now' \
            --wifi-connect "$@" &
        next_pid=$!
        killall chromium-browser chromium &>/dev/null
        # Wait until the :3000 app is actually responding before opening Chromium.
        while true; do
            curl -fsS http://localhost:3000 >/dev/null 2>&1 && break
            sleep 1
        done
        chromium-browser --start-fullscreen --incognito \
            --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
            http://localhost:3000/?view=screen >/dev/null 2>&1 &
        sleep 5
        wait "$next_pid"
    done
fi
