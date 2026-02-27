'use client';

import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface BusinessUnitLogoUploadProps {
  currentImageUrl?: string | null;
  businessUnitInitials: string;
  businessUnitName: string;
  businessUnitId: string;
  onUploadSuccess: (imageUrl: string, fileName: string) => void;
  onRemoveSuccess: () => void;
}

export function BusinessUnitLogoUpload({
  currentImageUrl,
  businessUnitInitials,
  businessUnitName,
  businessUnitId,
  onUploadSuccess,
  onRemoveSuccess,
}: BusinessUnitLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);

  // Update previewUrl when currentImageUrl changes
  useEffect(() => {
    setPreviewUrl(currentImageUrl || null);
  }, [currentImageUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('businessUnitId', businessUnitId);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/upload/business-unit-logo', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      if (result.success) {
        toast.success('Business unit logo updated successfully');
        onUploadSuccess(result.fileUrl, result.fileName);
        setPreviewUrl(result.fileUrl);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
      // Revert preview on error
      setPreviewUrl(currentImageUrl || null);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Clear the input
      event.target.value = '';
    }
  };

  const handleRemove = async () => {
    if (!currentImageUrl) return;

    try {
      // Extract filename from URL if needed
      const fileName = currentImageUrl.split('/').pop();
      
      const response = await fetch(`/api/upload/business-unit-logo?fileName=${fileName}&businessUnitId=${businessUnitId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      if (result.success) {
        toast.success('Business unit logo removed successfully');
        setPreviewUrl(null);
        onRemoveSuccess();
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove logo');
    }
  };

  return (
    <div className="space-y-4">
      {/* Business Unit Logo Display */}
      <div className="flex justify-center relative">
        <div className="relative">
          <div className="h-32 w-32 border-4 border-background shadow-lg rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt={businessUnitName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-2xl font-semibold text-muted-foreground">
                {businessUnitInitials}
              </div>
            )}
          </div>
          
          {/* Upload Button */}
          <div className="absolute -bottom-2 -right-2">
            <label htmlFor="business-unit-logo" className="cursor-pointer">
              <div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:bg-primary/90 transition-colors border-2 border-background">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </div>
              <input
                id="business-unit-logo"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Instructions and Actions */}
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Click the camera icon to upload a business unit logo
        </p>
        <p className="text-xs text-muted-foreground">
          Maximum size: 5MB • Supported formats: JPG, PNG, WebP, GIF
        </p>
        
        {previewUrl && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRemove}
            disabled={isUploading}
            className="text-xs gap-1"
          >
            <X className="h-3 w-3" />
            Remove Logo
          </Button>
        )}
      </div>
    </div>
  );
}