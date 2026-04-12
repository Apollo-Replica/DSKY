import { AgcInternalState, AgcContext, VerbHandler } from './types'
import { NounRegistry } from './nouns'
import { createVerbs } from './verbs'
import { handleKeyPress } from './keyboard'
import { OFF_TEST } from '../../../utils/dskyStates'

const createInitialState = (): AgcInternalState => ({
    verb: '',
    noun: '',
    program: '00',
    register1: '',
    register2: '',
    register3: '',
    inputMode: '',
    verbNounFlashing: false,
    flashState: false,
    operatorErrorActive: false,
    lightTest: 0,
    compActy: false,
    keyRel: null,
    keyRelMode: false,
    verbStack: [],
})

export class AgcStateManager {
    private state: AgcInternalState
    private nounRegistry: NounRegistry
    private verbs: Record<string, VerbHandler>
    private _ctx: AgcContext
    private emitCallback: (state: Record<string, any>) => void
    private updateInterval: ReturnType<typeof setInterval> | null = null
    private flashTicks = 0
    private refreshTicks = 0
    private lastEmitted: string = ''
    private _haConnected = false

    constructor(nounRegistry: NounRegistry, emitCallback: (state: Record<string, any>) => void) {
        this.state = createInitialState()
        this.nounRegistry = nounRegistry
        this.emitCallback = emitCallback

        const ctx: AgcContext = {
            state: this.state,
            getNounValues: (id) => this.nounRegistry.getNounValues(id),
            setNounValue: (id, reg, val) => this.nounRegistry.setNounValue(id, reg, val),
            verbs: {},
            getNounEntity: (id, reg) => this.nounRegistry.getNounEntity(id, reg),
        }
        this.verbs = createVerbs(ctx)
        ctx.verbs = this.verbs
        this._ctx = ctx
    }

    get haConnected(): boolean {
        return this._haConnected
    }

    set haConnected(value: boolean) {
        this._haConnected = value
    }

    getNounRegistry(): NounRegistry {
        return this.nounRegistry
    }

    setCallService(fn: (domain: string, service: string, data?: Record<string, any>) => Promise<void>): void {
        this._ctx.callService = fn
    }

    start(): void {
        if (this.updateInterval) return
        console.log('[HA] AGC state manager started')
        this.updateInterval = setInterval(() => this.tick(), 20)
    }

    stop(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval)
            this.updateInterval = null
        }
    }

    handleKey(key: string): void {
        handleKeyPress(key, this.state, this.verbs)
    }

    private tick(): void {
        // Flash toggle every 600ms (30 ticks)
        this.flashTicks++
        if (this.flashTicks >= 30) {
            this.state.flashState = !this.state.flashState
            this.flashTicks = 0
        }

        // Auto-refresh V16 every 1s (50 ticks)
        this.refreshTicks++
        if (this.refreshTicks >= 50) {
            if (this.state.keyRel && this.state.keyRelMode) {
                this.state.noun = this.state.keyRel[1]
                const verb = this.verbs[this.state.keyRel[0]]
                if (verb) verb(false, false)
            }
            this.refreshTicks = 0
        }

        const dskyState = this.renderToDskyState()
        const serialized = JSON.stringify(dskyState)
        if (serialized !== this.lastEmitted) {
            this.lastEmitted = serialized
            this.emitCallback(dskyState)
        }
    }

    private renderToDskyState(): any {
        const {
            flashState,
            operatorErrorActive,
            keyRel,
            keyRelMode,
            compActy,
            verbNounFlashing,
            program,
            verb,
            noun,
            register1,
            register2,
            register3,
            lightTest,
        } = this.state

        const showVerbNoun = !verbNounFlashing || flashState

        return {
            ...OFF_TEST,
            IlluminateUplinkActy: this._haConnected ? 1 : lightTest,
            IlluminateNoAtt: lightTest,
            IlluminateStby: lightTest,
            IlluminateKeyRel: (lightTest || (keyRel && !keyRelMode)) && flashState ? 1 : 0,
            IlluminateOprErr: (operatorErrorActive || lightTest) && flashState ? 1 : 0,
            IlluminateNoDap: lightTest,
            IlluminatePrioDisp: lightTest,
            IlluminateTemp: lightTest,
            IlluminateGimbalLock: lightTest,
            IlluminateProg: lightTest,
            IlluminateRestart: lightTest,
            IlluminateTracker: lightTest,
            IlluminateAlt: lightTest,
            IlluminateVel: lightTest,
            IlluminateCompLight: compActy,
            VerbD1: showVerbNoun ? (verb[0] || '') : '',
            VerbD2: showVerbNoun ? (verb[1] || '') : '',
            NounD1: showVerbNoun ? (noun[0] || '') : '',
            NounD2: showVerbNoun ? (noun[1] || '') : '',
            ProgramD1: program[0] || '',
            ProgramD2: program[1] || '',
            Register1Sign: register1[0] || '',
            Register1D1: register1[1] || '',
            Register1D2: register1[2] || '',
            Register1D3: register1[3] || '',
            Register1D4: register1[4] || '',
            Register1D5: register1[5] || '',
            Register2Sign: register2[0] || '',
            Register2D1: register2[1] || '',
            Register2D2: register2[2] || '',
            Register2D3: register2[3] || '',
            Register2D4: register2[4] || '',
            Register2D5: register2[5] || '',
            Register3Sign: register3[0] || '',
            Register3D1: register3[1] || '',
            Register3D2: register3[2] || '',
            Register3D3: register3[3] || '',
            Register3D4: register3[4] || '',
            Register3D5: register3[5] || '',
            StatusBrightness: 127,
            DisplayBrightness: 127,
            KeyboardBrightness: 127,
        }
    }
}
