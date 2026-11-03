
"use client";

import { useEffect } from "react";

export default function EventRedirect({
  eventId,
}: {
  eventId: string;
}) {
  useEffect(() => {
    window.location.replace(
      `/?event=${encodeURIComponent(eventId)}`
    );
  }, [eventId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 text-center text-gray-800">
      <p>Membuka detail event NGIPEN...</p>
    </main>
  );
}
