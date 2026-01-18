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
        // Only values from 1 to 127 will be sent
        state.StatusBrightness ? Math.min(state.StatusBrightness, 127) : 127
    ) // B14
    bits += decimalToByte(
        // Only values from 1 to 127 will be sent
        state.KeyboardBrightness ? Math.min(state.KeyboardBrightness, 127) : 127
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

let listener: (data: Buffer) => Promise<void> = async (_data) => {}
export const setSerialListener = (newListener: (data: Buffer) => Promise<void>) => { listener = newListener }

export const updateSerialState = (newState: any, force = false) => {
    const newPacket = stateToBinaryString(newState)
    if (force || stateToBinaryString(state) != newPacket) {
        state = newState
        let serialPacket = binaryStringToBuffer(newPacket)
        if (serial) serial.write(serialPacket)
    }
}

export const createSerial = async (serialPath: string | undefined, baudRate = '9600'): Promise<SerialPort | null> => {
    // If no serial source specified, skip serial setup
    if (!serialPath || serialPath === 'none') return null

    serial = new SerialPort({ path: serialPath, baudRate: parseInt(baudRate) })

    updateSerialState(state, true)

    serial.on('data', async (data: Buffer) => {
        await listener(data)
    })

    serial.on('close', async () => {
        console.log("[Serial] Connection lost!")
        serial = null
    })

    return serial
}

// Create serial connection from config (after web UI selection)
export const createSerialFromConfig = async (serialPath: string, baudRate = '9600'): Promise<SerialPort | null> => {
    if (!serialPath || serialPath === 'none') return null

    serial = new SerialPort({ path: serialPath, baudRate: parseInt(baudRate) })

    updateSerialState(state, true)

    serial.on('data', async (data: Buffer) => {
        await listener(data)
    })

    serial.on('close', async () => {
        console.log("[Serial] Connection lost!")
        serial = null
    })

    return serial
}

// Close the serial connection
export const closeSerial = () => {
    if (serial) {
        console.log('[Serial] Closing connection')
        serial.close()
        serial = null
    }
}
