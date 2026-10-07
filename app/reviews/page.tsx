"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Star, X,ArrowRight, Sparkles, Heart, Palette, Trophy, Crown, Users, Building, Link as LinkIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import Image from "next/image";
import SocialPair from "@/public/images/social_pair.avif";
import { useThemeMode } from "@/hooks/use-theme-mode";
import CtcBanner from "@/components/CtcBanner";

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

/*
interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingCounts: { 1: number; 2: number; 3: number; 4: number; 5: number };
  ratingPercentages: { 1: number; 2: number; 3: number; 4: number; 5: number };
}
*/

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ReviewsPage() {
  useThemeMode();
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'creators' | 'brands'>('creators');
  // Kept commented for future re-enable of public stats widget.
  // const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  // const [statsLoading, setStatsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 9,
    total: 0,
    totalPages: 0
  });
  const [sortBy, setSortBy] = useState<string>('relevance');
  const searchParams = useSearchParams();
  const imageRefreshInFlightRef = useRef(false);
  const lastImageRefreshAtRef = useRef(0);

  const normalizeVideoUrl = (rawUrl: string): string | null => {
    if (!rawUrl || !rawUrl.trim()) return null;
    const trimmed = rawUrl.trim();
    try {
      const url = new URL(trimmed);
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
    } catch {
      try {
        const url = new URL(`https://${trimmed}`);
        return url.toString();
      } catch {
        return null;
      }
    }
  };

  // Kept commented for future re-enable of public stats widget.
  // const fetchRatingStats = async () => {
  //   setStatsLoading(true);
  //   try {
  //     const response = await fetch('/api/reviews/stats');
  //
  //     if (!response.ok) {
  //       throw new Error('Failed to fetch rating statistics');
  //     }
  //
  //     const data = await response.json();
  //     setRatingStats(data);
  //   } catch (err) {
  //     console.error('Error fetching rating stats:', err);
  //   } finally {
  //     setStatsLoading(false);
  //   }
  // };

  // Kept commented for future re-enable of public stats widget.
  // useEffect(() => {
  //   fetchRatingStats();
  // }, []);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);

    try {
      const userTypeForTab = activeTab === 'creators' ? 'creator' : 'advertiser';
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: 'approved',
        userType: userTypeForTab,
      });

      const response = await fetch(`/api/reviews-api/reviews?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / prev.limit)
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewImageError = async () => {
    const now = Date.now();
    // Prevent loops and avoid storms when multiple images fail at once.
    if (imageRefreshInFlightRef.current || now - lastImageRefreshAtRef.current < 30000) {
      return;
    }
    imageRefreshInFlightRef.current = true;
    lastImageRefreshAtRef.current = now;
    try {
      await fetchReviews();
    } finally {
      imageRefreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    setActiveTab(tabParam === 'brands' ? 'brands' : 'creators');
  }, [searchParams]);

  useEffect(() => {
    fetchReviews();
  }, [pagination.page, pagination.limit, activeTab]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const filteredReviews = [...reviews].sort((a, b) => {
    if (sortBy === 'relevance') {
      // Only consider reviews with both high rating (4-5 stars) AND review text as most relevant
      const aHasRelevance = (a.rating >= 4) && (a.experience && a.experience.trim().length > 0);
      const bHasRelevance = (b.rating >= 4) && (b.experience && b.experience.trim().length > 0);
      
      // If one has relevance and the other doesn't, prioritize the relevant one
      if (aHasRelevance !== bHasRelevance) {
        return bHasRelevance ? 1 : -1;
      }
      
      // If both have relevance, sort by rating first, then date
      if (aHasRelevance && bHasRelevance) {
        if (b.rating !== a.rating) {
          return b.rating - a.rating; // Higher rating first
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newest first
      }
      
      // If neither has relevance, sort by rating then date
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return 0;
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
      <div className="max-w-[884px] mx-auto w-full">
        <div className="flex flex-col gap-7 w-full">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className="w-full relative bg-[#171717] rounded-3xl p-9 flex flex-col gap-1 overflow-hidden"
              style={{
                boxShadow: '8px 8px 50px black, 4px 12px 4px rgba(0, 0, 0, 0.20), inset 0px 0px 4px rgba(255, 255, 255, 0.25)'
              }}
            >
              <div className="flex flex-col gap-8 w-full relative z-10">
                <div className="flex justify-between items-start w-full">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Avatar className="w-12 h-12 rounded-lg">
                      <AvatarImage
                        src={review.users.profile_picture_url || undefined}
                        alt={review.users.full_name || 'User'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="rounded-lg text-lg font-bold bg-[#242424] text-white">
                        {review.users.username
                          ? review.users.username.charAt(0).toUpperCase()
                          : review.users.full_name
                          ? review.users.full_name.charAt(0).toUpperCase()
                          : review.users.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <div className="text-white text-lg font-medium leading-tight">
                        {review.users.username || review.users.full_name || review.users.email}
                      </div>
                      <div className="text-[#8E8E8E] text-base font-normal leading-tight">
                        {review.user_type === 'creator' ? 'Creator' : 'Brand'}
                      </div>
                    </div>
                  </div>
                  <div className="text-white text-lg italic font-medium leading-relaxed">
                    {Array(Math.max(1, review.rating)).fill('⭐').join(' ')}
                  </div>
                </div>
                <div className="text-white text-base font-medium leading-relaxed">
                  {review.experience}
                </div>

                {/* Images */}
                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2.5">
                    {review.images.slice(0, 3).map((image, index) => (
                      <div key={index} className="relative group/img rounded-lg overflow-hidden border border-white/10">
                        <img
                          src={image}
                          alt={`Review image ${index + 1}`}
                          className="w-14 h-14 object-cover rounded-lg cursor-pointer group-hover/img:scale-110 transition-transform duration-300 ease-out"
                          onClick={() => {
                            setSelectedImages(review.images);
                            setIsImageModalOpen(true);
                          }}
                          onError={handleReviewImageError}
                        />
                        {review.images.length > 3 && index === 2 && (
                          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center pointer-events-none">
                            <span className="text-white text-xs font-semibold">
                              +{review.images.length - 3}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Video Links */}
                {review.video_links && review.video_links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.video_links
                      .map((link, index) => ({ index, href: normalizeVideoUrl(link) }))
                      .filter((item) => item.href)
                      .map((item) => (
                        <a
                          key={`${review.id}-video-${item.index}`}
                          href={item.href as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 justify-center rounded-full bg-[#353535] px-2 py-1 text-[12px] italic font-normal text-[#DEDEDE] outline outline-1 -outline-offset-1 outline-[#434343] hover:bg-[#434343] transition-colors"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          Video Link {item.index + 1}
                        </a>
                      ))}
                  </div>
                )}
              </div>
              
              {/* Card inner decorations */}
              <div className="absolute top-3 left-4 right-4 flex justify-between items-center pointer-events-none z-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#353535] shadow-[0px_0.2px_0.5px_black_inset,0px_1px_2px_black_inset]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#353535] shadow-[0px_0.2px_0.5px_black_inset,0px_1px_2px_black_inset]" />
              </div>
              <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center pointer-events-none z-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#353535] shadow-[0px_0.2px_0.5px_black_inset,0px_1px_2px_black_inset]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#353535] shadow-[0px_0.2px_0.5px_black_inset,0px_1px_2px_black_inset]" />
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        <div className="mt-10">
          <PaginationControls
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            hasNextPage={pagination.page < pagination.totalPages}
            hasPreviousPage={pagination.page > 1}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            isDark={true}
            pageSizeOptions={[9, 15, 21, 30]}
            showResultInfo={true}
            showPageSizeSelector={true}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="relative min-h-screen bg-black text-white overflow-hidden">

        <div className="relative z-20">
          {/* Floating Decorative Elements */}
          {/* Floating Decorative Elements */}
          <section className="pt-20 pb-16 md:pt-24 relative overflow-hidden">
            <div className="container mx-auto px-4 flex flex-col items-center justify-center gap-12 relative z-10">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="inline-flex items-center justify-center gap-1 rounded-2xl bg-[#353535] px-3 py-1 outline outline-1 -outline-offset-1 outline-[#434343]">
                  <span className="text-center text-[15px] font-normal leading-[21px] text-[#C4C4C4] font-['Inter']">Reviews</span>
                </div>
                <div className="flex flex-col items-center justify-start gap-4">
                  <h1 className="text-center text-[40px] md:text-[52px] font-bold leading-[1.1] bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent font-['Inter']">
                    What Creators & Brand has to say
                  </h1>
                  <p className="max-w-[654px] text-center text-lg md:text-[20px] font-medium leading-[1.5] text-[#8E8E8E] font-['Inter']">
                    Real reviews from brands and creators about their experience
                  </p>
                </div>
              </div>

              {/* Toggle */}
              <div className="inline-flex items-center rounded-full bg-[#242424] p-1.5 w-[320px] relative">
                <div
                  className="absolute top-1.5 bottom-1.5 w-[154px] rounded-full transition-all duration-300"
                  style={{
                    background: 'radial-gradient(ellipse 56.33% 251.62% at 53.16% 51.28%, rgba(50, 21, 0, 0.09) 0%, rgba(128, 68, 0, 0.31) 44%, rgba(255, 136, 0, 0.61) 89%)',
                    boxShadow: '-0.73px 2.56px 4.39px 0.37px rgba(0, 0, 0, 0.40)',
                    left: activeTab === 'creators' ? '6px' : 'calc(100% - 154px - 6px)'
                  }}
                />
                <button
                  onClick={() => setActiveTab('creators')}
                  className={`relative z-10 flex-1 py-2 text-center text-[16px] font-medium transition-colors font-['Inter'] ${
                    activeTab === 'creators' ? 'text-white' : 'text-[#C4C4C4]'
                  }`}
                >
                  Creators
                </button>
                <button
                  onClick={() => setActiveTab('brands')}
                  className={`relative z-10 flex-1 py-2 text-center text-[16px] font-medium transition-colors font-['Inter'] ${
                    activeTab === 'brands' ? 'text-white' : 'text-[#C4C4C4]'
                  }`}
                >
                  Brands
                </button>
              </div>
            </div>
          </section>

          {/* Reviews Controls & List */}
          <div className="container mx-auto px-4 pb-16 flex flex-col items-center">
            <div className="w-full max-w-[744px] mb-8 flex justify-end">
              {/* Sort selector */}
              <div className="w-[203px] rounded-md bg-[#222] px-3 py-2 outline outline-[0.72px] -outline-offset-[0.72px] outline-[#353535] flex items-center justify-between">
                <Select value={sortBy || "relevance"} onValueChange={(value) => setSortBy(value)}>
                  <SelectTrigger isDark={true} className="w-full border-0 bg-transparent text-white p-1 h-auto text-[15px] hover:bg-transparent focus:ring-0 focus:outline-none shadow-none">
                    <SelectValue placeholder="Most Relevant" />
                  </SelectTrigger>
                  <SelectContent isDark={true} className="bg-[#141419] border border-white/15 text-white shadow-2xl rounded-xl p-1">
                    <SelectItem isDark={true} value="relevance" className="cursor-pointer data-[state=checked]:bg-[#353535] focus:bg-[#242424] hover:bg-[#242424] data-[highlighted]:bg-[#242424]">
                      Most Relevant
                    </SelectItem>
                    <SelectItem isDark={true} value="newest" className="cursor-pointer data-[state=checked]:bg-[#353535] focus:bg-[#242424] hover:bg-[#242424] data-[highlighted]:bg-[#242424]">
                      Newest
                    </SelectItem>
                    <SelectItem isDark={true} value="oldest" className="cursor-pointer data-[state=checked]:bg-[#353535] focus:bg-[#242424] hover:bg-[#242424] data-[highlighted]:bg-[#242424]">
                      Oldest
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reviews Content */}
            {renderReviewsList()}
          </div>
        </div>

        {/* Dark Image Modal */}
        {isImageModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className={`bg-[#141419] border border-white/15 rounded-2xl overflow-hidden shadow-2xl text-white ${imagesLoading ? 'w-full max-w-2xl' : 'max-w-4xl'} max-h-[90vh]`}>
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Review Images</h3>
                <button
                  onClick={() => {
                    setIsImageModalOpen(false);
                    setSelectedImages([]);
                    setImagesLoading(false);
                  }}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {imagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <PageLoadingSpinner mode="dark" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40">
                        <img
                          src={image}
                          alt={`Review image ${index + 1}`}
                          className="w-full h-64 object-cover rounded-lg"
                          onError={handleReviewImageError}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center p-2">
                          <a
                            href={image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg"
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


          <section className="py-16 px-4 sm:px-8 lg:px-24 bg-black flex justify-center items-center">
                      <div className="relative w-full max-w-[1200px] min-h-[471px] py-16 px-6 sm:px-12 flex flex-col justify-center items-center overflow-hidden rounded-[28px] border border-[#3A3636] bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)]">
                        {/* Background Decorative Shapes */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[335px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-202px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                          {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[354px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-183px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[27px] top-[308px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-230px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[27px] top-[288px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-250px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                        </div>
              
                        {/* Main Content Box */}
                        <div className="relative z-10 max-w-[654px] mx-auto flex flex-col items-center text-center gap-9">
                          <div className="flex flex-col items-center gap-4">
                            <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-medium text-white leading-[130%] tracking-tight">
                              Want to promote your brand?
                              <br/>
                              Book a Call
                            </h2>
                            <p className="text-[15px] sm:text-[17px] font-medium text-[#8E8E8E] leading-[150%]">
                              Book a demo with{" "}
                              <span className="text-[#F1F1F1] font-semibold">Vishesh</span>
                              , Founder of Game Of Creators. Join hundreds of successful businesses. Get answers and start launching impactful campaigns with a free consultation.
                            </p>
                          </div>
              
                          <a
                            href="https://calendly.com/guptavishesh2/30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2.5 px-9 py-3 bg-[#DEDEDE] text-[#353535] hover:bg-white rounded-[14px] font-semibold text-base leading-[20px] transition-all duration-200 cursor-pointer shadow-md group"
                          >
                            <span>Book Call Now</span>
                            <ArrowRight className="w-4 h-4 text-[#353535] transition-transform group-hover:translate-x-0.5" />
                          </a>
                        </div>
                      </div>
                    </section>
      <CtcBanner />
    </>
  );
}
