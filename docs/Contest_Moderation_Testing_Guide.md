# Contest Moderation System - Testing Guide

## Quick Setup for End-to-End Testing

### 1. **Database Setup**

```bash
# Run the master setup script
psql -d your_database -f sql/setup_contest_moderation_complete.sql

# Add test data (optional but recommended)
psql -d your_database -f sql/create_test_data_for_moderation.sql
```

### 2. **What You Can Test**

#### **Brand Dashboard** (`/dashboard/contests`)
- **7 Tabs** with different contest states:
  - **All**: All contests
  - **Draft**: Contests being created
  - **Pending Approval**: Submitted for admin review
  - **Ready**: Approved, waiting to be published
  - **Active**: Live contests (active/upcoming)
  - **Pending Verification**: Ended, awaiting admin review
  - **Done**: Verified contests (with payment status)

#### **Admin Dashboard** (`/dashboard/admin/contest-moderation`)
- **Contest approval workflow**
- **Bulk moderation actions**
- **Review and rejection with reasons**

### 3. **Expected UI Behavior**

#### **Published Contests** (Active/Done tabs)
- **Original design**: Traditional card layout
- **Submission counts** displayed
- **Status badges**: Live, Upcoming, Ended, etc.
- **Payment status**: "Verified - Payment Processing" vs "Verified - Payment Released"

#### **Unpublished Contests** (Draft/Pending/Ready/Rejected tabs)
- **Modern design**: Enhanced card layout with visual appeal
- **Date information** instead of submission counts
- **Moderation status badges**: Draft, Pending Approval, Ready, Rejected
- **Rejection reasons** displayed for rejected contests
- **Context-aware actions**: Continue Editing vs View Details

### 4. **Testing the Complete Flow**

1. **Create Draft Contest** → Save as draft
2. **Submit for Approval** → Moves to Pending Approval tab
3. **Admin Reviews** → Approve/Reject via admin panel
4. **If Approved** → Moves to Ready tab
5. **Publish Contest** → Moves to Active tab (original design)
6. **Contest Ends** → Moves to Pending Verification tab
7. **Admin Verifies** → Badge shows "Verified - Payment Processing"
8. **Process Payments** → Badge shows "Verified - Payment Released"

### 5. **Key Features to Verify**

- ✅ **Tab filtering** works correctly
- ✅ **Status badges** show appropriate colors and text
- ✅ **Card designs** differ between published/unpublished
- ✅ **Rejection reasons** display properly
- ✅ **Payment status** differentiation in Done tab
- ✅ **Sorting and filtering** work across all tabs
- ✅ **Admin moderation** actions function correctly

### 6. **Database States to Test**

The test data script creates contests in all these states:

| State | Count | Description |
|-------|-------|-------------|
| Draft | 2 | Being created |
| Pending Approval | 2 | Awaiting admin review |
| Ready | 1 | Approved, ready to publish |
| Active | 3 | Live contests (active + upcoming) |
| Pending Verification | 2 | Ended, awaiting review |
| Done | 2 | Verified (1 payment processing, 1 payment released) |
| Rejected | 2 | Rejected with reasons |

### 7. **Manual Testing Checklist**

- [ ] All 7 tabs display correct contest counts
- [ ] Published contests use original design
- [ ] Unpublished contests use modern design
- [ ] Status badges show correct colors and text
- [ ] Rejection reasons display properly
- [ ] Payment status differentiation works
- [ ] Admin can approve/reject contests
- [ ] Contest creation flow works end-to-end
- [ ] Sorting and filtering function correctly
- [ ] Responsive design works on mobile

### 8. **Troubleshooting**

If you encounter issues:

1. **Check database**: Ensure `post_contest_status` field exists
2. **Verify view**: Run `SELECT * FROM contests_with_status LIMIT 1;`
3. **Check permissions**: Ensure your user can access the view
4. **Review browser console**: Look for any JavaScript errors
5. **Verify types**: Ensure TypeScript types match database schema

### 9. **Performance Notes**

The system includes optimized indexes for:
- `post_contest_status` filtering
- Combined `status` + `post_contest_status` queries
- Efficient view queries with proper joins

This should handle large datasets efficiently while maintaining fast UI responsiveness. 