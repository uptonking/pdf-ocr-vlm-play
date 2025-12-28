'use client';

import React, { useEffect, useRef } from 'react';

interface BackgroundLayerProps {
    imageUrl?: string;
    pdfUrl?: string;
    pageIndex: number;
    pageSize: { width: number; height: number };
    dpi: number;
    rotation: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    dpr: number;
    viewportWidth: number;
    viewportHeight: number;
    style?: React.CSSProperties;
    onRenderComplete?: () => void;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
    imageUrl,
    pdfUrl,
    pageIndex,
    pageSize,
    dpi,
    rotation,
    scale,
    offsetX,
    offsetY,
    dpr,
    viewportWidth,
    viewportHeight,
    style,
    onRenderComplete,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
    const abortedRef = useRef(false);
    const renderCompleteRef = useRef(false);
    const lastPdfUrlRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Only cancel if PDF URL actually changed
        const pdfChanged = pdfUrl !== lastPdfUrlRef.current;

        // Cancel any previous render task only if URL changed
        if (pdfChanged && renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch (e) {
                // Ignore cancellation errors
            }
            renderTaskRef.current = null;
        }

        // Reset aborted flag and render completion
        abortedRef.current = false;
        renderCompleteRef.current = false;

        // Store current PDF URL
        lastPdfUrlRef.current = pdfUrl;

        canvas.width = viewportWidth * dpr;
        canvas.height = viewportHeight * dpr;
        canvas.style.width = `${viewportWidth}px`;
        canvas.style.height = `${viewportHeight}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, viewportWidth, viewportHeight);

        // Fill with white background immediately (especially for PDFs)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewportWidth, viewportHeight);

        const renderBackground = async () => {
            // Check if this render was aborted
            if (abortedRef.current) return;

            try {
                if (imageUrl) {
                    // Restore CTM with DPR scaling for image rendering
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                    const img = new Image();
                    img.src = imageUrl;
                    img.onerror = () => {
                        if (abortedRef.current) return;
                        ctx.fillStyle = '#fefefe';
                        ctx.fillRect(0, 0, viewportWidth, viewportHeight);
                        ctx.fillStyle = 'gray';
                        ctx.font = '20px Arial';
                        ctx.fillText('Image Load Failed', 50, 50);
                    };
                    img.onload = () => {
                        if (abortedRef.current) return;
                        const rotatedWidth = rotation % 180 === 0 ? pageSize.width : pageSize.height;
                        const rotatedHeight = rotation % 180 === 0 ? pageSize.height : pageSize.width;
                        const drawWidth = rotatedWidth * scale;
                        const drawHeight = rotatedHeight * scale;

                        ctx.save();
                        ctx.translate(offsetX + drawWidth / 2, offsetY + drawHeight / 2);
                        ctx.rotate((rotation * Math.PI) / 180);
                        ctx.translate(-drawWidth / 2, -drawHeight / 2);
                        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
                        ctx.restore();

                        // Signal that image rendering is complete
                        onRenderComplete?.();
                    };
                } else if (pdfUrl) {
                    const PDFJS = await import('pdfjs-dist');
                    PDFJS.GlobalWorkerOptions.workerSrc = new URL(
                        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
                        import.meta.url,
                    ).toString();

                    const loadingTask = PDFJS.getDocument(pdfUrl);
                    const pdf = await loadingTask.promise;

                    // Check for abort after getting PDF
                    if (abortedRef.current) return;

                    const page = await pdf.getPage(pageIndex + 1);

                    // Get PDF's native viewport size (in points at 72 DPI)
                    const nativeViewport = page.getViewport({ scale: 1, rotation });
                    const pdfWidth = nativeViewport.width;
                    const pdfHeight = nativeViewport.height;

                    // pageSize from OCR is pixels at 300 DPI
                    // Calculate scale to make PDF match pageSize
                    const pdfScale = (pageSize.width / pdfWidth + pageSize.height / pdfHeight) / 2;

                    // Viewport should match what we want to render (before DPR scaling)
                    // The transform matrix will handle DPR
                    const viewport = page.getViewport({ scale: pdfScale * scale, rotation });

                    // Check for abort before rendering
                    if (abortedRef.current) return;

                    // Reset CTM to identity before PDF rendering (undo ctx.scale)
                    ctx.setTransform(1, 0, 0, 1, 0, 0);

                    const renderTask = page.render({
                        canvasContext: ctx,
                        viewport,
                        canvas: canvas,
                        // Transform handles all scaling and positioning
                        transform: [dpr, 0, 0, dpr, offsetX * dpr, offsetY * dpr],
                    });

                    // Store the render task for cancellation
                    renderTaskRef.current = renderTask;

                    try {
                        await renderTask.promise;
                        // Mark render as complete and signal callback
                        if (!abortedRef.current) {
                            renderCompleteRef.current = true;
                            onRenderComplete?.();
                        }
                    } catch (e: any) {
                        // Ignore errors from cancelled renders
                        if (e.name !== 'RenderingCancelledException' && e.message?.includes('cancelled') === false) {
                            console.error('PDF render error:', e);
                        }
                    }
                } else {
                    ctx.fillStyle = '#fefefe';
                    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
                }
            } catch (error) {
                // Only log errors that aren't from cancellation
                if ((error as any)?.name !== 'RenderingCancelledException') {
                    console.error('Error rendering background:', error);
                }
            }
        };

        renderBackground();

        // Cleanup function to cancel render on unmount or dependency change
        return () => {
            abortedRef.current = true;
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                } catch (e) {
                    // Ignore cancellation errors
                }
                renderTaskRef.current = null;
            }
        };
    }, [imageUrl, pdfUrl, pageIndex, pageSize, dpi, rotation, scale, offsetX, offsetY, dpr, viewportWidth, viewportHeight]);

    return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, ...style }} />;
};

export default BackgroundLayer;
