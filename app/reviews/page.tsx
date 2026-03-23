"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Star, Search, CheckCircle, X, Clock, Sparkles, Heart, Palette, Trophy, Crown, Users, Building } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import Image from "next/image";
import SocialPair from "@/public/images/social_pair.avif";

interface UserReview {
  id: string;
  user_id: string;
  user_type: 'advertiser' | 'creator';
  rating: number;
  experience: string;
  images: string[];
  video_links: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  users: {
    email: string;
    user_type: string;
    full_name: string | null;
    username: string | null;
    profile_picture_url: string | null;
  };
}

interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingCounts: { 1: number; 2: number; 3: number; 4: number; 5: number };
  ratingPercentages: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [imagesLoading, setImagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'creators' | 'brands'>('creators');
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const searchParams = useSearchParams();

  const fetchRatingStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/reviews/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch rating statistics');
      }

      const data = await response.json();
      setRatingStats(data);
    } catch (err) {
      console.error('Error fetching rating stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reviews-api/reviews?status=approved');
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    fetchRatingStats();
    
    // Set active tab based on URL parameter
    const tabParam = searchParams.get('tab');
    console.log('URL tab parameter:', tabParam);
    if (tabParam === 'brands') {
      console.log('Setting active tab to brands');
      setActiveTab('brands');
    } else {
      console.log('Defaulting to creators tab');
    }
  }, [searchParams]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const handleImageClick = (images: string[]) => {
    setSelectedImages(images);
    setIsImageModalOpen(true);
    setImagesLoading(true);
    
    // Preload images
    Promise.all(images.map(src => new Promise<void>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    }))).finally(() => {
      setImagesLoading(false);
    });
  };

  const filteredReviews = reviews.filter(review => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        review.users.email?.toLowerCase().includes(searchLower) ||
        review.users.full_name?.toLowerCase().includes(searchLower) ||
        review.users.username?.toLowerCase().includes(searchLower) ||
        review.experience.toLowerCase().includes(searchLower)
      );
    }
    return true;
  }).filter(review => {
    if (activeTab === 'creators') return review.user_type === 'creator';
    if (activeTab === 'brands') return review.user_type === 'advertiser';
    return true;
  });

  // Calculate stats
  const totalReviews = reviews.length;
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const renderReviewsList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <PageLoadingSpinner mode="dark" />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchReviews}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      );
    }
    
    if (filteredReviews.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-white">No reviews found matching your criteria.</p>
        </div>
      );
    }
    
    return (
      <div className="max-w-7xl mx-auto">
        <div className="space-y-6">
          {filteredReviews.map((review, index) => (
            <div key={review.id} className="border border-gray-600 rounded-lg p-6">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarImage
                    src={review.users.profile_picture_url || undefined}
                    alt={review.users.full_name || 'User'}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className="text-lg bg-[#4C238D] text-violet-100">
                    {review.users.username
                      ? review.users.username.charAt(0)
                      : review.users.full_name
                      ? review.users.full_name.charAt(0)
                      : review.users.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-slate-50">
                      {review.users.username || review.users.full_name || review.users.email}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#C4A3FF] w-fit">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.85)]" />
                      {review.user_type}
                    </span>
                    <span className="text-sm text-slate-400/90">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Rating */}
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* Review Text */}
                  <p className="text-slate-300 leading-relaxed mb-3">
                    {review.experience}
                  </p>
                  
                  {/* Images */}
                  {review.images && review.images.length > 0 && (
                    <div className="flex gap-2">
                      {review.images.slice(0, 3).map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Review image ${index + 1}`}
                            className="w-12 h-12 object-cover rounded cursor-pointer group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                            onClick={() => window.open(image, '_blank')}
                          />
                          {review.images.length > 3 && index === 2 && (
                            <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                              <span className="text-white text-xs font-medium">
                                +{review.images.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-[#000825] text-white overflow-hidden border-b border-[#A87313]">
        <div className="relative z-20">
          {/* Floating Gaming Elements */}
          <section className="pt-20 pb-20 md:pt-28 md:pb-36 relative overflow-hidden">
            {/* Strategic Background Elements */}
        
        {/* Floating Creative Elements */}
        <div className="inset-0 z-10 pointer-events-none">
          <Sparkles className="absolute top-20 left-10 h-8 w-8 text-amber-400/30 animate-pulse" />
          <Sparkles
            className="absolute top-32 right-20 h-9 w-9 text-violet-400/40 animate-bounce"
            style={{ animationDelay: "1s" }}
          />
          <Star
            className="absolute top-40 left-1/4 h-9 w-9 text-purple-400/30 animate-pulse"
            style={{ animationDelay: "2s" }}
          />
          <Heart
            className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce"
            style={{ animationDelay: "0.5s" }}
          />
          <Palette
            className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse"
            style={{ animationDelay: "1.5s" }}
          />
          <Trophy
            className="absolute bottom-32 right-12 h-9 w-9 text-amber-400/40 animate-bounce"
            style={{ animationDelay: "0.8s" }}
          />
        </div>
        
        {/* Blue Ellipse Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1200px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none bg-blue-ellipse"></div>

        <div className="container mx-auto px-4 text-center relative z-10">
          {/* Premium Badge */}
          <div className="inline-grid grid-cols-[auto_1fr] items-center gap-2 bg-[#FFFFFF1A] rounded-full px-3 py-1.5 sm:px-6 sm:py-3 mb-8 max-w-[92vw] sm:max-w-none mx-auto">
            <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
            <span className="text-xs sm:text-lg font-semibold bg-white bg-clip-text text-transparent leading-tight whitespace-normal text-left">
              #1 Gamified Creator Marketing Platform
            </span>
          </div>

          {/* Enhanced Social Icons */}
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <Image
                  src={SocialPair}
                  alt="Social Media Icons"
                  width={150}
                  height={40}
                  className="relative z-10"
                />
              </div>
            </div>
          </div>

          {/* Massive Title */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl flex flex-wrap justify-center gap-x-2 md:gap-x-3 mb-6 leading-tight text-center slide-up"
            style={{ animationDelay: "1s" }}
          >
            <span
              className="font-semibold text-white drop-shadow-2xl"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              What Our
            </span>
            <span
              className="font-semibold text-white drop-shadow-2xl"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              <span className="relative">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
                  }}
                >
                  Brands and Creators
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
              </span>
            </span>
            <span
              className="font-semibold text-white drop-shadow-2xl"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Say
            </span>
          </h1>

          {/* Strategic Subtitle */}
          <p
            className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
            style={{ animationDelay: "2s" }}
          >
            Real reviews from
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">
              {" "}brands and creators
            </span>{" "}
            about their experience
          </p>
        </div>
      </section>

      {/* Reviews List */}
      <div className="container mx-auto px-4 py-6">
        <div className="py-8 px-4">
         
          {/* <div className="max-w-7xl mx-auto mb-8">
            <div className="rounded-lg shadow-lg p-6 border border-white/20">
            <div className="flex items-center justify-between">
              
              <div className="flex items-center space-x-6 gap-4">
                <div className="text-center">
                  {statsLoading ? (
                    <div className="animate-pulse">
                      <div className="text-6xl font-bold text-gray-400">0.0</div>
                      <div className="flex items-center justify-center mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className="h-5 w-5 text-gray-400"
                          />
                        ))}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Loading...</div>
                    </div>
                  ) : ratingStats ? (
                    <>
                      <div className="text-6xl font-bold text-white">{ratingStats.averageRating}</div>
                      <div className="flex items-center justify-center mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-5 w-5 ${
                              star <= Math.floor(ratingStats.averageRating) ? 'fill-yellow-400 text-yellow-400' : 
                              star === Math.ceil(ratingStats.averageRating) && ratingStats.averageRating % 1 !== 0 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-gray-300 mt-1">{ratingStats.totalReviews.toLocaleString()} reviews</div>
                    </>
                  ) : (
                    <div className="text-6xl font-bold text-white">0.0</div>
                  )}
                </div>
                
                
                <div className="space-y-1.5">
                  {statsLoading ? (
                    [5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2 animate-pulse">
                        <span className="text-sm text-gray-300 w-6">{rating}</span>
                        <div className="w-[300px] bg-gray-600/30 rounded-full h-2">
                          <div className="bg-gray-500/50 h-2 rounded-full w-0" />
                        </div>
                      </div>
                    ))
                  ) : ratingStats ? (
                    [5, 4, 3, 2, 1].map((rating) => {
                      const percentage = ratingStats.ratingPercentages[rating as keyof typeof ratingStats.ratingPercentages] || 0;
                      return (
                        <div key={rating} className="flex items-center space-x-2">
                          <span className="text-sm text-gray-300 w-6">{rating}</span>
                          <div className="w-[300px] bg-gray-600/30 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-400 w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    [5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2">
                        <span className="text-sm text-gray-300 w-6">{rating}</span>
                        <div className="w-[300px] bg-gray-600/30 rounded-full h-2">
                          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          </div> */}

          {/* Tab Buttons */}
          <div className="flex justify-center mb-16">
            <div className="inline-flex rounded-md border border-[#7F39EC]/70 bg-black/80 backdrop-blur-sm p-1">
              <button
                onClick={() => setActiveTab('creators')}
                className={`flex items-center gap-2 px-6 py-2 rounded-md text-md font-medium transition-all duration-500 ${
                  activeTab === 'creators'
                    ? 'bg-gradient-to-r from-[#4C238D] via-[#7F39EC] to-fuchsia-400 text-white shadow-lg shadow-[#7F39EC]/50 ring-2 ring-[#7F39EC]/60'
                    : 'text-slate-400/90 hover:text-slate-100 hover:bg-[#7F39EC]/10'
                }`}
              >
                <Users className="h-4 w-4" />
                Creators
              </button>
              <button
                onClick={() => setActiveTab('brands')}
                className={`flex items-center gap-2 px-6 py-2 rounded-md text-md font-medium transition-all duration-500 ${
                  activeTab === 'brands'
                    ? 'bg-gradient-to-r from-[#4C238D] via-[#7F39EC] to-fuchsia-400 text-white shadow-lg shadow-[#7F39EC]/50 ring-2 ring-[#7F39EC]/60'
                    : 'text-slate-400/90 hover:text-slate-100 hover:bg-[#7F39EC]/10'
                }`}
              >
                <Building className="h-4 w-4" />
                Brands
              </button>
            </div>
          </div>
          
          {/* Reviews Content */}
          {renderReviewsList()}
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-lg overflow-hidden ${imagesLoading ? 'w-full max-w-2xl' : 'max-w-4xl'} max-h-[90vh]`}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Review Images</h3>
              <button
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedImages([]);
                  setImagesLoading(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {imagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <PageLoadingSpinner mode="light" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Review image ${index + 1}`}
                        className="w-full h-64 object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-25 transition-opacity rounded-lg flex items-center justify-center">
                        <a
                          href={image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100 transition-opacity"
                        >
                          Open in New Tab
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
}
