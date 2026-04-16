"use client"

import { useEffect, useState } from 'react'

export function useAudio() {
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
    const [audioFiles, setAudioFiles] = useState<Record<string, AudioBuffer> | null>(null)

    useEffect(() => {
        const fetchAudioFiles = async () => {
            let sampleRate
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                sampleRate = 32000
            }
            const newAudioContext = new AudioContext({ sampleRate })
            const newAudioFiles: Record<string, AudioBuffer> = {}
            for (let i = 1; i <= 11; i++) {
                for (let j = 0; j < 5; j++) {
                    const res = await fetch(`audio/clicks${i}_${j}.mp3`)
                    const arrayBuffer = await res.arrayBuffer()
                    const audioBuffer = await newAudioContext.decodeAudioData(arrayBuffer)
                    newAudioFiles[`${i}-${j}`] = audioBuffer
                }
            }
            setAudioContext(newAudioContext)
            setAudioFiles(newAudioFiles)
        }

        fetchAudioFiles()
    }, [])

    return { audioContext, audioFiles }
}
