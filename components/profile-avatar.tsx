"use client";

interface ProfileAvatarProps {
  src?: string | null;
  frameKey?: string | null;
  fallback?: string;
  size?: number;
  className?: string;
  alt?: string;
}

const FRAME_ASSETS: Record<string, string> = {
  free_red: "/profile-frames/free/free-red.png",
  free_yellow: "/profile-frames/free/free-yellow.png",
  free_blue: "/profile-frames/free/free-blue.png",
  kitsune_member: "/profile-frames/member/kitsune-member-square.png",
};

export default function ProfileAvatar({
  src,
  frameKey,
  fallback = "U",
  size = 48,
  className = "",
  alt = "",
}: ProfileAvatarProps) {
  const frameSrc = frameKey ? FRAME_ASSETS[frameKey] : undefined;

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-visible align-middle ${className}`} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full rounded-full object-cover" style={{ width: size, height: size }} />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-red-100 font-black text-red-700 dark:bg-red-950 dark:text-red-300" style={{ fontSize: Math.max(12, size * 0.34) }}>{fallback}</span>
      )}
      {frameSrc && <img src={frameSrc} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none object-contain" style={{ width: size * 1.52, height: size * 1.52, transform: "translate(-50%, -50%)" }} />}
    </span>
  );
}
