import { SerialPort } from 'serialport'
import { AgcIntegration } from './AgcIntegration'
import { V35_TEST } from '../../utils/dskyStates'
import { DiscoveredAPI } from '../networkScan'

export interface ConfigState {
    ready: boolean
    step: 'serial' | 'source' | 'bridge' | 'manualUrl' | 'yaagc' | 'confirm'
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
    textInput?: string
}

export const INPUT_SOURCES = [
    {name: 'NASSP', value: 'nassp'},
    {name: 'Reentry', value: 'reentry'},
    {name: 'Bridge to another DSKY API', value: 'bridge'},
    {name: 'yaAGC', value: 'yaagc'},
    {name: 'KSP', value: 'ksp'},
    {name: 'Random Values', value: 'random'}
]

export const YAAGC_VERSIONS = [
    {name: 'Comanche055', value: 'Comanche055'},
    {name: 'Luminary099', value: 'Luminary099'},
    {name: 'Luminary210', value: 'Luminary210'},
    {name: 'Start my own YaAGC', value: 'own'}
]

export interface ConfigResult {
    inputSource: string
    serialPort: string | null
    bridgeUrl?: string
    yaagcVersion?: string
}

export class ConfigIntegration extends AgcIntegration {
    readonly name = 'Config'
    readonly id = 'config'

    private configState: ConfigState
    private configCallback: ((state: ConfigState) => void) | null = null
    private onComplete: ((result: ConfigResult) => void) | null = null
    private onScanRequest: (() => void) | null = null

    constructor() {
        super()
        this.configState = this.createInitialState()
    }

    private createInitialState(): ConfigState {
        return {
            ready: false,
            step: 'serial',
            serialPort: null,
            inputSource: null,
            availablePorts: [],
            discoveredApis: [],
            scanning: false,
            selectedIndex: 0,
            options: [],
            textInput: ''
        }
    }

    /**
     * Set callback for config state changes (for UI updates)
     */
    setConfigCallback(callback: (state: ConfigState) => void): void {
        this.configCallback = callback
    }

    /**
     * Set callback for when configuration is complete
     */
    setOnComplete(callback: (result: ConfigResult) => void): void {
        this.onComplete = callback
    }

    /**
     * Set callback for when a network scan is requested
     */
    setOnScanRequest(callback: () => void): void {
        this.onScanRequest = callback
    }

    /**
     * Get current config state
     */
    getConfigState(): ConfigState {
        return {
            ...this.configState,
            resetDisabled: process.env.DISABLE_RESET === '1'
        }
    }

    /**
     * Update discovered APIs (called after network scan completes)
     */
    updateDiscoveredApis(apis: DiscoveredAPI[]): void {
        this.updateConfig({
            discoveredApis: apis,
            scanning: false,
            options: this.buildOptionsForStep('bridge', { ...this.configState, discoveredApis: apis })
        })
    }

    async handleKey(key: string): Promise<void> {
        // Special handling for text input mode
        if (this.configState.step === 'manualUrl') {
            await this.handleTextInput(key)
            return
        }

        switch (key) {
            case '+':
            case 'v':
                this.next()
                break
            case '-':
            case 'n':
                this.prev()
                break
            case 'e':
            case 'p':
                await this.select()
                break
            case 'c':
                this.back()
                break
            case 'o':
                // PRO release - ignore in config mode
                break
            default:
                if (/[0-9]/.test(key)) {
                    this.directSelect(parseInt(key))
                }
        }
    }

    private async handleTextInput(key: string): Promise<void> {
        const currentInput = this.configState.textInput || ''

        if (key === 'e' || key === 'p') {
            // Enter/confirm - validate and proceed
            const url = currentInput.trim()
            if (this.isValidWebSocketUrl(url)) {
                this.updateConfig({
                    bridgeUrl: url,
                    step: 'confirm',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('confirm', this.configState)
                })
            }
            // If invalid, stay on manualUrl step (user can keep editing)
            return
        }

        if (key === 'c') {
            // Cancel/back - go back to bridge selection
            this.updateConfig({
                step: 'bridge',
                selectedIndex: 0,
                textInput: '',
                options: this.buildOptionsForStep('bridge', this.configState)
            })
            return
        }

        // Handle backspace
        if (key === 'backspace') {
            this.updateConfig({ textInput: currentInput.slice(0, -1) })
            return
        }

        // Handle printable characters (single chars that aren't control keys)
        if (key.length === 1) {
            this.updateConfig({ textInput: currentInput + key })
        }
    }

    private isValidWebSocketUrl(url: string): boolean {
        try {
            const parsed = new URL(url)
            return parsed.protocol === 'ws:' || parsed.protocol === 'wss:'
        } catch {
            return false
        }
    }

    /**
     * Handle text input from WebSocket (for web UI)
     */
    handleTextInputFromWeb(text: string): void {
        if (this.configState.step === 'manualUrl') {
            this.updateConfig({ textInput: text })
        }
    }

    protected async onStart(_options: Record<string, any>): Promise<void> {
        console.log('[Config] Starting config mode')
        this.configState = this.createInitialState()
        await this.refreshSerialPorts()
        // Emit initial DSKY state (shows test pattern during config)
        this.emitState(V35_TEST)
    }

    protected onStop(): void {
        console.log('[Config] Stopping config mode')
        this.configCallback = null
    }

    /**
     * Reset config back to initial state
     */
    reset(): void {
        const availablePorts = this.configState.availablePorts // Keep cached ports
        this.configState = this.createInitialState()
        this.configState.availablePorts = availablePorts
        this.refreshSerialPorts()
        this.broadcastConfig()
    }

