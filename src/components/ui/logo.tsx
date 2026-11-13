import * as React from "react"
import Image from "next/image";
import { cn } from "@/lib/utils"

interface LogoProps {
    /** Size/extra classes for the tile, e.g. "h-12 w-12". Defaults to h-10 w-10. */
    className?: string;
    priority?: boolean;
}

/**
 * Inventra brand mark. The emblem's strokes are dark slate on a transparent
 * background, so it sits on a light rounded tile to stay crisp and readable
 * on the app's dark theme.
 */
export const Logo = React.forwardRef<HTMLSpanElement, LogoProps>(({ className, priority }, ref) => (
    <span
        ref={ref}
        className={cn(
            "relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1",
            "shadow-md shadow-primary/20 ring-1 ring-white/20",
            className,
        )}
    >
        <Image
            src="/inventra-logo-icon.png"
            alt="Inventra logo"
            width={96}
            height={96}
            priority={priority}
            className="h-full w-full object-contain"
        />
    </span>
));
Logo.displayName = "Logo";
