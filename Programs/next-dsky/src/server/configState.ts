import { SerialPort } from 'serialport'

export interface DiscoveredAPI {
    ip: string
    port: number
    url: string
    name?: string
}

export interface ConfigState {
    ready: boolean
    step: 'serial' | 'source' | 'bridge' | 'yaagc' | 'confirm'
    serialPort: string | null
    inputSource: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    availablePorts: Array<{path: string, name: string}>
    discoveredApis: DiscoveredAPI[]
    scanning: boolean
    selectedIndex: number
    options: string[]
    resetDisabled?: boolean
}

export const INPUT_SOURCES = [
    {name: 'NASSP', value: 'nassp'},
    {name: 'Reentry', value: 'reentry'},
    {name: 'Bridge to another DSKY API', value: 'bridge'},
    {name: 'yaAGC', value: 'yaagc'},
    {name: 'KSP', value: 'ksp'},
    {name: 'Random Values', value: 'random'},
    {name: 'HomeAssistant (WIP)', value: 'homeassistant'}
]

export const YAAGC_VERSIONS = [
    {name: 'Comanche055', value: 'Comanche055'},
    {name: 'Luminary099', value: 'Luminary099'},
    {name: 'Luminary210', value: 'Luminary210'},
    {name: 'Start my own YaAGC', value: 'own'}
]

const initialState: ConfigState = {
    ready: false,
    step: 'serial',
    serialPort: null,
    inputSource: null,
    availablePorts: [],
    discoveredApis: [],
    scanning: false,
    selectedIndex: 0,
    options: []
}

let configState: ConfigState = { ...initialState }
let broadcaster: ((state: ConfigState) => void) | null = null

export const getConfigState = (): ConfigState => ({
    ...configState,
    resetDisabled: process.env.DISABLE_RESET === '1'
})

export const setConfigBroadcaster = (fn: (state: ConfigState) => void) => {
    broadcaster = fn
}

const broadcast = () => {
    if (broadcaster) broadcaster(configState)
}

export const updateConfig = (partial: Partial<ConfigState>) => {
    configState = { ...configState, ...partial }
    broadcast()
}

export const resetToConfig = () => {
    configState = {
        ...initialState,
        availablePorts: configState.availablePorts // Keep cached ports
    }
    refreshSerialPorts()
    broadcast()
}

export const refreshSerialPorts = async () => {
    const ports = await SerialPort.list()
    const availablePorts = ports.map((p: any) => ({
        path: p.path,
        name: p.friendlyName || p.path
    }))
    updateConfig({
        availablePorts,
        options: buildOptionsForStep('serial', { ...configState, availablePorts })
    })
}

const buildOptionsForStep = (step: string, state: ConfigState): string[] => {
    switch (step) {
        case 'serial':
            return [
                'No Serial output',
                ...state.availablePorts.map(p => p.name || p.path),
                'Refresh List'
            ]
        case 'source':
            return INPUT_SOURCES.map(s => s.name)
        case 'bridge':
            return [
                'Public (dsky.ortizma.com)',
                ...state.discoveredApis.map(api => api.ip),
                'Rescan',
                'Manual URL'
            ]
        case 'yaagc':
            return YAAGC_VERSIONS.map(v => v.name)
        case 'confirm':
            return ['Confirm', 'Back to start']
        default:
            return []
    }
}

export const configNext = () => {
    const maxIndex = configState.options.length - 1
    updateConfig({
        selectedIndex: Math.min(configState.selectedIndex + 1, maxIndex)
    })
}

export const configPrev = () => {
    updateConfig({
        selectedIndex: Math.max(configState.selectedIndex - 1, 0)
    })
}

export const configDirectSelect = (index: number) => {
    if (index >= 0 && index < configState.options.length) {
        updateConfig({ selectedIndex: index })
    }
}

