import { Suspense } from 'react'
import HaConfigContent from './haConfigContent'

export default function HaConfigPage() {
    return (
        <Suspense fallback={
            <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', color: '#4ade80', fontFamily: 'monospace' }}>
                <div>Loading...</div>
            </main>
        }>
            <HaConfigContent />
        </Suspense>
    )
}
