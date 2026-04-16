"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import type { ServerState } from '../../types/serverState'

/**
 * Lightweight hook that connects to the DSKY WebSocket and tracks ServerState.
 * Used by config pages (HA setup, etc.) that only need server state + messaging,
 * not audio or DSKY display animation.
 */
export function useServerState() {
    const [serverState, setServerState] = useState<ServerState | null>(null)
    const [wsConnected, setWsConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const mountedRef = useRef(true)

    const sendMessage = useCallback((type: string, data?: Record<string, unknown>) => {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, ...data }))
        }
    }, [])

    useEffect(() => {
        mountedRef.current = true
        let reconnectTimeout: NodeJS.Timeout | null = null

        const connect = () => {
            if (!mountedRef.current) return
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const wsURL = `${protocol}//${window.location.host}/ws`
            const ws = new WebSocket(wsURL)
            wsRef.current = ws

            ws.onopen = () => {
                if (mountedRef.current) setWsConnected(true)
            }
            ws.onclose = () => {
                if (mountedRef.current) {
                    setWsConnected(false)
                    reconnectTimeout = setTimeout(connect, 1000)
                }
            }
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.serverState && mountedRef.current) {
                    setServerState(data.serverState)
                }
            }
        }

        connect()

        return () => {
            mountedRef.current = false
            if (reconnectTimeout) clearTimeout(reconnectTimeout)
            wsRef.current?.close()
            wsRef.current = null
        }
    }, [])

    return { serverState, wsConnected, sendMessage }
}
