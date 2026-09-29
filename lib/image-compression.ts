/**
 * Compress an image file to a target size (default 100KB)
 * Only compresses if image is larger than 120KB threshold, otherwise returns original
 * @param file - The image file to compress
 * @param maxSizeKB - Target maximum size in KB (default: 100)
 * @param quality - Initial quality (0.1 to 1.0, default: 0.8)
 * @returns Promise<File> - Compressed or original image file
 */
/**
 * Compress an image file to a target size (default 100KB) with progress callback
 * Only compresses if image is larger than 120KB threshold, otherwise returns original
 * @param file - The image file to compress
 * @param maxSizeKB - Target maximum size in KB (default: 100)
 * @param quality - Initial quality (0.1 to 1.0, default: 0.8)
 * @param onProgress - Progress callback (0-1)
 * @returns Promise<File> - Compressed or original image file
 */
export async function compressImageWithProgress(
  file: File,
  maxSizeKB: number = 100,
  quality: number = 0.8,
  onProgress?: (progress: number) => void
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Don't compress if already at or below threshold (120KB buffer)
    if (file.size <= 120 * 1024) {
      onProgress?.(1);
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate new dimensions - more aggressive resizing for faster compression
        let { width, height } = img;
        const maxDimension = 1200; // Reduced from 1920 for faster processing
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        } else {
          // Also scale down smaller images if they're still too large
          const scaleFactor = Math.sqrt((maxSizeKB * 1024) / file.size) * 0.8;
          if (scaleFactor < 1) {
            width = width * scaleFactor;
            height = height * scaleFactor;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Faster compression with fewer quality steps and progress tracking
        let currentQuality = quality;
        const qualitySteps = 5; // Number of quality reduction steps
        let currentStep = 0;
        
        const compressWithQuality = () => {
          currentStep++;
          const progress = currentStep / qualitySteps;
          onProgress?.(progress);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }

              // If file is small enough or quality is too low, return the result
              if (blob.size <= maxSizeKB * 1024 || currentQuality <= 0.1) {
                onProgress?.(1);
                const compressedFile = new File(
                  [blob],
                  file.name,
                  {
                    type: file.type,
                    lastModified: Date.now(),
                  }
                );
                resolve(compressedFile);
                return;
              }

              // More aggressive quality reduction for fewer iterations
              currentQuality = Math.max(0.1, currentQuality - 0.2); // Reduce by 0.2 instead of 0.1
              compressWithQuality();
            },
            file.type,
            currentQuality
          );
        };

        compressWithQuality();
      };

      img.onerror = () => {
        reject(new Error('Could not load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
  });
}

    /**
 * Compress an image file to a target size (default 100KB)
 * Only compresses if image is larger than 120KB threshold, otherwise returns original
 * @param file - The image file to compress
 * @param maxSizeKB - Target maximum size in KB (default: 100)
 * @param quality - Initial quality (0.1 to 1.0, default: 0.8)
 * @returns Promise<File> - Compressed or original image file
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = 100,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Don't compress if already at or below threshold (120KB buffer)
    if (file.size <= 120 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate new dimensions - more aggressive resizing for faster compression
        let { width, height } = img;
        const maxDimension = 1200; // Reduced from 1920 for faster processing
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        } else {
          // Also scale down smaller images if they're still too large
          const scaleFactor = Math.sqrt((maxSizeKB * 1024) / file.size) * 0.8;
          if (scaleFactor < 1) {
            width = width * scaleFactor;
            height = height * scaleFactor;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Faster compression with fewer quality steps
        const compressWithQuality = (currentQuality: number): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }

              // If file is small enough or quality is too low, return the result
              if (blob.size <= maxSizeKB * 1024 || currentQuality <= 0.1) {
                const compressedFile = new File(
                  [blob],
                  file.name,
                  {
                    type: file.type,
                    lastModified: Date.now(),
                  }
                );
                resolve(compressedFile);
                return;
              }

              // More aggressive quality reduction for fewer iterations
              const newQuality = Math.max(0.1, currentQuality - 0.2); // Reduce by 0.2 instead of 0.1
              compressWithQuality(newQuality);
            },
            file.type,
            currentQuality
          );
        };

        compressWithQuality(quality);
      };

      img.onerror = () => {
        reject(new Error('Could not load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
  });
}

/**
 * Compress multiple image files
 * Only compresses images larger than 120KB threshold
 * @param files - Array of image files to compress
 * @param maxSizeKB - Target maximum size in KB (default: 100)
 * @returns Promise<File[]> - Array of compressed or original image files
 */
export async function compressImages(
  files: File[],
  maxSizeKB: number = 100
): Promise<File[]> {
  const compressedFiles: File[] = [];
  
  for (const file of files) {
    try {
      // Only compress image files
      if (!file.type.startsWith('image/')) {
        compressedFiles.push(file);
        continue;
      }
      
      // Check if compression is needed (120KB threshold)
      if (file.size <= 120 * 1024) {
        console.log(`Image ${files.indexOf(file) + 1}: ${(file.size / 1024).toFixed(1)}KB (no compression needed)`);
        compressedFiles.push(file);
        continue;
      }
      
      const compressedFile = await compressImage(file, maxSizeKB);
      compressedFiles.push(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', file.name, error);
      // Use original file if compression fails
      compressedFiles.push(file);
    }
  }
  
  return compressedFiles;
}

/**
 * Get image dimensions from a file
 * @param file - Image file
 * @returns Promise<{width: number, height: number}> - Image dimensions
 */
export function getImageDimensions(file: File): Promise<{width: number, height: number}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };
      
      img.onerror = () => {
        reject(new Error('Could not load image'));
      };
    };
    
    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
  });
}
