"use client";

import { useState,useEffect } from "react";
import { X, Star, Upload, Image as ImageIcon, Video, Link as LinkIcon, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (review: {
    rating: number;
    experience: string;
    images: File[];
    videoLinks: string[];
  }) => Promise<void>;
}

export function ReviewModal({ isOpen, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [experience, setExperience] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoLinks, setVideoLinks] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compressedSizes, setCompressedSizes] = useState<{original: number, compressed: number, progress?: number}[]>([]);
  const [compressingIndices, setCompressingIndices] = useState<Set<number>>(new Set());
  const getInitialMode = (): "light" | "dark" => {
        if (typeof document === "undefined") return "light";
        const dataMode = document
            .querySelector("[data-mode]")
            ?.getAttribute("data-mode");
        if (dataMode === "dark" || dataMode === "light") {
            return dataMode;
        }
        if (document.documentElement.classList.contains("dark")) {
            return "dark";
        }
        if (
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
            return "dark";
        }
        return "light";
    };

    const [mode, setMode] = useState<"light" | "dark">(getInitialMode);
    // Read mode from data attribute and html class, respond to changes
    useEffect(() => {
        const readMode = (): "light" | "dark" => {
            const el = document.querySelector("[data-mode]");
            const attr = el?.getAttribute("data-mode");
            if (attr === "dark" || attr === "light") return attr;
            return document.documentElement.classList.contains("dark")
                ? "dark"
                : "light";
        };

        // Set immediately on mount to avoid any flicker
        setMode(readMode());

        // Watch for changes on either data-mode or html class
        const observer = new MutationObserver(() => {
            setMode(readMode());
        });
        const dataModeTarget = document.querySelector("[data-mode]");
        if (dataModeTarget) {
            observer.observe(dataModeTarget, {
                attributes: true,
                attributeFilter: ["data-mode"],
            });
        }
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = [...selectedImages, ...files].slice(0, 5); // Max 5 images
    
    setSelectedImages(newImages);
    
    // Initialize compression sizes for new images (immediate feedback)
    const newCompressedSizes = [...compressedSizes];
    const newCompressingIndices = new Set(compressingIndices);
    
    // Process each file for compression preview
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageIndex = selectedImages.length + i; // Current index in the full array
      const needsCompression = file.size > 120 * 1024; // 120KB threshold
      
      if (needsCompression) {
        // Show "Will compress" initially, then do quick preview compression
        const compressionInfoIndex = newCompressedSizes.length; // Index in the newCompressedSizes array
        newCompressedSizes.push({ original: file.size, compressed: 0, progress: 0 });
        newCompressingIndices.add(imageIndex);
        
        // Set the initial state immediately to avoid race conditions
        setCompressedSizes(newCompressedSizes);
        setCompressingIndices(newCompressingIndices);
        
        // Do quick preview compression in background with progress
        try {
          const { compressImageWithProgress } = await import('../lib/image-compression');
          
          const compressedFile = await compressImageWithProgress(file, 100, 0.8, (progress) => {
            // Update progress for this specific image using the fixed compressionInfoIndex
            console.log(`Compression progress for image ${compressionInfoIndex}: ${Math.round(progress * 100)}%`);
            setCompressedSizes(prev => {
              const updatedSizes = [...prev];
              if (updatedSizes[compressionInfoIndex]) {
                updatedSizes[compressionInfoIndex] = {
                  ...updatedSizes[compressionInfoIndex],
                  progress: Math.round(progress * 100)
                };
              }
              return updatedSizes;
            });
          });
          
          // Update the compression info with final result
          setCompressedSizes(prev => {
            const updatedSizes = [...prev];
            if (updatedSizes[compressionInfoIndex]) {
              updatedSizes[compressionInfoIndex] = {
                original: file.size,
                compressed: compressedFile.size,
                progress: 100
              };
            }
            return updatedSizes;
          });
          
          // Remove from compressing set
          setCompressingIndices(prev => {
            const newSet = new Set(prev);
            newSet.delete(imageIndex);
            return newSet;
          });
          
        } catch (error) {
          console.error('Preview compression failed:', error);
          // Remove from compressing set on error
          setCompressingIndices(prev => {
            const newSet = new Set(prev);
            newSet.delete(imageIndex);
            return newSet;
          });
        }
      } else {
        // No compression needed
        newCompressedSizes.push({ original: file.size, compressed: file.size, progress: 100 });
        // Set state immediately for non-compressed images
        setCompressedSizes([...newCompressedSizes]);
      }
    }
    
    // Create previews
    const newPreviews = [...imagePreviews];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newPreviews.push(e.target.result as string);
          setImagePreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    const newCompressedSizes = compressedSizes.filter((_, i) => i !== index);
    
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
    setCompressedSizes(newCompressedSizes);
    
    // Remove from compressing indices if needed
    setCompressingIndices(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const addVideoLink = () => {
    setVideoLinks([...videoLinks, ""]);
  };

  const removeVideoLink = (index: number) => {
    const newLinks = videoLinks.filter((_, i) => i !== index);
    setVideoLinks(newLinks.length > 0 ? newLinks : [""]);
  };

  const updateVideoLink = (index: number, value: string) => {
    const newLinks = [...videoLinks];
    newLinks[index] = value;
    setVideoLinks(newLinks);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert("Please select a rating");
      return;
    }

    // Validate video links if any are provided
    const validVideoLinks = videoLinks.filter(link => link.trim() !== "");
    const invalidLinks = validVideoLinks.filter(link => !isValidUrl(link));
    
    if (invalidLinks.length > 0) {
      alert("Please enter valid URLs for video/drive links");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a compression progress callback
      const handleCompressionProgress = (index: number, originalSize: number, compressedSize: number) => {
        setCompressedSizes(prev => {
          const newSizes = [...prev];
          if (newSizes[index]) {
            newSizes[index] = { original: originalSize, compressed: compressedSize };
          }
          return newSizes;
        });
      };

      await onSubmit({
        rating,
        experience: experience.trim(),
        images: selectedImages,
        videoLinks: validVideoLinks,
      });

      // Reset form
      setRating(0);
      setExperience("");
      setSelectedImages([]);
      setImagePreviews([]);
      setVideoLinks([""]);
      setCompressedSizes([]);
      setCompressingIndices(new Set());
      onClose();
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
const isDark = mode === "dark";
  return (
    <Dialog open={isOpen} isdark={isDark} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle    className={cn(
                                      isDark
                                          ? "text-gray-200"
                                          : "text-gray-900"
                                  )}>Share Your Experience</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-6">
          {/* Rating */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDark ? "text-gray-400" : "text-gray-700"}`}>
              How would you rate your experience?
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="transition-all duration-200"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredStar || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    } hover:scale-110 transition-transform`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className={cn("mt-2 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>

          {/* Experience Description */}
          <div>
            <label className={cn("block text-sm font-medium mb-3", isDark ? "text-gray-200" : "text-gray-700")}>
              Tell us about your experience
            </label>
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Share your thoughts about the platform, contests, support, or any other aspect of your experience..."
              className={cn("w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none",
                isDark 
                  ? "border-gray-600 bg-gray-800 text-gray-200 placeholder-gray-400" 
                  : "border-gray-300 bg-white text-gray-900 placeholder-gray-500"
              )}
              rows={4}
              maxLength={1000}
            />
            <p className={cn("mt-1 text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
              {experience.length}/1000 characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className={cn("block text-sm font-medium mb-3", isDark ? "text-gray-200" : "text-gray-700")}>
              Share images (optional)
            </label>
            <p className={cn("text-xs mb-3", isDark ? "text-gray-400" : "text-gray-500")}>
              Images will be automatically compressed to 100KB for faster upload
            </p>
            
            {/* Upload Button */}
            <div className="mb-4">
              <label className="cursor-pointer">
                <div className={cn("border-2 border-dashed rounded-lg p-4 hover:border-purple-500 transition-colors",
                  isDark ? "border-gray-600" : "border-gray-300"
                )}>
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}>Click to upload images</p>
                    <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-gray-500")}>PNG, JPG, GIF up to 5MB each (auto-compressed to 100KB)</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </label>
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {imagePreviews.map((preview, index) => {
                    const compressionInfo = compressedSizes[index];
                    const originalSizeKB = compressionInfo ? (compressionInfo.original / 1024).toFixed(1) : '0';
                    const compressedSizeKB = compressionInfo?.compressed > 0 
                      ? (compressionInfo.compressed / 1024).toFixed(1) 
                      : 'Processing...';
                    const reductionPercent = compressionInfo?.compressed > 0
                      ? ((1 - compressionInfo.compressed / compressionInfo.original) * 100).toFixed(0)
                      : null;

                    return (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Compression Info Badge */}
                        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded-md">
                          {compressionInfo ? (
                            <>
                              <div className="font-semibold">
                                {compressingIndices.has(index) && compressionInfo.progress !== undefined && compressionInfo.progress < 100
                                  ? `Compressing ${compressionInfo.progress}%`
                                  : compressionInfo.compressed === 0 
                                    ? `${(compressionInfo.original / 1024).toFixed(1)}KB`
                                    : `${(compressionInfo.compressed / 1024).toFixed(1)}KB`
                                }
                              </div>
                              
                              {/* Show progress bar during compression */}
                              {compressingIndices.has(index) && compressionInfo.progress !== undefined && compressionInfo.progress < 100 && (
                                <div className="mt-1">
                                  <div className="w-full bg-gray-600 rounded-full h-1">
                                    <div 
                                      className="bg-green-400 h-1 rounded-full transition-all duration-300"
                                      style={{ width: `${compressionInfo.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                              
                              {compressionInfo.original !== compressionInfo.compressed && compressionInfo.compressed > 0 && (
                                <div className="text-green-300">
                                  -{((1 - compressionInfo.compressed / compressionInfo.original) * 100).toFixed(0)}%
                                </div>
                              )}
                              {/* {compressionInfo.original === compressionInfo.compressed && compressionInfo.compressed > 0 && (
                                <div className="text-blue-300">No compression</div>
                              )} */}
                              {compressionInfo.compressed === 0 && compressionInfo.progress === undefined && (
                                <div className="text-orange-300">Will compress</div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs">Loading...</div>
                          )}
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Video/Drive Links */}
          <div>
            <label className={cn("block text-sm font-medium mb-3", isDark ? "text-gray-200" : "text-gray-700")}>
              Share video or drive links (optional)
            </label>
            <p className={cn("text-xs mb-3", isDark ? "text-gray-400" : "text-gray-500")}>
              Add links to videos, Google Drive, Dropbox, or other cloud storage
            </p>
            
            <div className="space-y-3">
              {videoLinks.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      type="url"
                      value={link}
                      onChange={(e) => updateVideoLink(index, e.target.value)}
                      placeholder="https://drive.google.com/.."
                      style={{
                        backgroundColor: isDark ? '#020817' : '#ffffff',
                        borderColor: link && !isValidUrl(link) ? '#fca5a5' : (isDark ? '#4b5563' : '#d1d5db'),
                        color: isDark ? '#ffffff' : '#111827'
                      }}
                      className={cn("w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                        link && !isValidUrl(link) ? "border-red-300 focus:ring-red-500" : ""
                      )}
          
                    />
                  </div>
                  {videoLinks.length > 1 && (
                    <button
                      onClick={() => removeVideoLink(index)}
                      className={cn("p-2 text-red-500 rounded-lg transition-colors",
                        isDark ? "hover:bg-red-900/20" : "hover:bg-red-50"
                      )}
                      title="Remove link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              
              {videoLinks.length < 5 && (
                <button
                  onClick={addVideoLink}
                  className={cn("flex items-center gap-2 text-sm font-medium transition-colors",
                    isDark ? "text-purple-400 hover:text-purple-300" : "text-purple-600 hover:text-purple-700"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Add another link
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={cn("flex-1 px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              isDark 
                ? "border-gray-600 text-gray-200 hover:bg-gray-800" 
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
