export interface AgcInternalState {
    verb: string
    noun: string
    program: string
    register1: string
    register2: string
    register3: string
    inputMode: '' | 'verb' | 'noun' | 'register1' | 'register2' | 'register3'
    verbNounFlashing: boolean
    flashState: boolean
    operatorErrorActive: boolean
    lightTest: number
    compActy: boolean
    keyRel: [string, string] | null
    keyRelMode: boolean
    verbStack: string[]
}

export interface RegisterSource {
    entity: string
    attribute?: string   // default: 'state'
    scale?: number       // default: 1
}

export interface NounConfig {
    label?: string
    builtin?: string     // e.g. 'clock'
    r1?: RegisterSource
    r2?: RegisterSource
    r3?: RegisterSource
}

export interface HASettings {
    url?: string
    token?: string
    nouns: Record<string, NounConfig>
}

export type VerbHandler = (enter: boolean, pro: boolean) => void | Promise<void>

export interface AgcContext {
    state: AgcInternalState
    getNounValues: (id: string) => [number, number, number]
    setNounValue: (id: string, register: 0 | 1 | 2, value: number) => void
    verbs: Record<string, VerbHandler>
    callService?: (domain: string, service: string, data?: Record<string, any>) => Promise<void>
    getNounEntity?: (nounId: string, register: 0 | 1 | 2) => string | undefined
}
