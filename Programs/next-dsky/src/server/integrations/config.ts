import { SerialPort } from 'serialport'
import * as os from 'os'
import { AgcIntegration } from './AgcIntegration'
import { V35_TEST } from '../../utils/dskyStates'
import { discoverEntities, generateNounMappings, persistNounMappings } from './homeassistant/entityDiscovery'
import type { ConfigState, ConfigResult, DiscoveredAPI, NetworkInterfaceOption } from '../../types/config'

export type { ConfigState, ConfigResult, DiscoveredAPI, DiscoveredEntity, NetworkInterfaceOption } from '../../types/config'

export function getInputSources() {
    return [
        {name: 'NASSP', value: 'nassp'},
        {name: 'Reentry', value: 'reentry'},
        {name: 'Bridge to another DSKY API', value: 'bridge'},
        {name: 'yaAGC', value: 'yaagc'},
        {name: 'KSP', value: 'ksp'},
        ...(process.env.DSKY_HOMEASSISTANT === '1' ? [{name: 'Home Assistant', value: 'homeassistant'}] : []),
        {name: 'Random Values', value: 'random'}
    ]
}

export const YAAGC_VERSIONS = [
    {name: 'Comanche055', value: 'Comanche055'},
    {name: 'Luminary099', value: 'Luminary099'},
    {name: 'Luminary210', value: 'Luminary210'},
    {name: 'Start my own YaAGC', value: 'own'}
]

export class ConfigIntegration extends AgcIntegration {
    readonly name = 'Config'
    readonly id = 'config'

    private configState: ConfigState
    private configCallback: ((state: ConfigState) => void) | null = null
    private onComplete: ((result: ConfigResult) => Promise<void>) | null = null
    private onScanRequest: (() => void) | null = null
    private onNetworkInterfaceSelected: ((ip: string | null) => void) | null = null
    private onWifiConfigure: (() => void) | null = null
    private presetSerialPort: string | null = null
    private presetNetworkInterface: string | null = null

    constructor(presetSerialPort?: string, presetNetworkInterface?: string) {
        super()
        this.presetSerialPort = presetSerialPort || null
        this.presetNetworkInterface = presetNetworkInterface || null
        this.configState = this.createInitialState()
    }

