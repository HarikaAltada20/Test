#!/bin/bash

# Apply database changes using Supabase CLI
echo "Applying database changes..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "Supabase CLI not found. Please install it first: https://supabase.com/docs/guides/cli"
    echo "You can also apply changes manually by running the SQL in sql/apply_all_changes.sql via the Supabase dashboard SQL Editor"
    exit 1
fi

# Apply SQL changes
supabase db execute --file sql/apply_all_changes.sql

echo "Changes applied successfully!"
echo ""
echo "To verify the changes:"
echo "1. Check storage bucket settings in Supabase dashboard > Storage > contest-assets > Settings"
echo "   - File size limit should be set to 20MB (20971520 bytes)"
echo ""
echo "2. Check if the view was created in Supabase dashboard > Table Editor > Views"
echo "   - Look for 'contests_with_status' view"
echo ""
echo "3. Check if the dynamic status is working by querying the view:"
echo "   SELECT id, title, is_draft, start_date, end_date, status FROM contests_with_status LIMIT 10;"
echo ""
echo "4. Test the application to verify UI changes:"
echo "   - Asset upload UI should now have separate containers"
echo "   - Date/time selection should restrict past dates"
echo "   - Save Draft buttons should appear in all form steps"
echo "   - User's actual plan should be displayed correctly" 