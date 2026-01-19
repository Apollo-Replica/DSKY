const ClientList = ({clients} : {clients: [{country?:string, you?:boolean}] | never[]}) => {
    return(
        <div className="clientList">
            { clients.map((client:any, index) => (
            <div
                key={index}
                className={`client-box ${client.you ? 'you' : ''}`}
            >
                {client?.country ?
                <img
                    src={`https://cdn.jsdelivr.net/npm/flag-icons@6.3.0/flags/4x3/${client.country.toLowerCase()}.svg`}
                    alt={`${client.country} flag`}
                    className="client-flag"
                /> : 
                <p>❓</p>
                }
            </div>
            ))}
        </div>
    )
}

export default ClientList