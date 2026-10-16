import ClaudeSpark from "../icons/ClaudeSpark";
import { cn } from "../../utils/cn";

type Props = {
  size?: "sm" | "md";
  showWordmark?: boolean;
  className?: string;
};

type BrandEnvironment = { VITE_BRAND_LOGO_URL?: string };

export function getBrandArtworkUrl(env?: BrandEnvironment): string | undefined {
  return env?.VITE_BRAND_LOGO_URL?.trim() || undefined;
}

/** Use the local vector mark by default; a provided URL opts into external artwork. */
export default function BrandLogo({
  size = "sm",
  showWordmark = true,
  className,
}: Props) {
  const env = (import.meta as unknown as { env?: BrandEnvironment }).env;
  const logoUrl = getBrandArtworkUrl(env);
  const markSize = size === "md" ? 28 : 22;

  return (
    <span
      role="img"
      aria-label="Claude"
      className={cn("inline-flex shrink-0 items-center gap-2 text-ink", className)}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={cn(
            "shrink-0 object-contain",
            showWordmark ? "h-6 max-w-[108px]" : "h-5 w-5"
          )}
          draggable={false}
        />
      ) : (
        <>
          <ClaudeSpark size={markSize} className="shrink-0 text-current" />
          {showWordmark && (
            <span
              aria-hidden="true"
              className={cn(
                "font-sans font-semibold tracking-[-0.045em]",
                size === "md" ? "text-[19px]" : "text-[16px]"
              )}
            >
              Claude
            </span>
          )}
        </>
      )}
    </span>
  );
}
