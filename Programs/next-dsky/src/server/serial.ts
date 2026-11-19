import { SerialPort } from 'serialport'
import { V35_TEST } from '../utils/dskyStates'
import { stateToBinaryString, binaryStringToBuffer } from './serialEncoding'

let serial: SerialPort | null = null
let state = V35_TEST
let isWriting = false
let pendingPacket: Buffer | null = null

let listener: (data: Buffer) => Promise<void> = async (_data) => {}
export const setSerialListener = (newListener: (data: Buffer) => Promise<void>) => { listener = newListener }

const writeToSerial = (packet: Buffer) => {
    if (!serial) return

    if (isWriting) {
        pendingPacket = packet
        return
    }

    isWriting = true
    serial.write(packet, (err) => {
        if (err) {
            console.error('[Serial] Write failed:', err)
            isWriting = false
            return
        }
        serial?.drain((drainErr) => {
            isWriting = false
            if (drainErr) {
                console.error('[Serial] Drain failed:', drainErr)
            }
            if (pendingPacket) {
                const nextPacket = pendingPacket
                pendingPacket = null
                writeToSerial(nextPacket)
            }
        })
    })
}

export const updateSerialState = (newState: any, force = false) => {
    const newPacket = stateToBinaryString(newState)
    if (force || stateToBinaryString(state) != newPacket) {
        state = newState
        const serialPacket = binaryStringToBuffer(newPacket)
        writeToSerial(serialPacket)
    }
}

const closeSerialInternal = async (port: SerialPort): Promise<void> => {
    await new Promise<void>((resolve) => {
        try {
            port.close(() => resolve())
        } catch {
            resolve()
        }
    })
}

const attachSerialHandlers = (port: SerialPort) => {
    port.on('data', async (data: Buffer) => {
        await listener(data)
    })

    port.on('close', () => {
        console.log('[Serial] Connection lost!')
        if (serial === port) {
            serial = null
            isWriting = false
            pendingPacket = null
        }
    })

    port.on('error', (err) => {
        console.error('[Serial] Port error:', err)
    })
}

const openSerial = async (serialPath: string, baudRate = '9600'): Promise<SerialPort> => {
    const baud = parseInt(baudRate)

    if (serial && serial.path === serialPath) {
        return serial
    }

    const next = new SerialPort({ path: serialPath, baudRate: baud, autoOpen: false })

    await new Promise<void>((resolve, reject) => {
        next.open((err) => {
            if (err) reject(err)
            else resolve()
        })
    })

    attachSerialHandlers(next)

    const previous = serial
    serial = next
    isWriting = false
    pendingPacket = null

    if (previous) {
        console.log('[Serial] Closing previous connection')
        await closeSerialInternal(previous)
    }

    updateSerialState(state, true)
    return next
}

const RETRY_MS = 5000
// Bumped by every connectSerialWithRetry() and closeSerial(): a pending retry
// loop only keeps going while the generation it started with is current.
let connectGeneration = 0

/**
 * Open `serialPath` without blocking the caller and without ever throwing.
 * The DSKY board may be missing, enumerate after the app starts, or get
 * replugged, so a failed open is retried every few seconds and a dropped
 * port is reopened. A later call or closeSerial() cancels the loop.
 */
export const connectSerialWithRetry = (serialPath: string | null | undefined, baudRate = '9600'): void => {
    if (!serialPath || serialPath === 'none') return
    const generation = ++connectGeneration
    let warned = false

    const attempt = async () => {
        if (generation !== connectGeneration) return
        try {
            const port = await openSerial(serialPath, baudRate)
            if (generation !== connectGeneration) return
            console.log(`[Serial] Connected to ${serialPath}`)
            warned = false
            port.once('close', () => {
                if (generation === connectGeneration) setTimeout(attempt, RETRY_MS)
            })
        } catch (err) {
            if (!warned) {
                const reason = err instanceof Error ? err.message : String(err)
                console.warn(`[Serial] ${serialPath} not available (${reason}); retrying every ${RETRY_MS / 1000}s`)
                warned = true
            }
            setTimeout(attempt, RETRY_MS)
        }
    }

    void attempt()
}

export const closeSerial = async (): Promise<void> => {
    connectGeneration++
    if (!serial) return
    const port = serial
    console.log('[Serial] Closing connection')
    serial = null
    await closeSerialInternal(port)
}
