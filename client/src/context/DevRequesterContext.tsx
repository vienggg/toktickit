import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Requester {
  id: number;
  name: string;
  email: string;
  department: string;
  isActive: boolean;
}

interface DevRequesterContextType {
  currentRequester: Requester | null;
  requesters: Requester[];
  isLoading: boolean;
  error: string | null;
  setCurrentRequester: (requester: Requester) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  fetchRequesters: () => Promise<void>;
}

const DevRequesterContext = createContext<DevRequesterContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'toktick_dev_requester_id';

export function DevRequesterProvider({ children }: { children: React.ReactNode }) {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [currentRequester, setCurrentRequesterState] = useState<Requester | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchRequesters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/requesters');
      if (!res.ok) {
        throw new Error(`Failed to fetch requesters (HTTP ${res.status})`);
      }
      const data: Requester[] = await res.json();
      setRequesters(data);

      // Check saved requester in localStorage
      const savedIdStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      const savedId = savedIdStr ? parseInt(savedIdStr, 10) : null;

      let selected = data.find((r) => r.id === savedId);
      if (!selected && data.length > 0) {
        selected = data[0]; // Default to Jennifer Anderson (id: 1)
      }

      if (selected) {
        setCurrentRequesterState(selected);
        localStorage.setItem(LOCAL_STORAGE_KEY, String(selected.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequesters();
  }, []);

  const setCurrentRequester = (requester: Requester) => {
    setCurrentRequesterState(requester);
    localStorage.setItem(LOCAL_STORAGE_KEY, String(requester.id));
  };

  return (
    <DevRequesterContext.Provider
      value={{
        currentRequester,
        requesters,
        isLoading,
        error,
        setCurrentRequester,
        isModalOpen,
        setIsModalOpen,
        fetchRequesters,
      }}
    >
      {children}
    </DevRequesterContext.Provider>
  );
}

export function useDevRequester(): DevRequesterContextType {
  const context = useContext(DevRequesterContext);
  if (!context) {
    throw new Error('useDevRequester must be used within a DevRequesterProvider');
  }
  return context;
}
