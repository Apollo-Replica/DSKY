"use client"

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from 'next/navigation'
import Alarms from "./alarms";
import ClientList from "./clientList";
import ELDisplay from "./elDisplay";
import MenuOverlay from "./menu/menuOverlay";
import DskyKeyboard from "./menu/dskyKeyboard";
import DskyDisplayWrapper from "./menu/dskyDisplayWrapper";
import { CUSTOM_APP_RENDERERS } from "./appRegistry";
import { useAudio } from "./hooks/useAudio";
import { useWebSocket } from "./hooks/useWebSocket";
import { useDskyAnimation } from "./hooks/useDskyAnimation";
import ViewToggle from "./viewToggle";

/** Aspect ratio of the DSKY chassis image */
const DSKY_AR = 484 / 558

export type DisplayVariant = 'amoled544' | 'lcd480'

export default function HomeContent({ envDisplay }: { envDisplay: DisplayVariant }) {
  const searchParams = useSearchParams()

  // Display variant: ?display=lcd480 or ?display=amoled544 overrides the env default
  const displayParam = searchParams.get('display')
  const initialDisplay: DisplayVariant =
    displayParam === 'lcd480' || displayParam === 'amoled544' ? displayParam : envDisplay
  const [displayVariant, setDisplayVariant] = useState<DisplayVariant>(initialDisplay)
  const displayVariantRef = useRef(displayVariant)
  displayVariantRef.current = displayVariant
  const toggleDisplayVariant = useCallback(() => {
    const next: DisplayVariant = displayVariantRef.current === 'amoled544' ? 'lcd480' : 'amoled544'
    setDisplayVariant(next)
    const params = new URLSearchParams(window.location.search)
    if (next === envDisplay) params.delete('display')
    else params.set('display', next)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [envDisplay])

  const oledMode = displayVariant === 'amoled544'

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

  // Audio mute toggle (client-side only)
  const [muted, setMuted] = useState(searchParams.get('mute') === '1')
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current
    setMuted(next)
    const params = new URLSearchParams(window.location.search)
    if (next) params.set('mute', '1')
    else params.delete('mute')
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
  const dskyState = useDskyAnimation({ wsRef, wsConnected, audioContext, audioFiles, serverState, mutedRef })

  // --- Render helpers ---

  const opacityEL = dskyState.Standby ? 0 : (dskyState.DisplayBrightness ?? 127) / 127
  const opacityStatus = (dskyState.StatusBrightness ?? 127) / 127

  const appId = serverState?.app?.id
  const CustomAppComponent = appId ? CUSTOM_APP_RENDERERS[appId] : undefined

  const renderDisplayContent = () => {
    if (CustomAppComponent && serverState) {
      return <CustomAppComponent serverState={serverState} />
    }
    return <ELDisplay dskyState={dskyState} opacity={opacityEL} />
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

          {/* DSKY chassis image */}
          <img
            src="./dsky.png"
            alt="DSKY unit"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', zIndex: 2, pointerEvents: 'none' }}
          />

          <DskyDisplayWrapper mode="overlay" displayType={displayVariant} containerRatio={containerRatio}>
            {!serverState?.menu?.isOpen && renderDisplayContent()}
            <MenuOverlay
              serverState={serverState}
              clients={dskyState?.clients || []}
              wsConnected={wsConnected}
              sendMessage={sendMessage}
            />
          </DskyDisplayWrapper>

          <Alarms dskyState={dskyState} opacity={opacityStatus} />
          <DskyKeyboard sendKey={sendKey} />
        </div>
        <ClientList clients={dskyState?.clients || []} />
        <ViewToggle
          viewMode={viewMode} onToggle={toggleViewMode}
          muted={muted} onToggleMuted={toggleMuted}
          displayVariant={displayVariant} onToggleDisplay={toggleDisplayVariant}
        />
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
      backgroundColor: oledMode ? '#000' : '#3f3b30',
    }}>
      <div className="screen-mode-layout">
        <div className="screen-mode-alarms">
          <Alarms dskyState={dskyState} opacity={opacityStatus} mode="screen" />
        </div>
        <div className="screen-mode-display">
          <DskyDisplayWrapper mode="screen">
            {!serverState?.menu?.isOpen && renderDisplayContent()}
            <MenuOverlay
              serverState={serverState}
              clients={dskyState?.clients || []}
              wsConnected={wsConnected}
              sendMessage={sendMessage}
              mode="screen"
            />
          </DskyDisplayWrapper>
        </div>
      </div>
      <ClientList clients={dskyState?.clients || []} />
      <ViewToggle
        viewMode={viewMode} onToggle={toggleViewMode}
        muted={muted} onToggleMuted={toggleMuted}
        displayVariant={displayVariant} onToggleDisplay={toggleDisplayVariant}
      />
    </main>
  );
}
