import { NounConfig } from './types'
import { RESERVED_NOUNS } from '../../../utils/nounAssignment'

const DEFAULT_NOUNS: Record<string, NounConfig> = Object.fromEntries(
    RESERVED_NOUNS.map(n => [n, { builtin: 'clock' }])
)

export class NounRegistry {
    private config: Record<string, NounConfig>
    private values: Record<string, [number, number, number]> = {}
    private entityToNoun: Map<string, { nounId: string, register: 0 | 1 | 2 }[]> = new Map()

    constructor(nounConfigs: Record<string, NounConfig>) {
        this.config = { ...DEFAULT_NOUNS, ...nounConfigs }
        this.buildEntityIndex()
    }

    private buildEntityIndex(): void {
        this.entityToNoun.clear()
        for (const [nounId, config] of Object.entries(this.config)) {
            if (config.builtin) continue
            const registers = [config.r1, config.r2, config.r3] as const
            registers.forEach((reg, i) => {
                if (!reg?.entity) return
                const existing = this.entityToNoun.get(reg.entity) || []
                existing.push({ nounId, register: i as 0 | 1 | 2 })
                this.entityToNoun.set(reg.entity, existing)
            })
        }
    }

    getNounValues(id: string): [number, number, number] {
        const config = this.config[id]
        if (!config) return [-1, -1, -1]

        if (config.builtin === 'clock') {
            const now = new Date()
            return [now.getHours(), now.getMinutes(), now.getSeconds() * 100]
        }

        return this.values[id] || [-1, -1, -1]
    }

    setNounValue(id: string, register: 0 | 1 | 2, value: number): void {
        if (!this.values[id]) {
            this.values[id] = [-1, -1, -1]
        }
        this.values[id][register] = value
    }

    updateFromEntity(entityId: string, state: string, attributes?: Record<string, any>): void {
        const mappings = this.entityToNoun.get(entityId)
        if (!mappings) return

        for (const { nounId, register } of mappings) {
            const config = this.config[nounId]
            const regConfig = [config.r1, config.r2, config.r3][register]
            if (!regConfig) continue

            const attr = regConfig.attribute || 'state'
            const scale = regConfig.scale || 1
            const rawValue = attr === 'state' ? state : attributes?.[attr]

            // Handle text states (on/off, open/closed, etc.)
            if (rawValue === 'on') {
                this.setNounValue(nounId, register, 1)
            } else if (rawValue === 'off') {
                this.setNounValue(nounId, register, 0)
            } else if (rawValue === 'unavailable' || rawValue === 'unknown') {
                this.setNounValue(nounId, register, -1)
            } else {
                const numValue = parseFloat(rawValue)
                if (!isNaN(numValue)) {
                    this.setNounValue(nounId, register, Math.round(numValue * scale))
                }
            }
        }
    }

    getSubscribedEntities(): string[] {
        return Array.from(this.entityToNoun.keys())
    }

    hasNoun(id: string): boolean {
        return id in this.config
    }

    getNounEntity(id: string, register: 0 | 1 | 2): string | undefined {
        const config = this.config[id]
        if (!config) return undefined
        const reg = [config.r1, config.r2, config.r3][register]
        return reg?.entity
    }
}
