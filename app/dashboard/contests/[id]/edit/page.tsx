"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Image, Trash, Upload } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { toLocalDateTimeStrings, toUTCISOString, formatLocalDateTime } from "@/lib/utils"

type ContestData = {
    id: string
    title: string
    category: string
    thumbnail_url: string | null
    brief: string | null
    rules: { list: string[] } | null
    start_date: string | null
    end_date: string | null
    prizes: { position: number; amount: number }[]
    total_prize: number
    winner_count: number
    inspiration_links: string[]
    resources: Record<string, string>
    status: string
}

export default function EditContestPage() {
    const params = useParams()
    const contestId = params.id as string
    const router = useRouter()
    const { user } = useAuth()
    const supabase = createSupabaseClient()

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [contest, setContest] = useState<ContestData | null>(null)

    const [title, setTitle] = useState("")
    const [category, setCategory] = useState<string>("technology")
    const [brief, setBrief] = useState("")
    const [rules, setRules] = useState("")
    const [startDate, setStartDate] = useState<string>("")
    const [startTime, setStartTime] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [endTime, setEndTime] = useState<string>("")
    const [winnerCount, setWinnerCount] = useState<number>(3)
    const [winnerAmounts, setWinnerAmounts] = useState<number[]>([500, 300, 200])
    const [inspirationLinks, setInspirationLinks] = useState<string[]>([])
    const [newInspirationLink, setNewInspirationLink] = useState("")
    const [thumbnail, setThumbnail] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Update the constants for prize amounts based on free plan
    const MIN_PRIZE_PER_WINNER = 10000 // Minimum prize amount per winner in cents ($100)
    const MAX_PRIZE_PER_WINNER = 100000 // Maximum prize amount per winner in cents ($1000)
    const DEFAULT_PRIZE_ALLOCATIONS = {
        1: 50000, // $500.00
        2: 30000, // $300.00
        3: 20000, // $200.00
        4: 10000, // $100.00
        5: 5000   // $50.00
    }

    // Add a utility function to convert cents to dollars for display
    const formatCurrency = (cents: number): string => {
        return `$${(cents / 100).toFixed(2)}`;
    }

    // Fetch contest data
    useEffect(() => {
        async function fetchContest() {
            if (!user) return

            try {
                const { data, error } = await supabase
                    .from("contests")
                    .select("*")
                    .eq("id", contestId)
                    .eq("advertiser_id", user.id)
                    .single()

                if (error) throw error

                if (data) {
                    // Check if the contest is live or ended based on dates
                    const now = new Date()
                    const startDate = data.start_date ? new Date(data.start_date) : null
                    const endDate = data.end_date ? new Date(data.end_date) : null

                    // Contest is "live" if start date is in the past and end date is in the future
                    const isLive = startDate && startDate <= now && (!endDate || endDate > now)
                    // Contest is "ended" if end date is in the past
                    const isEnded = endDate && endDate <= now

                    // Prevent editing if contest is already live or ended
                    if (isLive || isEnded) {
                        setError("This contest is already live or has ended and cannot be edited.")
                        setIsLoading(false)
                        return
                    }

                    setContest(data as ContestData)
                    setTitle(data.title || "")
                    setCategory(data.category || "technology")
                    setBrief(data.brief || "")

                    if (data.rules && data.rules.list) {
                        setRules(data.rules.list.join("\n"))
                    }

                    // Convert UTC dates to local timezone for display
                    if (data.start_date) {
                        const { dateString, timeString } = toLocalDateTimeStrings(data.start_date);
                        setStartDate(dateString);
                        setStartTime(timeString);
                    }

                    if (data.end_date) {
                        const { dateString, timeString } = toLocalDateTimeStrings(data.end_date);
                        setEndDate(dateString);
                        setEndTime(timeString);
                    }

                    if (data.prizes && Array.isArray(data.prizes)) {
                        setWinnerCount(data.prizes.length)
                        setWinnerAmounts(data.prizes.map((prize: { amount: number }) => prize.amount))
                    }

                    if (data.inspiration_links && Array.isArray(data.inspiration_links)) {
                        setInspirationLinks(data.inspiration_links)
                    }

                    if (data.thumbnail_url) {
                        setThumbnailPreview(data.thumbnail_url)
                    }
                }
            } catch (error: any) {
                setError(error.message)
            } finally {
                setIsLoading(false)
            }
        }

        fetchContest()
    }, [contestId, user, supabase])

    // Get minimum allowed start date and time (current date/time)
    const getMinDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    // Get minimum allowed end date (at least 1 day after the start date)
    const getMinEndDate = () => {
        if (!startDate) return getMinDateTime();

        const startDateObj = new Date(startDate);
        // Add one day to the start date to ensure minimum 1 day duration
        startDateObj.setDate(startDateObj.getDate() + 1);

        const year = startDateObj.getFullYear();
        const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(startDateObj.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    // Update end date/time when start date/time changes to ensure minimum 1-day duration
    useEffect(() => {
        if (!startDate || !startTime) return;

        const startDateTime = new Date(`${startDate}T${startTime}`);

        // If end date/time is set and is less than 1 day after start, update it
        if (endDate && endTime) {
            const endDateTime = new Date(`${endDate}T${endTime}`);
            const minEndDateTime = new Date(startDateTime);
            minEndDateTime.setDate(minEndDateTime.getDate() + 1);

            if (endDateTime < minEndDateTime) {
                // Set end date/time to be exactly 1 day after start
                const newEndDate = getMinEndDate();
                setEndDate(newEndDate);
                setEndTime(startTime); // Keep the same time of day
            }
        }
    }, [startDate, startTime, endDate, endTime]);

    // Form submission with additional validation
    const handleSubmit = async () => {
        setError(null);
        setValidationError(null);
        setIsLoading(true);

        // Add timeout tracking to prevent hanging UI
        let submitTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

        // Add a timeout to prevent hanging in case of unexpected delays
        submitTimeoutId = setTimeout(() => {
            if (isLoading) {
                console.log("Edit submission taking longer than expected...");
                // Keep the UI responsive by updating state but don't stop the operation
                setValidationError("Operation is taking longer than expected. Please wait...");
            }
        }, 5000);

        if (!user) {
            setError("You must be logged in to update a contest");
            setIsLoading(false);
            return;
        }

        try {
            // Validate dates and times - use local timezone for validation
            if (startDate && startTime && endDate && endTime) {
                try {
                    // Create local date objects in user's timezone
                    const startDateTime = new Date(`${startDate}T${startTime}`);
                    const endDateTime = new Date(`${endDate}T${endTime}`);
                    const now = new Date();

                    // Make sure dates are valid
                    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                        setValidationError("Invalid date or time format. Please check your entries.");
                        setIsLoading(false);
                        return;
                    }

                    if (startDateTime < now) {
                        setValidationError("Contest start time must be in the future");
                        setIsLoading(false);
                        return;
                    }

                    if (endDateTime <= startDateTime) {
                        setValidationError("Contest end time must be after the start time");
                        setIsLoading(false);
                        return;
                    }

                    // Check if duration is at least 1 day (24 hours)
                    const durationMs = endDateTime.getTime() - startDateTime.getTime();
                    const oneDayMs = 24 * 60 * 60 * 1000;
                    if (durationMs < oneDayMs) {
                        setValidationError("Contest duration must be at least 1 day");
                        setIsLoading(false);
                        return;
                    }
                } catch (error) {
                    console.error("Date validation error:", error);
                    setValidationError("There was an error with the date/time format. Please check your entries.");
                    setIsLoading(false);
                    return;
                }
            } else {
                setValidationError("Contest start and end dates/times are required");
                setIsLoading(false);
                return;
            }

            // Format prizes array
            const prizesArray = []
            for (let i = 0; i < winnerCount; i++) {
                prizesArray.push({
                    position: i + 1,
                    amount: (winnerAmounts[i] || 0)
                })
            }

            // Calculate total prize
            let totalPrize = 0
            for (let i = 0; i < winnerCount; i++) {
                totalPrize += winnerAmounts[i] || 0
            }

            // Upload new thumbnail if present
            let thumbnailUrl = contest?.thumbnail_url || null
            if (thumbnail) {
                try {
                    const fileName = `contest_thumbnails/${user.id}_${Date.now()}`
                    const { error: uploadError } = await supabase.storage
                        .from('contest-assets')
                        .upload(fileName, thumbnail)

                    if (uploadError) {
                        throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
                    }

                    const { data: publicUrlData } = supabase.storage
                        .from('contest-assets')
                        .getPublicUrl(fileName)

                    thumbnailUrl = publicUrlData.publicUrl
                } catch (error: any) {
                    setError(`Thumbnail upload failed: ${error.message}`)
                    setIsLoading(false)
                    return
                }
            }

            // Format dates properly to ensure they're in ISO format (UTC)
            let formattedStartDate = null
            let formattedEndDate = null

            if (startDate && startTime) {
                formattedStartDate = toUTCISOString(startDate, startTime);
                if (!formattedStartDate) throw new Error("Invalid start date/time format");
            }

            if (endDate && endTime) {
                formattedEndDate = toUTCISOString(endDate, endTime);
                if (!formattedEndDate) throw new Error("Invalid end date/time format");
            }

            // Update contest
            const { error } = await supabase
                .from("contests")
                .update({
                    title,
                    thumbnail_url: thumbnailUrl,
                    category,
                    brief,
                    prizes: prizesArray,
                    total_prize: totalPrize,
                    rules: { list: rules.split("\n") },
                    inspiration_links: inspirationLinks,
                    winner_count: winnerCount,
                    start_date: formattedStartDate, // Use ISO format for UTC
                    end_date: formattedEndDate // Use ISO format for UTC
                })
                .eq("id", contestId)
                .eq("advertiser_id", user.id)

            if (error) throw error

            router.push(`/dashboard/contests/${contestId}`)
            if (submitTimeoutId !== undefined) clearTimeout(submitTimeoutId);
        } catch (err: any) {
            if (submitTimeoutId !== undefined) clearTimeout(submitTimeoutId);
            setError(err.message || "Failed to update contest")
            setIsLoading(false)
        }
    }

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setThumbnail(file)
            const reader = new FileReader()
            reader.onload = (e) => {
                if (e.target?.result) {
                    setThumbnailPreview(e.target.result as string)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const removeThumbnail = () => {
        setThumbnail(null)
        setThumbnailPreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const addInspirationLink = () => {
        if (newInspirationLink && !inspirationLinks.includes(newInspirationLink)) {
            setInspirationLinks([...inspirationLinks, newInspirationLink])
            setNewInspirationLink("")
        }
    }

    const removeInspirationLink = (link: string) => {
        setInspirationLinks(inspirationLinks.filter(l => l !== link))
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p>Loading contest data...</p>
            </div>
        )
    }

    if (!contest) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-red-500 mb-4">Contest is live so you can't edit it now</p>
                <Button asChild>
                    <Link href="/dashboard/contests">Back to Contests</Link>
                </Button>
            </div>
        )
    }

    if (error && error.includes("already live or has ended")) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/contests/${contestId}`}>
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Edit Contest</h1>
                </div>

                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>

                <div className="flex justify-center">
                    <Button
                        onClick={() => router.push(`/dashboard/contests/${contestId}`)}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        Return to Contest
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/contests/${contestId}`}>
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Edit Contest</h1>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {validationError && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{validationError}</AlertDescription>
                </Alert>
            )}

            <Card className="mx-auto max-w-4xl">
                <CardHeader>
                    <CardTitle>Edit Contest Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Contest title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Go Viral! Get Paid to Create"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select value={category} onValueChange={(value) => setCategory(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="crypto-financial">Crypto/Financial</SelectItem>
                                    <SelectItem value="education">Education</SelectItem>
                                    <SelectItem value="dating">Dating</SelectItem>
                                    <SelectItem value="food-drink">Food & Drink</SelectItem>
                                    <SelectItem value="games-toys">Games & Toys</SelectItem>
                                    <SelectItem value="health-wellness">Health & Wellness</SelectItem>
                                    <SelectItem value="home-living">Home & Living</SelectItem>
                                    <SelectItem value="pets-animals">Pets & Animals</SelectItem>
                                    <SelectItem value="sports-outdoors">Sports & Outdoors</SelectItem>
                                    <SelectItem value="technology">Technology</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Thumbnail</Label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                            {thumbnailPreview ? (
                                <div className="relative">
                                    <img
                                        src={thumbnailPreview}
                                        alt="Thumbnail preview"
                                        className="mx-auto max-h-64 object-contain"
                                    />
                                    <div className="mt-2 flex justify-between items-center">
                                        <p className="text-sm text-gray-500">
                                            {thumbnail?.name || "Current thumbnail"}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={removeThumbnail}
                                            className="text-red-500"
                                        >
                                            <Trash className="h-4 w-4 mr-1" /> Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Image className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                                    <p className="text-sm font-medium mb-1">Drag, drop or browse thumbnail</p>
                                    <p className="text-xs text-gray-500 mb-4">Max file size: 5MB</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-4 w-4 mr-2" /> Upload
                                    </Button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleThumbnailChange}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brief">Brief</Label>
                        <Textarea
                            id="brief"
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            placeholder="Go Viral is the app that pays creators! We help creators connect with brands & get paid to create content!"
                            rows={6}
                        />
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Inspiration Content:</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            {inspirationLinks.map((link, index) => (
                                <li key={index} className="flex items-center justify-between">
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">
                                        {link}
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeInspirationLink(link)}
                                        className="text-red-500 h-6 w-6 p-0"
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Add TikTok inspiration link"
                                value={newInspirationLink}
                                onChange={(e) => setNewInspirationLink(e.target.value)}
                            />
                            <Button onClick={addInspirationLink} disabled={!newInspirationLink}>Add</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Set rules</h3>
                        <Textarea
                            value={rules}
                            onChange={(e) => setRules(e.target.value)}
                            rows={8}
                            placeholder="Content rules and guidelines"
                        />
                    </div>

                    <Separator />

                    {/* Contest Duration */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Contest Duration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start-date">Start Date</Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    min={getMinDateTime()}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="start-time">Start Time</Label>
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-date">End Date</Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={getMinEndDate()}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-time">End Time</Label>
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 mt-1">
                            Contest duration must be at least 1 day.
                        </p>
                    </div>

                    <Separator />

                    {/* Prize Distribution */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">Prize distribution</h3>
                            <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                                <span className="text-sm font-medium">Total Prize Pool:</span>
                                <span className="text-lg font-bold">{formatCurrency(winnerAmounts.reduce((sum, amount) => sum + amount, 0))}</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center gap-4 mb-4">
                                <Label className="w-48">Number of Winners <span className="text-xs text-gray-500">(Required)</span></Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 rounded-full"
                                        onClick={() => {
                                            if (winnerCount > 1) {
                                                const newCount = winnerCount - 1;
                                                setWinnerCount(newCount);
                                                const newAmounts = [...winnerAmounts].slice(0, newCount);
                                                setWinnerAmounts(newAmounts);
                                            }
                                        }}
                                        disabled={winnerCount <= 1}
                                    >
                                        -
                                    </Button>
                                    <span className="w-8 text-center">{winnerCount}</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 rounded-full"
                                        onClick={() => {
                                            const newCount = winnerCount + 1;
                                            if (newCount <= 10) {
                                                setWinnerCount(newCount);
                                                const newAmounts = [...winnerAmounts];
                                                // Use default allocation if available, otherwise use minimum prize
                                                const position = newCount;
                                                newAmounts.push(DEFAULT_PRIZE_ALLOCATIONS[position as keyof typeof DEFAULT_PRIZE_ALLOCATIONS] || MIN_PRIZE_PER_WINNER);
                                                setWinnerAmounts(newAmounts);
                                            }
                                        }}
                                        disabled={winnerCount >= 10}
                                    >
                                        +
                                    </Button>
                                </div>
                                <div className="text-sm text-gray-500">
                                    <span>Max: 10</span>
                                </div>
                            </div>

                            {Array.from({ length: winnerCount }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 mb-2">
                                    <Label className="w-48">Winner {i + 1}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={(winnerAmounts[i] || MIN_PRIZE_PER_WINNER) / 100}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;

                                            // Allow empty input for typing new values
                                            if (inputValue === '') {
                                                const newAmounts = [...winnerAmounts];
                                                newAmounts[i] = 0; // Temporarily set to 0
                                                setWinnerAmounts(newAmounts);
                                                return;
                                            }

                                            // Convert from display dollars to cents for storage
                                            const dollars = parseFloat(inputValue);

                                            // Only validate if we have a proper number
                                            if (!isNaN(dollars)) {
                                                // Convert to cents and round to avoid floating point issues
                                                const value = Math.round(dollars * 100);

                                                // Always update the value first for responsiveness
                                                const newAmounts = [...winnerAmounts];
                                                newAmounts[i] = value;
                                                setWinnerAmounts(newAmounts);

                                                // Show validation messages after updating
                                                if (value < MIN_PRIZE_PER_WINNER) {
                                                    setValidationError(`Prize amount cannot be less than ${formatCurrency(MIN_PRIZE_PER_WINNER)}`);
                                                } else if (value > MAX_PRIZE_PER_WINNER) {
                                                    setValidationError(`Prize amount cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`);
                                                } else {
                                                    setValidationError(null);
                                                }
                                            }
                                        }}
                                        min={MIN_PRIZE_PER_WINNER / 100}
                                        max={MAX_PRIZE_PER_WINNER / 100}
                                        className="w-48"
                                    />
                                    <div className="text-sm text-gray-500">
                                        <span>Min: {formatCurrency(MIN_PRIZE_PER_WINNER)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
} 