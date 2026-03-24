import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';
import heic2any from 'heic2any';

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
  maxImages?: number;
  label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  images, 
  onChange, 
  multiple = false, 
  maxImages = 5,
  label = "Upload Image"
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<string | null> => {
    try {
      let blob: Blob = file;
      
      // Handle HEIC/HEIF
      if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        setIsConverting(true);
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.7
        });
        blob = Array.isArray(converted) ? converted[0] : converted;
        setIsConverting(false);
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error processing image:", error);
      setIsConverting(false);
      return null;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    
    const newImages = [...images];
    const limit = multiple ? maxImages : 1;

    for (let i = 0; i < files.length; i++) {
      if (newImages.length >= limit) break;
      const base64 = await processFile(files[i]);
      if (base64) {
        if (multiple) {
          newImages.push(base64);
        } else {
          newImages[0] = base64;
        }
      }
    }
    onChange(newImages);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {label && <label className="block text-sm font-bold text-slate-700 mb-1">{label}</label>}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img, index) => (
          <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group shadow-sm">
            <img src={img} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <button 
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {(multiple ? images.length < maxImages : images.length === 0) && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
            }`}
          >
            {isConverting ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
            ) : (
              <>
                <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-2 group-hover:text-emerald-500 transition-colors">
                  {multiple ? <Plus size={24} /> : <Upload size={24} />}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isDragging ? 'Drop here' : (multiple ? 'Add More' : 'Upload')}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        accept="image/*,.heic,.heif"
        multiple={multiple}
        className="hidden"
      />
      
      <p className="text-[10px] text-slate-400 italic">
        Supports JPG, PNG, HEIC (iPhone). Max {multiple ? maxImages : 1} images.
      </p>
    </div>
  );
};
