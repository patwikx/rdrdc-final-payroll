'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect, useState } from 'react';

interface SidebarWrapperProps {
  children: React.ReactNode;
}

export function SidebarWrapper({ children }: SidebarWrapperProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(true); // Default to open
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Set initial state based on device type
    const shouldBeOpen = !isMobile; // Open on desktop, closed on mobile
    setIsOpen(shouldBeOpen);
    
    // Set the cookie to match the device-appropriate state
    document.cookie = `sidebar_state=${shouldBeOpen}; path=/; max-age=604800`;
  }, [isMobile]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <SidebarProvider defaultOpen={true}>
        {children}
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider 
      open={isOpen} 
      onOpenChange={setIsOpen}
      defaultOpen={!isMobile}
    >
      {children}
    </SidebarProvider>
  );
}