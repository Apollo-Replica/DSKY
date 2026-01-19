/**
 * Abstract base class for AGC integrations.
 * Each integration (Reentry, NASSP, KSP, Bridge, yaAGC, Random) extends this class
 * and implements the specifics of connecting to that particular AGC source.
 */
export abstract class AgcIntegration {
    protected stateCallback: ((state: any) => void) | null = null
    protected running: boolean = false

    /**
     * Human-readable name of the integration
     */
    abstract readonly name: string

    /**
     * Identifier used in config/CLI (e.g., 'reentry', 'nassp', 'ksp')
     */
    abstract readonly id: string

    /**
     * Start the integration and begin receiving state updates.
     * @param callback Function called whenever the AGC state changes
     * @param options Optional configuration (e.g., bridgeUrl, yaagc version)
     */
    async start(callback: (state: any) => void, options?: Record<string, any>): Promise<void> {
        if (this.running) {
            console.log(`[${this.name}] Already running`)
            return
        }
        this.stateCallback = callback
        this.running = true
        await this.onStart(options || {})
    }

    /**
     * Stop the integration and clean up resources.
     */
    stop(): void {
        if (!this.running) {
            return
        }
        console.log(`[${this.name}] Stopping`)
        this.running = false
        this.onStop()
        this.stateCallback = null
    }

    /**
     * Handle a key press from the DSKY keyboard.
     * @param key The key that was pressed (e.g., '0'-'9', 'v', 'n', '+', '-', 'e', 'c', 'p', etc.)
     */
    abstract handleKey(key: string): Promise<void>

    /**
     * Called when the integration should start. Implement connection logic here.
     * @param options Configuration options passed from the config system
     */
    protected abstract onStart(options: Record<string, any>): Promise<void>

    /**
     * Called when the integration should stop. Implement cleanup logic here.
     */
    protected abstract onStop(): void

    /**
     * Helper method to emit state updates to the callback
     */
    protected emitState(state: any): void {
        if (this.stateCallback && this.running) {
            this.stateCallback(state)
        }
    }
}
