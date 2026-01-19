
export const Digit = ({className,digit} : any) =>{
    return <div className={className}>
        {!['','1','4','L','U','I','d','H'].includes(digit) && <div className={'segment_e'} />}
        {!['','1','2','3','7', 'd'].includes(digit) && <div className={'segment_f'} />}
        {!['', '5','6','L','I','C'].includes(digit) && <div className={'segment_h'} />}
        {!['','1','7','0', 'L','O','U','I','C','n'].includes(digit) && <div className={'segment_j'} />}
        {!['','1','3','4','5','7','9'].includes(digit) && <div className={'segment_k'} />}
        {!['','2','L','C','I'].includes(digit) && <div className={'segment_m'} />}
        {!['','1','4','7','A','I','n','H'].includes(digit) && <div className={'segment_n'} />}
    </div>
}