import Image from "next/image";

const Alarms = ({dskyState, opacity} : {dskyState:any,opacity:number}) =>{
    return (
        <div className="Alarms" >
        <Image
          alt={'alarms_mask'}
          src={'./alarms_mask.svg'}
          width={1000}
          height={1000}
          className="alarms_mask"
        />
        <div className="alarms-bg" />
        {!!dskyState.IlluminateUplinkActy && <div className="alarm-uplink" style={{opacity}}/>}
        {!!dskyState.IlluminateNoAtt && <div className="alarm-noatt" style={{opacity}}/>}
        {!!dskyState.IlluminateStby && <div className="alarm-stby" style={{opacity}}/>}
        {!!dskyState.IlluminateKeyRel && <div className="alarm-keyrel" style={{opacity}}/>}
        {!!dskyState.IlluminateOprErr && <div className="alarm-oprerr" style={{opacity}}/>}
        {!!dskyState.IlluminateNoDap && <div className="alarm-nodap" style={{opacity}}/>}
        {!!dskyState.IlluminatePrioDisp && <div className="alarm-priodisp" style={{opacity}}/>}
        {!!dskyState.IlluminateTemp && <div className="alarm-temp" style={{opacity}}/>}
        {!!dskyState.IlluminateGimbalLock && <div className="alarm-gimballock" style={{opacity}}/>}
        {!!dskyState.IlluminateProg && <div className="alarm-prog" style={{opacity}}/>}
        {!!dskyState.IlluminateRestart && <div className="alarm-restart" style={{opacity}}/>}
        {!!dskyState.IlluminateTracker && <div className="alarm-tracker" style={{opacity}}/>}
        {!!dskyState.IlluminateAlt && <div className="alarm-alt" style={{opacity}}/>}
        {!!dskyState.IlluminateVel && <div className="alarm-vel" style={{opacity}}/>}
      </div>
    )
}

export default Alarms