
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ClientLayout from "../client-layout";
import { LegalHeader } from "./legal-header";


export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientLayout>
        <LegalHeader />
        <main>{children}</main>
        <footer className="border-t border-border/50 mt-24">
          <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
              <div>
                <div className="font-semibold text-foreground">Inventra</div>
                <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Inventra — All rights reserved</div>
              </div>
            </Link>

            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors duration-300">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors duration-300">Terms</Link>
              <Link href="/refund" className="hover:text-foreground transition-colors duration-300">Refund Policy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors duration-300">Contact</Link>
            </div>
          </div>
        </footer>
    </ClientLayout>
  );
}
