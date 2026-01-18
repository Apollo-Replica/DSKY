#!/bin/bash

# DSKY launcher for Orange Pi
# - Starts `next-dsky` (server + UI) and opens Chromium fullscreen
# - Keeps the existing `cron` mode (re-open Chromium if it died)

start_chromium() {
    killall chromium-browser chromium &>/dev/null
    chromium-browser --start-fullscreen --incognito http://localhost:3000 &
    sleep 5
    wmctrl -a chromium
}

start_next_dsky() {
    cd ~/DSKY/Programs/next-dsky
    npm start -- \
        -s /dev/ttyUSB0 \
        --shutdown 'shutdown -h now' "$@" &
    echo $!
}

if [ "$1" = "cron" ]; then
    killall chromium-browser chromium &>/dev/null
    if [ $? -eq 0 ]; then
        export DISPLAY=:0
        chromium-browser --start-fullscreen --incognito http://localhost:3000 &
        sleep 5
        wmctrl -a chromium
    fi
else
    xttitle next-dsky
    unclutter -idle 3 -root &>/dev/null &

    while true; do
        wmctrl -a next-dsky
        next_pid="$(start_next_dsky "$@")"
        start_chromium
        wait "$next_pid"
        sleep 1
    done
fi
