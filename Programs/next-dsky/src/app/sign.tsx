
export const Sign = ({className, sign} : any) =>{
    return <div className={className}>
        {!['','-'].includes(sign) && <div className={'sign_top'} />}
        {![''].includes(sign) && <div className={'sign_mid'} />}
        {!['', '-'].includes(sign) && <div className={'sign_bot'} />}
    </div>
}