"use client"

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { AUDIO_LOAD, NO_CONN, NO_CONN_UHOH } from "../utils/dskyStates";
import { chunkedUpdate, getChangedChunks } from "@/utils/chunks";
import { useSearchParams, useRouter } from 'next/navigation'
import Keyboard from "./keyboard";
import ClientList from "./clientList";
import Alarms from "./alarms";
import ELDisplay from "./elDisplay";

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  let oledMode = 'no'
  if(process.env.OLED_MODE == '1') oledMode ='yes'
  if(searchParams.get('oled') == '1') oledMode = 'yes'

  let displayType = 'default'
  if(process.env.DISPLAY_TYPE) displayType = process.env.DISPLAY_TYPE
  if(searchParams.get('display')) displayType = searchParams.get('display') as string

  const initialState = AUDIO_LOAD
  const [dskyState,setDskyState] = useState(initialState)
  const [audioContext, setAudioContext] : any = useState(null)
  const [audioFiles, setAudioFiles] : any = useState(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [showKeyboard, setShowKeyboard] : any = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasRedirectedRef = useRef(false)

  const fetchAudioFiles = async () => {
    // Cache audio files
    let sampleRate
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // Webkit sucks for audio
      sampleRate = 32000
    }
    const newAudioContext : any = new (window.AudioContext)({sampleRate})
    const newAudioFiles : any = {}
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

  // WebSocket connection effect
  useEffect(() => {
    if (!audioContext) return
    
    mountedRef.current = true
    connect()

    // Agent ping interval
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

  // Set up WebSocket message handling
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

      // If config is not ready, navigate to /config (only once)
      if (newState.config && !newState.config.ready) {
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true
          router.push('/config')
        }
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
      const currentWs = wsRef.current
      if(event.key.length == 1 && !event.repeat && currentWs?.readyState === WebSocket.OPEN){
        currentWs.send(event.key)
      }
    }
    const relayKeyRelease = (event: KeyboardEvent) => {
      const currentWs = wsRef.current
      if((event.key == 'p' || event.key == 'P') && currentWs?.readyState === WebSocket.OPEN){
        currentWs.send('O')
      }
    }
    window.addEventListener('keydown', relayKeyPress);
    window.addEventListener('keyup', relayKeyRelease);

    // Cleanup function
    return () => {
      ws.removeEventListener('message', handleMessage)
      window.removeEventListener('keydown', relayKeyPress);
      window.removeEventListener('keyup', relayKeyRelease);
    };
  }, [wsConnected, audioFiles, audioContext]);

  useEffect(()=>{
    if(!audioContext || !audioFiles) return

    const hookData = {
      lastState: dskyState,
      cancelUpdates: false,
      audioContext,
      audioFiles,
      setDskyState
    }

    let noConnTimeout1 : any
    let noConnTimeout2 : any
    let noConnInterval1 : any
    let noConnInterval2 : any
    if(!wsConnected) {
      noConnTimeout1 = setTimeout(()=> {
        noConnInterval1 = setInterval(()=> chunkedUpdate(NO_CONN, hookData),1000)
      }, 1000)
      noConnTimeout2 = setTimeout(()=> {
        noConnInterval2 = setInterval(()=> chunkedUpdate(NO_CONN_UHOH, hookData),1000)
      }, 2000)
    }

    // Cleanup function
    return () => {
      if(noConnTimeout1) {
        clearTimeout(noConnTimeout1)
      }
      if(noConnTimeout2) {
        clearTimeout(noConnTimeout2)
      }
      if(noConnInterval1){
        clearInterval(noConnInterval1)
      }
      if(noConnInterval2){
        clearInterval(noConnInterval2)
      }
    };
  }, [wsConnected, audioFiles, audioContext]);

  const sendKey = useCallback((key: string) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(key)
    }
  }, [])

  const opacityEL = dskyState.Standby ? 0 : ((dskyState.DisplayBrightness || 127) - 1) / 126
  const opacityStatus = ((dskyState.StatusBrightness || 127) - 1) / 126
  return (
    <main className={`flex min-h-screen flex-col items-center justify-between display-${displayType} oled-${oledMode} keyboard-${showKeyboard?1:0}`} >
      <Keyboard sendKey={sendKey} showKeyboard={showKeyboard} setShowKeyboard={setShowKeyboard} />
      <ClientList clients={dskyState?.clients || []} />
      <Alarms dskyState={dskyState} opacity={opacityStatus} />
      <ELDisplay dskyState={dskyState} opacity={opacityEL} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="flex min-h-screen flex-col items-center justify-center bg-black text-green-500 font-mono"><div>Loading...</div></main>}>
      <HomeContent />
    </Suspense>
  );
}
