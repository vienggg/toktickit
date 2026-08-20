import React, { createContext, useContext, useState, useEffect } from "react";
import { RequesterUser } from "../types";

interface DevRequesterContextType {
  selectedRequester: RequesterUser | null;
  requesters: RequesterUser[];
  loading: boolean;
  error: string | null;
  isModalOpen: boolean;
  selectRequester: (user: RequesterUser) => void;
  openModal: () => void;
  closeModal: () => void;
  refreshRequesters: () => Promise<void>;
}

const DevRequesterContext = createContext<DevRequesterContextType | undefined>(undefined);

const STORAGE_KEY = "toktickit_dev_requester";

export const DevRequesterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedRequester, setSelectedRequester] = useState<RequesterUser | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [requesters, setRequesters] = useState<RequesterUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(() => !localStorage.getItem(STORAGE_KEY));

  const fetchRequesters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/requesters");
      if (!res.ok) {
        throw new Error(`Failed to load development requesters (Status ${res.status})`);
      }
      const data: RequesterUser[] = await res.json();
      setRequesters(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequesters();
  }, []);

  const selectRequester = (user: RequesterUser) => {
    setSelectedRequester(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setIsModalOpen(false);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    if (selectedRequester) {
      setIsModalOpen(false);
    }
  };

  return (
    <DevRequesterContext.Provider
      value={{
        selectedRequester,
        requesters,
        loading,
        error,
        isModalOpen,
        selectRequester,
        openModal,
        closeModal,
        refreshRequesters: fetchRequesters
      }}
    >
      {children}
    </DevRequesterContext.Provider>
  );
};

export const useDevRequester = (): DevRequesterContextType => {
  const context = useContext(DevRequesterContext);
  if (!context) {
    throw new Error("useDevRequester must be used within a DevRequesterProvider");
  }
  return context;
};
