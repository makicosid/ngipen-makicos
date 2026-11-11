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
        <img src={src} alt={alt} className="absolute left-1/2 top-1/2 rounded-full object-cover" style={{ width: size * 0.92, height: size * 0.92, transform: "translate(-50%, -50%)" }} />
      ) : (
        <span className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full bg-red-100 font-black text-red-700 dark:bg-red-950 dark:text-red-300" style={{ width: size * 0.74, height: size * 0.74, fontSize: Math.max(12, size * 0.25), transform: "translate(-50%, -50%)" }}>{fallback}</span>
      )}
      {frameSrc && <img src={frameSrc} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-none select-none object-contain" style={{ width: size * 1.3, height: size * 1.3, transform: "translate(-50%, -50%)" }} />}
    </span>
  );
}
