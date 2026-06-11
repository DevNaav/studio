
'use client';

import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function LegalHeader() {
    const pathname = usePathname();

    const navItems = [
        { href: "/", label: "Home" },
        { href: "/contact", label: "Contact" },
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
        { href: "/refund", label: "Refund Policy" },
    ];
    return (
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
            <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                    <Logo />
                    <div className="font-semibold text-lg text-foreground">Inventra</div>
                </Link>
                <nav className="hidden md:flex items-center gap-6">
                    {navItems.map((item) => (
                         <Link key={item.href} href={item.href} className={
                            cn("text-sm transition-colors duration-300", 
                                pathname === item.href ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                            )}>
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" asChild><Link href="/login">Login</Link></Button>
                    <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-300 shadow-lg shadow-primary/20">
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
