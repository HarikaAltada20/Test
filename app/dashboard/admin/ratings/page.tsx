"use client";

import { useState, useEffect, useRef } from "react";
import { Star, Filter, Search, CheckCircle,MessageSquare, XCircle, Clock, User as UserIcon, X, MoreHorizontal, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

interface UserReview {
  id: string;
  user_id: string;
  user_type: 'advertiser' | 'creator';
  rating: number;
  experience: string;
  images: string[];
  video_links: string[];
  status: 'pending' | 'approved' | 'rejected'; // This will now match the database enum
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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingCounts: { 1: number; 2: number; 3: number; 4: number; 5: number };
  ratingPercentages: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

function ReviewTextCell({
  reviewText,
  onViewFullReview,
}: {
  reviewText: string;
  onViewFullReview: (reviewText: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [showMoreButton, setShowMoreButton] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const timeoutId = setTimeout(() => {
        if (containerRef.current && contentRef.current) {
          // Force layout calculation
          const containerWidth = containerRef.current.clientWidth;
          const contentWidth = contentRef.current.scrollWidth;
          const isOverflowing = contentWidth > containerWidth;
          
          // Also check if text is longer than 70 characters as a fallback
          const isLongText = reviewText ? reviewText.length > 50 : false;
          
          setShowMoreButton(isOverflowing || isLongText);
          
          // Double-check after a brief delay to ensure truncation is applied
          setTimeout(() => {
            if (containerRef.current && contentRef.current) {
              const newContentWidth = contentRef.current.scrollWidth;
              const newContainerWidth = containerRef.current.clientWidth;
              const newIsOverflowing = newContentWidth > newContainerWidth;
              const newIsLongText = reviewText ? reviewText.length > 50 : false;
              setShowMoreButton(newIsOverflowing || newIsLongText);
            }
          }, 50);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => {
      window.removeEventListener("resize", checkOverflow);
    };
  }, [reviewText]);

  if (!reviewText || reviewText.trim().length === 0) {
    return <div className="text-sm text-gray-400">No review</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1 w-full"
    >
      <span
        ref={contentRef}
        className={`text-sm ${showMoreButton ? "truncate flex-1 min-w-0" : ""}`}
        style={showMoreButton ? { maxWidth: "calc(100% - 40px)" } : {}}
      >
        {reviewText}
      </span>
      {showMoreButton && (
        <Button
          variant="ghost"
          size="sm"
          className="text-purple-600 underline h-6 px-2 text-xs flex-shrink-0"
          onClick={() => onViewFullReview(reviewText)}
        >
          More
        </Button>
      )}
    </div>
  );
}

export default function RatingsPage() {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchRatingStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/admin/user-reviews/stats');
      
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

  const fetchReviews = async (page = 1, reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter) params.append('status', statusFilter);
      if (userTypeFilter) params.append('userType', userTypeFilter);
      if (ratingFilter) params.append('rating', ratingFilter);

      const response = await fetch(`/api/admin/user-reviews?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();
      
      if (reset) {
        setReviews(data.reviews);
      } else {
        setReviews(prev => page === 1 ? data.reviews : [...prev, ...data.reviews]);
      }
      
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(1, true);
    fetchRatingStats();
  }, [statusFilter, userTypeFilter, ratingFilter]);

  const handleStatusUpdate = async (reviewId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      const response = await fetch('/api/admin/user-reviews', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewId,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update review status');
      }

      // Update review in local state
      setReviews(prev => prev.map(review => 
        review.id === reviewId 
          ? { ...review, status: newStatus, updated_at: new Date().toISOString() }
          : review
      ));

      // Refresh rating stats when a review status changes
      fetchRatingStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review');
    }
  };

  const handleStatusChange = async (reviewId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    await handleStatusUpdate(reviewId, newStatus);
  };

  const handleViewFullReview = (reviewText: string) => {
    setSelectedReview(reviewText);
    setIsReviewModalOpen(true);
  };

  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-800';
      case 'rejected':
        return 'text-red-800';
      default:
        return 'text-yellow-800';
    }
  };

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
  });

  // Calculate stats - count all reviews regardless of status
  const approvedReviews = reviews.filter(review => review.status === 'approved').length;
  const rejectedReviews = reviews.filter(review => review.status === 'rejected').length;
  const pendingReviews = reviews.filter(review => review.status === 'pending').length;
  const totalReviews = reviews.length; // Count all reviews

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Users Ratings and reviews</h1>
        <p className="text-gray-600 mt-2">Manage and moderate user reviews and ratings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Reviews Card */}
        <div className="rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2 bg-white">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div className="flex-1 space-y-2 text-black">
                <p className="text-lg font-medium">Total Reviews</p>
                <p className="text-xl font-bold">{totalReviews}</p>
                <p className="text-sm mt-0.5">All submitted reviews</p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4 bg-[#D8C3FF] text-[#4A00BE]">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </div>

        {/* Approved Reviews Card - Green */}
        <div className="rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2 bg-white">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div className="flex-1 space-y-2 text-black">
                <p className="text-lg font-medium">Approved</p>
                <p className="text-xl font-bold">{approvedReviews}</p>
                <p className="text-sm mt-0.5">Approved reviews</p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4 bg-[#D8C3FF] text-[#4A00BE]">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </div>

        {/* Rejected Reviews Card - Red */}
        <div className="rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2 bg-white">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div className="flex-1 space-y-2 text-black">
                <p className="text-lg font-medium">Rejected</p>
                <p className="text-xl font-bold">{rejectedReviews}</p>
                <p className="text-sm mt-0.5">Rejected reviews</p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4 bg-[#D8C3FF] text-[#4A00BE]">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </div>

        {/* Pending Reviews Card - Yellow */}
        <div className="rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2 bg-white">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div className="flex-1 space-y-2 text-black">
                <p className="text-lg font-medium">Pending</p>
                <p className="text-xl font-bold">{pendingReviews}</p>
                <p className="text-sm mt-0.5">Pending reviews</p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4 bg-[#D8C3FF] text-[#4A00BE]">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </div>
      </div>

      {/* Rating Overview Component */}
      {/* <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
         
          <div className="flex items-center space-x-6 gap-4">
            <div className="text-center">
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="text-6xl font-bold text-gray-300">0.0</div>
                  <div className="flex items-center justify-center mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="h-5 w-5 text-gray-300"
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Loading...</div>
                </div>
              ) : ratingStats ? (
                <>
                  <div className="text-6xl font-bold text-gray-900">{ratingStats.averageRating}</div>
                  <div className="flex items-center justify-center mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= Math.floor(ratingStats.averageRating) ? 'fill-green-500 text-green-500' : 
                          star === Math.ceil(ratingStats.averageRating) && ratingStats.averageRating % 1 !== 0 ? 'fill-green-500 text-green-500' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{ratingStats.totalReviews.toLocaleString()} reviews</div>
                </>
              ) : (
                <div className="text-6xl font-bold text-gray-900">0.0</div>
              )}
            </div>
            
            
            <div className="space-y-1.5">
              {statsLoading ? (
                [5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center space-x-2 animate-pulse">
                    <span className="text-sm text-gray-600 w-6">{rating}</span>
                    <div className="w-[500px] bg-gray-200 rounded-full h-2">
                      <div className="bg-gray-300 h-2 rounded-full w-0" />
                    </div>
                  </div>
                ))
              ) : ratingStats ? (
                [5, 4, 3, 2, 1].map((rating) => {
                  const percentage = ratingStats.ratingPercentages[rating as keyof typeof ratingStats.ratingPercentages] || 0;
                  return (
                    <div key={rating} className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 w-6">{rating}</span>
                      <div className="w-[500px] bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-12 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })
              ) : (
                [5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 w-6">{rating}</span>
                    <div className="w-[500px] bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 py-4 items-start lg:items-center justify-between">
        {/* Search on left */}
        <div className="w-full lg:w-auto lg:flex-1 lg:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, username, email"
              className="pl-10"
            />
          </div>
        </div>

        {/* Three filters on right */}
        <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
          <div className="min-w-[180px]">
            <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <Select value={userTypeFilter || "all"} onValueChange={(value) => setUserTypeFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="advertiser">Advertiser</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <Select value={ratingFilter || "all"} onValueChange={(value) => setRatingFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-lg shadow">
        <div className="py-6 px-4">
          {loading && reviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading reviews...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => fetchReviews(1, true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No reviews found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Review
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Images
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Videos
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white divide-y divide-gray-200">
                  {filteredReviews.map((review) => (
                    <TableRow key={review.id} className="hover:bg-gray-50">
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Avatar className="w-10 h-10 mr-3">
                            <AvatarImage
                              src={review.users.profile_picture_url || undefined}
                              alt={review.users.full_name || 'User'}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            <AvatarFallback className="text-xs">
                              {review.users.full_name?.[0]?.toUpperCase() ||
                                review.users.username?.[0]?.toUpperCase() ||
                                review.users.email?.[0]?.toUpperCase() ||
                                "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {review.users.full_name || review.users.username || 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {review.users.username && review.users.full_name && review.users.username !== review.users.full_name 
                                ? `@${review.users.username}` 
                                : ''}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{review.users.email}</div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                          review.user_type === 'advertiser' 
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-purple-100 text-purple-800 border-purple-200'
                        }`}>
                          {review.user_type}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {renderStars(review.rating)}
                          <span className="ml-2 text-sm text-gray-500">({review.rating}/5)</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 max-w-xs">
                        <ReviewTextCell
                          reviewText={review.experience}
                          onViewFullReview={handleViewFullReview}
                        />
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        {review.images.length > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedImages(review.images);
                              setImagesLoading(true);
                              setIsImageModalOpen(true);
                              // Simulate image loading time or you could preload images
                              setTimeout(() => setImagesLoading(false), 1000);
                            }}
                            className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                          >
                            View {review.images.length} image(s)
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No images</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        {review.video_links.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {review.video_links.map((video, index) => (
                              <a
                                key={index}
                                href={video}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-800 underline text-sm"
                              >
                                Video {index + 1}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No videos</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(review.status)}
                          <span className={`text-sm font-medium ${getStatusColor(review.status)}`}>
                            {review.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          {new Date(review.created_at).toLocaleDateString()}
                          {/* {review.updated_at !== review.created_at && (
                            <div className="text-xs text-gray-400">
                              Updated {new Date(review.updated_at).toLocaleDateString()}
                            </div>
                          )} */}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="p-1">
                              <MoreVertical className="h-5 w-5 text-gray-500" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[120px]">
                            <DropdownMenuItem onClick={() => handleStatusChange(review.id, 'pending')} className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(review.id, 'approved')} className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Approved
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(review.id, 'rejected')} className="flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              Rejected
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Load More */}
              {pagination.page < pagination.totalPages && (
                <div className="text-center pt-6">
                  <button
                    onClick={() => fetchReviews(pagination.page + 1, false)}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
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

      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Full Review</h3>
              <button
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setSelectedReview(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                {selectedReview}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