    async refreshSerialPorts(): Promise<void> {
        const ports = await SerialPort.list()
        const availablePorts = ports.map((p: any) => ({
            path: p.path,
            name: p.friendlyName || p.path
        }))
        this.updateConfig({
            availablePorts,
            options: this.buildOptionsForStep('serial', { ...this.configState, availablePorts })
        })
    }

    private updateConfig(partial: Partial<ConfigState>): void {
        this.configState = { ...this.configState, ...partial }
        this.broadcastConfig()
    }

    private broadcastConfig(): void {
        if (this.configCallback) {
            this.configCallback(this.getConfigState())
        }
    }

    private buildOptionsForStep(step: string, state: ConfigState): string[] {
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

    private next(): void {
        const maxIndex = this.configState.options.length - 1
        this.updateConfig({
            selectedIndex: Math.min(this.configState.selectedIndex + 1, maxIndex)
        })
    }

    private prev(): void {
        this.updateConfig({
            selectedIndex: Math.max(this.configState.selectedIndex - 1, 0)
        })
    }

    private directSelect(index: number): void {
        if (index >= 0 && index < this.configState.options.length) {
            this.updateConfig({ selectedIndex: index })
        }
    }

    private async select(): Promise<void> {
        const { step, selectedIndex, options, availablePorts, discoveredApis } = this.configState

        switch (step) {
            case 'serial': {
                const option = options[selectedIndex]
                if (option === 'Refresh List') {
                    await this.refreshSerialPorts()
                    return
                }
                const serialPort = option === 'No Serial output'
                    ? null
                    : availablePorts[selectedIndex - 1]?.path || null
                this.updateConfig({
                    serialPort,
                    step: 'source',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('source', this.configState)
                })
                return
            }

            case 'source': {
                const source = INPUT_SOURCES[selectedIndex]
                this.updateConfig({ inputSource: source.value })

                if (source.value === 'bridge') {
                    this.updateConfig({
                        step: 'bridge',
                        selectedIndex: 0,
                        scanning: true,
                        options: this.buildOptionsForStep('bridge', this.configState)
                    })
                    // Trigger network scan
                    if (this.onScanRequest) {
                        this.onScanRequest()
                    }
                    return
                } else if (source.value === 'yaagc') {
                    this.updateConfig({
                        step: 'yaagc',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('yaagc', this.configState)
                    })
                    return
                } else {
                    // Skip to confirm for other sources
                    this.updateConfig({
                        step: 'confirm',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('confirm', this.configState)
                    })
                    return
                }
            }

            case 'bridge': {
                const option = options[selectedIndex]
                if (option === 'Rescan') {
                    this.updateConfig({ scanning: true })
                    if (this.onScanRequest) {
                        this.onScanRequest()
                    }
                    return
                }
                if (option === 'Manual URL') {
                    // Navigate to manual URL input step
                    this.updateConfig({
                        step: 'manualUrl',
                        textInput: 'wss://',
                        options: []
                    })
                    return
                } else if (option === 'Public (dsky.ortizma.com)') {
                    this.updateConfig({ bridgeUrl: 'wss://dsky.ortizma.com/ws' })
                } else {
                    // It's a discovered API
                    const api = discoveredApis[selectedIndex - 1]
                    if (api) {
                        this.updateConfig({ bridgeUrl: api.url })
                    }
                }
                this.updateConfig({
                    step: 'confirm',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('confirm', this.configState)
                })
                return
            }

            case 'manualUrl': {
                // This is handled in handleTextInput, but in case select is called directly
                const url = (this.configState.textInput || '').trim()
                if (this.isValidWebSocketUrl(url)) {
                    this.updateConfig({
                        bridgeUrl: url,
                        step: 'confirm',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('confirm', this.configState)
                    })
                }
                return
            }

            case 'yaagc': {
                const version = YAAGC_VERSIONS[selectedIndex]
                this.updateConfig({
                    yaagcVersion: version.value,
                    step: 'confirm',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('confirm', this.configState)
                })
                return
            }

            case 'confirm': {
                if (selectedIndex === 1) {
                    // Back to start
                    this.reset()
                    return
                }
                // Confirm - configuration complete
                this.updateConfig({ ready: true })
                
                if (this.onComplete) {
                    this.onComplete({
                        inputSource: this.configState.inputSource!,
                        serialPort: this.configState.serialPort,
                        bridgeUrl: this.configState.bridgeUrl,
                        yaagcVersion: this.configState.yaagcVersion
                    })
                }
                return
            }
        }
    }

    private back(): void {
        const { step } = this.configState

        switch (step) {
            case 'source':
                this.updateConfig({
                    step: 'serial',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('serial', this.configState)
                })
                break
            case 'bridge':
            case 'yaagc':
                this.updateConfig({
                    step: 'source',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('source', this.configState)
                })
                break
            case 'manualUrl':
                this.updateConfig({
                    step: 'bridge',
                    selectedIndex: 0,
                    textInput: '',
                    options: this.buildOptionsForStep('bridge', this.configState)
                })
                break
            case 'confirm':
                const prevStep = this.configState.inputSource === 'bridge' ? 'bridge'
                    : this.configState.inputSource === 'yaagc' ? 'yaagc'
                    : 'source'
                this.updateConfig({
                    step: prevStep as ConfigState['step'],
                    selectedIndex: 0,
                    options: this.buildOptionsForStep(prevStep, this.configState)
                })
                break
        }
    }
}
