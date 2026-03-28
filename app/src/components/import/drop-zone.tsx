'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string[];
  children: ReactNode;
}

export function DropZone({ onFiles, accept, children }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const filterFiles = useCallback(
    (fileList: FileList): File[] => {
      const arr = Array.from(fileList);
      if (!accept || accept.length === 0) return arr;
      return arr.filter((f) =>
        accept.some((ext) => f.name.toLowerCase().endsWith(ext.toLowerCase()))
      );
    },
    [accept]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the root element (not a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const files = filterFiles(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [filterFiles, onFiles]
  );

  return (
    <div
      className="relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {dragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-blue-400 bg-blue-500/10 backdrop-blur-sm">
          <Upload className="h-10 w-10 text-blue-400" />
          <p className="text-base font-semibold text-blue-300">Drop HEC-RAS file here</p>
          {accept && accept.length > 0 && (
            <p className="text-xs text-blue-400/80">
              Accepted: {accept.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
