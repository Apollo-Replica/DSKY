"use client"

import dynamic from 'next/dynamic'

// Disable SSR for the config page to avoid hydration issues
const ConfigPageContent = dynamic(() => import('./ConfigPageContent'), {
    ssr: false,
    loading: () => (
        <main className="flex min-h-screen flex-col items-center justify-center bg-black text-green-500 font-mono">
            <div className="text-xl">Loading...</div>
        </main>
    )
})

export default function ConfigPage() {
    return <ConfigPageContent />
}
