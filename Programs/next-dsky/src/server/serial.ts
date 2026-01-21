import { SerialPort } from 'serialport'
import { V35_TEST } from '../utils/dskyStates'

const decimalToByte = (decimal: number): string => {
    // Convert number to binary string
    let binaryString = decimal.toString(2)
    // Pad the binary string with leading zeros to make it 8 bits long
    binaryString = binaryString.padStart(8, '0')
    return binaryString
}

const digitsToDecimal = (digit1: string | number, digit2: string | number): number => {
    // Ensure that num1 and num2 are within the range 0-15
    let d1 = Math.max(0, Math.min(15, typeof digit1 === 'number' ? digit1 : parseInt(digit1) || 0))
    let d2 = Math.max(0, Math.min(15, typeof digit2 === 'number' ? digit2 : parseInt(digit2) || 0))

    // Handle empty digit
    if (digit1 === '') d1 = 10
    if (digit2 === '') d2 = 10

    // Combine the two numbers into a single byte
    const combinedByte = (d1 << 4) | d2

    return combinedByte
}

const booleansToDecimal = (b7: any, b6: any, b5: any, b4: any, b3: any, b2: any, b1: any, b0: any): number => {
    // Convert booleans to a binary string
    const binaryString = (b7 ? '1' : '0') +
        (b6 ? '1' : '0') +
        (b5 ? '1' : '0') +
        (b4 ? '1' : '0') +
        (b3 ? '1' : '0') +
        (b2 ? '1' : '0') +
        (b1 ? '1' : '0') +
        (b0 ? '1' : '0')

    // Convert binary string to decimal
    const decimalValue = parseInt(binaryString, 2)

    return decimalValue
}

const stateToBinaryString = (state: any): string => {
    let bits = '11111111'
    bits += decimalToByte(
        digitsToDecimal(
            state.ProgramD1,
            state.ProgramD2
        )
    ) // B0
    bits += decimalToByte(
        digitsToDecimal(
            state.VerbD1,
            state.VerbD2
        )
    ) // B1
    bits += decimalToByte(
        digitsToDecimal(
            state.NounD1,
            state.NounD2
        )
    ) // B2
    bits += decimalToByte(
        booleansToDecimal(
            state.Register1Sign == '+',
            state.Register2Sign == '+',
            state.Register3Sign == '+',
            state.IlluminateCompLight,
            0, 0, 0, 0) +
        digitsToDecimal('0', state.Register1D1)
    ) // B3
    bits += decimalToByte(
        digitsToDecimal(
            state.Register1D2,
            state.Register1D3
        )
    ) // B4
    bits += decimalToByte(
        digitsToDecimal(
            state.Register1D4,
            state.Register1D5
        )
    ) // B5
    bits += decimalToByte(
        booleansToDecimal(
            state.Register1Sign != '',
            state.Register2Sign != '',
            state.Register3Sign != '',
            state.IlluminateUplinkActy,
            0, 0, 0, 0) +
        digitsToDecimal('0', state.Register2D1)
    ) // B6
    bits += decimalToByte(
        digitsToDecimal(
            state.Register2D2,
            state.Register2D3
        )
    ) // B7
    bits += decimalToByte(
        digitsToDecimal(
            state.Register2D4,
            state.Register2D5
        )
    ) // B8
    bits += decimalToByte(
        booleansToDecimal(
            state.IlluminateNoAtt,
            state.IlluminateStby,
            state.IlluminateKeyRel,
            state.IlluminateOprErr,
            0, 0, 0, 0) +
        digitsToDecimal('0', state.Register3D1)
    ) // B9
    bits += decimalToByte(
        digitsToDecimal(
            state.Register3D2,
            state.Register3D3
        )
    ) // B10
    bits += decimalToByte(
        digitsToDecimal(
            state.Register3D4,
            state.Register3D5
        )
    ) // B11
    bits += decimalToByte(
        booleansToDecimal(
            state.IlluminateNoDap,
            state.IlluminatePrioDisp,
            state.IlluminateTemp,
            state.IlluminateGimbalLock,
            state.IlluminateProg,
            state.IlluminateRestart,
            state.IlluminateTracker,
            0)
    ) // B12
    bits += decimalToByte(
        booleansToDecimal(
            state.IlluminateAlt,
            state.IlluminateVel,
            0, 0, 0, 0, 0, 0)
    ) // B13
    bits += decimalToByte(
        // Serial protocol cannot send 0x00, so brightness range is 1-127 (1 = off)
        Math.max(1, Math.min(state.StatusBrightness || 127, 127))
    ) // B14
    bits += decimalToByte(
        // Serial protocol cannot send 0x00, so brightness range is 1-127 (1 = off)
        Math.max(1, Math.min(state.KeyboardBrightness || 127, 127))
    ) // B15
    return bits
}

const binaryStringToBuffer = (bits: string): Buffer => {
    const chunks = (bits.match(/.{1,8}/g) || []).map(byte => byte.padEnd(8, '0'))
    const numberArray = chunks.map(chunk => parseInt(chunk, 2))
    return Buffer.from(numberArray)
}

let serial: SerialPort | null = null
let state = V35_TEST
let isWriting = false
let pendingPacket: Buffer | null = null

let listener: (data: Buffer) => Promise<void> = async (_data) => {}
export const setSerialListener = (newListener: (data: Buffer) => Promise<void>) => { listener = newListener }

const writeToSerial = (packet: Buffer) => {
    if (!serial) return

    if (isWriting) {
        // Queue the latest packet - older pending packets are discarded
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
        // Wait for data to be fully transmitted
        serial?.drain((drainErr) => {
            isWriting = false
            if (drainErr) {
                console.error('[Serial] Drain failed:', drainErr)
            }
            // Send any pending packet
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
            // `close` is async; callback fires when fully closed.
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

    // Reuse the existing port if it's already open on the same path.
    if (serial && serial.path === serialPath) {
        return serial
    }

    // Open the new port first (so we don't lose an existing working connection if open fails).
    const next = new SerialPort({ path: serialPath, baudRate: baud, autoOpen: false })

    await new Promise<void>((resolve, reject) => {
        next.open((err) => {
            if (err) reject(err)
            else resolve()
        })
    })

    attachSerialHandlers(next)

    // Swap in the new port and close the previous one.
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

export const createSerial = async (serialPath: string | undefined, baudRate = '9600'): Promise<SerialPort | null> => {
    // If no serial source specified, skip serial setup
    if (!serialPath || serialPath === 'none') return null
    return await openSerial(serialPath, baudRate)
}

// Create serial connection from config (after web UI selection)
export const createSerialFromConfig = async (serialPath: string, baudRate = '9600'): Promise<SerialPort | null> => {
    if (!serialPath || serialPath === 'none') return null
    return await openSerial(serialPath, baudRate)
}

// Close the serial connection
export const closeSerial = async (): Promise<void> => {
    if (!serial) return
    const port = serial
    console.log('[Serial] Closing connection')
    serial = null
    await closeSerialInternal(port)
}
