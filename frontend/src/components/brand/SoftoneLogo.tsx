import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export type SoftoneLogoVariant = "primary" | "stacked" | "extended" | "icon";

const LOGO_VERSION = "2";

const LOGO_SRC: Record<SoftoneLogoVariant, string> = {
  primary: `/logos/logo-primary.png?v=${LOGO_VERSION}`,
  stacked: `/logos/logo-stacked.png?v=${LOGO_VERSION}`,
  extended: `/logos/logo-extended.png?v=${LOGO_VERSION}`,
  icon: `/logos/logo-icon.png?v=${LOGO_VERSION}`,
};

function pickVariant(width: number, height: number, forceIcon: boolean): SoftoneLogoVariant {
  if (forceIcon || width < 56) return "icon";

  const ratio = width / Math.max(height, 1);

  if (ratio >= 2.15) return "extended";
  if (ratio >= 1.25) return "primary";
  if (ratio >= 0.72) return "stacked";
  return "icon";
}

interface SoftoneLogoProps {
  className?: string;
  /** Sidebar collapsed — always show ear icon only */
  collapsed?: boolean;
  alt?: string;
}

export function SoftoneLogo({
  className,
  collapsed = false,
  alt = "Softone Hearing",
}: SoftoneLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<SoftoneLogoVariant>(
    collapsed ? "icon" : "primary"
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setVariant(pickVariant(width, height, collapsed));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [collapsed]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "softone-logo flex items-center justify-center w-full overflow-hidden",
        collapsed ? "h-10" : "h-14 min-h-[2.5rem]",
        className
      )}
      data-logo-variant={variant}
    >
      <img
        src={LOGO_SRC[variant]}
        alt={alt}
        className={clsx(
          "max-w-full max-h-full w-auto h-auto object-contain select-none",
          variant === "icon" ? "h-8 w-8" : "h-full"
        )}
        draggable={false}
      />
    </div>
  );
}
