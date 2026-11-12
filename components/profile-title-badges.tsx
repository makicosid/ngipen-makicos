"use client";

export interface ProfileTitle {
  title_key: string;
  title_name: string;
  title_type: "regular" | "exclusive";
  style_variant?: "regular" | "exclusive";
}

interface ProfileTitleBadgesProps {
  titles?: ProfileTitle[] | null;
  className?: string;
  align?: "left" | "center";
  size?: "sm" | "md";
}

export default function ProfileTitleBadges({
  titles,
  className = "",
  align = "left",
  size = "sm",
}: ProfileTitleBadgesProps) {
  const safeTitles = titles ?? [];

  if (safeTitles.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        align === "center" ? "justify-center" : "justify-start"
      } ${className}`}
    >
      {safeTitles.map((title) => {
        const exclusive =
          title.title_type === "exclusive" ||
          title.style_variant === "exclusive";

        return (
          <span
            key={title.title_key}
            className={
              exclusive
                ? `inline-flex items-center gap-1.5 rounded-md border border-[#D6B45B] bg-[#8F1D2C] px-3 py-1.5 font-black tracking-[0.02em] text-[#FFE8A3] shadow-sm ${
                    size === "md" ? "text-xs" : "text-[10px]"
                  }`
                : `inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/90 px-2.5 py-1 font-bold tracking-[0.04em] text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200 ${
                    size === "md" ? "text-xs" : "text-[10px]"
                  }`
            }
            title={title.title_name}
          >
            {exclusive ? (
              <span aria-hidden="true" className="text-[#F4D27C]">
                ✦
              </span>
            ) : (
              <span aria-hidden="true" className="text-rose-500">
                ◇
              </span>
            )}
            {title.title_name}
            {exclusive && (
              <span aria-hidden="true" className="text-[#F4D27C]">
                ✦
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
