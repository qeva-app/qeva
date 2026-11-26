'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image } from 'lucide-react';
import { toast } from 'sonner';

interface IconUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export default function IconUpload({ value, onChange }: IconUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPEG, SVG, and WebP allowed');
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error('Max file size is 512KB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('icon', file);

      const res = await fetch('/api/upload/icon', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        onChange(data.url);
        toast.success('Icon uploaded');
      } else {
        toast.error('Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt="Icon" className="w-10 h-10 rounded-lg object-cover border border-border" />
            <button
              onClick={() => onChange('')}
              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive/100 text-white rounded-full flex items-center justify-center"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
            <Image size={20} />
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-outline btn-sm"
        >
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Upload Icon'}
        </button>
      </div>
    </div>
  );
}
