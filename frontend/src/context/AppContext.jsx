import { createContext, useContext, useState } from 'react';
import { initialProjects } from '../data/demoData.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [projects, setProjects] = useState(initialProjects);

  return (
    <AppContext.Provider value={{ projects, setProjects }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppData must be used within AppProvider');
  }
  return context;
}
