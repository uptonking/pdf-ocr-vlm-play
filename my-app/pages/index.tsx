'use client';

import React, { useState, useEffect } from 'react';
import DocumentViewer from '../components/DocumentViewer';
import Sidebar from '../components/Sidebar';
import PlaceholderViewer from '../components/PlaceholderViewer';
import { uploadImage } from '../utils/api';
import { message } from 'antd';
import { DocumentData } from '../types/document';


const Home: React.FC = () => {
    const [payload, setPayload] = useState<DocumentData | null>(null);
    const [viewMode, setViewMode] = useState<'overlay' | 'side-by-side'>('overlay');
    const [opacity, setOpacity] = useState(0.5);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string>();
    const [uploadedFileName, setUploadedFileName] = useState<string>();
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const updateSize = () => {
            const sidebarWidth = sidebarCollapsed ? 50 : 300;
            setViewportSize({
                width: window.innerWidth - sidebarWidth - 40,
                height: window.innerHeight - 40,
            });
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [sidebarCollapsed]);

    useEffect(() => {
        const sidebarWidth = sidebarCollapsed ? 50 : 300;
        setViewportSize({
            width: window.innerWidth - sidebarWidth - 40,
            height: window.innerHeight - 40,
        });
    }, [payload, sidebarCollapsed]);

    const handlePlaceholderUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const imageUrl = URL.createObjectURL(file);
                handleImageUpload(file, imageUrl);
            }
        };
        input.click();
    };

    const handleZoomIn = () => {
        // TODO: Implement zoom in logic
    };

    const handleZoomOut = () => {
        // TODO: Implement zoom out logic
    };

    const handleImageUpload = async (file: File, imageUrl: string) => {
        console.log('Uploaded image:', file);

        setUploadedImageUrl(imageUrl);
        setUploadedFileName(file.name);

        setIsUploading(true);
        message.loading('Processing document...', 0);

        try {
            const response = await uploadImage(file);

            if (response.success && response.data) {
                // Merge imageUrl/pdfUrl into pages for rendering
                // Prepend backend URL to convert relative paths to absolute
                const backendUrl = 'http://localhost:8000';
                const processedData = {
                    ...response.data,
                    pages: response.data.pages.map(page => ({
                        ...page,
                        imageUrl: response.data.imageUrl
                            ? `${backendUrl}${response.data.imageUrl}`
                            : page.imageUrl,
                        pdfUrl: response.data.pdfUrl
                            ? `${backendUrl}${response.data.pdfUrl}`
                            : page.pdfUrl,
                    }))
                };
                setPayload(processedData);
                message.destroy();
                message.success('Document processed successfully!');
            } else {
                message.destroy();
                message.error(response.error || 'Failed to process document');
            }
        } catch (error) {
            message.destroy();
            message.error('Upload failed. Please try again.');
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex' }}>
            <Sidebar
                currentPage={currentPageIndex + 1}
                totalPages={payload?.pages.length || 1}
                onPrev={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                onNext={() => setCurrentPageIndex(prev => Math.min((payload?.pages.length || 1) - 1, prev + 1))}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onImageUpload={handleImageUpload}
                onCollapsedChange={setSidebarCollapsed}
                uploadedImageUrl={uploadedImageUrl}
                uploadedFileName={uploadedFileName}
            />
            
            <div style={{
                flex: 1,
                marginLeft: sidebarCollapsed ? 50 : 300,
                padding: 20,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'auto',
                background: '#f5f5f5',
                transition: 'margin-left 0.3s ease',
                minHeight: '100vh',
                maxWidth: `calc(100vw - ${sidebarCollapsed ? 50 : 300}px)`
            }}>
                {payload ? (
                    <DocumentViewer
                        key={payload.documentId} // Force re-render when document changes
                        documentId={payload.documentId}
                        initialPages={payload.pages}
                        viewportWidth={viewportSize.width}
                        viewportHeight={viewportSize.height}
                        currentPageIndex={currentPageIndex}
                    />
                ) : (
                    <PlaceholderViewer onUploadClick={handlePlaceholderUpload} />
                )}
            </div>
        </div>
    );
};

export default Home;
