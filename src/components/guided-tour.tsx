
'use client';

import React from 'react';
import { Joyride, type Step, type EventData } from 'react-joyride';

interface GuidedTourProps {
    run: boolean;
    onTourComplete: () => void;
}

const steps: Step[] = [
    {
        target: '#tour-step-1-dashboard',
        content: 'Welcome to your Dashboard! This is your main hub for viewing all active projects and key metrics at a glance.',
        skipBeacon: true,
    },
    {
        target: '#tour-step-2-sidebar-global',
        content: 'These are your Global Logs. You can manage all your machines, labor, and company-wide documents from here, independent of any specific site.',
    },
    {
        target: '#tour-step-3-add-project',
        content: 'Ready to start? Click here to create your first construction site or manufacturing unit. Let\'s go!',
    },
    {
        target: '#tour-step-4-copilot',
        content: 'Meet your new global Co-Pilot! Click this pulsing bubble on any page to open a direct voice and chat connection to the Inventra AI.',
    },
];

export function GuidedTour({ run, onTourComplete }: GuidedTourProps) {
    
    const handleJoyrideCallback = (data: EventData) => {
        const { status } = data;
        const finishedStatuses: string[] = ['finished', 'skipped'];

        if (finishedStatuses.includes(status)) {
            onTourComplete();
        }
    };

    return (
        <Joyride
            run={run}
            steps={steps}
            continuous
            onEvent={handleJoyrideCallback}
            options={{
                showProgress: true,
                buttons: ['back', 'close', 'skip', 'primary'],
                primaryColor: '#8b5cf6',
                textColor: '#ffffff',
                arrowColor: 'rgba(15, 10, 30, 0.9)',
                backgroundColor: 'rgba(15, 10, 30, 0.9)',
                zIndex: 1000,
                spotlightRadius: 16,
            }}
            styles={{
                tooltip: {
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 25px rgba(139, 92, 246, 0.15)',
                    backdropFilter: 'blur(20px)',
                    padding: '18px',
                },
                tooltipContent: {
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#d1d5db',
                },
                buttonPrimary: {
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '8px 16px',
                    boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
                },
                buttonBack: {
                    color: '#9ca3af',
                    marginRight: '12px',
                    fontSize: '12px',
                },
                buttonSkip: {
                    color: '#9ca3af',
                    fontSize: '12px',
                }
            }}
        />
    );
}
