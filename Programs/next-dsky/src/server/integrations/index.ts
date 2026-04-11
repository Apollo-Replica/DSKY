import { AgcIntegration } from './AgcIntegration'
import { ReentryIntegration } from './reentry'
import { NASSPIntegration } from './nassp'
import { KSPIntegration } from './ksp'
import { BridgeIntegration } from './bridge'
import { YaAGCIntegration } from './yaAGC'
import { RandomIntegration } from './random'
import { HomeAssistantIntegration } from './homeassistant'
import { ConfigIntegration } from './config'

// Export the base class for type usage
export { AgcIntegration } from './AgcIntegration'

// Export all integration classes
export { ReentryIntegration } from './reentry'
export { NASSPIntegration } from './nassp'
export { KSPIntegration } from './ksp'
export { BridgeIntegration } from './bridge'
export { YaAGCIntegration } from './yaAGC'
export { RandomIntegration } from './random'
export { HomeAssistantIntegration } from './homeassistant'
export { ConfigIntegration, type ConfigState, type ConfigResult, INPUT_SOURCES, YAAGC_VERSIONS } from './config'

/**
 * Registry of all available AGC integrations.
 * Maps integration ID to its class constructor.
 */
const integrationRegistry: Record<string, new () => AgcIntegration> = {
    config: ConfigIntegration,
    reentry: ReentryIntegration,
    nassp: NASSPIntegration,
    ksp: KSPIntegration,
    bridge: BridgeIntegration,
    yaagc: YaAGCIntegration,
    random: RandomIntegration,
    homeassistant: HomeAssistantIntegration,
}

/**
 * Get an instance of an AGC integration by its ID.
 * @param id The integration identifier (e.g., 'reentry', 'nassp', 'ksp', 'bridge', 'yaagc', 'random')
 * @returns A new instance of the requested integration, or RandomIntegration if not found
 */
export function getIntegration(id: string): AgcIntegration {
    const IntegrationClass = integrationRegistry[id]
    if (IntegrationClass) {
        return new IntegrationClass()
    }
    console.log(`[Integrations] Unknown integration '${id}', falling back to random`)
    return new RandomIntegration()
}

/**
 * Get a list of all available integration IDs.
 */
export function getAvailableIntegrations(): string[] {
    return Object.keys(integrationRegistry)
}

/**
 * Check if an integration ID is valid.
 */
export function isValidIntegration(id: string): boolean {
    return id in integrationRegistry
}
