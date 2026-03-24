import React, { useState, useRef } from 'react';
import { Upload, Camera, RefreshCw, User as UserIcon } from 'lucide-react';
import heic2any from 'heic2any';

interface ProfileImageUploadProps {
  currentImage?: string;
  onChange: (base64: string) => void;
}

export const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({ 
  currentImage, 
  onChange 
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<string | null> => {
    try {
      let blob: Blob = file;
      
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64 = await processFile(file);
    if (base64) {
      setPreview(base64);
      onChange(base64);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange('');
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-100 shadow-sm bg-slate-50 flex items-center justify-center">
          {preview || currentImage ? (
            <img 
              src={preview || currentImage} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon size={32} className="text-slate-300" />
          )}
          
          {isConverting && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
            </div>
          )}
        </div>
        
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute -bottom-1 -right-1 p-2 bg-emerald-600 text-white rounded-full shadow-md hover:bg-emerald-700 transition-all hover:scale-110 border-2 border-white"
          title="Change Photo"
        >
          <Camera size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
        >
          <Upload size={14} />
          {preview || currentImage ? 'Change Image' : 'Upload Photo'}
        </button>
        
        {(preview || currentImage) && (
          <button 
            type="button"
            onClick={handleRemove}
            className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors text-left"
          >
            Remove Photo
          </button>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,.heic,.heif"
        className="hidden"
      />
    </div>
  );
};
