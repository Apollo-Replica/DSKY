"use client"

import { useState, useRef } from "react"

interface DskyKeyboardProps {
    sendKey: (key: string) => void
}

interface KeyDef {
    id: string
    key: string
    left: number
    top: number
    width: number
    height: number
    pro?: boolean
}

const COL = { verb: 8.8, plus: 20.9, k7: 32.9, k8: 44.5, k9: 56.3, clr: 68.2, entr: 80 }
const ROW = { top: 61.4, verbEntr: 66.4, mid: 71.6, nounRset: 76.9, bot: 82 }
const W = 11
const H = 9.5

const KEYS: KeyDef[] = [
    // Left column
    { id: 'verb', key: 'v', left: COL.verb, top: ROW.verbEntr, width: W, height: H },
    { id: 'noun', key: 'n', left: COL.verb, top: ROW.nounRset, width: W, height: H },
    // Right column
    { id: 'entr', key: 'e', left: COL.entr, top: ROW.verbEntr, width: W, height: H },
    { id: 'rset', key: 'r', left: COL.entr, top: ROW.nounRset, width: W, height: H },
    // +/-/0 column
    { id: 'plus', key: '+', left: COL.plus, top: ROW.top, width: W, height: H },
    { id: 'min',  key: '-', left: COL.plus, top: ROW.mid, width: W, height: H },
    { id: 'k0',   key: '0', left: COL.plus, top: ROW.bot, width: W, height: H },
    // 7/4/1 column
    { id: 'k7',   key: '7', left: COL.k7, top: ROW.top, width: W, height: H },
    { id: 'k4',   key: '4', left: COL.k7, top: ROW.mid, width: W, height: H },
    { id: 'k1',   key: '1', left: COL.k7, top: ROW.bot, width: W, height: H },
    // 8/5/2 column
    { id: 'k8',   key: '8', left: COL.k8, top: ROW.top, width: W, height: H },
    { id: 'k5',   key: '5', left: COL.k8, top: ROW.mid, width: W, height: H },
    { id: 'k2',   key: '2', left: COL.k8, top: ROW.bot, width: W, height: H },
    // 9/6/3 column
    { id: 'k9',   key: '9', left: COL.k9, top: ROW.top, width: W, height: H },
    { id: 'k6',   key: '6', left: COL.k9, top: ROW.mid, width: W, height: H },
    { id: 'k3',   key: '3', left: COL.k9, top: ROW.bot, width: W, height: H },
    // CLR/PRO/KEY REL column
    { id: 'clr',  key: 'c', left: COL.clr, top: ROW.top, width: W, height: H },
    { id: 'pro',  key: 'p', left: COL.clr, top: ROW.mid, width: W, height: H, pro: true },
    { id: 'krel', key: 'k', left: COL.clr, top: ROW.bot, width: W, height: H },
]

function TransparentButton({ keyDef, onPress, onRelease }: { keyDef: KeyDef, onPress: (k: KeyDef) => void, onRelease?: (k: KeyDef) => void }) {
    const [pressed, setPressed] = useState(false)
    const pressedRef = useRef(false)

    const handleDown = () => {
        setPressed(true)
        pressedRef.current = true
        onPress(keyDef)
    }

    const handleUp = () => {
        if (pressedRef.current) {
            pressedRef.current = false
            setPressed(false)
            onRelease?.(keyDef)
        }
    }

    return (
        <button
            onPointerDown={handleDown}
            onPointerUp={handleUp}
            onPointerLeave={handleUp}
            onPointerCancel={handleUp}
            style={{
                position: 'absolute',
                left: `${keyDef.left}%`,
                top: `${keyDef.top}%`,
                width: `${keyDef.width}%`,
                height: `${keyDef.height}%`,
                zIndex: 5,
                cursor: 'pointer',
                background: pressed ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'transparent',
                padding: 0,
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
                touchAction: 'manipulation',
                outline: 'none',
            }}
        />
    )
}

export default function DskyKeyboard({ sendKey }: DskyKeyboardProps) {
    const handlePress = (keyDef: KeyDef) => {
        sendKey(keyDef.key)
    }

    const handleRelease = (keyDef: KeyDef) => {
        sendKey('o')
    }

    return (
        <>
            {KEYS.map((k) => (
                <TransparentButton key={k.id} keyDef={k} onPress={handlePress} onRelease={k.pro ? handleRelease : undefined} />
            ))}
        </>
    )
}
