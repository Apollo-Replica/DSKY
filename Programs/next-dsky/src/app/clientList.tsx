interface Client {
    country?: string
    you?: boolean
}

interface GroupedClient {
    country: string | null
    count: number
    hasYou: boolean
}

function groupClients(clients: Client[]): GroupedClient[] {
    const map = new Map<string | null, GroupedClient>()
    for (const c of clients) {
        const key = c.country?.toLowerCase() ?? null
        const existing = map.get(key)
        if (existing) {
            existing.count++
            if (c.you) existing.hasYou = true
        } else {
            map.set(key, { country: key, count: 1, hasYou: !!c.you })
        }
    }
    return Array.from(map.values())
}

const ClientList = ({ clients }: { clients: Client[] | never[] }) => {
    const groups = groupClients(clients as Client[])

    return (
        <div className="clientList">
            {groups.map((group) => (
                <div
                    key={group.country ?? 'unknown'}
                    className={`client-box ${group.hasYou ? 'you' : ''}`}
                >
                    {group.country ? (
                        <img
                            src={`https://cdn.jsdelivr.net/npm/flag-icons@6.3.0/flags/4x3/${group.country}.svg`}
                            alt={`${group.country} flag`}
                            className="client-flag"
                        />
                    ) : (
                        <span className="client-unknown">👤</span>
                    )}
                    {group.count > 1 && (
                        <span className="client-count">{group.count}</span>
                    )}
                </div>
            ))}
        </div>
    )
}

export default ClientList
