"use client"

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from 'next/navigation'
import Alarms from "./alarms";
import ClientList from "./clientList";
import MenuOverlay from "./menu/menuOverlay";
import DskyKeyboard from "./menu/dskyKeyboard";
import DskyDisplayWrapper from "./menu/dskyDisplayWrapper";
import { SCREEN_AREA } from "./menu/constants";
import { CUSTOM_APP_RENDERERS } from "./appRegistry";
import { useAudio } from "./hooks/useAudio";
import { useWebSocket } from "./hooks/useWebSocket";
import { useDskyAnimation } from "./hooks/useDskyAnimation";
import ViewToggle from "./viewToggle";

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

  // --- Hooks ---

  const { audioContext, audioFiles } = useAudio()
  const { wsRef, wsConnected, serverState, sendKey, sendMessage } = useWebSocket({
    audioContext,
    agentMode: searchParams.get('agent') === '1',
  })
  const dskyState = useDskyAnimation({ wsRef, wsConnected, audioContext, audioFiles, serverState })

  // --- Render helpers ---

  const opacityEL = dskyState.Standby ? 0 : (dskyState.DisplayBrightness ?? 127) / 127
  const opacityStatus = (dskyState.StatusBrightness ?? 127) / 127

  const appId = serverState?.app?.id
  const CustomAppComponent = appId ? CUSTOM_APP_RENDERERS[appId] : undefined

  const renderDisplayContent = (mode: 'overlay' | 'screen') => {
    if (CustomAppComponent && serverState) {
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
    return <DskyDisplayWrapper dskyState={dskyState} opacity={opacityEL} displayType={displayType} oledMode={oledMode} mode={mode} containerRatio={containerRatio} />
  }

  if (viewMode === 'full') {
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

          {!serverState?.menu?.isOpen && renderDisplayContent('overlay')}

          <Alarms dskyState={dskyState} opacity={opacityStatus} />
          <DskyKeyboard sendKey={sendKey} />
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
