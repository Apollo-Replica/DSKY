"use client"

import { useEffect, useState, useRef, useCallback } from "react";
import { AUDIO_LOAD, NO_CONN, NO_CONN_UHOH } from "../utils/dskyStates";
import { chunkedUpdate, getChangedChunks } from "@/utils/chunks";
import { useSearchParams } from 'next/navigation'
import Alarms from "./alarms";
import ClientList from "./clientList";
import MenuOverlay from "./menu/menuOverlay";
import DskyKeyboard from "./menu/dskyKeyboard";
import DskyDisplayWrapper from "./menu/dskyDisplayWrapper";
import { SCREEN_AREA } from "./menu/constants";
import { CUSTOM_APP_RENDERERS } from "./appRegistry";
import type { ServerState } from "../types/serverState";

/** Aspect ratio of the DSKY chassis image */
const DSKY_AR = 484 / 558

export default function HomeContent({ envOled, envDisplay }: { envOled: boolean, envDisplay: string }) {
  const searchParams = useSearchParams()
  let oledMode = envOled ? 'yes' : 'no'
  if(searchParams.get('oled') === '0') oledMode = 'no'
  else if(searchParams.get('oled') === '1') oledMode = 'yes'

  let displayType = envDisplay
  if(searchParams.get('display')) displayType = searchParams.get('display') as string

  // View mode: query param ?view=screen overrides default 'full'
  const viewParam = searchParams.get('view')
  const [viewMode, setViewMode] = useState<'full' | 'screen'>(viewParam === 'screen' ? 'screen' : 'full')

  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode
  const toggleViewMode = useCallback(() => {
    const next = viewModeRef.current === 'full' ? 'screen' : 'full'
    setViewMode(next)
    const params = new URLSearchParams(window.location.search)
    if (next === 'full') params.delete('view')
    else params.set('view', 'screen')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [])

  const initialState = AUDIO_LOAD
  const [dskyState,setDskyState] = useState(initialState)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [audioFiles, setAudioFiles] = useState<Record<string, AudioBuffer> | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [serverState, setServerState] = useState<ServerState | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track how much the DSKY container has shrunk on narrow viewports (1 = full size)
  const [containerRatio, setContainerRatio] = useState(1)

  useEffect(() => {
    const update = () => {
      const idealWidth = window.innerHeight * 0.96 * DSKY_AR
      setContainerRatio(Math.min(1, window.innerWidth / idealWidth))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // --- sendKey and sendMessage ---

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


  // --- Audio loading ---

  const fetchAudioFiles = async () => {
    let sampleRate
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      sampleRate = 32000
    }
    const newAudioContext = new AudioContext({sampleRate})
    const newAudioFiles: Record<string, AudioBuffer> = {}
    for(let i=1; i<=11; i++){
      for(let j=0; j<5; j++){
        const res = await fetch(`audio/clicks${i}_${j}.mp3`)
        const arrayBuffer = await res.arrayBuffer()
        const audioBuffer = await newAudioContext.decodeAudioData(arrayBuffer)
        newAudioFiles[`${i}-${j}`] = audioBuffer
      }
    }
    setAudioContext(newAudioContext)
    setAudioFiles(newAudioFiles)
  }

  useEffect(()=>{ fetchAudioFiles() },[])

  // --- WebSocket connection ---

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
      if (ws?.readyState === WebSocket.OPEN && searchParams.get('agent') == "1") {
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
  }, [audioContext, connect, searchParams])

  // --- WebSocket message handling & keyboard relay ---

  useEffect(() => {
    if(!audioContext || !audioFiles) return
    const ws = wsRef.current
    if(!ws) return

    const hookData = {
      lastState: dskyState,
      audioContext,
      audioFiles,
      setDskyState
    }

    let animationLock = 0
    let queuedTimeout: NodeJS.Timeout | null

    const handleMessage = (event: MessageEvent) => {
      if(queuedTimeout) clearTimeout(queuedTimeout)
      const newState = JSON.parse(event.data);

      // Save server state
      if (newState.serverState) {
        setServerState(newState.serverState)
      }

      const changedChunks = getChangedChunks(hookData.lastState,newState)
      const animatedStateUpdate = () =>{
        animationLock = Date.now() + (30 * changedChunks.length) + 30
        chunkedUpdate(newState, hookData)
      }
      const remainingLockTime = animationLock - Date.now()
      if(remainingLockTime <= 0){
        animatedStateUpdate()
      }else{
        queuedTimeout = setTimeout(animatedStateUpdate, remainingLockTime)
      }
    }

    ws.addEventListener('message', handleMessage)

    // All key presses go to server — server decides whether menu or app handles them
    const relayKeyPress = (event: KeyboardEvent) => {
      if (event.repeat) return
      const key = event.key
      if (key.length === 1) {
        const currentWs = wsRef.current
        if (currentWs?.readyState === WebSocket.OPEN) {
          currentWs.send(key)
        }
        // Prevent default when menu is open to avoid page interactions
        if (serverState?.menu?.isOpen) {
          event.preventDefault()
        }
      }
    }
    const relayKeyRelease = (event: KeyboardEvent) => {
      if (serverState?.menu?.isOpen) return
      const currentWs = wsRef.current
      if((event.key == 'p' || event.key == 'P') && currentWs?.readyState === WebSocket.OPEN){
        currentWs.send('O')
      }
    }
    window.addEventListener('keydown', relayKeyPress);
    window.addEventListener('keyup', relayKeyRelease);

    return () => {
      ws.removeEventListener('message', handleMessage)
      window.removeEventListener('keydown', relayKeyPress);
      window.removeEventListener('keyup', relayKeyRelease);
    };
  }, [wsConnected, audioFiles, audioContext, serverState?.menu?.isOpen]);

  // --- No-connection state animation ---

  useEffect(()=>{
    if(!audioContext || !audioFiles) return

    const hookData = {
      lastState: dskyState,
      cancelUpdates: false,
      audioContext,
      audioFiles,
      setDskyState
    }

    let noConnTimeout1: ReturnType<typeof setTimeout> | undefined
    let noConnTimeout2: ReturnType<typeof setTimeout> | undefined
    let noConnInterval1: ReturnType<typeof setInterval> | undefined
    let noConnInterval2: ReturnType<typeof setInterval> | undefined
    if(!wsConnected) {
      noConnTimeout1 = setTimeout(()=> {
        noConnInterval1 = setInterval(()=> chunkedUpdate(NO_CONN, hookData),1000)
      }, 1000)
      noConnTimeout2 = setTimeout(()=> {
        noConnInterval2 = setInterval(()=> chunkedUpdate(NO_CONN_UHOH, hookData),1000)
      }, 2000)
    }

    return () => {
      if(noConnTimeout1) clearTimeout(noConnTimeout1)
      if(noConnTimeout2) clearTimeout(noConnTimeout2)
      if(noConnInterval1) clearInterval(noConnInterval1)
      if(noConnInterval2) clearInterval(noConnInterval2)
    };
  }, [wsConnected, audioFiles, audioContext]);

  // --- Render helpers ---

  const opacityEL = dskyState.Standby ? 0 : (dskyState.DisplayBrightness ?? 127) / 127
  const opacityStatus = (dskyState.StatusBrightness ?? 127) / 127

  // Determine which component to render in the display area
  const appId = serverState?.app?.id
  const CustomAppComponent = appId ? CUSTOM_APP_RENDERERS[appId] : undefined

  const renderDisplayContent = (mode: 'overlay' | 'screen') => {
    if (CustomAppComponent && serverState) {
      // Custom app (calculator, clock) — render its own component
      return (
        <div style={{
          position: 'absolute',
          left: mode === 'screen' ? 0 : `${SCREEN_AREA.left}%`,
          top: mode === 'screen' ? 0 : `${SCREEN_AREA.top}%`,
          width: mode === 'screen' ? '100%' : `${SCREEN_AREA.right - SCREEN_AREA.left}%`,
          height: mode === 'screen' ? '100%' : `${SCREEN_AREA.bottom - SCREEN_AREA.top}%`,
          zIndex: 3,
          overflow: 'hidden',
          containerType: 'size',
        }}>
          <CustomAppComponent serverState={serverState} />
        </div>
      )
    }
    // Default: EL Display
    return <DskyDisplayWrapper dskyState={dskyState} opacity={opacityEL} displayType={displayType} oledMode={oledMode} mode={mode} containerRatio={containerRatio} />
  }

  if (viewMode === 'full') {
    // Full DSKY skin
    return (
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
      }}>
        <div style={{
          position: 'relative',
          width: `min(calc(96vh * ${DSKY_AR}), 100vw)`,
          aspectRatio: '484 / 558',
        }}>

          {/* Screen background color */}
          <div style={{
            position: 'absolute',
            left: `${SCREEN_AREA.left}%`,
            top: `${SCREEN_AREA.top}%`,
            width: `${SCREEN_AREA.width}%`,
            height: `${SCREEN_AREA.height}%`,
            backgroundColor: oledMode === 'yes' ? '#000' : '#3f3b30',
            zIndex: 0,
          }} />

          {/* DSKY chassis image */}
          <img
            src="./dsky.png"
            alt="DSKY unit"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', zIndex: 2, pointerEvents: 'none' }}
          />

          {/* Display content (EL or custom app) — hidden when menu is open */}
          {!serverState?.menu?.isOpen && renderDisplayContent('overlay')}

          {/* Alarm indicators */}
          <Alarms dskyState={dskyState} opacity={opacityStatus} />

          {/* Keyboard buttons */}
          <DskyKeyboard sendKey={sendKey} />

          {/* Menu overlay */}
          <MenuOverlay
            serverState={serverState}
            clients={dskyState?.clients || []}
            wsConnected={wsConnected}
            sendMessage={sendMessage}
          />
        </div>
        <ClientList clients={dskyState?.clients || []} />
        <ViewToggle viewMode={viewMode} onToggle={toggleViewMode} />
      </main>
    )
  }

  // Screen-only mode
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: oledMode === 'yes' ? '#000' : '#3f3b30',
    }}>
      <div className="screen-mode-layout">
        <div className="screen-mode-alarms">
          <Alarms dskyState={dskyState} opacity={opacityStatus} mode="screen" />
        </div>
        <div className="screen-mode-display">
          {!serverState?.menu?.isOpen && renderDisplayContent('screen')}
          <MenuOverlay
            serverState={serverState}
            clients={dskyState?.clients || []}
            wsConnected={wsConnected}
            sendMessage={sendMessage}
            mode="screen"
          />
        </div>
      </div>
      <ClientList clients={dskyState?.clients || []} />
      <ViewToggle viewMode={viewMode} onToggle={toggleViewMode} />
    </main>
  );
}

function ViewToggle({ viewMode, onToggle }: { viewMode: 'full' | 'screen'; onToggle: () => void }) {
  const isFull = viewMode === 'full'
  return (
    <div className="view-toggle" onClick={onToggle} title={isFull ? 'Screen only' : 'Full DSKY'}>
      <div className="toggle-panel">
        {/* Corner screws */}
        <div className="toggle-screw" style={{ top: 3, left: 3 }} />
        <div className="toggle-screw" style={{ top: 3, right: 3 }} />
        <div className="toggle-screw" style={{ bottom: 3, left: 3 }} />
        <div className="toggle-screw" style={{ bottom: 3, right: 3 }} />

        {/* Fixed labels — both always visible */}
        <div className={`toggle-label ${isFull ? 'toggle-label-active' : ''}`}>FULL</div>

        {/* Switch housing + lever */}
        <div className="toggle-housing">
          <div className={`toggle-lever ${isFull ? 'toggle-up' : 'toggle-down'}`}>
            <div className="toggle-knob" />
          </div>
        </div>

        <div className={`toggle-label ${!isFull ? 'toggle-label-active' : ''}`}>SCR</div>
      </div>
    </div>
  )
}
