import { AgcIntegration } from '../AgcIntegration'
import { NounRegistry } from './nouns'
import { AgcStateManager } from './agcState'
import { HAConnectionManager } from './haConnection'
import { loadSettings } from './settings'

export class HomeAssistantIntegration extends AgcIntegration {
    readonly name = 'Home Assistant'
    readonly id = 'homeassistant'

    private agcState: AgcStateManager | null = null
    private haConnection: HAConnectionManager | null = null

    async handleKey(key: string): Promise<void> {
        this.agcState?.handleKey(key)
    }

    protected async onStart(options: Record<string, any>): Promise<void> {
        const settings = loadSettings(options)
        const nounRegistry = new NounRegistry(settings.nouns)

        this.agcState = new AgcStateManager(nounRegistry, (state) => this.emitState(state))
        this.agcState.start()

        // Connect to HA if URL and token are available
        if (settings.url && settings.token) {
            this.haConnection = new HAConnectionManager(
                settings.url,
                settings.token,
                nounRegistry,
                (connected) => {
                    if (this.agcState) {
                        this.agcState.haConnected = connected
                    }
                }
            )
            // Wire service calls from verbs to HA connection
            this.agcState.setCallService((domain, service, data) =>
                this.haConnection!.callService(domain, service, data)
            )
            await this.haConnection.connect()
        } else {
            console.log('[HA] No URL/token configured — running standalone (clock only)')
        }
    }

    protected onStop(): void {
        this.haConnection?.disconnect()
        this.agcState?.stop()
        this.haConnection = null
        this.agcState = null
    }
}
