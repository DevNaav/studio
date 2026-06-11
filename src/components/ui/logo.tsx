import * as React from "react"
import Image from "next/image";
import { cn } from "@/lib/utils"

export const Logo = React.forwardRef<
    HTMLImageElement,
    Omit<React.ComponentProps<typeof Image>, 'src' | 'alt'>
>(({ className, ...props }, ref) => (
    <Image 
        src="/inventra-logo.png"
        alt="Inventra Logo"
        width={32}
        height={32}
        className={cn("h-8 w-8", className)} 
        {...props} 
    />
));
Logo.displayName = "Logo";

    