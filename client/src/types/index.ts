export interface RequesterUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Attachment {
  id: number;
  ticketId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isRemoved: boolean;
  removedReason?: string | null;
  removedAt?: string | null;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  currentStatus: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  createdAt: string;
  updatedAt: string;
  requester?: RequesterUser;
  category?: Category;
  relatedSystem?: RelatedSystem;
  attachments?: Attachment[];
  _count?: {
    attachments: number;
  };
}
