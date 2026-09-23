import React, { useRef, useState } from 'react';
import { UploadCloud, X, FileUp } from 'lucide-react';
import { Badge, ActionIcon, Button } from '@mantine/core';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onFilesSelected,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFilesSelected(Array.from(fileList));
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-[#141519] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl p-5 text-zinc-800 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Add Files to Spatial Canvas
            </span>
            <Badge size="xs" variant="light" color="orange">
              Auto-cluster
            </Badge>
          </div>
          <ActionIcon onClick={onClose} variant="subtle" color="gray" size="sm">
            <X className="w-4 h-4" />
          </ActionIcon>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 py-10 px-4 border border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-orange-500 bg-orange-500/[0.04]'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500'
          }`}
        >
          <UploadCloud className="w-7 h-7 text-orange-500 mb-2" />
          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
            Drop files here, or <span className="text-orange-500 underline">browse</span>
          </p>
          <p className="text-[10px] text-zinc-400 mt-1">
            PDFs, images, audio, markdown, code, and CSV spreadsheets
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>
    </div>
  );
};
