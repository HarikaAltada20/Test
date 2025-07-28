# Rejection Reason System

## Overview
This system allows brands/admins to reject submissions with predefined reasons or custom reasons, providing better feedback to creators.

## Features Implemented

### 1. RejectionReasonModal Component
- **Location**: `components/RejectionReasonModal.tsx`
- **Features**:
  - Dropdown with 10 predefined rejection reasons
  - Custom reason input for "Other" option
  - Description preview for selected reasons
  - Loading state support
  - Form validation

### 2. Predefined Rejection Reasons
1. **Content Guidelines Violation** - Content does not follow contest guidelines or platform rules
2. **Quality Standards Not Met** - Content quality does not meet the required standards
3. **Brand Guidelines Violation** - Content does not align with brand guidelines or requirements
4. **Inappropriate Content** - Content contains inappropriate or offensive material
5. **Copyright Issues** - Content may violate copyright or intellectual property rights
6. **Technical Issues** - Content has technical problems or is not accessible
7. **Off Topic** - Content is not relevant to the contest theme or requirements
8. **Duplicate Content** - Content appears to be duplicate or very similar to existing submissions
9. **Incomplete Submission** - Submission is incomplete or missing required elements
10. **Other** - Other reason not listed above

### 3. API Updates
- **Updated**: `app/api/admin/verify-submission/route.ts`
  - Now uses `description` column to store rejection reasons
  - Supports both predefined and custom reasons
  - Enhanced success messages with rejection reasons

- **New**: `app/api/admin/rejection-reasons/route.ts`
  - Returns predefined rejection reasons
  - Can be used to make reasons configurable in the future

### 4. Frontend Integration
- **Updated**: `app/dashboard/contests/[id]/contest-detail-client.tsx`
  - Added rejection modal state management
  - Updated "Mark as Rejected" to open modal instead of direct API call
  - Integrated RejectionReasonModal component

### 5. Database Changes
- **Uses existing**: `description` column in `submissions` table
- **Stores**: Rejection reason in `description` field when status is 'rejected'
- **Clears**: `description` field when status changes from 'rejected' to other status

## How It Works

### For Brands/Admins:
1. Click "Mark as Rejected" in submission dropdown
2. Modal opens with predefined reasons
3. Select a reason or choose "Other" for custom reason
4. If "Other" is selected, enter custom reason
5. Click "Reject Submission" to confirm
6. Submission status updates to 'rejected' with reason stored in description

### For Creators:
- Rejection reason is stored in the `description` field
- Can be displayed in creator dashboard or notifications
- Provides clear feedback on why submission was rejected

## Technical Implementation

### State Management
```typescript
const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
const [pendingRejectionSubmission, setPendingRejectionSubmission] = useState<string | null>(null);
```

### API Call
```typescript
const handleUpdateSubmissionStatus = async (submissionId: string, newStatus: Submission['status'], reason?: string) => {
  // API call with reason parameter
  body: JSON.stringify({
    submissionId,
    action: newStatus,
    reason: reason || null,
  }),
}
```

### Database Storage
```sql
-- When rejecting, description field is updated
UPDATE submissions 
SET status = 'rejected', description = 'rejection_reason_here'
WHERE id = 'submission_id';
```

## Future Enhancements

1. **Configurable Reasons**: Move predefined reasons to database
2. **Reason Categories**: Group reasons by type (quality, guidelines, technical, etc.)
3. **Reason Analytics**: Track most common rejection reasons
4. **Creator Notifications**: Send rejection notifications with reasons
5. **Reason Templates**: Allow brands to create custom reason templates

## Files Modified

1. `components/RejectionReasonModal.tsx` - New component
2. `app/dashboard/contests/[id]/contest-detail-client.tsx` - Updated integration
3. `app/api/admin/verify-submission/route.ts` - Updated API
4. `app/api/admin/rejection-reasons/route.ts` - New API endpoint
5. `scripts/apply-advertiser-submission-policy.sql` - RLS policies

## Testing

To test the system:
1. Go to a contest with submissions
2. Click the dropdown menu on a submission
3. Select "Mark as Rejected"
4. Choose a predefined reason or enter custom reason
5. Confirm rejection
6. Verify submission status changes and reason is stored

## UI Improvements (Latest)

### Fixed Issues:
- **Hover Text Visibility**: Added proper text alignment and styling to ensure dropdown text is visible on hover
- **Selected Option Positioning**: Fixed alignment to show selected options at the start (left-aligned) instead of center
- **Dropdown Item Layout**: Improved spacing and text alignment for better readability
- **Selected Reason Display**: Enhanced preview to show both reason title and description clearly

### Visual Enhancements:
- Better text alignment with `text-left` classes
- Full-width dropdown items for better text visibility
- Custom CSS to override default positioning
- Improved selected reason preview with structured layout
- Fixed hover text visibility with enhanced CSS styling
- Added proper spacing and overflow handling
- Improved dropdown positioning and scrolling behavior 