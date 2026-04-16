import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { V35_TEST } from '../utils/dskyStates'
import type { ServerState } from '../types/serverState'

let wss: WebSocketServer | null = null
let listener: (data: Buffer) => Promise<void> = async (_data) => {}
export const setWebSocketListener = (newListener: (data: Buffer) => Promise<void>) => { listener = newListener }

let messageListener: ((type: string, data?: any) => void) | null = null
export const setMessageListener = (newListener: (type: string, data?: any) => void) => {
    messageListener = newListener
}

let state = V35_TEST
let currentServerState: ServerState | null = null
let clientsData = new Map<WebSocket, { country?: string, ip: string }>()

// Function to get the country from an IP (simplified - no geoip for now)
const getCountryFromIp = (_ip: string): string | undefined => {
    // For simplicity, we're not using geoip-lite here
    // Can be added back if needed
    return undefined
}

const getClientIp = (req: IncomingMessage): string => {
    const forwardedFor = req.headers['x-forwarded-for']
    if (forwardedFor) {
        // In case there are multiple proxies, use the first IP address
        const firstIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]
        return firstIp.trim()
    }
    return req.socket.remoteAddress?.replace(/^.*:/, '') || 'unknown' // Extract IPv4 address
}

const getStateMessage = (connection: WebSocket, dskyState: any): string => {
    // Get the IP address of the current connection
    const currentIp = clientsData.get(connection)?.ip

    // Create the clients array with the "you" field set based on IP match
    const clientsArray = Array.from(clientsData.values()).map(client => ({
        ...client,
        you: client.ip === currentIp,
        ip: undefined
    }))

    return JSON.stringify({
        ...dskyState,
        serverState: currentServerState,
        clients: clientsArray
    })
}

const handleClientMessage = (message: string): boolean => {
    try {
        const data = JSON.parse(message)
        if (data.type && (data.type.startsWith('action:') || data.type.startsWith('config:'))) {
            if (messageListener) {
                messageListener(data.type, data)
            }
            return true
        }
    } catch (e) {
        // Not JSON, not a structured message
    }
    return false
}

export const initWebSocket = (webSocketServer: WebSocketServer) => {
    wss = webSocketServer

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        console.log(`[WS] Client connected from ${req.socket.remoteAddress}`)
        
        ws.on('error', (err) => {
            console.error('[WS] WebSocket error:', err)
        })
        
        ws.on('message', (data: Buffer) => {
            const message = data.toString()
            if (message === 'agent') {
                clientsData.delete(ws)
                return
            }
            // Check if it's a structured message (action:* or config:*)
            if (handleClientMessage(message)) {
                return
            }
            listener(data)
        })

        ws.on('close', (code, reason) => {
            console.log(`[WS] Client disconnected. Code: ${code}, Reason: ${reason?.toString() || 'none'}`)
            clientsData.delete(ws)
            updateWebSocketState(state) // Notify clients about the disconnection
        })

        // Get client's IP address
        const ip = getClientIp(req)
        const country = getCountryFromIp(ip)

        // Add client data to clients map
        clientsData.set(ws, { country, ip })

        const initialMessage = getStateMessage(ws, state)
        console.log(`[WS] Sending initial state to client (${initialMessage.length} bytes)`)
        try {
            ws.send(initialMessage, (err) => {
                if (err) {
                    console.error('[WS] Error sending initial state:', err)
                } else {
                    console.log('[WS] Initial state sent successfully')
                }
            })
        } catch (e) {
            console.error('[WS] Exception sending initial state:', e)
        }
    })
}

// Function to notify all WebSocket clients
export const updateWebSocketState = (newState: any) => {
    if (!wss) return

    if (JSON.stringify(state) !== JSON.stringify(newState)) {
        state = newState

        for (const connection of wss.clients) {
            if (connection.readyState === WebSocket.OPEN) {
                const newPacket = getStateMessage(connection as WebSocket, newState)
                connection.send(newPacket)
            }
        }
    }
}

export const getWebSocket = (): WebSocketServer | null => {
    return wss
}

// Broadcast server state to all clients
export const broadcastServerState = (serverState: ServerState) => {
    if (!wss) return

    currentServerState = serverState

    for (const connection of wss.clients) {
        if (connection.readyState === WebSocket.OPEN) {
            const newPacket = getStateMessage(connection as WebSocket, state)
            connection.send(newPacket)
        }
    }
}
