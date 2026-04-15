import * as os from 'os'
import type { NetworkInterfaceOption } from '../types/serverState'

/**
 * Detect available IPv4 network interfaces, sorted by RFC1918 preference.
 */
export function detectNetworkInterfaces(): NetworkInterfaceOption[] {
    const result: NetworkInterfaceOption[] = []
    const ifaces = os.networkInterfaces()

    for (const [name, entries] of Object.entries(ifaces)) {
        for (const entry of entries || []) {
            if (entry.family !== 'IPv4') continue
            if (entry.internal) continue
            if (entry.address.startsWith('169.254.')) continue // Skip APIPA
            result.push({ name, ip: entry.address })
            break // one IPv4 per interface is enough
        }
    }

    const score = (ip: string) => {
        const parts = ip.split('.').map(n => parseInt(n, 10))
        if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return 0
        const [a, b] = parts
        if (a === 192 && b === 168) return 3
        if (a === 10) return 2
        if (a === 172 && b >= 16 && b <= 31) return 1
        return 0
    }

    return result.sort((a, b) => score(b.ip) - score(a.ip) || a.name.localeCompare(b.name))
}

/**
 * Pick the best interface for mDNS multicast (highest RFC1918 score).
 * Returns null if no suitable interface found.
 */
export function pickBestInterface(): string | null {
    const interfaces = detectNetworkInterfaces()
    return interfaces.length > 0 ? interfaces[0].ip : null
}
