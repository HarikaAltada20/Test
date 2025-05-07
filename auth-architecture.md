# Authentication Architecture

## Overview
This document outlines the implementation of Client-Side Rendering (CSR) for authenticated pages and Static Site Generation (SSG) for non-authenticated routes in the GoViral application.

## Key Components

### 1. Client-Side Authentication

- **Auth Context (`contexts/auth-context.tsx`)**
  - Enhanced logout functionality to clear all client-side data immediately
  - Provides authentication state to the entire application

- **Auth Utils (`lib/auth-utils.ts`)**
  - `completeLogout()`: Utility function for fully clearing auth state and redirecting
  - `checkClientAuth()`: Client-side function to verify authentication status

- **Client Auth Hook (`hooks/use-client-auth.tsx`)**
  - React hook that can be used in any component to verify authentication
  - Provides automatic redirects for unauthenticated users
  - Customizable with redirect paths and required user types

- **Auth Guard Component (`components/auth-guard.tsx`)**
  - Wrapper component to protect routes requiring authentication
  - Shows loading states while checking authentication
  - Supports redirects for unauthorized access

### 2. Authenticated Routes (CSR)

- **Dashboard Layout (`app/dashboard/layout.tsx`)**
  - Protected with AuthGuard component
  - Ensures all dashboard pages require authentication

- **Dashboard Page (`app/dashboard/page.tsx`)**
  - Uses the useClientAuth hook for authentication checks
  - Fetches user data only after successful authentication

### 3. Public Routes (SSG)

- **Home Page (`app/page.tsx`)**
  - Uses static site generation with revalidation
  - Adds `export const revalidate = 3600` to refresh content hourly
  - Content is pre-rendered at build time for better performance

## How It Works

1. **Authentication Flow**
   - Unauthenticated users accessing protected routes are automatically redirected
   - Auth state is maintained client-side with proper error handling
   - Logout clears all local storage, cookies, and session data for immediate effect

2. **Performance Benefits**
   - Public pages load instantly as they're pre-rendered (SSG)
   - Authenticated pages leverage client-side checks for security
   - Clear separation between public and private content

3. **Implementation Details**
   - Next.js App Router for page routing
   - Supabase for authentication services
   - React Context and Hooks for state management

## Folders Structure

```
app/                     # Next.js app directory
├── dashboard/           # Authenticated routes (CSR)
├── auth/                # Authentication pages (CSR)
├── page.tsx             # Home page (SSG)
├── about/               # Public pages (SSG)
├── ...
components/
├── auth-guard.tsx       # Auth protection component
contexts/
├── auth-context.tsx     # Authentication state management
hooks/
├── use-client-auth.tsx  # Client auth hook
lib/
├── auth-utils.ts        # Authentication utilities
``` 