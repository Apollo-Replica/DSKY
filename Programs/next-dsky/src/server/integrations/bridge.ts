import { client as WebSocketClient, connection as WebSocketConnection } from 'websocket'

let client: WebSocketClient | null = null
let activeConnection: WebSocketConnection | null = null
let bridgeHost: string = ''
let shouldReconnect = true

let clientInput = (_data: string) => {}
let clientOutput = (_data: any) => {}

const onDisconnect = async () => {
    activeConnection = null
    if (!shouldReconnect) return
    console.log("Bridge connection failed, reconnecting...")
    await new Promise(r => setTimeout(r, 1000))
    if (shouldReconnect) await connectClient()
}

const onConnect = (connection: WebSocketConnection) => {
    console.log("Bridge connected!")
    activeConnection = connection
    connection.on("message", (message: any) => {
        if (message.type === 'utf8') {
            clientOutput(JSON.parse(message.utf8Data))
        }
    })
    connection.on("close", onDisconnect)
    clientInput = (data: string) => connection.sendUTF(data)
}

const connectClient = async () => {
    if (!client || !shouldReconnect) return
    client.connect(bridgeHost, 'echo-protocol')
}

export const watchStateBridge = async (callback: (state: any) => void, options: { bridgeUrl?: string } = {}) => {
    // Create new client for this session
    client = new WebSocketClient()
    shouldReconnect = true
    
    client.on('connectFailed', onDisconnect)
    client.on('connect', onConnect)
    
    // Get bridge URL from options or use default
    bridgeHost = options.bridgeUrl || 'wss://dsky.ortizma.com/ws'
    console.log(`[Bridge] Connecting to: ${bridgeHost}`)
    connectClient()
    clientOutput = (data: any) => callback(data)
    
    // Return cleanup function
    return () => {
        console.log('[Bridge] Closing connection')
        shouldReconnect = false
        if (activeConnection) {
            activeConnection.close()
            activeConnection = null
        }
        client = null
        clientInput = (_data: string) => {}
        clientOutput = (_data: any) => {}
    }
};

export const getBridgeKeyboardHandler = () => {
    return (data: string) => {
        clientInput(data)
    }
};
