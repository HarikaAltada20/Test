# Contest Moderation System - Optimized Implementation

## Overview

The Contest Moderation System implements a clean, optimized review workflow for contests created by brands/advertisers before they are published to creators. This ensures quality control and content compliance before contests go live.

**Key Benefits:**
- ✅ Single source of truth: `moderation_status` field only
- ✅ No redundant `is_draft` field - cleaner schema
- ✅ Optimized database queries and indexes
- ✅ Simplified codebase with consistent logic

## Contest Lifecycle

### States

1. **Draft** - Brand is still working on the contest
2. **Pending Approval** - Contest submitted for admin review
3. **Approved (Ready)** - Admin approved, brand can publish
4. **Published** - Contest is live for creators
5. **Rejected** - Admin rejected, needs changes

### Workflow

```
Draft → Pending Approval → Approved → Published
                      ↓
                   Rejected → (back to Draft)
```

## Database Schema Changes

### Fields in `contests` table:
- **REMOVED:** `is_draft` (boolean) - No longer needed
- **ADDED:** `moderation_status` (enum): Primary status field - 'draft', 'pending_approval', 'approved', 'published', 'rejected'
- **ADDED:** `submitted_for_approval_at` (timestamp): When submitted for review
- **ADDED:** `approved_at` (timestamp): When approved by admin
- **ADDED:** `approved_by` (uuid): Admin who approved the contest
- **ADDED:** `published_at` (timestamp): When published by brand
- **ADDED:** `rejection_reason` (text): Reason for rejection

### Optimized Indexes:
- `idx_contests_moderation_status` - Fast queries by status
- `idx_contests_submitted_for_approval` - Admin queue ordering
- `idx_contests_published_at` - Published contest queries

### Updated View:
- `contests_with_status`: **Separates concerns clearly**
  - `moderation_status`: Always shows approval workflow status
  - `status`: Only shows lifecycle status for published contests (null for others)

## API Endpoints

### Admin Endpoints
- `POST /api/admin/contest-moderation` - Approve/reject contests
- `GET /api/admin/contest-moderation` - Get contests for moderation

### Brand Endpoints  
- `POST /api/contests/[id]/moderation` - Submit for approval or publish
- `GET /api/contests/[id]/moderation` - Get moderation status and history

## UI Components

### Admin Interface
- `/dashboard/admin/contest-moderation` - Contest moderation dashboard
- Review contest details, approve/reject with reasons
- Filter by moderation status
- Audit trail visibility

### Brand Interface
- Updated contest creation flow to start as draft
- Contest detail pages show moderation status
- Submit for approval and publish buttons based on status
- Display rejection reasons and approval status

## Business Rules

### Editing Permissions
- **Draft**: Full editing allowed
- **Pending Approval**: No editing allowed
- **Approved**: Only date/time changes allowed (others require re-approval)
- **Published**: No editing allowed
- **Rejected**: Full editing allowed to address issues

### Date/Time Special Handling
- Brands can change contest dates/times without re-approval when in "Approved" state
- All other content changes require re-submission for approval

### Publishing Rules
- Only approved contests can be published
- Publishing is a one-way action - cannot unpublish
- Contest becomes visible to creators immediately upon publishing

## Implementation Files

### Database
- `sql/001_add_moderation_enum.sql` - Create moderation status enum
- `sql/002_add_moderation_fields.sql` - Add moderation fields to contests table
- `sql/003_update_contests_view.sql` - Update contests_with_status view
- `sql/004_create_moderation_functions.sql` - Create helper functions (optional)

### API Routes
- `app/api/admin/contest-moderation/route.ts` - Admin moderation endpoints
- `app/api/contests/[id]/moderation/route.ts` - Brand moderation endpoints

### UI Components
- `app/dashboard/admin/contest-moderation/page.tsx` - Admin moderation page
- `app/dashboard/admin/contest-moderation/ContestModerationClient.tsx` - Admin UI client
- Updated contest creation client to use moderation_status
- Added admin navigation link in sidebar

### Type Definitions
- `types/supabase.ts` already includes moderation fields

## Implementation Approach

### Optimized Design
- **Single source of truth**: Only `moderation_status` field - no redundancy
- **Clean schema**: Removed unnecessary `is_draft` field entirely
- **Optimized queries**: Indexes on key fields for fast performance
- **Simple logic**: No complex fallback conditions or field synchronization

### Clean Backend
- Direct database updates with optimized queries
- Simple API endpoints with clear validation
- Optional database functions for complex operations
- Consistent status handling throughout the application

## Security Considerations

- Admin-only access to moderation endpoints
- Ownership verification for all contest operations
- Audit logging for all moderation actions
- Proper validation of contest data before approval

## Future Enhancements

1. **Email Notifications**: Notify brands of approval/rejection status
2. **Bulk Actions**: Allow admins to approve/reject multiple contests
3. **Auto-approval**: Rules-based automatic approval for trusted brands
4. **Content Guidelines**: Integrated content policy checking
5. **Review Templates**: Pre-defined rejection reasons and approval criteria

## Migration Instructions

### **Option 1: Fresh Installation (Recommended)**
```sql
-- Single command installation with separated concerns
\i sql/optimized_moderation_system_v2.sql
```

### **Option 2: Step by Step**
```sql
-- 1. Create the enum
\i sql/001_add_moderation_enum.sql

-- 2. Add moderation fields (removes is_draft)
\i sql/002_add_moderation_fields.sql

-- 3. Update the contests_with_status view
\i sql/003_update_contests_view.sql

-- 4. (Optional) Create helper functions
\i sql/004_create_moderation_functions.sql
```

### **Deploy Code Changes:**
- Deploy optimized API endpoints (no `is_draft` references)
- Deploy updated UI components
- Admin navigation includes "Contest Moderation" link
- Updated TypeScript types (removed `is_draft`)

### **Verify Installation:**
- All contests have `moderation_status` set appropriately
- Admin moderation interface works
- Brand submission and publishing workflow functions
- Contest creation uses `moderation_status = 'draft'`
- No references to `is_draft` field remain

## Testing Scenarios

1. **Brand Creates Contest**: Should start as draft
2. **Submit for Approval**: Should validate required fields and update status
3. **Admin Approval**: Should allow publishing and log action
4. **Admin Rejection**: Should provide reason and allow re-editing
5. **Edit Restrictions**: Test editing permissions at each status
6. **Date/Time Changes**: Test special handling for approved contests
7. **Publishing**: Test final publication and visibility to creators

## Monitoring and Analytics

Track the following metrics:
- Average time from submission to approval
- Approval vs rejection rates
- Most common rejection reasons
- Contest quality improvements over time 