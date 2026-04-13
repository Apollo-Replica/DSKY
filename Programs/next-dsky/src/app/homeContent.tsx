"use client"

import { useEffect, useState, useRef, useCallback } from "react";
import { AUDIO_LOAD, NO_CONN, NO_CONN_UHOH } from "../utils/dskyStates";
import { chunkedUpdate, getChangedChunks } from "@/utils/chunks";
import { useSearchParams } from 'next/navigation'
import ELDisplay from "./elDisplay";
import Alarms from "./alarms";
import ClientList from "./clientList";
import MenuOverlay from "./menu/menuOverlay";
import { useMenuNavigation } from "./menu/useMenuNavigation";
import { MAIN_SCREEN_ITEM_COUNT } from "./menu/screens/mainScreen";
import { SIMULATE_SCREEN_ITEM_COUNT } from "./menu/screens/simulateScreen";
import { getConnectScreenItemCount } from "./menu/screens/connectScreen";
import { getSettingsScreenItemCount } from "./menu/screens/settingsScreen";
import { APPS_SCREEN_ITEM_COUNT } from "./menu/screens/appsScreen";
import DskyKeyboard from "./menu/dskyKeyboard";
import DskyDisplayWrapper from "./menu/dskyDisplayWrapper";
import { SCREEN_AREA } from "./menu/constants";
import type { ConfigState } from "../types/config";

type ViewMode = 'screen' | 'full'

/** Aspect ratio of the DSKY chassis image */
const DSKY_AR = 484 / 558

