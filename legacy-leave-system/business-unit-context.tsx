// context/business-unit-context.tsx
'use client';

import { createContext, useContext } from 'react';

interface BusinessUnitContextType {
  businessUnitId: string | null;
}

const BusinessUnitContext = createContext<BusinessUnitContextType | null>(null);

export function useBusinessUnit() {
  const context = useContext(BusinessUnitContext);
  if (!context) {
    throw new Error('useBusinessUnit must be used within a BusinessUnitProvider');
  }
  return context;
}

export function BusinessUnitProvider({ children, businessUnitId }: { children: React.ReactNode; businessUnitId: string | null }) {
  return (
    <BusinessUnitContext.Provider value={{ businessUnitId }}>
      {children}
    </BusinessUnitContext.Provider>
  );
}