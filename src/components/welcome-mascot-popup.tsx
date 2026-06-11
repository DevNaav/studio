
'use client';

import { useState } from 'react';
import AestheticWavingMascot from "@/components/AestheticWavingMascot";
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

interface WelcomeMascotPopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WelcomeMascotPopup({ open, onOpenChange }: WelcomeMascotPopupProps) {
    if (!open) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 bg-transparent border-0 shadow-none max-w-xl" hideCloseButton={true}>
                <DialogTitle className="sr-only">Welcome to Inventra</DialogTitle>
                <AestheticWavingMascot
                    title="Welcome to Inventra!"
                    subtitle="We're glad to have you."
                    size={180}
                    allowExport={false}
                    onClose={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

    