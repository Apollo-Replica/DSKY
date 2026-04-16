/**
 * Shared types for DSKY display state.
 */

export interface DskyClient {
    id: string
    [key: string]: unknown
}

export interface DskyState {
    IlluminateCompLight: boolean | number
    ProgramD1: string
    ProgramD2: string
    VerbD1: string
    VerbD2: string
    NounD1: string
    NounD2: string
    Register1Sign: string
    Register1D1: string
    Register1D2: string
    Register1D3: string
    Register1D4: string
    Register1D5: string
    Register2Sign: string
    Register2D1: string
    Register2D2: string
    Register2D3: string
    Register2D4: string
    Register2D5: string
    Register3Sign: string
    Register3D1: string
    Register3D2: string
    Register3D3: string
    Register3D4: string
    Register3D5: string
    IlluminateUplinkActy: number
    IlluminateNoAtt: number
    IlluminateStby: number
    IlluminateKeyRel: number
    IlluminateOprErr: number
    IlluminateNoDap: number
    IlluminatePrioDisp: number
    IlluminateTemp: number
    IlluminateGimbalLock: number
    IlluminateProg: number
    IlluminateRestart: number
    IlluminateTracker: number
    IlluminateAlt: number
    IlluminateVel: number
    StatusBrightness: number
    DisplayBrightness: number
    KeyboardBrightness: number
    Standby: boolean
    clients: DskyClient[]
    [key: string]: unknown
}
