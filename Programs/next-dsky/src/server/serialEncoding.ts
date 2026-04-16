/**
 * Encodes DSKY display state into a binary packet for the serial hardware.
 * Each field of the DSKY state maps to specific bits in a 17-byte frame.
 */

const decimalToByte = (decimal: number): string => {
    let binaryString = decimal.toString(2)
    binaryString = binaryString.padStart(8, '0')
    return binaryString
}

const digitsToDecimal = (digit1: string | number, digit2: string | number): number => {
    let d1 = Math.max(0, Math.min(15, typeof digit1 === 'number' ? digit1 : parseInt(digit1) || 0))
    let d2 = Math.max(0, Math.min(15, typeof digit2 === 'number' ? digit2 : parseInt(digit2) || 0))

    if (digit1 === '') d1 = 10
    if (digit2 === '') d2 = 10

    const combinedByte = (d1 << 4) | d2
    return combinedByte
}

const booleansToDecimal = (b7: any, b6: any, b5: any, b4: any, b3: any, b2: any, b1: any, b0: any): number => {
    const binaryString = (b7 ? '1' : '0') +
        (b6 ? '1' : '0') +
        (b5 ? '1' : '0') +
        (b4 ? '1' : '0') +
        (b3 ? '1' : '0') +
        (b2 ? '1' : '0') +
        (b1 ? '1' : '0') +
        (b0 ? '1' : '0')

    const decimalValue = parseInt(binaryString, 2)
    return decimalValue
}

export const stateToBinaryString = (state: any): string => {
    let bits = '11111111'
    bits += decimalToByte(digitsToDecimal(state.ProgramD1, state.ProgramD2))
    bits += decimalToByte(digitsToDecimal(state.VerbD1, state.VerbD2))
    bits += decimalToByte(digitsToDecimal(state.NounD1, state.NounD2))
    bits += decimalToByte(
        booleansToDecimal(
            state.Register1Sign == '+',
            state.Register2Sign == '+',
            state.Register3Sign == '+',
            state.IlluminateCompLight,
            0, 0, 0, 0) +
        digitsToDecimal('0', state.Register1D1)
    )
    bits += decimalToByte(digitsToDecimal(state.Register1D2, state.Register1D3))
    bits += decimalToByte(digitsToDecimal(state.Register1D4, state.Register1D5))
    bits += decimalToByte(
        booleansToDecimal(
            state.Register1Sign != '',
            state.Register2Sign != '',
            state.Register3Sign != '',
            state.IlluminateUplinkActy,
            0, 0, 0, 0) +
        digitsToDecimal('0', state.Register2D1)
    )
    bits += decimalToByte(digitsToDecimal(state.Register2D2, state.Register2D3))
    bits += decimalToByte(digitsToDecimal(state.Register2D4, state.Register2D5))
    bits += decimalToByte(
        booleansToDecimal(
            state.IlluminateNoAtt,
            state.IlluminateStby,
            state.IlluminateKeyRel,
            state.IlluminateOprErr,
            0, 0, 0, 0) +
        digitsToDecimal('0', state.Register3D1)
    )
    bits += decimalToByte(digitsToDecimal(state.Register3D2, state.Register3D3))
    bits += decimalToByte(digitsToDecimal(state.Register3D4, state.Register3D5))
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
    )
    bits += decimalToByte(
        booleansToDecimal(
            state.IlluminateAlt,
            state.IlluminateVel,
            0, 0, 0, 0, 0, 0)
    )
    bits += decimalToByte(Math.min(state.StatusBrightness ?? 127, 127))
    bits += decimalToByte(Math.min(state.KeyboardBrightness ?? 127, 127))
    return bits
}

export const binaryStringToBuffer = (bits: string): Buffer => {
    const chunks = (bits.match(/.{1,8}/g) || []).map(byte => byte.padEnd(8, '0'))
    const numberArray = chunks.map(chunk => parseInt(chunk, 2))
    return Buffer.from(numberArray)
}
