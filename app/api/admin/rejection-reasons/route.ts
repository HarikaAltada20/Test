import { NextResponse } from 'next/server';

// Predefined rejection reasons - can be moved to database in the future
const PREDEFINED_REASONS = [
  {
    value: 'contest_rules',
    label: 'Contest brief or rules not followed',
    description: 'Submission does not follow the contest brief or rules'
  },
  {
    value: 'terms_violation',
    label: 'Terms & Conditions violation',
    description: 'Violates the platform or contest terms and conditions'
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate content',
    description: 'Content is offensive, harmful, or otherwise inappropriate'
  },
  {
    value: 'copyright_issue',
    label: 'Copyright issue',
    description: 'Potential copyright or intellectual property infringement'
  },
  {
    value: 'technical_issues',
    label: 'Technical issues',
    description: 'Content has technical problems, is inaccessible, or was deleted'
  },
  {
    value: 'duplicate_content',
    label: 'Duplicate content',
    description: 'Same or very similar to an existing submission'
  },
  {
    value: 'quality_standards',
    label: 'Quality standards not met',
    description: 'Content quality does not meet the required standards'
  },
  {
    value: 'other',
    label: 'Custom Reason',
    description: 'Provide a specific custom reason in your own words'
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