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
  top_supporter: "/profile-frames/exclusive/top-supporter-imperial.png",
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
  const isMemberFrame = frameKey === "kitsune_member";
  const isTopSupporterFrame = frameKey === "top_supporter";
  const avatarScale = 0.92;
  const frameScale = isMemberFrame || isTopSupporterFrame ? 1.5 : 1.3;

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-visible align-middle ${className}`} style={{ width: size * frameScale, height: size * frameScale }}>
      {src ? (
        <img src={src} alt={alt} className="absolute left-1/2 top-1/2 rounded-full object-cover" style={{ width: size * avatarScale, height: size * avatarScale, transform: "translate(-50%, -50%)" }} />
      ) : (
        <span className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full bg-red-100 font-black text-red-700 dark:bg-red-950 dark:text-red-300" style={{ width: size * avatarScale, height: size * avatarScale, fontSize: Math.max(12, size * 0.25), transform: "translate(-50%, -50%)" }}>{fallback}</span>
      )}
      {frameSrc && <img src={frameSrc} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-none select-none object-contain" style={{ width: size * frameScale, height: size * frameScale, transform: "translate(-50%, -50%)" }} />}
    </span>
  );
}
