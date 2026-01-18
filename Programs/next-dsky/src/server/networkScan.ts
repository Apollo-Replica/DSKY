import * as net from 'net'
import * as os from 'os'
import { DiscoveredAPI } from './configState'

const SCAN_TIMEOUT = 200 // ms
const DSKY_PORTS = [3001, 3000] // Default DSKY API ports

const getLocalSubnets = (): string[] => {
    const interfaces = os.networkInterfaces()
    const subnets: string[] = []

    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name]
        if (!iface) continue

        for (const info of iface) {
            // Skip internal and non-IPv4 addresses
            if (info.internal || info.family !== 'IPv4') continue

            // Extract subnet (first 3 octets)
            const parts = info.address.split('.')
            if (parts.length === 4) {
                subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`)
            }
        }
    }

    return subnets
}

const checkPort = (ip: string, port: number): Promise<boolean> => {
    return new Promise((resolve) => {
        const socket = new net.Socket()

        socket.setTimeout(SCAN_TIMEOUT)

        socket.on('connect', () => {
            socket.destroy()
            resolve(true)
        })

        socket.on('timeout', () => {
            socket.destroy()
            resolve(false)
        })

        socket.on('error', () => {
            socket.destroy()
            resolve(false)
        })

        socket.connect(port, ip)
    })
}

const verifyDSKYApi = async (ip: string, port: number): Promise<boolean> => {
    // For now, just check if port is open
    // A more thorough check would attempt WebSocket connection
    // and verify the response format
    return await checkPort(ip, port)
}

export const scanForDSKYApis = async (onProgress?: (current: number, total: number) => void): Promise<DiscoveredAPI[]> => {
    const subnets = getLocalSubnets()
    const results: DiscoveredAPI[] = []
    const scanPromises: Promise<DiscoveredAPI | null>[] = []

    let completed = 0
    const total = subnets.length * 254 * DSKY_PORTS.length

    for (const subnet of subnets) {
        for (let i = 1; i <= 254; i++) {
            const ip = `${subnet}.${i}`

            for (const port of DSKY_PORTS) {
                const promise = (async (): Promise<DiscoveredAPI | null> => {
                    const isOpen = await verifyDSKYApi(ip, port)
                    completed++

                    if (onProgress) {
                        onProgress(completed, total)
                    }

                    if (isOpen) {
                        const protocol = port === 443 ? 'wss' : 'ws'
                        const path = port === 443 ? '/ws' : ''
                        return {
                            ip,
                            port,
                            url: `${protocol}://${ip}:${port}${path}`,
                            name: ip
                        }
                    }
                    return null
                })()

                scanPromises.push(promise)
            }
        }
    }

    // Run all scans in parallel with some concurrency control
    const batchSize = 100
    for (let i = 0; i < scanPromises.length; i += batchSize) {
        const batch = scanPromises.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch)

        for (const result of batchResults) {
            if (result) {
                // Skip our own IP
                const localIps = getLocalIps()
                if (!localIps.includes(result.ip)) {
                    results.push(result)
                }
            }
        }
    }

    return results
}

const getLocalIps = (): string[] => {
    const interfaces = os.networkInterfaces()
    const ips: string[] = []

    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name]
        if (!iface) continue

        for (const info of iface) {
            if (info.family === 'IPv4') {
                ips.push(info.address)
            }
        }
    }

    return ips
}
