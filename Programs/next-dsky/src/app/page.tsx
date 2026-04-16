import { Suspense } from "react";
import HomeContent from "./homeContent";

export default function Home() {
  return (
    <Suspense fallback={<main className="flex min-h-screen flex-col items-center justify-center bg-black text-green-500 font-mono"><div>Loading...</div></main>}>
      <HomeContent envOled={process.env.OLED_MODE !== '0'} envDisplay={process.env.DISPLAY_TYPE || 'default'} />
    </Suspense>
  );
}
