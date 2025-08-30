# GoViral Platform - Complete Product Requirements Document (PRD)

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Vision & Mission](#product-vision--mission)
3. [Market Opportunity](#market-opportunity)
4. [Product Overview](#product-overview)
5. [User Personas & Roles](#user-personas--roles)
6. [Core Features & Functionality](#core-features--functionality)
7. [Business Model](#business-model)
8. [Technical Architecture](#technical-architecture)
9. [User Flows & Journeys](#user-flows--journeys)
10. [Data Model](#data-model)
11. [Platform Integrations](#platform-integrations)
12. [Admin & Content Moderation](#admin--content-moderation)
13. [Monetization & Payment Systems](#monetization--payment-systems)
14. [Security & Compliance](#security--compliance)
15. [Performance & Scalability](#performance--scalability)
16. [Roadmap & Future Enhancements](#roadmap--future-enhancements)

---

## Executive Summary

**GoViral** (formerly Game of Creators) is a revolutionary influencer marketing platform that connects brands with content creators through strategic contest-based campaigns. The platform enables brands to discover their content-market fit through data-driven creator competitions while providing creators with monetization opportunities.

### Key Value Propositions:
- **For Brands**: Test content styles at scale, find content-market fit, get full ownership of winning content
- **For Creators**: Earn money through contest participation, showcase skills, build portfolio
- **For Platform**: Generate revenue through subscription plans and transaction fees

### Current Status:
- **Technology Stack**: Next.js 15, TypeScript, Supabase, Tailwind CSS
- **User Base**: 5,000+ active creators across various niches
- **Business Model**: Subscription-based for brands with commission fees
- **Platform Maturity**: Production-ready with advanced features

---

## Product Vision & Mission

### **Vision Statement**
To become the world's leading platform where brands discover viral content and creators build sustainable careers through data-driven, fair competition.

### **Mission Statement**
We democratize content marketing by creating a transparent, performance-based ecosystem where creativity meets data, enabling brands to find their content-market fit while empowering creators to monetize their skills.

### **Core Values**
1. **Transparency**: All metrics are verifiable and public
2. **Fairness**: Merit-based rewards with clear performance criteria
3. **Ownership**: Brands get full rights to winning content
4. **Authenticity**: Real audiences, genuine engagement
5. **Empowerment**: Equal opportunities for all creators regardless of follower count

---

## Market Opportunity

### **Target Market Size**
- **Influencer Marketing Industry**: $21.1 billion (2023)
- **User-Generated Content Market**: $18.6 billion (2028 projected)
- **Creator Economy**: $104 billion (2022)

### **Market Problems Solved**
1. **Brand Challenge**: Difficulty finding content that resonates with target audience
2. **Creator Challenge**: Inconsistent income and limited opportunities for smaller creators
3. **Industry Challenge**: Lack of performance transparency in influencer partnerships
4. **Content Challenge**: High cost and time investment for content creation testing

### **Competitive Advantage**
- **Contest-based model** creates natural motivation for quality content
- **Performance-driven rewards** ensure brands get value
- **Full content ownership** provides long-term value
- **Real audience verification** through public platform links
- **Scalable testing** allows rapid content-market fit discovery

---

## Product Overview

### **Platform Purpose**
GoViral is a contest-based influencer marketing platform where brands launch creative contests and creators compete to produce the most engaging content, with winners determined by real performance metrics.

### **Core Concept**
1. **Brands** create contests with specific briefs and prize pools
2. **Creators** submit content on their social media accounts
3. **Performance metrics** (views, engagement) determine winners
4. **Winners** receive monetary rewards
5. **Brands** gain full ownership of winning content

### **Key Differentiators**
- **Contest Model**: Gamified approach increases creator motivation
- **Performance-Based**: Winners determined by actual audience engagement
- **Content Ownership**: Brands get perpetual rights to winning content
- **Transparent Metrics**: All performance data is publicly verifiable
- **Platform Agnostic**: Supports YouTube, Instagram, and other platforms

---

## User Personas & Roles

### **1. Brand/Advertiser User**
**Profile**: Marketing managers, startup founders, growth marketers
**Goals**: 
- Find content that resonates with target audience
- Test marketing messages at scale
- Build library of high-performing content
- Achieve viral marketing success

**Needs**:
- Easy contest creation with detailed briefs
- Performance analytics and insights
- Content ownership and download rights
- Budget control and ROI tracking

**Pain Points**:
- Uncertainty about content performance
- High cost of professional content creation
- Difficulty measuring content effectiveness
- Time-consuming creator outreach

### **2. Creator User**
**Profile**: Content creators, influencers, aspiring creators
**Goals**:
- Earn money from content creation
- Build portfolio and gain exposure
- Develop skills and creativity
- Access brand partnership opportunities

**Needs**:
- Clear contest briefs and requirements
- Fair competition and transparent judging
- Reliable payment system
- Skill development opportunities

**Pain Points**:
- Inconsistent income opportunities
- Unfair competition from larger accounts
- Unclear payment terms
- Limited feedback on content performance

### **3. Admin User**
**Profile**: Platform moderators, customer support, management
**Goals**:
- Ensure platform quality and safety
- Moderate content and resolve disputes
- Monitor platform performance
- Support user success

**Needs**:
- Content moderation tools
- User management capabilities
- Analytics and reporting
- Dispute resolution workflows

---

## Core Features & Functionality

### **1. Contest Management System**

#### **Contest Types**
1. **Leaderboard Contests**
   - Fixed prize pool distributed among top performers
   - Ranked by views, engagement, or custom metrics
   - Multiple winners (1-100 depending on plan)

2. **CPM Contests**
   - Pay-per-thousand-views model
   - Budget-controlled spending
   - Performance-based payouts
   - Minimum/maximum view thresholds

#### **Contest Creation Features**
- **Rich Brief Editor**: HTML/Markdown support with preview
- **Resource Management**: File uploads and external links
- **Prize Pool Configuration**: Flexible winner distribution
- **Date/Time Scheduling**: Contest duration management
- **Platform Selection**: YouTube, Instagram, etc.
- **Category Tagging**: Tech, lifestyle, beauty, etc.
- **Inspiration Links**: Reference content examples

#### **Contest Lifecycle**
1. **Draft**: Brand creates and edits contest
2. **Pending Approval**: Submitted for admin review
3. **Approved**: Ready for publication
4. **Published**: Live for creator participation
5. **Active**: During contest period
6. **Ended**: Contest period completed
7. **Under Review**: Post-contest evaluation
8. **Verification Complete**: Winners confirmed
9. **Payouts Processed**: Payments distributed

### **2. Creator Discovery & Participation**

#### **Opportunity Dashboard**
- **Contest Browser**: Filter by platform, category, status
- **Sorting Options**: By date, prize value, CPM rate, submissions
- **Contest Details**: Full brief, requirements, deadlines
- **Participation Tracking**: Submitted contests history

#### **Submission System**
- **Content Link Submission**: Direct platform URLs
- **Automatic Verification**: Platform-specific validation
- **Metadata Extraction**: Title, thumbnail, description
- **Performance Tracking**: Real-time metrics updates
- **Status Management**: Pending, verified, rejected, paid

### **3. Social Media Integrations**

#### **YouTube Integration**
- **OAuth Authentication**: Secure account linking
- **Video Verification**: Ownership and public status check
- **Metrics Collection**: Views, likes, comments, shares
- **Channel Analytics**: Subscriber count, channel info
- **Real-time Updates**: Automated metrics refresh

#### **Instagram Integration**
- **Business Account Support**: Instagram Business API
- **Content Verification**: Post ownership validation
- **Engagement Metrics**: Likes, comments, shares, saves
- **Story Support**: Instagram Stories participation
- **Reels Analytics**: Instagram Reels performance data

### **4. Analytics & Reporting**

#### **Brand Analytics**
- **Contest Performance**: Participation rates, engagement
- **Creator Insights**: Top performers, audience demographics
- **Content Analysis**: Best-performing content types
- **ROI Tracking**: Cost per view, engagement rates
- **Download Center**: Winning content access

#### **Creator Analytics**
- **Earnings Dashboard**: Total earnings, pending payments
- **Performance History**: Contest participation outcomes
- **Skill Development**: Performance trend analysis
- **Opportunity Matching**: Personalized contest recommendations

### **5. Payment & Withdrawal System**

#### **Multiple Payout Methods**
- **Cryptocurrency**: LTC, USDT (BEP20)
- **UPI**: Indian payment system integration
- **Bank Transfer**: International wire transfers
- **PayPal**: (Planned future feature)

#### **Withdrawal Management**
- **Minimum Thresholds**: $5 minimum withdrawal
- **Fee Structure**: 10% platform fee
- **Request Tracking**: Status monitoring
- **Security Verification**: Multi-step approval process

---

## Business Model

### **Revenue Streams**

#### **1. Subscription Plans**
| Plan | Monthly Price | Commission | Max Contests | Min Budget | Max Winners |
|------|---------------|------------|--------------|------------|-------------|
| FREE | $0 | 50% | 1 | $100 | 3 |
| BRONZE | $100 | 20% | 5 | $100 | 10 |
| SILVER | $200 | 15% | 10 | $75 | 20 |
| GOLD | $300 | 12% | 20 | $50 | 30 |
| PLATINUM | $400 | 10% | 30 | $50 | 50 |
| DIAMOND | $500 | 10% | 100 | $50 | 100 |

#### **2. Transaction Fees**
- **Creator Withdrawals**: 10% fee on all payouts
- **Payment Processing**: Standard gateway fees
- **International Transfers**: Additional banking fees

#### **3. Value-Added Services** (Future)
- **Premium Analytics**: Advanced insights and reporting
- **Managed Campaigns**: Full-service contest management
- **Custom Integrations**: Bespoke platform connections
- **White-label Solutions**: Private-labeled platforms

### **Unit Economics**
- **Average Contest Value**: $1,000-$2,000
- **Platform Commission**: 10-50% depending on plan
- **Creator Payout**: 90% of contest budget (after commission)
- **Platform Revenue**: Commission + withdrawal fees + subscriptions

---

## Technical Architecture

### **Frontend Stack**
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React hooks + local state
- **Authentication**: Supabase Auth
- **Rich Text**: TipTap/Novel editor for briefs

### **Backend Stack**
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with OAuth
- **Storage**: Supabase Storage for file uploads
- **API**: Next.js API routes
- **Real-time**: Supabase real-time subscriptions

### **Third-Party Integrations**
- **YouTube**: Google APIs (OAuth2, YouTube Data API v3)
- **Instagram**: Meta Business API
- **Payments**: Stripe, Razorpay
- **Email**: Supabase Auth emails
- **Monitoring**: Vercel Analytics

### **Deployment**
- **Hosting**: Vercel for Next.js application
- **Database**: Supabase managed PostgreSQL
- **CDN**: Vercel Edge Network
- **Domain**: Custom domain with SSL

### **Development Tools**
- **Version Control**: Git
- **Package Manager**: pnpm
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript compiler
- **Build System**: Next.js built-in

---

## User Flows & Journeys

### **Brand User Journey**

#### **1. Onboarding Flow**
```
Sign Up → Email Verification → Choose Username → 
Profile Setup → Subscription Selection → Dashboard Access
```

#### **2. Contest Creation Flow**
```
Dashboard → Create Contest → Basic Info → Brief & Rules → 
Resources Upload → Prize Configuration → Schedule → 
Save Draft → Submit for Approval → Admin Review → 
Approved → Publish → Contest Live
```

#### **3. Contest Management Flow**
```
Published Contest → Monitor Submissions → Track Performance → 
Contest Ends → Review Results → Approve Winners → 
Process Payouts → Download Content
```

### **Creator User Journey**

#### **1. Onboarding Flow**
```
Sign Up → Email Verification → Choose Username → 
Profile Setup → Connect Social Accounts → Browse Opportunities
```

#### **2. Contest Participation Flow**
```
Browse Contests → Select Contest → Read Brief → 
Create Content → Post on Platform → Submit Link → 
Verification → Performance Tracking → Results → 
Payment (if winner)
```

#### **3. Earnings Management Flow**
```
Earnings Dashboard → Setup Payout Method → 
Request Withdrawal → Admin Review → 
Payment Processing → Funds Received
```

---

## Data Model

### **Core Entities**

#### **Users Table**
```sql
users {
  id: UUID (Primary Key)
  email: STRING
  full_name: STRING
  username: STRING (Unique)
  user_type: ENUM('advertiser', 'creator', 'admin')
  profile_picture_url: STRING
  referral_code: STRING
  referred_by: UUID (Foreign Key)
  coins: INTEGER
  is_active: BOOLEAN
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

#### **Contests Table**
```sql
contests {
  id: UUID (Primary Key)
  advertiser_id: UUID (Foreign Key)
  title: STRING
  platform: STRING ('youtube', 'instagram')
  contest_type: ENUM('leaderboard', 'cpm')
  brief_html: TEXT
  rules_html: TEXT
  thumbnail_url: STRING
  start_date: TIMESTAMP
  end_date: TIMESTAMP
  contest_based_details: JSONB
  moderation_status: ENUM('draft', 'pending_approval', 'approved', 'published', 'rejected')
  post_contest_status: ENUM('pending_review', 'in_review', 'verification_complete', 'payouts_processed')
  live_submission_count: INTEGER
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

#### **Submissions Table**
```sql
submissions {
  id: UUID (Primary Key)
  contest_id: UUID (Foreign Key)
  creator_id: UUID (Foreign Key)
  content_link: STRING
  platform: STRING
  video_id: STRING
  video_title: STRING
  video_thumbnail_url: STRING
  views: INTEGER
  other_stats: JSONB
  earnings: INTEGER (cents)
  status: ENUM('pending', 'verified', 'rejected', 'paid')
  created_at: TIMESTAMP
  last_insights_update: TIMESTAMP
}
```

#### **Subscription Plans Table**
```sql
subscription_plans {
  id: UUID (Primary Key)
  name: STRING
  price: INTEGER (cents)
  json_features: JSONB
  stripe_price_id: STRING
  razorpay_plan_id: STRING
  created_at: TIMESTAMP
}
```

#### **Creator Profiles Table**
```sql
creator_profiles {
  id: UUID (Primary Key, Foreign Key to users)
  bio: TEXT
  youtube_account: JSONB
  instagram_account: JSONB
  total_contests_participated: INTEGER
  total_contests_won: INTEGER
  total_money_won: INTEGER (cents)
  withdrawable_balance: INTEGER (cents)
  total_views: BIGINT
}
```

#### **Advertiser Profiles Table**
```sql
advertiser_profiles {
  id: UUID (Primary Key, Foreign Key to users)
  company_name: STRING
  website_url: STRING
  subscription_plan: STRING
  available_deposit_balance: INTEGER (cents)
  withdrawable_balance: INTEGER (cents)
  total_money_spent: INTEGER (cents)
  total_contests_run: INTEGER
}
```

---

## Platform Integrations

### **YouTube Integration**

#### **Authentication Flow**
1. User initiates YouTube connection
2. OAuth2 redirect to Google
3. User grants permissions
4. Receive access/refresh tokens
5. Store encrypted tokens in database
6. Fetch and store channel information

#### **Content Verification**
1. Creator submits YouTube video URL
2. Extract video ID from URL
3. Verify video ownership via API
4. Check video privacy status (must be public)
5. Extract metadata (title, thumbnail, description)
6. Store video information

#### **Metrics Collection**
1. Scheduled cron jobs (hourly/daily)
2. Fetch video statistics via YouTube API
3. Update submission records
4. Calculate contest rankings
5. Notify brands of performance changes

### **Instagram Integration**

#### **Business Account Requirements**
- Instagram Business or Creator account
- Facebook Page connection
- Meta Business API access
- Content publishing permissions

#### **Content Types Supported**
- Instagram Posts (photos/videos)
- Instagram Reels
- Instagram Stories (24-hour availability)
- IGTV (legacy support)

---

## Admin & Content Moderation

### **Contest Moderation System**

#### **Approval Workflow**
1. **Draft Creation**: Brand creates contest
2. **Submission**: Brand submits for approval
3. **Admin Review**: Content guidelines check
4. **Decision**: Approve, reject, or request changes
5. **Notification**: Brand receives decision
6. **Publication**: Approved contests go live

#### **Review Criteria**
- **Content Guidelines**: No inappropriate content
- **Legal Compliance**: Terms of service adherence
- **Prize Structure**: Minimum prize requirements
- **Brief Quality**: Clear, actionable instructions
- **Resource Availability**: Valid links and files

#### **Admin Dashboard Features**
- **Queue Management**: Pending approvals list
- **Contest Details**: Full brief and resource review
- **Decision Tracking**: Approval/rejection history
- **Bulk Actions**: Mass approve/reject functionality
- **Analytics**: Moderation queue metrics

### **Content Safety**
- **Automated Filtering**: Basic content screening
- **Manual Review**: Human moderation for flagged content
- **Community Reporting**: User-generated reports
- **Appeal Process**: Contest rejection appeals
- **Compliance Monitoring**: Ongoing guideline enforcement

---

## Monetization & Payment Systems

### **Payment Processing Architecture**

#### **For Brands (Subscription Payments)**
- **Stripe Integration**: Credit card processing
- **Razorpay Integration**: Indian market payments
- **Subscription Management**: Auto-renewal, cancellation
- **Invoice Generation**: Automated billing
- **Payment Retry**: Failed payment handling

#### **For Creators (Payout System)**
- **Multi-method Support**: Crypto, UPI, bank transfer
- **Escrow System**: Secure payment holding
- **Withdrawal Requests**: Creator-initiated payouts
- **Admin Approval**: Payment verification process
- **Transaction Tracking**: Full audit trail

### **Financial Management**

#### **Revenue Recognition**
- **Subscription Revenue**: Monthly recurring recognition
- **Commission Revenue**: Per-contest completion
- **Transaction Fees**: Per-withdrawal processing

#### **Expense Tracking**
- **Creator Payouts**: Contest prize distributions
- **Payment Processing**: Gateway fees
- **Platform Costs**: Infrastructure and operations

---

## Security & Compliance

### **Data Security**
- **Encryption**: All sensitive data encrypted at rest
- **HTTPS**: SSL/TLS for all communications
- **Authentication**: Multi-factor authentication support
- **Authorization**: Role-based access control
- **API Security**: Rate limiting and validation

### **Privacy Compliance**
- **GDPR**: European privacy regulation compliance
- **CCPA**: California privacy rights
- **Data Retention**: Automatic data cleanup policies
- **User Consent**: Clear privacy policy and consent flows
- **Data Export**: User data download capabilities

### **Financial Security**
- **PCI DSS**: Payment card data security
- **AML/KYC**: Anti-money laundering compliance
- **Fraud Detection**: Transaction monitoring
- **Secure Storage**: Encrypted financial data
- **Audit Trails**: Complete transaction logging

---

## Performance & Scalability

### **Current Performance**
- **Database**: Optimized queries with proper indexing
- **CDN**: Global content delivery network
- **Caching**: Strategic caching for frequently accessed data
- **Real-time**: Efficient WebSocket connections for live updates

### **Scalability Considerations**
- **Horizontal Scaling**: Database read replicas
- **Microservices**: API decomposition for high-load features
- **Queue Systems**: Background job processing
- **Media Processing**: Efficient file upload and processing
- **Search Optimization**: Advanced contest and creator discovery

### **Monitoring & Analytics**
- **Application Monitoring**: Error tracking and performance
- **User Analytics**: Engagement and conversion tracking
- **Business Metrics**: Revenue and growth analytics
- **System Health**: Infrastructure monitoring

---

## Roadmap & Future Enhancements

### **Short-term (3-6 months)**
1. **Mobile App Development**: Native iOS/Android applications
2. **Advanced Analytics**: Enhanced reporting and insights
3. **Payment Expansion**: Additional payment methods
4. **Platform Expansion**: TikTok integration
5. **Creator Tools**: Content creation assistance

### **Medium-term (6-12 months)**
1. **AI-Powered Matching**: Smart creator-contest pairing
2. **Automated Moderation**: AI content review
3. **White-label Solution**: Custom branded platforms
4. **Enterprise Features**: Advanced brand management
5. **Global Expansion**: Multi-language support

### **Long-term (12+ months)**
1. **Predictive Analytics**: Performance prediction models
2. **Blockchain Integration**: NFT content ownership
3. **Virtual Reality**: VR/AR content support
4. **Acquisition Features**: Creator talent marketplace
5. **API Ecosystem**: Third-party developer platform

---

## Success Metrics & KPIs

### **Platform Growth**
- **Monthly Active Users**: Total active creators and brands
- **Contest Creation Rate**: New contests per month
- **Creator Participation**: Average submissions per contest
- **Platform Revenue**: Monthly recurring revenue growth

### **User Success**
- **Creator Earnings**: Average earnings per creator
- **Brand Satisfaction**: Contest completion and renewal rates
- **Content Performance**: Average views and engagement
- **Platform NPS**: Net Promoter Score

### **Business Health**
- **Customer Acquisition Cost**: Cost to acquire new users
- **Lifetime Value**: Revenue per user over time
- **Churn Rate**: User retention and loss rates
- **Gross Margin**: Revenue after direct costs

---

## Conclusion

GoViral represents a revolutionary approach to influencer marketing that benefits all stakeholders:

- **Brands** get data-driven content discovery with full ownership rights
- **Creators** gain fair, performance-based earning opportunities
- **Platform** builds sustainable revenue through transparent value creation

The platform's contest-based model creates natural incentives for quality content while providing measurable results for brands. With its robust technical architecture, comprehensive feature set, and clear growth strategy, GoViral is positioned to become the leading platform in the creator economy.

The combination of transparent metrics, fair competition, and full content ownership creates a unique value proposition that addresses key pain points in the current influencer marketing landscape. As the creator economy continues to grow, GoViral provides the infrastructure and tools necessary for brands and creators to succeed together.

---

*This PRD serves as the comprehensive guide for understanding, developing, and scaling the GoViral platform. It should be regularly updated as the product evolves and new features are added.* 