export default function HomeContent({ envOled, envDisplay }: { envOled: boolean, envDisplay: string }) {
  const searchParams = useSearchParams()
  let oledMode = envOled ? 'yes' : 'no'
  if(searchParams.get('oled') === '0') oledMode = 'no'
  else if(searchParams.get('oled') === '1') oledMode = 'yes'

  let displayType = envDisplay
  if(searchParams.get('display')) displayType = searchParams.get('display') as string

  const initialState = AUDIO_LOAD
  const [dskyState,setDskyState] = useState(initialState)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [audioFiles, setAudioFiles] = useState<Record<string, AudioBuffer> | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [configState, setConfigState] = useState<ConfigState | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasRedirectedRef = useRef(false)

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

  // --- sendKey and menu hook ---

  const sendKey = useCallback((key: string) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(key)
    }
  }, [])

  const sendConfigMessage = useCallback((type: string, data?: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }))
    }
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'full' ? 'screen' : 'full')
  }, [])

  const menu = useMenuNavigation({ sendKey })

  // When server sends 'source' step, open menu instead (only once)
  const menuOpenedForSourceRef = useRef(false)
  useEffect(() => {
    const configReady = configState?.ready !== false
    if (!configReady && configState && configState.step === 'source' && !menuOpenedForSourceRef.current) {
      menuOpenedForSourceRef.current = true
      menu.openMenu()
    }
    if (configReady) {
      menuOpenedForSourceRef.current = false
    }
  }, [configState?.step, configState?.ready, menu.openMenu])

  const getItemCountForScreen = useCallback(() => {
    switch (menu.menuState.activeScreen) {
      case 'main': return MAIN_SCREEN_ITEM_COUNT
      case 'simulate': return SIMULATE_SCREEN_ITEM_COUNT
      case 'connect': return getConnectScreenItemCount(configState)
      case 'settings': return getSettingsScreenItemCount()
      case 'apps': return APPS_SCREEN_ITEM_COUNT
      default: return 0 // app screens (calculator, clock, games) handle their own keys
    }
  }, [menu.menuState.activeScreen, configState])

  // Refs for latest menu functions (avoids stale closures)
  const menuRef = useRef(menu)
  menuRef.current = menu
  const getItemCountRef = useRef(getItemCountForScreen)
  getItemCountRef.current = getItemCountForScreen

  // App key handler — apps register their own handler to intercept keys
  const appKeyHandlerRef = useRef<((key: string) => void) | null>(null)

  // Triple-N detection inside apps (to navigate back to menu)
  // Counts consecutive 'n' presses — no timer, no buffering, instant action
  const appNounStreak = useRef(0)

  const handleMenuKeyRef = useRef((key: string) => {})
  handleMenuKeyRef.current = (key: string) => {
    if (appKeyHandlerRef.current) {
      if (key === 'n') {
        appNounStreak.current++
        if (appNounStreak.current >= 3) {
          appNounStreak.current = 0
          menuRef.current.navigateBack()
          return
        }
      } else {
        appNounStreak.current = 0
      }
      appKeyHandlerRef.current(key)
      return
    }

    const m = menuRef.current
    const maxItems = getItemCountRef.current()
    switch (key) {
      case '+':
      case 'v':
        if (maxItems > 0) m.moveSelection(-1, maxItems)
        break
      case '-':
      case 'n':
        if (maxItems > 0) m.moveSelection(1, maxItems)
        break
      case 'e':
      case 'p': {
        const selected = document.querySelector<HTMLElement>('[data-menu-card="true"][aria-selected="true"]')
        if (selected) {
          selected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        }
        break
      }
      case 'c':
      case 'r':
        m.navigateBack()
        break
      case 'k':
        m.closeMenu()
        break
      default:
        if (/^[1-9]$/.test(key)) {
          const idx = parseInt(key) - 1
          if (idx < maxItems) {
            m.setSelectedIndex(idx)
          }
        }
    }
  }

  const sendKeyWithMenu = useCallback((key: string) => {
    const consumed = menuRef.current.handleKeyEvent(key)
    if (consumed) {
      if (menuRef.current.menuState.isOpen) {
        handleMenuKeyRef.current(key)
      }
      return
    }
    sendKey(key)
  }, [sendKey])

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

      // Always save config state (for wizard and menu panels)
      if (newState.config) {
        setConfigState(newState.config)
      }

      // If config not ready, don't process DSKY display state
      if (newState.config && !newState.config.ready) {
        return
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

    const relayKeyPress = (event: KeyboardEvent) => {
      if (event.repeat) return
      const key = event.key

      if (key.length === 1) {
        const consumed = menuRef.current.handleKeyEvent(key)
        if (consumed) {
          if (menuRef.current.menuState.isOpen) {
            handleMenuKeyRef.current(key)
          }
          event.preventDefault()
          return
        }
      }

      const currentWs = wsRef.current
      if(key.length == 1 && currentWs?.readyState === WebSocket.OPEN){
        currentWs.send(key)
      }
    }
    const relayKeyRelease = (event: KeyboardEvent) => {
      if (menuRef.current.menuState.isOpen) return
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
  }, [wsConnected, audioFiles, audioContext]);

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

  // --- Render ---

  const opacityEL = dskyState.Standby ? 0 : (dskyState.DisplayBrightness ?? 127) / 127
  const opacityStatus = (dskyState.StatusBrightness ?? 127) / 127

  if (viewMode === 'full') {
    // Full DSKY skin — same layout as menu overlay
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

          {/* Screen background color — matches display area, behind the PNG */}
          {configState?.ready && (
            <div style={{
              position: 'absolute',
              left: `${SCREEN_AREA.left}%`,
              top: `${SCREEN_AREA.top}%`,
              width: `${SCREEN_AREA.width}%`,
              height: `${SCREEN_AREA.height}%`,
              backgroundColor: oledMode === 'yes' ? '#000' : '#3f3b30',
              zIndex: 0,
            }} />
          )}

          {/* DSKY chassis image — on top of green bg, transparent screen area shows through */}
          <img
            src="./dsky.png"
            alt="DSKY unit"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', zIndex: 2, pointerEvents: 'none' }}
          />

          {/* EL Display — positionable wrapper (hidden when menu is open) */}
          {!menu.menuState.isOpen && (
            <DskyDisplayWrapper dskyState={dskyState} opacity={opacityEL} displayType={displayType} oledMode={oledMode} configState={configState} sendConfigMessage={sendConfigMessage} mode="overlay" containerRatio={containerRatio} />
          )}

          {/* Alarm indicators */}
          <Alarms dskyState={dskyState} opacity={opacityStatus} />

          {/* Keyboard buttons */}
          <DskyKeyboard sendKey={sendKeyWithMenu} />

          {/* Client list */}
          <ClientList clients={dskyState?.clients || []} />

          {/* Menu overlay — inside the DSKY container, over the display area */}
          <MenuOverlay
          menuState={menu.menuState}
          onClose={menu.closeMenu}
          onNavigateTo={menu.navigateTo}
          onNavigateBack={menu.navigateBack}
          selectedIndex={menu.menuState.selectedIndex}
          onSetSelectedIndex={menu.setSelectedIndex}
          onMoveSelection={menu.moveSelection}
          configState={configState}
          clients={dskyState?.clients || []}
          wsConnected={wsConnected}
          viewMode={viewMode}
          onCycleViewMode={toggleViewMode}
          sendConfigMessage={sendConfigMessage}
          sendKey={sendKeyWithMenu}
          dskyState={dskyState}
          appKeyHandlerRef={appKeyHandlerRef}
        />
        </div>
      </main>
    )
  }

  // Screen-only mode — display with optional alarms sidebar
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: oledMode === 'yes' ? '#000' : '#3f3b30',
    }}>
      <div className="screen-mode-layout">
        {/* Alarms sidebar — hidden by default, shown on wide screens via CSS */}
        <div className="screen-mode-alarms">
          <Alarms dskyState={dskyState} opacity={opacityStatus} mode="screen" />
        </div>

        {/* Display area — holds ELDisplay and menu overlay */}
        <div className="screen-mode-display">
          {!menu.menuState.isOpen && (
            <DskyDisplayWrapper dskyState={dskyState} opacity={opacityEL} displayType={displayType} oledMode={oledMode} configState={configState} sendConfigMessage={sendConfigMessage} mode="screen" />
          )}
          {/* Menu overlay — covers the display area in screen mode */}
          <MenuOverlay
            menuState={menu.menuState}
            onClose={menu.closeMenu}
            onNavigateTo={menu.navigateTo}
            onNavigateBack={menu.navigateBack}
              selectedIndex={menu.menuState.selectedIndex}
            onSetSelectedIndex={menu.setSelectedIndex}
            onMoveSelection={menu.moveSelection}
            configState={configState}
            clients={dskyState?.clients || []}
            wsConnected={wsConnected}
            viewMode={viewMode}
            onCycleViewMode={toggleViewMode}
            sendConfigMessage={sendConfigMessage}
            sendKey={sendKeyWithMenu}
            dskyState={dskyState}
            appKeyHandlerRef={appKeyHandlerRef}
            mode="screen"
          />
        </div>
      </div>
      <ClientList clients={dskyState?.clients || []} />
    </main>
  );
}
