import * as fs from 'fs';
import * as dgram from 'node:dgram'
import getAppDataPath from "appdata-path";
import { createWatcher } from "../filesystem"
import { OFF_TEST } from '../../utils/dskyStates';

let inputServer = dgram.createSocket('udp4');
let state: any = { ...OFF_TEST }

const CMButtons: Record<string, number> = {
    'v': 1,
    'n': 2,
    '+': 3,
    '-': 4,
    '0': 5,
    '1': 6,
    '2': 7,
    '3': 8,
    '4': 9,
    '5': 10,
    '6': 11,
    '7': 12,
    '8': 13,
    '9': 14,
    'c': 15,
    'p': 16,
    'k': 17,
    'e': 18,
    'r': 19,
}

const LMButtons: Record<string, number> = {
    'v': 7,
    'n': 8,
    '+': 9,
    '-': 10,
    '0': 11,
    '1': 12,
    '2': 13,
    '3': 14,
    '4': 15,
    '5': 16,
    '6': 17,
    '7': 18,
    '8': 19,
    '9': 20,
    'c': 21,
    'p': 22,
    'k': 23,
    'e': 24,
    'r': 25,
}

function normalizeBrightness(
    value: number,
    originalMin: number,
    originalMax: number,
    targetMin: number = 1,
    targetMax: number = 127
): number {
    const normalized = ((value - originalMin) / (originalMax - originalMin)) * (targetMax - targetMin) + targetMin;
    return Math.min(Math.max(targetMin, normalized), targetMax)
}

export const watchStateReentry = (callback: (state: any) => void) => {
    const APOLLO_PATH = `${getAppDataPath()}\\..\\LocalLow\\Wilhelmsen Studios\\ReEntry\\Export\\Apollo`;
    const AGC_PATH = `${APOLLO_PATH}\\outputAGC.json`;
    const LGC_PATH = `${APOLLO_PATH}\\outputLGC.json`;

    const handleStateUpdate = (path: string, condition: (state: any) => boolean, callback: (state: any) => void) => {
        try {
            const newState = JSON.parse(fs.readFileSync(path).toString());
            if (newState.HideVerb) {
                newState.VerbD1 = ''
                newState.VerbD2 = ''
            }
            if (newState.HideNoun) {
                newState.NounD1 = ''
                newState.NounD2 = ''
            }

            // Reentry gives brighnesses in weird ranges, normalize them to 1-127 and save them in the standardized key names
            if (newState.IsInCM != undefined) {
                newState.DisplayBrightness = normalizeBrightness(newState.BrightnessNumerics, 0.2, 1.14117646)
                newState.StatusBrightness = normalizeBrightness(newState.BrightnessNumerics, 0.2, 1.14117646)
                newState.KeyboardBrightness = normalizeBrightness(newState.BrightnessIntegral, 0.0, 0.9411765)
            } else {
                newState.DisplayBrightness = normalizeBrightness(newState.BrightnessNumerics, 0.4, 1.4)
                newState.StatusBrightness = normalizeBrightness(newState.BrightnessNumerics, 0.4, 1.4)
                newState.KeyboardBrightness = normalizeBrightness(newState.BrightnessIntegral, 0.4, 1.4)
            }

            if (condition(newState)) {
                state = newState
                callback(newState);
            }
        } catch (error: any) {
            console.error(`Error while parsing ${path}: ${error.message}`);
        }
    };

    // Watch AGC state for changes
    const handleAGCUpdate = () => {
        handleStateUpdate(AGC_PATH, (state) => state.IsInCM, callback);
    };

    // Watch LGC state for changes
    const handleLGCUpdate = () => {
        handleStateUpdate(LGC_PATH, (state) => state.IsInLM, callback);
    };

    // Call the Watchers to check AGC + LGC (non-blocking)
    const agcHandle = createWatcher(AGC_PATH, handleAGCUpdate);
    const lgcHandle = createWatcher(LGC_PATH, handleLGCUpdate);
    
    // Return cleanup function
    return () => {
        console.log('[Reentry] Closing file watchers')
        // Cancel stops the retry loop and closes any created watcher
        agcHandle.cancel()
        lgcHandle.cancel()
    }
};

export const getReentryKeyboardHandler = () => {
    return async (data: string) => {
        try {
            const IsInCM = !!state.IsInCM
            const buttonMap = IsInCM ? CMButtons : LMButtons
            const buttonToPress = buttonMap[data]
            if (!buttonToPress) return
            const dataPacket = {
                TargetCraft: IsInCM ? 2 : 3,
                MessageType: 1,
                ID: buttonToPress,
                toPos: 0
            }
            inputServer.send(JSON.stringify(dataPacket), 8051, '127.0.0.1')
        } catch (error) {
            console.error('Error sending button press: ', error);
        }
    }
};