    private createInitialState(): ConfigState {
        return {
            ready: false,
            step: 'serial',
            stepNumber: 1,
            serialPort: null,
            inputSource: null,
            networkInterface: null,
            availableInterfaces: [],
            availablePorts: [],
            discoveredApis: [],
            scanning: false,
            selectedIndex: 0,
            options: [],
            textInput: '',
            wifiConnectRunning: false
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
    setOnComplete(callback: (result: ConfigResult) => void): void
    setOnComplete(callback: (result: ConfigResult) => Promise<void>): void
    setOnComplete(callback: (result: ConfigResult) => void | Promise<void>): void {
        this.onComplete = async (result: ConfigResult) => {
            await callback(result)
        }
    }

    /**
     * Set callback for when a network scan is requested
     */
    setOnScanRequest(callback: () => void): void {
        this.onScanRequest = callback
    }

    /**
     * Called when a network interface is selected (Windows multi-adapter fix)
     */
    setOnNetworkInterfaceSelected(callback: (ip: string | null) => void): void {
        this.onNetworkInterfaceSelected = callback
    }

    /**
     * Set callback for when WiFi configuration is requested
     */
    setOnWifiConfigure(callback: () => void): void {
        this.onWifiConfigure = callback
    }

    setWifiConnectRunning(running: boolean): void {
        this.updateConfig({ wifiConnectRunning: running })
    }

    /**
     * Get current config state
     */
    getConfigState(): ConfigState {
        return {
            ...this.configState,
            stepNumber: this.computeStepNumber(this.configState),
            resetDisabled: process.env.DISABLE_RESET === '1',
            wifiConnectAvailable: this.onWifiConfigure !== null,
            wifiConnectRunning: this.configState.wifiConnectRunning === true
        }
    }

    /**
     * Update discovered APIs (called after network scan completes)
     */
    updateDiscoveredApis(apis: DiscoveredAPI[]): void {
        // Discovered APIs are only relevant to the "bridge" step.
        // mDNS updates can arrive at any time; do NOT clobber the current step's options.
        const partial: Partial<ConfigState> = {
            discoveredApis: apis,
            scanning: false
        }

        if (this.configState.step === 'bridge') {
            partial.options = this.buildOptionsForStep('bridge', { ...this.configState, discoveredApis: apis })
        }

        this.updateConfig(partial)
    }

    async handleKey(key: string): Promise<void> {
        if (this.configState.wifiConnectRunning) {
            // Lock input while wifi-connect is running (avoid state corruption / accidental navigation)
            return
        }
        // Special handling for text input mode
        if (this.configState.step === 'manualUrl' || this.configState.step === 'haUrl' || this.configState.step === 'haToken') {
            await this.handleTextInput(key)
            return
        }
        // haDiscover: only CLR (back), everything else is locked during discovery
        if (this.configState.step === 'haDiscover') {
            if (key === 'c') this.back()
            return
        }
        switch (key) {
            case '+':
            case 'v':
                this.prev()
                break
            case '-':
            case 'n':
                this.next()
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
        const { step } = this.configState

        if (key === 'e' || key === 'p') {
            // Enter/confirm
            if (step === 'manualUrl') {
                const url = currentInput.trim()
                if (this.isValidWebSocketUrl(url)) {
                    this.updateConfig({
                        bridgeUrl: url,
                        step: 'confirm',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('confirm', this.configState)
                    })
                }
            } else if (step === 'haUrl') {
                const url = currentInput.trim()
                if (this.isValidHttpUrl(url)) {
                    this.updateConfig({
                        haUrl: url,
                        step: 'haToken',
                        textInput: process.env.HA_TOKEN || '',
                        options: []
                    })
                }
            } else if (step === 'haToken') {
                const token = currentInput.trim()
                if (token.length > 0) {
                    this.updateConfig({
                        haToken: token,
                        step: 'haDiscover',
                        textInput: '',
                        options: []
                    })
                    await this.discoverHAEntities()
                }
            }
            return
        }

        if (key === 'c') {
            // Cancel/back
            if (step === 'manualUrl') {
                this.updateConfig({
                    step: 'bridge',
                    selectedIndex: 0,
                    textInput: '',
                    options: this.buildOptionsForStep('bridge', this.configState)
                })
            } else if (step === 'haUrl') {
                this.updateConfig({
                    step: 'haSetup',
                    selectedIndex: 0,
                    textInput: '',
                    options: this.buildOptionsForStep('haSetup', this.configState)
                })
            } else if (step === 'haToken') {
                this.updateConfig({
                    step: 'haUrl',
                    textInput: this.configState.haUrl || process.env.HA_URL || 'http://',
                    options: []
                })
            }
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

    private isValidHttpUrl(url: string): boolean {
        try {
            const parsed = new URL(url)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        } catch {
            return false
        }
    }

    private async discoverHAEntities(): Promise<void> {
        const { haUrl, haToken } = this.configState
        if (!haUrl || !haToken) return

        try {
            console.log(`[Config] Discovering HA entities at ${haUrl}`)
            const entities = await discoverEntities(haUrl, haToken)
            console.log(`[Config] Found ${entities.length} entities`)
            this.updateConfig({
                haEntities: entities,
                haSelectedEntityIds: entities.map(e => e.entity_id), // all selected by default
                haDiscoverError: undefined,
                step: 'haEntities',
                selectedIndex: 0,
                options: this.buildOptionsForStep('haEntities', {
                    ...this.configState,
                    haEntities: entities,
                    haSelectedEntityIds: entities.map(e => e.entity_id)
                })
            })
        } catch (err: any) {
            console.error('[Config] HA entity discovery failed:', err?.message || err)
            this.updateConfig({
                haDiscoverError: err?.message || 'Connection failed',
                step: 'haDiscover',
                options: []
            })
        }
    }

    private async haEntitiesDone(): Promise<void> {
        const { haSelectedEntityIds, haEntities } = this.configState
        if (!haSelectedEntityIds || !haEntities || haSelectedEntityIds.length === 0) return

        // Generate and persist noun mappings (including URL + token for auto-start on reboot)
        const nouns = generateNounMappings(haSelectedEntityIds, haEntities)
        persistNounMappings(nouns, this.configState.haUrl, this.configState.haToken)

        this.updateConfig({
            step: 'confirm',
            selectedIndex: 0,
            options: this.buildOptionsForStep('confirm', this.configState)
        })
    }

    /**
     * Handle text input from WebSocket (for web UI)
     */
    handleTextInputFromWeb(text: string): void {
        if (this.configState.wifiConnectRunning) return
        if (this.configState.step === 'manualUrl' || this.configState.step === 'haUrl' || this.configState.step === 'haToken') {
            this.updateConfig({ textInput: text })
        }
    }

    /**
     * Toggle entity selection (called from web UI click on entity row)
     */
    toggleHaEntity(index: number): void {
        if (this.configState.step !== 'haEntities') return
        const entities = this.configState.haEntities || []
        const selected = [...(this.configState.haSelectedEntityIds || [])]

        if (index === 0) {
            // Toggle all
            const allSelected = entities.every(e => selected.includes(e.entity_id))
            const newSelected = allSelected ? [] : entities.map(e => e.entity_id)
            this.updateConfig({
                haSelectedEntityIds: newSelected,
                options: this.buildOptionsForStep('haEntities', {
                    ...this.configState,
                    haSelectedEntityIds: newSelected
                })
            })
        } else {
            // Toggle individual entity (index 1..N maps to entities[0..N-1])
            const entity = entities[index - 1]
            if (entity) {
                const idx = selected.indexOf(entity.entity_id)
                if (idx >= 0) {
                    selected.splice(idx, 1)
                } else {
                    selected.push(entity.entity_id)
                }
                this.updateConfig({
                    haSelectedEntityIds: selected,
                    options: this.buildOptionsForStep('haEntities', {
                        ...this.configState,
                        haSelectedEntityIds: selected
                    })
                })
            }
        }
    }

    protected async onStart(_options: Record<string, any>): Promise<void> {
        console.log('[Config] Starting config mode')
        this.configState = this.createInitialState()

        // Windows: if multiple IPv4 interfaces are present and no env override is set,
        // ask the user to pick which interface mDNS should use for outbound multicast.
        const shouldPromptNetworkInterface =
            os.platform() === 'win32' && !this.presetNetworkInterface

        if (this.presetNetworkInterface) {
            this.configState.networkInterface = this.presetNetworkInterface
            if (this.onNetworkInterfaceSelected) {
                this.onNetworkInterfaceSelected(this.presetNetworkInterface)
            }
        }

        if (shouldPromptNetworkInterface) {
            const availableInterfaces = this.detectNetworkInterfaces()
            this.configState.availableInterfaces = availableInterfaces

            if (availableInterfaces.length > 1) {
                this.configState.step = 'network'
                this.configState.options = this.buildOptionsForStep('network', this.configState)
                // Emit initial DSKY state (shows test pattern during config)
                this.emitState(V35_TEST)
                return
            }
        }

        // If serial port is preset via CLI, skip serial step
        if (this.presetSerialPort) {
            console.log(`[Config] Using preset serial port: ${this.presetSerialPort}`)
            this.configState.serialPort = this.presetSerialPort
            this.configState.step = 'source'
            this.configState.options = this.buildOptionsForStep('source', this.configState)
        } else {
            await this.refreshSerialPorts()
        }

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

        // Recreate baseline state
        this.configState = this.createInitialState()
        this.configState.availablePorts = availablePorts

        // Apply preset network interface (CLI arg) if present
        if (this.presetNetworkInterface) {
            this.configState.networkInterface = this.presetNetworkInterface
            if (this.onNetworkInterfaceSelected) {
                this.onNetworkInterfaceSelected(this.presetNetworkInterface)
            }
        } else {
            this.configState.networkInterface = null
            if (this.onNetworkInterfaceSelected) {
                // Let caller revert to auto if we were previously overridden via UI selection
                this.onNetworkInterfaceSelected(null)
            }
        }

        // Determine the real "step 1" dynamically (based on args + platform + interfaces)
        const shouldPromptNetworkInterface =
            os.platform() === 'win32' && !this.presetNetworkInterface

        if (shouldPromptNetworkInterface) {
            const availableInterfaces = this.detectNetworkInterfaces()
            this.configState.availableInterfaces = availableInterfaces

            if (availableInterfaces.length > 1) {
                this.updateConfig({
                    step: 'network',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('network', this.configState)
                })
                return
            }
        } else {
            // Keep list around for consistent numbering/back behavior (if present)
            if (os.platform() === 'win32') {
                this.configState.availableInterfaces = this.detectNetworkInterfaces()
            }
        }

        // Serial step is optional when preset via CLI
        if (this.presetSerialPort) {
            this.configState.serialPort = this.presetSerialPort
            this.updateConfig({
                step: 'source',
                selectedIndex: 0,
                options: this.buildOptionsForStep('source', this.configState)
            })
            return
        }

        // Default: go back to serial selection
        this.updateConfig({
            step: 'serial',
            selectedIndex: 0,
            options: this.buildOptionsForStep('serial', this.configState)
        })
        // Refresh ports asynchronously (will update options again)
        this.refreshSerialPorts()
    }

    /**
     * Jump directly to a specific step (used by the new menu UI)
     */
    async gotoStep(step: string): Promise<void> {
        switch (step) {
            case 'serial':
                this.updateConfig({
                    step: 'serial',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('serial', this.configState)
                })
                await this.refreshSerialPorts()
                break
            case 'source':
                this.updateConfig({
                    step: 'source',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('source', this.configState)
                })
                break
            case 'haSetup':
                this.configState.inputSource = 'homeassistant'
                this.updateConfig({
                    step: 'haSetup',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('haSetup', this.configState)
                })
                break
            case 'bridge':
                this.configState.inputSource = 'bridge'
                this.updateConfig({
                    step: 'bridge',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('bridge', this.configState),
                    scanning: true
                })
                if (this.onScanRequest) this.onScanRequest()
                break
            case 'yaagc':
                this.configState.inputSource = 'yaagc'
                this.updateConfig({
                    step: 'yaagc',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('yaagc', this.configState)
                })
                break
        }
    }

    /**
     * Directly select a source and start the integration (for sources with no extra config)
     */
    async selectSourceDirect(source: string): Promise<void> {
        this.configState.inputSource = source
        this.updateConfig({
            step: 'confirm',
            selectedIndex: 0,
            options: this.buildOptionsForStep('confirm', this.configState)
        })
        // Auto-confirm
        await this.select()
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
        this.configState.stepNumber = this.computeStepNumber(this.configState)
        this.broadcastConfig()
    }

    private broadcastConfig(): void {
        if (this.configCallback) {
            this.configCallback(this.getConfigState())
        }
    }

    private buildOptionsForStep(step: string, state: ConfigState): string[] {
        switch (step) {
            case 'network':
                return [
                    'Auto (default route)',
                    ...state.availableInterfaces.map(i => `${i.name} (${i.ip})`)
                ]
            case 'serial':
                return [
                    'No Serial output',
                    ...state.availablePorts.map(p => p.name || p.path),
                    'Refresh List'
                ]
            case 'source':
                return getInputSources().map(s => s.name)
            case 'bridge':
                return [
                    'Public (dsky.ortizma.com)',
                    ...state.discoveredApis.map(api => api.name || api.ip),
                    'Rescan',
                    'Manual URL'
                ]
            case 'yaagc':
                return YAAGC_VERSIONS.map(v => v.name)
            case 'haSetup':
                return ['Continue on this device']
            case 'haEntities': {
                const entities = state.haEntities || []
                const selected = state.haSelectedEntityIds || []
                const allSelected = entities.length > 0 && entities.every(e => selected.includes(e.entity_id))
                return [
                    allSelected ? 'Deselect all' : 'Select all',
                    ...entities.map(e => {
                        const check = selected.includes(e.entity_id) ? '\u2611' : '\u2610'
                        return `${check} ${e.friendly_name} (${e.domain})`
                    }),
                ]
            }
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
        // Allow going to -1 (WiFi config option) when WiFi callback is set
        const minIndex = this.onWifiConfigure ? -1 : 0
        this.updateConfig({
            selectedIndex: Math.max(this.configState.selectedIndex - 1, minIndex)
        })
    }

    private directSelect(index: number): void {
        if (index >= 0 && index < this.configState.options.length) {
            this.updateConfig({ selectedIndex: index })
        }
    }

    private async select(): Promise<void> {
        const { step, selectedIndex, options, availablePorts, discoveredApis, availableInterfaces } = this.configState

        // Handle WiFi config selection (index -1)
        if (selectedIndex === -1 && this.onWifiConfigure) {
            this.onWifiConfigure()
            // Reset to index 0 after triggering WiFi config
            this.updateConfig({ selectedIndex: 0 })
            return
        }

        switch (step) {
            case 'network': {
                const option = options[selectedIndex]
                const chosen =
                    option === 'Auto (default route)' ? null : availableInterfaces[selectedIndex - 1]?.ip || null

                this.updateConfig({ networkInterface: chosen })
                if (this.onNetworkInterfaceSelected) {
                    this.onNetworkInterfaceSelected(chosen)
                }

                // Continue flow
                if (this.presetSerialPort) {
                    this.updateConfig({
                        step: 'source',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('source', this.configState)
                    })
                } else {
                    this.updateConfig({
                        step: 'serial',
                        selectedIndex: 0,
                        options: []
                    })
                    await this.refreshSerialPorts()
                }
                return
            }
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
                const source = getInputSources()[selectedIndex]
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
                } else if (source.value === 'homeassistant') {
                    this.updateConfig({
                        step: 'haSetup',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('haSetup', this.configState),
                        localUrl: this.computeLocalUrl()
                    })
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

            case 'haSetup': {
                // Continue to URL entry
                this.updateConfig({
                    step: 'haUrl',
                    textInput: process.env.HA_URL || 'http://',
                    options: []
                })
                return
            }

            case 'haEntities': {
                // Select = confirm and advance
                const selected = this.configState.haSelectedEntityIds || []
                if (selected.length > 0) {
                    await this.haEntitiesDone()
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
                    try {
                        await this.onComplete({
                            inputSource: this.configState.inputSource!,
                            serialPort: this.configState.serialPort,
                            bridgeUrl: this.configState.bridgeUrl,
                            yaagcVersion: this.configState.yaagcVersion,
                            haUrl: this.configState.haUrl,
                            haToken: this.configState.haToken,
                            haEntities: this.configState.haEntities,
                            haSelectedEntityIds: this.configState.haSelectedEntityIds
                        })
                    } catch (err) {
                        console.error('[Config] Failed to start selected integration:', err)
                        // Keep config UI responsive rather than leaving it in a "ready" state.
                        this.updateConfig({ ready: false })
                    }
                }
                return
            }
        }
    }

    private back(): void {
        const { step } = this.configState

        switch (step) {
            case 'serial':
                if (this.configState.availableInterfaces.length > 1) {
                    this.updateConfig({
                        step: 'network',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('network', this.configState)
                    })
                }
                break
            case 'source':
                if (this.presetSerialPort && this.configState.availableInterfaces.length > 1) {
                    this.updateConfig({
                        step: 'network',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('network', this.configState)
                    })
                } else {
                    this.updateConfig({
                        step: 'serial',
                        selectedIndex: 0,
                        options: this.buildOptionsForStep('serial', this.configState)
                    })
                }
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
            case 'haSetup':
                this.updateConfig({
                    step: 'source',
                    selectedIndex: 0,
                    options: this.buildOptionsForStep('source', this.configState)
                })
                break
            case 'haUrl':
                this.updateConfig({
                    step: 'haSetup',
                    selectedIndex: 0,
                    textInput: '',
                    options: this.buildOptionsForStep('haSetup', this.configState)
                })
                break
            case 'haToken':
                this.updateConfig({
                    step: 'haUrl',
                    textInput: this.configState.haUrl || process.env.HA_URL || 'http://',
                    options: []
                })
                break
            case 'haDiscover':
            case 'haEntities':
                this.updateConfig({
                    step: 'haToken',
                    textInput: this.configState.haToken || process.env.HA_TOKEN || '',
                    options: []
                })
                break
            case 'confirm':
                const prevStep = this.configState.inputSource === 'bridge' ? 'bridge'
                    : this.configState.inputSource === 'yaagc' ? 'yaagc'
                    : this.configState.inputSource === 'homeassistant' ? 'haEntities'
                    : 'source'
                this.updateConfig({
                    step: prevStep as ConfigState['step'],
                    selectedIndex: 0,
                    options: this.buildOptionsForStep(prevStep, this.configState)
                })
                break
        }
    }

    private computeStepNumber(state: ConfigState): number {
        // Numbering starts at 1, and shifts when optional steps are omitted.
        // Optional steps:
        // - network: only when multiple interfaces detected and no overrides
        // - serial: omitted when presetSerialPort is provided via args
        const hasNetworkStep =
            os.platform() === 'win32' && !this.presetNetworkInterface && state.availableInterfaces.length > 1
        const hasSerialStep = !this.presetSerialPort

        const base = 1
        const networkOffset = hasNetworkStep ? 1 : 0
        const serialOffset = hasSerialStep ? 1 : 0

        switch (state.step) {
            case 'network':
                return base
            case 'serial':
                return base + networkOffset
            case 'source':
                return base + networkOffset + serialOffset
            case 'bridge':
            case 'manualUrl':
            case 'yaagc':
            case 'haSetup':
                return base + networkOffset + serialOffset + 1
            case 'haUrl':
                return base + networkOffset + serialOffset + 2
            case 'haToken':
                return base + networkOffset + serialOffset + 3
            case 'haDiscover':
            case 'haEntities':
                return base + networkOffset + serialOffset + 4
            case 'confirm':
                if (state.inputSource === 'homeassistant') {
                    return base + networkOffset + serialOffset + 5
                }
                return base + networkOffset + serialOffset + 2
        }
    }

    private computeLocalUrl(): string {
        // Find the first LAN IP address to show the user
        const ifaces = os.networkInterfaces()
        for (const entries of Object.values(ifaces)) {
            for (const entry of entries || []) {
                if (entry.family !== 'IPv4' || entry.internal) continue
                if (entry.address.startsWith('169.254.')) continue
                // Use port 3000 as default; in production the server runs on this port
                return `http://${entry.address}:3000/config`
            }
        }
        return 'http://localhost:3000/config'
    }

    private detectNetworkInterfaces(): NetworkInterfaceOption[] {
        const result: NetworkInterfaceOption[] = []
        const ifaces = os.networkInterfaces()

        for (const [name, entries] of Object.entries(ifaces)) {
            for (const entry of entries || []) {
                if (entry.family !== 'IPv4') continue
                if (entry.internal) continue
                // Skip APIPA
                if (entry.address.startsWith('169.254.')) continue
                result.push({ name, ip: entry.address })
                break // one IPv4 per interface is enough for selection
            }
        }

        // Prefer showing RFC1918 first
        const score = (ip: string) => {
            const parts = ip.split('.').map(n => parseInt(n, 10))
            if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return 0
            const [a, b] = parts
            // RFC1918
            if (a === 192 && b === 168) return 3
            if (a === 10) return 2
            if (a === 172 && b >= 16 && b <= 31) return 1
            return 0
        }
        return result.sort((a, b) => score(b.ip) - score(a.ip) || a.name.localeCompare(b.name))
    }
}
