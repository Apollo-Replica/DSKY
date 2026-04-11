export const RESERVED_NOUNS = ['36', '65']

export interface NounAssignment {
    noun: string
    entityId: string
    friendlyName: string
    domain: string
    toggleable: boolean
}

export function assignNouns(
    selectedEntityIds: string[],
    entities: Array<{ entity_id: string, friendly_name: string, domain: string }>
): NounAssignment[] {
    const assignments: NounAssignment[] = []
    let nounId = 1

    for (const entityId of selectedEntityIds) {
        while (RESERVED_NOUNS.includes(String(nounId).padStart(2, '0')) && nounId < 100) {
            nounId++
        }
        if (nounId >= 100) break

        const entity = entities.find(e => e.entity_id === entityId)
        if (!entity) continue

        assignments.push({
            noun: String(nounId).padStart(2, '0'),
            entityId: entity.entity_id,
            friendlyName: entity.friendly_name,
            domain: entity.domain,
            toggleable: entity.domain === 'switch' || entity.domain === 'light',
        })
        nounId++
    }

    return assignments
}
