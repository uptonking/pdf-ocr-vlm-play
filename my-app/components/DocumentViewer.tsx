'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { DomFormLayer } from './layers';
import { calculateScale, mapViewToPage, rotateBbox } from '../utils/coordinateTransforms';
import { debounce } from 'lodash';
import { Element } from '../utils/pdfExport';
import DocumentFrame from './DocumentFrame';

const BackgroundLayer = dynamic(() => import('./layers').then(mod => ({ default: mod.BackgroundLayer })), { ssr: false });

interface Page {
  pageIndex: number;
  pageSize: { width: number; height: number };
  dpi: number;
  rotation: number;
  imageUrl?: string;
  pdfUrl?: string;
  elements: Element[];
}

interface DocumentViewerProps {
  documentId: string;
  initialPages: Page[];
  viewportWidth: number;
  viewportHeight: number;
  policy?: 'fit-width' | 'fit-height' | 'fit-both';
  currentPageIndex?: number;
  onSave?: (pages: Page[]) => void;
  onExport?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  initialPages,
  viewportWidth,
  viewportHeight,
  policy = 'fit-both',
  currentPageIndex: externalCurrentPageIndex,
  onSave,
  onExport,
}) => {
  const [internalCurrentPageIndex, setInternalCurrentPageIndex] = useState(0);
  const currentPageIndex = externalCurrentPageIndex !== undefined ? externalCurrentPageIndex : internalCurrentPageIndex;
  const [formData, setFormData] = useState(initialPages);
  const [scaleInfo, setScaleInfo] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [dpr, setDpr] = useState(1);
  const [viewMode, setViewMode] = useState('overlay');
  const [opacity, setOpacity] = useState(0.5);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [renderSize, setRenderSize] = useState({ width: viewportWidth, height: viewportHeight });
  const [backgroundReady, setBackgroundReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDpr(window.devicePixelRatio || 1);
    }
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (initialPages.length === 0 || currentPageIndex >= initialPages.length) return;

      const width = viewportWidth;
      const ratio = initialPages[currentPageIndex].pageSize.height / initialPages[currentPageIndex].pageSize.width;
      const height = width * ratio;
      setRenderSize({ width, height });
    };

    updateSize();
  }, [initialPages, currentPageIndex, viewportWidth]);

  // Reset background ready state when page changes
  useEffect(() => {
    setBackgroundReady(false);
  }, [currentPageIndex]);

  const handleBackgroundRenderComplete = () => {
    setBackgroundReady(true);
  };

  const currentPage = initialPages[currentPageIndex];

  useEffect(() => {
    if (!currentPage) return;
    
    const { scale, offsetX, offsetY } = calculateScale(currentPage.pageSize, { width: renderSize.width, height: renderSize.height }, policy);
    setScaleInfo({ scale, offsetX, offsetY });
  }, [currentPage?.pageSize, renderSize, policy]);

  const handleDragEnd = (id: string, newViewBbox: [number, number, number, number]) => {
    const newPageBbox = mapViewToPage(newViewBbox, scaleInfo.scale, scaleInfo.offsetX, scaleInfo.offsetY);
    setFormData(prev => {
      const newPages = [...prev];
      const elIndex = newPages[currentPageIndex].elements.findIndex(el => el.id === id);
      if (elIndex !== -1) {
        newPages[currentPageIndex].elements[elIndex].bbox = newPageBbox;
      }
      return newPages;
    });
  };

  const handleInputChange = (id: string, value: any) => {
    setFormData(prev => {
      const newPages = [...prev];
      const elIndex = newPages[currentPageIndex].elements.findIndex(el => el.id === id);
      if (elIndex !== -1) {
        newPages[currentPageIndex].elements[elIndex].text = value;
      }
      return newPages;
    });
  };

  const handleZoomIn = () => {
    setScaleInfo(prev => ({ ...prev, scale: prev.scale * 1.2 }));
  };

  const handleZoomOut = () => {
    setScaleInfo(prev => ({ ...prev, scale: prev.scale / 1.2 }));
  };

  const debouncedSave = debounce(() => onSave?.(formData), 500);

  useEffect(() => {
    debouncedSave();
  }, [formData]);

  if (!currentPage) {
    return <div>Loading...</div>;
  }

  const rotatedElements = currentPage?.elements?.map(el => ({
    ...el,
    bbox: rotateBbox(el.bbox, currentPage.pageSize, currentPage.rotation),
  })) || [];

  const aspectRatio = currentPage?.pageSize?.width && currentPage?.pageSize?.height
    ? currentPage.pageSize.width / currentPage.pageSize.height
    : 1;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DocumentFrame
        width={`${renderSize.width}px`}
        height={`${renderSize.height}px`}
        aspectRatio={aspectRatio}
      >
        <BackgroundLayer
          imageUrl={currentPage.imageUrl}
          pdfUrl={currentPage.pdfUrl}
          pageIndex={currentPage.pageIndex}
          pageSize={currentPage.pageSize}
          dpi={currentPage.dpi}
          rotation={currentPage.rotation}
          scale={scaleInfo.scale}
          offsetX={scaleInfo.offsetX}
          offsetY={scaleInfo.offsetY}
          dpr={dpr}
          viewportWidth={renderSize.width}
          viewportHeight={renderSize.height}
          onRenderComplete={handleBackgroundRenderComplete}
        />
        {backgroundReady && (
          <DomFormLayer
            elements={rotatedElements}
            scale={scaleInfo.scale}
            offsetX={scaleInfo.offsetX}
            offsetY={scaleInfo.offsetY}
            viewportWidth={renderSize.width}
            viewportHeight={renderSize.height}
            pageSize={currentPage.pageSize}
            onChange={handleInputChange}
          />
        )}
      </DocumentFrame>
    </div>
  );
};

export default DocumentViewer;
