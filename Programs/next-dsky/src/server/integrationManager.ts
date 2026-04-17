import { AgcIntegration, getIntegration } from './integrations'
import { createSerial, createSerialFromConfig, closeSerial } from './serial'
import { mdnsService } from './mdnsService'
import { initCalculator, handleCalculatorKey } from './apps/calculatorApp'
import { initClock, handleClockKey, getClockState, cleanup as cleanupClock } from './apps/clockApp'
import { initGames, handleGamesKey, getGamesState, cleanup as cleanupGames } from './apps/gamesApp'
import { V35_TEST, OFF_TEST } from '../utils/dskyStates'
import { openMenu } from './menuController'
import { serverState, setServerState, broadcast, updateApp, updateSerial, updateHa } from './stateManager'

export let activeIntegration: AgcIntegration | null = null
export let pendingUpdate: any = null
export let programOptions: any = {}

export const setProgramOptions = (options: any) => {
    programOptions = options
}

export const setPendingUpdate = (update: any) => {
    pendingUpdate = update
}

export const consumePendingUpdate = (): any => {
    const update = pendingUpdate
    pendingUpdate = null
    return update
}

export const stopIntegration = () => {
    if (activeIntegration) {
        console.log('[Server] Stopping active integration')
        activeIntegration.stop()
    }
    activeIntegration = null
    cleanupClock()
    cleanupGames()
}

export const enterIdle = () => {
    stopIntegration()
    mdnsService.setApp('idle')
    updateApp({ id: null, yaagcVersion: undefined, bridgeUrl: undefined, haUrl: undefined, calculator: undefined, clock: undefined, games: undefined })
    pendingUpdate = V35_TEST
    openMenu()
}

export interface IntegrationConfig {
    app: string
    serialPort?: string | null
    bridgeUrl?: string
    yaagcVersion?: string
    haUrl?: string
    haToken?: string
    haEntities?: any[]
    haSelectedEntityIds?: string[]
}

export const startIntegration = async (config: IntegrationConfig) => {
    console.log(`[Server] Starting integration: ${config.app}`)
    stopIntegration()

    if (config.serialPort) {
        console.log(`[Server] Creating serial connection to: ${config.serialPort}`)
        await createSerialFromConfig(config.serialPort, programOptions.baud || '9600')
    }

    const integrationOptions: Record<string, any> = { ...programOptions }
    if (config.yaagcVersion) integrationOptions.yaagc = config.yaagcVersion
    if (config.bridgeUrl) integrationOptions.bridgeUrl = config.bridgeUrl
    if (config.haUrl) integrationOptions.haUrl = config.haUrl
    if (config.haToken) integrationOptions.haToken = config.haToken

    activeIntegration = getIntegration(config.app)
    mdnsService.setApp(config.app)
    await activeIntegration.start((state) => {
        pendingUpdate = state
    }, integrationOptions)

    updateApp({
        id: config.app,
        bridgeUrl: config.bridgeUrl,
        yaagcVersion: config.yaagcVersion,
        haUrl: config.haUrl,
    })
    updateSerial({ port: config.serialPort ?? serverState.serial.port })
    if (config.haEntities || config.haSelectedEntityIds) {
        updateHa({
            entities: config.haEntities,
            selectedIds: config.haSelectedEntityIds,
        })
    }
}

export const startCustomApp = (appId: string) => {
    console.log(`[Server] Starting custom app: ${appId}`)
    stopIntegration()
    pendingUpdate = OFF_TEST

    if (appId === 'calculator') {
        const calcState = initCalculator()
        updateApp({ id: 'calculator', calculator: calcState, clock: undefined, games: undefined })
    } else if (appId === 'clock') {
        const clockState = initClock(broadcast)
        updateApp({ id: 'clock', clock: clockState, calculator: undefined, games: undefined })
    } else if (appId === 'games') {
        const gamesState = initGames((s) => {
            setServerState({ ...serverState, app: { ...serverState.app, games: s } })
            broadcast()
        })
        updateApp({ id: 'games', games: gamesState, calculator: undefined, clock: undefined })
    }
}

export async function routeKeyToApp(key: string) {
    const appId = serverState.app.id

    if (appId === 'calculator') {
        const calcState = handleCalculatorKey(key)
        setServerState({ ...serverState, app: { ...serverState.app, calculator: calcState } })
        broadcast()
        return
    }
    if (appId === 'clock') {
        handleClockKey(key)
        setServerState({ ...serverState, app: { ...serverState.app, clock: getClockState() } })
        broadcast()
        return
    }
    if (appId === 'games') {
        handleGamesKey(key)
        setServerState({ ...serverState, app: { ...serverState.app, games: getGamesState() } })
        broadcast()
        return
    }

    if (activeIntegration) {
        await activeIntegration.handleKey(key)
    }
}
