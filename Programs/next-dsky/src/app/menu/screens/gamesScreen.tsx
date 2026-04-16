"use client"

import { panelStyle, titleStyle } from "../panelStyles"

export default function GamesScreen() {
    return (
        <div style={panelStyle}>
            <div style={titleStyle}>GAMES</div>
            <div style={{
                fontSize: '3.5cqh',
                color: 'var(--menu-secondary)',
                textAlign: 'center',
                padding: '4cqh 0',
            }}>
                COMING SOON
            </div>
        </div>
    )
}
