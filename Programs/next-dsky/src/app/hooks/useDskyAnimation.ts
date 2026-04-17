"use client"

import { useEffect, useState } from 'react'
import { AUDIO_LOAD, NO_CONN, NO_CONN_UHOH } from '../../utils/dskyStates'
import { chunkedUpdate, getChangedChunks } from '@/utils/chunks'
import type { ServerState } from '../../types/serverState'

interface UseDskyAnimationOptions {
    wsRef: React.MutableRefObject<WebSocket | null>
    wsConnected: boolean
    audioContext: AudioContext | null
    audioFiles: Record<string, AudioBuffer> | null
    serverState: ServerState | null
    mutedRef: React.MutableRefObject<boolean>
}

/**
 * Manages DSKY display state: chunked animation on WS messages,
 * keyboard relay to server, and no-connection fallback animation.
 */
export function useDskyAnimation({
    wsRef,
    wsConnected,
    audioContext,
    audioFiles,
    serverState,
    mutedRef,
}: UseDskyAnimationOptions) {
    const [dskyState, setDskyState] = useState(AUDIO_LOAD)

    // --- Chunked animation + keyboard relay ---
    useEffect(() => {
        if (!audioContext || !audioFiles) return
        const ws = wsRef.current
        if (!ws) return

        const hookData = {
            lastState: dskyState,
            audioContext,
            audioFiles,
            setDskyState,
            muted: mutedRef,
        }

        let animationLock = 0
        let queuedTimeout: NodeJS.Timeout | null

        const handleMessage = (event: MessageEvent) => {
            if (queuedTimeout) clearTimeout(queuedTimeout)
            const newState = JSON.parse(event.data)

            const changedChunks = getChangedChunks(hookData.lastState, newState)
            const animatedStateUpdate = () => {
                animationLock = Date.now() + 30 * changedChunks.length + 30
                chunkedUpdate(newState, hookData)
            }
            const remainingLockTime = animationLock - Date.now()
            if (remainingLockTime <= 0) {
                animatedStateUpdate()
            } else {
                queuedTimeout = setTimeout(animatedStateUpdate, remainingLockTime)
            }
        }

        ws.addEventListener('message', handleMessage)

        const isTypingTarget = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) return false
            const tag = target.tagName
            return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
        }
        const relayKeyPress = (event: KeyboardEvent) => {
            if (event.repeat) return
            if (isTypingTarget(event.target)) return
            const key = event.key
            if (key.length === 1) {
                const currentWs = wsRef.current
                if (currentWs?.readyState === WebSocket.OPEN) {
                    currentWs.send(key)
                }
                if (serverState?.menu?.isOpen) {
                    event.preventDefault()
                }
            }
        }
        const relayKeyRelease = (event: KeyboardEvent) => {
            if (serverState?.menu?.isOpen) return
            if (isTypingTarget(event.target)) return
            const currentWs = wsRef.current
            if ((event.key == 'p' || event.key == 'P') && currentWs?.readyState === WebSocket.OPEN) {
                currentWs.send('O')
            }
        }
        window.addEventListener('keydown', relayKeyPress)
        window.addEventListener('keyup', relayKeyRelease)

        return () => {
            ws.removeEventListener('message', handleMessage)
            window.removeEventListener('keydown', relayKeyPress)
            window.removeEventListener('keyup', relayKeyRelease)
        }
    }, [wsConnected, audioFiles, audioContext, serverState?.menu?.isOpen])

    // --- No-connection fallback animation ---
    useEffect(() => {
        if (!audioContext || !audioFiles) return

        const hookData = {
            lastState: dskyState,
            cancelUpdates: false,
            audioContext,
            audioFiles,
            setDskyState,
            muted: mutedRef,
        }

        let noConnTimeout1: ReturnType<typeof setTimeout> | undefined
        let noConnTimeout2: ReturnType<typeof setTimeout> | undefined
        let noConnInterval1: ReturnType<typeof setInterval> | undefined
        let noConnInterval2: ReturnType<typeof setInterval> | undefined
        if (!wsConnected) {
            noConnTimeout1 = setTimeout(() => {
                noConnInterval1 = setInterval(() => chunkedUpdate(NO_CONN, hookData), 1000)
            }, 1000)
            noConnTimeout2 = setTimeout(() => {
                noConnInterval2 = setInterval(() => chunkedUpdate(NO_CONN_UHOH, hookData), 1000)
            }, 2000)
        }

        return () => {
            if (noConnTimeout1) clearTimeout(noConnTimeout1)
            if (noConnTimeout2) clearTimeout(noConnTimeout2)
            if (noConnInterval1) clearInterval(noConnInterval1)
            if (noConnInterval2) clearInterval(noConnInterval2)
        }
    }, [wsConnected, audioFiles, audioContext])

    return dskyState
}
