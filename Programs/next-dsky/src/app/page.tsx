import { Suspense } from "react";
import HomeContent from "./homeContent";

// Read DSKY_DISPLAY from the runtime env, not baked at build time.
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <Suspense fallback={<main className="flex min-h-screen flex-col items-center justify-center bg-black text-green-500 font-mono"><div>Loading...</div></main>}>
      <HomeContent envDisplay={process.env.DSKY_DISPLAY === 'lcd480' ? 'lcd480' : 'amoled544'} />
    </Suspense>
  );
}
