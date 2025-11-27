import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

type ImagePreviewProps = {
  src: string | null;
  onClose: () => void;
};

export function ImagePreview({ src, onClose }: ImagePreviewProps) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="Preview" className="w-full h-full object-contain" />
        <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg">
          <ImageIcon size={24} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}

export default ImagePreview;
