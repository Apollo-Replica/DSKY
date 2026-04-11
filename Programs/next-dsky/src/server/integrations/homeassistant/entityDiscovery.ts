import * as fs from 'fs'
import * as path from 'path'
import {
    createConnection,
    createLongLivedTokenAuth,
    getStates,
} from 'home-assistant-js-websocket'
import { NounConfig } from './types'
import { assignNouns } from '../../../utils/nounAssignment'
import type { DiscoveredEntity } from '../../../types/config'

export type { DiscoveredEntity }

const SUPPORTED_DOMAINS = ['switch', 'light', 'sensor', 'binary_sensor', 'climate']

// HA internal integrations that are not real user devices
const EXCLUDED_PREFIXES = [
    'sensor.backup_', 'sensor.sun_', 'sensor.sun.',
    'binary_sensor.backup_',
]
const EXCLUDED_ENTITY_IDS = new Set([
    'sensor.backup_backup_manager_state',
    'sensor.backup_next_scheduled_automatic_backup',
    'sensor.backup_last_successful_automatic_backup',
    'sensor.backup_last_attempted_automatic_backup',
    'sensor.sun_next_dawn',
    'sensor.sun_next_dusk',
    'sensor.sun_next_midnight',
    'sensor.sun_next_noon',
    'sensor.sun_next_rising',
    'sensor.sun_next_setting',
])

function isUserEntity(entityId: string, state: string): boolean {
    if (EXCLUDED_ENTITY_IDS.has(entityId)) return false
    for (const prefix of EXCLUDED_PREFIXES) {
        if (entityId.startsWith(prefix)) return false
    }
    if (state === 'unavailable' || state === 'unknown') return false
    return true
}

export async function discoverEntities(url: string, token: string): Promise<DiscoveredEntity[]> {
    const auth = createLongLivedTokenAuth(url, token)
    const connection = await createConnection({ auth })

    try {
        const states = await getStates(connection)
        return states
            .filter(entity => {
                const domain = entity.entity_id.split('.')[0]
                if (!SUPPORTED_DOMAINS.includes(domain)) return false
                return isUserEntity(entity.entity_id, entity.state)
            })
            .map(entity => ({
                entity_id: entity.entity_id,
                friendly_name: entity.attributes.friendly_name || entity.entity_id,
                domain: entity.entity_id.split('.')[0],
                device_class: entity.attributes.device_class,
            }))
            .sort((a, b) => {
                if (a.domain !== b.domain) return a.domain.localeCompare(b.domain)
                return a.friendly_name.localeCompare(b.friendly_name)
            })
    } finally {
        connection.close()
    }
}

function entityToNounConfig(entity: DiscoveredEntity): NounConfig {
    const { entity_id, friendly_name, domain } = entity

    switch (domain) {
        case 'switch':
        case 'binary_sensor':
            return {
                label: friendly_name,
                r1: { entity: entity_id },
            }
        case 'light':
            return {
                label: friendly_name,
                r1: { entity: entity_id },
                r2: { entity: entity_id, attribute: 'brightness' },
            }
        case 'sensor':
            return {
                label: friendly_name,
                r1: { entity: entity_id, scale: 100 },
            }
        case 'climate':
            return {
                label: friendly_name,
                r1: { entity: entity_id, attribute: 'current_temperature', scale: 100 },
                r2: { entity: entity_id, attribute: 'current_humidity', scale: 100 },
                r3: { entity: entity_id, attribute: 'temperature', scale: 100 },
            }
        default:
            return {
                label: friendly_name,
                r1: { entity: entity_id },
            }
    }
}

export function generateNounMappings(
    selectedEntityIds: string[],
    allEntities: DiscoveredEntity[]
): Record<string, NounConfig> {
    const assignments = assignNouns(selectedEntityIds, allEntities)
    const nouns: Record<string, NounConfig> = {}

    for (const assignment of assignments) {
        const entity = allEntities.find(e => e.entity_id === assignment.entityId)
        if (!entity) continue
        nouns[assignment.noun] = entityToNounConfig(entity)
    }

    return nouns
}

export function persistNounMappings(
    nouns: Record<string, NounConfig>,
    url?: string,
    token?: string
): void {
    const filePath = path.resolve('ha_entities.json')
    const data: Record<string, any> = { nouns }
    if (url) data.url = url
    if (token) data.token = token
    const content = JSON.stringify(data, null, 2)
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`[HA] Persisted ${Object.keys(nouns).length} noun mappings to ${filePath}`)
}