export const configSelect = async (): Promise<{ done: boolean, startWatcher?: boolean }> => {
    const { step, selectedIndex, options, availablePorts, discoveredApis } = configState

    switch (step) {
        case 'serial': {
            const option = options[selectedIndex]
            if (option === 'Refresh List') {
                await refreshSerialPorts()
                return { done: false }
            }
            const serialPort = option === 'No Serial output'
                ? null
                : availablePorts[selectedIndex - 1]?.path || null
            updateConfig({
                serialPort,
                step: 'source',
                selectedIndex: 0,
                options: buildOptionsForStep('source', configState)
            })
            return { done: false }
        }

        case 'source': {
            const source = INPUT_SOURCES[selectedIndex]
            updateConfig({ inputSource: source.value })

            if (source.value === 'bridge') {
                updateConfig({
                    step: 'bridge',
                    selectedIndex: 0,
                    scanning: true,
                    options: buildOptionsForStep('bridge', configState)
                })
                // Trigger network scan (will be handled by caller)
                return { done: false }
            } else if (source.value === 'yaagc') {
                updateConfig({
                    step: 'yaagc',
                    selectedIndex: 0,
                    options: buildOptionsForStep('yaagc', configState)
                })
                return { done: false }
            } else {
                // Skip to confirm for other sources
                updateConfig({
                    step: 'confirm',
                    selectedIndex: 0,
                    options: buildOptionsForStep('confirm', configState)
                })
                return { done: false }
            }
        }

        case 'bridge': {
            const option = options[selectedIndex]
            if (option === 'Rescan') {
                updateConfig({ scanning: true })
                return { done: false }
            }
            if (option === 'Manual URL') {
                // For manual URL, we'll need special handling
                // For now, default to public
                updateConfig({ bridgeUrl: 'wss://dsky.ortizma.com/ws' })
            } else if (option === 'Public (dsky.ortizma.com)') {
                updateConfig({ bridgeUrl: 'wss://dsky.ortizma.com/ws' })
            } else {
                // It's a discovered API
                const api = discoveredApis[selectedIndex - 1]
                if (api) {
                    updateConfig({ bridgeUrl: api.url })
                }
            }
            updateConfig({
                step: 'confirm',
                selectedIndex: 0,
                options: buildOptionsForStep('confirm', configState)
            })
            return { done: false }
        }

        case 'yaagc': {
            const version = YAAGC_VERSIONS[selectedIndex]
            updateConfig({
                yaagcVersion: version.value,
                step: 'confirm',
                selectedIndex: 0,
                options: buildOptionsForStep('confirm', configState)
            })
            return { done: false }
        }

        case 'confirm': {
            if (selectedIndex === 1) {
                // Back to start
                resetToConfig()
                return { done: false }
            }
            // Confirm - mark as ready
            updateConfig({ ready: true })
            return { done: true, startWatcher: true }
        }

        default:
            return { done: false }
    }
}

export const configBack = () => {
    const { step } = configState

    switch (step) {
        case 'source':
            updateConfig({
                step: 'serial',
                selectedIndex: 0,
                options: buildOptionsForStep('serial', configState)
            })
            break
        case 'bridge':
        case 'yaagc':
            updateConfig({
                step: 'source',
                selectedIndex: 0,
                options: buildOptionsForStep('source', configState)
            })
            break
        case 'confirm':
            const prevStep = configState.inputSource === 'bridge' ? 'bridge'
                : configState.inputSource === 'yaagc' ? 'yaagc'
                : 'source'
            updateConfig({
                step: prevStep,
                selectedIndex: 0,
                options: buildOptionsForStep(prevStep, configState)
            })
            break
    }
}

export const updateDiscoveredApis = (apis: DiscoveredAPI[]) => {
    updateConfig({
        discoveredApis: apis,
        scanning: false,
        options: buildOptionsForStep('bridge', { ...configState, discoveredApis: apis })
    })
}

// Initialize options for first step
export const initConfig = async () => {
    await refreshSerialPorts()
}
