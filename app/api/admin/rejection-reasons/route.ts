import { NextResponse } from 'next/server';

// Predefined rejection reasons - can be moved to database in the future
const PREDEFINED_REASONS = [
  {
    value: 'content_guidelines',
    label: 'Content Guidelines Violation',
    description: 'Content does not follow contest guidelines or platform rules'
  },
  {
    value: 'quality_standards',
    label: 'Quality Standards Not Met',
    description: 'Content quality does not meet the required standards'
  },
  {
    value: 'brand_guidelines',
    label: 'Brand Guidelines Violation',
    description: 'Content does not align with brand guidelines or requirements'
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Content contains inappropriate or offensive material'
  },
  {
    value: 'copyright_issues',
    label: 'Copyright Issues',
    description: 'Content may violate copyright or intellectual property rights'
  },
  {
    value: 'technical_issues',
    label: 'Technical Issues',
    description: 'Content has technical problems or is not accessible'
  },
  {
    value: 'off_topic',
    label: 'Off Topic',
    description: 'Content is not relevant to the contest theme or requirements'
  },
  {
    value: 'duplicate_content',
    label: 'Duplicate Content',
    description: 'Content appears to be duplicate or very similar to existing submissions'
  },
  {
    value: 'incomplete_submission',
    label: 'Incomplete Submission',
    description: 'Submission is incomplete or missing required elements'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other reason not listed above'
  }
];

export async function GET() {
  try {
    return NextResponse.json({
      reasons: PREDEFINED_REASONS
    });
  } catch (error) {
    console.error('Error fetching rejection reasons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 