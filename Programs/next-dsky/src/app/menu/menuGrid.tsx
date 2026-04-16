"use client"

import { ReactNode } from "react"

interface MenuGridProps {
    children: ReactNode
    columns?: 1 | 2
}

export default function MenuGrid({ children, columns = 2 }: MenuGridProps) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: columns === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: '2cqh 2cqw',
            }}
            role="menu"
        >
            {children}
        </div>
    )
}
