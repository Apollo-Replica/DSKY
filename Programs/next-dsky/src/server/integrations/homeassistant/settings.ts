import * as fs from 'fs'
import * as path from 'path'
import { HASettings, NounConfig } from './types'

export const loadSettings = (options?: Record<string, any>): HASettings => {
    let fileNouns: Record<string, NounConfig> = {}
    let fileUrl: string | undefined
    let fileToken: string | undefined

    const filePath = path.resolve('ha_entities.json')
    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(content)
        fileNouns = parsed.nouns || {}
        fileUrl = parsed.url || undefined
        fileToken = parsed.token || undefined
        console.log('[HA] Loaded entity mappings from', filePath)
    } catch (err: any) {
        if (err?.code === 'ENOENT') {
            console.log('[HA] No ha_entities.json found, using defaults')
        } else {
            console.error('[HA] Failed to parse ha_entities.json:', err?.message || err)
        }
    }

    // Priority: wizard options > env vars > persisted file
    const settings: HASettings = {
        url: options?.haUrl || process.env.HA_URL || fileUrl,
        token: options?.haToken || process.env.HA_TOKEN || fileToken,
        nouns: fileNouns,
    }

    if (settings.url) {
        const source = options?.haUrl ? 'config wizard' : process.env.HA_URL ? 'env' : 'ha_entities.json'
        console.log(`[HA] URL loaded from ${source}: ${settings.url}`)
    }
    if (settings.token) {
        const source = options?.haToken ? 'config wizard' : process.env.HA_TOKEN ? 'env' : 'ha_entities.json'
        console.log(`[HA] Token loaded from ${source}`)
    }

    return settings
}

/**
 * Check if a persisted HA config exists with URL, token and nouns.
 */
export const hasPersistedConfig = (): boolean => {
    const filePath = path.resolve('ha_entities.json')
    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(content)
        return !!(parsed.url && parsed.token && parsed.nouns && Object.keys(parsed.nouns).length > 0)
    } catch {
        return false
    }
}

/**
 * Load persisted config for help panel data (entities + selected IDs).
 * Reconstructs entity info from the noun mappings stored in ha_entities.json.
 */
export const loadPersistedConfig = (): {
    entities: Array<{ entity_id: string, friendly_name: string, domain: string }>
    selectedEntityIds: string[]
} => {
    const filePath = path.resolve('ha_entities.json')
    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(content)
        const nouns: Record<string, NounConfig> = parsed.nouns || {}

        const entities: Array<{ entity_id: string, friendly_name: string, domain: string }> = []
        const selectedEntityIds: string[] = []

        for (const config of Object.values(nouns)) {
            if (config.builtin) continue
            const entityId = config.r1?.entity
            if (!entityId) continue
            if (selectedEntityIds.includes(entityId)) continue
            selectedEntityIds.push(entityId)
            entities.push({
                entity_id: entityId,
                friendly_name: config.label || entityId,
                domain: entityId.split('.')[0],
            })
        }

        return { entities, selectedEntityIds }
    } catch {
        return { entities: [], selectedEntityIds: [] }
    }
}
