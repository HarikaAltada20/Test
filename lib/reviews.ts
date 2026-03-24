import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { compressImages } from "./image-compression";

export interface ReviewData {
  rating: number;
  experience: string;
  images: File[];
  videoLinks: string[];
}

export interface ReviewSubmission {
  user_id: string;
  user_type: 'advertiser' | 'creator';
  rating: number;
  experience: string;
  images: string[];
  video_links: string[];
}

export async function submitReview(
  user: User | null,
  reviewData: ReviewData,
  onCompressionProgress?: (index: number, originalSize: number, compressedSize: number) => void
): Promise<{ success: boolean; error?: string; reviewId?: string }> {
  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const supabase = createClient();

  try {
    // Compress images to 100KB before uploading
    let compressedImages: File[] = [];
    
    if (reviewData.images.length > 0) {
      console.log('Checking images for compression (target: 100KB)...');
      compressedImages = await compressImages(reviewData.images, 100);
      
      // Log compression results and call progress callback
      reviewData.images.forEach((original, index) => {
        const compressed = compressedImages[index];
        const originalSize = original.size;
        const compressedSize = compressed.size;
        
        if (originalSize === compressedSize) {
          console.log(`Image ${index + 1}: ${(originalSize / 1024).toFixed(1)}KB (no compression needed)`);
        } else {
          console.log(`Image ${index + 1}: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% reduction)`);
        }
        
        // Call progress callback if provided
        if (onCompressionProgress) {
          onCompressionProgress(index, originalSize, compressedSize);
        }
      });
    }

    // Upload compressed images to storage if any
    // Store object paths (not public URLs) because the bucket is private.
    const imagePaths: string[] = [];
    
    if (compressedImages.length > 0) {
      for (const image of compressedImages) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('review-images')
          .upload(fileName, image);

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          continue; // Continue with other images if one fails
        }

        imagePaths.push(fileName);
      }
    }

    // Get user type from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return { success: false, error: "Could not determine user type" };
    }

    // Insert review into database
    const reviewSubmission: ReviewSubmission = {
      user_id: user.id,
      user_type: userData.user_type as 'advertiser' | 'creator',
      rating: reviewData.rating,
      experience: reviewData.experience,
      images: imagePaths,
      video_links: reviewData.videoLinks,
    };

    const { data: reviewInsertData, error: insertError } = await supabase
      .from('user_reviews')
      .insert(reviewSubmission)
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting review:', insertError);
      return { success: false, error: "Failed to save review" };
    }

    return { 
      success: true, 
      reviewId: reviewInsertData.id 
    };

  } catch (error) {
    console.error('Unexpected error in submitReview:', error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getUserReviews(
  userId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('user_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user reviews:', error);
      return { success: false, error: "Failed to fetch reviews" };
    }

    return { success: true, data };

  } catch (error) {
    console.error('Unexpected error in getUserReviews:', error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getAllReviews(
  page: number = 1,
  limit: number = 10
): Promise<{ success: boolean; data?: any[]; error?: string; count?: number }> {
  const supabase = createClient();

  try {
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('user_reviews')
      .select('*, users!inner(full_name, profile_picture_url)', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching all reviews:', error);
      return { success: false, error: "Failed to fetch reviews" };
    }

    return { success: true, data, count: count || undefined };

  } catch (error) {
    console.error('Unexpected error in getAllReviews:', error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
