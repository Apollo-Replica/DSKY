"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import type { ServerState } from '../../types/serverState'

interface UseWebSocketOptions {
    audioContext: AudioContext | null
    agentMode: boolean
}

interface UseWebSocketResult {
    wsRef: React.MutableRefObject<WebSocket | null>
    wsConnected: boolean
    serverState: ServerState | null
    sendKey: (key: string) => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
}

export function useWebSocket({ audioContext, agentMode }: UseWebSocketOptions): UseWebSocketResult {
    const [wsConnected, setWsConnected] = useState(false)
    const [serverState, setServerState] = useState<ServerState | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const mountedRef = useRef(true)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const sendKey = useCallback((key: string) => {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(key)
        }
    }, [])

    const sendMessage = useCallback((type: string, data?: Record<string, unknown>) => {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, ...data }))
        }
    }, [])

    const connect = useCallback(() => {
        if (!mountedRef.current || !audioContext) return
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
            return
        }

        console.log('[DSKY] Connecting WebSocket...')
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsURL = `${protocol}//${window.location.host}/ws`

        const ws = new WebSocket(wsURL)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('[DSKY] WebSocket connected')
            if (mountedRef.current) setWsConnected(true)
        }

        ws.onclose = (event) => {
            console.log('[DSKY] WebSocket closed. Code:', event.code)
            if (mountedRef.current) {
                setWsConnected(false)
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) connect()
                }, 1000)
            }
        }

        ws.onerror = () => {
            console.log('[DSKY] WebSocket error')
        }
    }, [audioContext])

    useEffect(() => {
        if (!audioContext) return

        mountedRef.current = true
        connect()

        const agentInterval = setInterval(() => {
            const ws = wsRef.current
            if (ws?.readyState === WebSocket.OPEN && agentMode) {
                ws.send("agent")
            }
        }, 1000)

        return () => {
            console.log('[DSKY] Cleanup - unmounting')
            mountedRef.current = false
            clearInterval(agentInterval)
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [audioContext, connect, agentMode])

    // Update server state from messages
    useEffect(() => {
        const ws = wsRef.current
        if (!ws) return

        const handleServerState = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.serverState) {
                    setServerState(data.serverState)
                }
            } catch {
                // ignore non-JSON messages
            }
        }

        ws.addEventListener('message', handleServerState)
        return () => ws.removeEventListener('message', handleServerState)
    }, [wsConnected])

    return { wsRef, wsConnected, serverState, sendKey, sendMessage }
}
