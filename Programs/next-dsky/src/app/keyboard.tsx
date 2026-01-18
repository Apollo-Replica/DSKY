import Image from "next/image";

interface KeyboardProps {
    sendKey: (key: string) => void
    showKeyboard: boolean
    setShowKeyboard: (a: boolean) => void
}

const Keyboard = ({ sendKey, showKeyboard, setShowKeyboard }: KeyboardProps) => {
    return (
        <>
            <div className="toggleKeyboard" onClick={() => setShowKeyboard(!showKeyboard)} >
                <Image
                    alt={'keyboard'}
                    src={showKeyboard ? './keyboard-hide.svg' : './keyboard-show.svg'}
                    width={1000}
                    height={1000}
                    className="togglekeyboard"
                />
            </div>
            <div className="keyboard" >
                <Image
                    alt={'keyboard'}
                    src={'./keyboard.svg'}
                    width={1000}
                    height={1000}
                    className="keyboard-mask"
                />
                <div className="key-verb" onClick={() => sendKey("v")}></div>
                <div className="key-noun" onClick={() => sendKey("n")}></div>
                <div className="key-plus" onClick={() => sendKey("+")}></div>
                <div className="key-minus" onClick={() => sendKey("-")}></div>
                <div className="key-0" onClick={() => sendKey("0")}></div>
                <div className="key-7" onClick={() => sendKey("7")}></div>
                <div className="key-4" onClick={() => sendKey("4")}></div>
                <div className="key-1" onClick={() => sendKey("1")}></div>
                <div className="key-8" onClick={() => sendKey("8")}></div>
                <div className="key-5" onClick={() => sendKey("5")}></div>
                <div className="key-2" onClick={() => sendKey("2")}></div>
                <div className="key-6" onClick={() => sendKey("6")}></div>
                <div className="key-9" onClick={() => sendKey("9")}></div>
                <div className="key-3" onClick={() => sendKey("3")}></div>
                <div className="key-clr" onClick={() => sendKey("c")}></div>
                <div className="key-pro" onClick={() => {
                    sendKey("p")
                    setTimeout(() => sendKey("o"), 200)
                }}></div>
                <div className="key-keyrel" onClick={() => sendKey("k")}></div>
                <div className="key-entr" onClick={() => sendKey("e")}></div>
                <div className="key-rset" onClick={() => sendKey("r")}></div>
            </div>
        </>
        
    )
}

export default Keyboard