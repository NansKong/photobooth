'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F4EFE6] text-[#282A2B] font-retro">
      <div className="text-center p-6">
        <p className="text-sm">Redirecting to photobooth lounge...</p>
      </div>
    </div>
  );
}
