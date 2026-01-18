import * as dgram from 'node:dgram'
import { AgcIntegration } from './AgcIntegration'

export class NASSPIntegration extends AgcIntegration {
    readonly name = 'NASSP'
    readonly id = 'nassp'
    
    private dskyServer: dgram.Socket | null = null
    private nasspAddress: string | undefined
    private nasspPort: number | undefined
    private lastDSKYMessage: string | undefined

    async handleKey(key: string): Promise<void> {
        try {
            if (this.nasspAddress && this.nasspPort && this.dskyServer) {
                this.dskyServer.send(key, this.nasspPort, this.nasspAddress)
            }
        } catch (error) {
            console.error('[NASSP] Error sending keypress:', error)
        }
    }

    protected async onStart(_options: Record<string, any>): Promise<void> {
        this.dskyServer = dgram.createSocket('udp4')
        this.lastDSKYMessage = undefined

        this.dskyServer.on('listening', () => {
            const address = this.dskyServer!.address()
            console.log(`[NASSP] Server listening on ${address.address}:${address.port}`)
        })

        this.dskyServer.on('message', (message, rinfo) => {
            this.handleMessage(message, rinfo)
        })

        this.dskyServer.bind(3002, '127.0.0.1')
    }

    protected onStop(): void {
        console.log('[NASSP] Closing UDP server')
        if (this.dskyServer) {
            this.dskyServer.close()
            this.dskyServer = null
        }
        this.nasspAddress = undefined
        this.nasspPort = undefined
    }

    private handleMessage(message: Buffer, rinfo: dgram.RemoteInfo): void {
        try {
            this.nasspAddress = rinfo.address
            this.nasspPort = rinfo.port
            const parsedJSON = JSON.parse(message.toString())
            const messageClean = JSON.stringify(parsedJSON)
            
            if (messageClean !== this.lastDSKYMessage) {
                this.lastDSKYMessage = messageClean
                const { compLight, prog, verb, noun, flashing, r1, r2, r3, alarms, powered, anun, numerics, integral } = parsedJSON
                const [alarmsPowered, ELPowered] = powered.split(' ').map((val: string) => val !== '0')
                const alarmValues = alarms.split(' ').map((val: string) => val !== '0' && alarmsPowered)

                const state = {
                    IlluminateCompLight: compLight === '1',
                    IlluminateUplinkActy: alarmValues[0],
                    IlluminateNoAtt: alarmValues[1],
                    IlluminateStby: alarmValues[2],
                    IlluminateKeyRel: alarmValues[3],
                    IlluminateOprErr: alarmValues[4],
                    IlluminateTemp: alarmValues[5],
                    IlluminateGimbalLock: alarmValues[6],
                    IlluminateProg: alarmValues[7],
                    IlluminateRestart: alarmValues[8],
                    IlluminateTracker: alarmValues[9],
                    IlluminateAlt: alarmValues[10],
                    IlluminateVel: alarmValues[11],
                    IlluminateNoDap: alarmValues[12],
                    IlluminatePrioDisp: alarmValues[13],
                    ProgramD1: prog[0].replace(' ', ''),
                    ProgramD2: prog[1].replace(' ', ''),
                    VerbD1: flashing === 1 ? '' : verb[0].replace(' ', ''),
                    VerbD2: flashing === 1 ? '' : verb[1].replace(' ', ''),
                    NounD1: flashing === 1 ? '' : noun[0].replace(' ', ''),
                    NounD2: flashing === 1 ? '' : noun[1].replace(' ', ''),
                    Register1Sign: r1[0].replace(' ', ''),
                    Register1D1: r1[1].replace(' ', ''),
                    Register1D2: r1[2].replace(' ', ''),
                    Register1D3: r1[3].replace(' ', ''),
                    Register1D4: r1[4].replace(' ', ''),
                    Register1D5: r1[5].replace(' ', ''),
                    Register2Sign: r2[0].replace(' ', ''),
                    Register2D1: r2[1].replace(' ', ''),
                    Register2D2: r2[2].replace(' ', ''),
                    Register2D3: r2[3].replace(' ', ''),
                    Register2D4: r2[4].replace(' ', ''),
                    Register2D5: r2[5].replace(' ', ''),
                    Register3Sign: r3[0].replace(' ', ''),
                    Register3D1: r3[1].replace(' ', ''),
                    Register3D2: r3[2].replace(' ', ''),
                    Register3D3: r3[3].replace(' ', ''),
                    Register3D4: r3[4].replace(' ', ''),
                    Register3D5: r3[5].replace(' ', ''),
                    Standby: !ELPowered,
                    StatusBrightness: Math.max(Math.floor(parseFloat(anun) * 127), 1),
                    DisplayBrightness: Math.max(Math.floor(parseFloat(numerics) * 127), 1),
                    KeyboardBrightness: Math.max(Math.floor(parseFloat(integral) * 127), 1)
                }
                this.emitState(state)
            }
        } catch {
            console.log("[NASSP] Error parsing message")
        }
    }
}
