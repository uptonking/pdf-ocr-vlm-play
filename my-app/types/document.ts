// Document types based on API response structure

export interface Element {
    id: string;
    role: string;
    type: string;
    bbox: [number, number, number, number];
    text?: string;
    confidence?: number;
    field_name?: string;
    imageUrl?: string;
    elements?: Element[];
}

export interface Page {
    pageIndex: number;
    pageSize: { width: number; height: number };
    dpi: number;
    rotation: number;
    background?: string;
    imageUrl?: string;
    pdfUrl?: string;
    elements: Element[];
}

export interface DocumentData {
    documentId: string;
    imageUrl?: string;
    pdfUrl?: string;
    pages: Page[];
}

export interface UploadResponse {
    success: boolean;
    data?: DocumentData;
    error?: string;
}
