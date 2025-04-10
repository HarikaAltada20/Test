import { ContestClientPage } from './client'
import { use } from 'react'

// Server component with proper params handling
export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    return <ContestClientPage contestId={resolvedParams.id} />
} 