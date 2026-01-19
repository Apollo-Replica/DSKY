#!/bin/bash

# DSKY launcher for Orange Pi
# - Starts `next-dsky` (server + UI) and opens Chromium fullscreen
# - Keeps the existing `cron` mode (re-open Chromium if it died)

if [ "$1" = "cron" ]; then
    killall chromium-browser chromium &>/dev/null
    if [ $? -eq 0 ]; then
        export DISPLAY=:0
        chromium-browser --start-fullscreen --incognito http://localhost:3000 >/dev/null 2>&1 &
        sleep 5
        wmctrl -a chromium
    fi
else
    xttitle next-dsky
    unclutter -idle 3 -root &>/dev/null &

    while true; do
        wmctrl -a next-dsky
        cd ~/DSKY/Programs/next-dsky
        npm start -- \
            -s /dev/ttyUSB0 \
            --shutdown 'shutdown -h now' "$@" &
        next_pid=$!
        killall chromium-browser chromium &>/dev/null
        # Wait until the :3000 app is actually responding before opening Chromium.
        while true; do
            curl -fsS http://localhost:3000 >/dev/null 2>&1 && break
            sleep 1
        done
        chromium-browser --start-fullscreen --incognito http://localhost:3000 >/dev/null 2>&1 &
        sleep 5
        wait "$next_pid"
    done
fi
