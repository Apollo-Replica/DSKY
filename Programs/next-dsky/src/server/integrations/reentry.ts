import * as fs from 'fs'
import * as dgram from 'node:dgram'
import getAppDataPath from 'appdata-path'
import { createWatcher } from '../filesystem'
import { OFF_TEST } from '../../utils/dskyStates'
import { AgcIntegration } from './AgcIntegration'

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
    return Math.round(Math.min(Math.max(targetMin, normalized), targetMax))
}

export class ReentryIntegration extends AgcIntegration {
    readonly name = 'Reentry'
    readonly id = 'reentry'

    private inputServer = dgram.createSocket('udp4')
    private state: any = { ...OFF_TEST }
    private agcHandle: { cancel: () => void } | null = null
    private lgcHandle: { cancel: () => void } | null = null
    private agcDebounceTimer: ReturnType<typeof setTimeout> | null = null
    private lgcDebounceTimer: ReturnType<typeof setTimeout> | null = null

    async handleKey(key: string): Promise<void> {
        try {
            const IsInCM = !!this.state.IsInCM
            const buttonMap = IsInCM ? CMButtons : LMButtons
            const buttonToPress = buttonMap[key]
            if (!buttonToPress) return
            const dataPacket = {
                TargetCraft: IsInCM ? 2 : 3,
                MessageType: 1,
                ID: buttonToPress,
                toPos: 0
            }
            this.inputServer.send(JSON.stringify(dataPacket), 8051, '127.0.0.1')
        } catch (error) {
            console.error('[Reentry] Error sending button press:', error)
        }
    }

    protected async onStart(_options: Record<string, any>): Promise<void> {
        const APOLLO_PATH = `${getAppDataPath()}\\..\\LocalLow\\Wilhelmsen Studios\\ReEntry\\Export\\Apollo`
        const AGC_PATH = `${APOLLO_PATH}\\outputAGC.json`
        const LGC_PATH = `${APOLLO_PATH}\\outputLGC.json`

        console.log(`[Reentry] Watching AGC: ${AGC_PATH}`)
        console.log(`[Reentry] Watching LGC: ${LGC_PATH}`)

        // Watch AGC state for changes (debounced to avoid reading while file is being written)
        this.agcHandle = createWatcher(AGC_PATH, () => {
            if (this.agcDebounceTimer) clearTimeout(this.agcDebounceTimer)
            this.agcDebounceTimer = setTimeout(() => {
                this.handleStateUpdate(AGC_PATH, (state) => state.IsInCM)
            }, 50)
        })

        // Watch LGC state for changes (debounced to avoid reading while file is being written)
        this.lgcHandle = createWatcher(LGC_PATH, () => {
            if (this.lgcDebounceTimer) clearTimeout(this.lgcDebounceTimer)
            this.lgcDebounceTimer = setTimeout(() => {
                this.handleStateUpdate(LGC_PATH, (state) => state.IsInLM)
            }, 50)
        })
    }

    protected onStop(): void {
        console.log('[Reentry] Closing file watchers')
        if (this.agcDebounceTimer) clearTimeout(this.agcDebounceTimer)
        if (this.lgcDebounceTimer) clearTimeout(this.lgcDebounceTimer)
        this.agcHandle?.cancel()
        this.lgcHandle?.cancel()
        this.agcHandle = null
        this.lgcHandle = null
        this.agcDebounceTimer = null
        this.lgcDebounceTimer = null
    }

    private handleStateUpdate(path: string, condition: (state: any) => boolean): void {
        try {
            const newState = JSON.parse(fs.readFileSync(path).toString())
            if (newState.HideVerb) {
                newState.VerbD1 = ''
                newState.VerbD2 = ''
            }
            if (newState.HideNoun) {
                newState.NounD1 = ''
                newState.NounD2 = ''
            }

            // Reentry gives brightnesses in weird ranges, normalize them to 1-127
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
                this.state = newState
                this.emitState(newState)
            }
        } catch (error: any) {
            console.error(`[Reentry] Error parsing ${path}: ${error.message}`)
        }
    }
}
