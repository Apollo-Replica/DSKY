
import Image from "next/image";
import { Digit } from "./digit";
import { Sign } from "./sign";

const ELDisplay = ({dskyState, opacity}: {dskyState:any, opacity:number}) => {
    return (
        <>
            <div className="ELDisplay">
                <Image
                    alt={'mask'}
                    src={'./mask.svg'}
                    width={1000}
                    height={1000}
                    className="mask"
                />
            </div>
            <div className="ELDisplay" style={{ opacity }}>
                <Image
                    alt={'basic_segments'}
                    src={'./basic_segments.svg'}
                    width={1000}
                    height={1000}
                    className="basic_segments"
                ></Image>
                {!!dskyState.IlluminateCompLight && <div className={'comp_acty'} />}
                <Digit
                    className={'ProgramD1'}
                    digit={dskyState.ProgramD1}
                />
                <Digit
                    className={'ProgramD2'}
                    digit={dskyState.ProgramD2}
                />
                <Digit
                    className={'VerbD1'}
                    digit={dskyState.VerbD1}
                />
                <Digit
                    className={'VerbD2'}
                    digit={dskyState.VerbD2}
                />
                <Digit
                    className={'NounD1'}
                    digit={dskyState.NounD1}
                />
                <Digit
                    className={'NounD2'}
                    digit={dskyState.NounD2}
                />

                <Sign
                    className={'Register1Sign'}
                    sign={dskyState.Register1Sign}
                />
                <Digit
                    className={'Register1D1'}
                    digit={dskyState.Register1D1}
                />
                <Digit
                    className={'Register1D2'}
                    digit={dskyState.Register1D2}
                />
                <Digit
                    className={'Register1D3'}
                    digit={dskyState.Register1D3}
                />
                <Digit
                    className={'Register1D4'}
                    digit={dskyState.Register1D4}
                />
                <Digit
                    className={'Register1D5'}
                    digit={dskyState.Register1D5}
                />

                <Sign
                    className={'Register2Sign'}
                    sign={dskyState.Register2Sign}
                />
                <Digit
                    className={'Register2D1'}
                    digit={dskyState.Register2D1}
                />
                <Digit
                    className={'Register2D2'}
                    digit={dskyState.Register2D2}
                />
                <Digit
                    className={'Register2D3'}
                    digit={dskyState.Register2D3}
                />
                <Digit
                    className={'Register2D4'}
                    digit={dskyState.Register2D4}
                />
                <Digit
                    className={'Register2D5'}
                    digit={dskyState.Register2D5}
                />


                <Sign
                    className={'Register3Sign'}
                    sign={dskyState.Register3Sign}
                />
                <Digit
                    className={'Register3D1'}
                    digit={dskyState.Register3D1}
                />
                <Digit
                    className={'Register3D2'}
                    digit={dskyState.Register3D2}
                />
                <Digit
                    className={'Register3D3'}
                    digit={dskyState.Register3D3}
                />
                <Digit
                    className={'Register3D4'}
                    digit={dskyState.Register3D4}
                />
                <Digit
                    className={'Register3D5'}
                    digit={dskyState.Register3D5}
                />
            </div>
        </>
    )
}

export default ELDisplay