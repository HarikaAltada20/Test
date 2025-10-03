### Microsoft Clarity Setup

Follow these steps to enable Microsoft Clarity across the site:

1. Create a Clarity project

   - Go to `https://clarity.microsoft.com/`
   - Create a new project and copy the Project ID (a short alphanumeric string)

2. Configure environment variable
   - Locally: create a `.env.local` file in the repo root:

```bash
NEXT_PUBLIC_CLARITY_ID=YOUR_PROJECT_ID
```

- Production (e.g., Vercel): add an Environment Variable in the dashboard
  - Name: `NEXT_PUBLIC_CLARITY_ID`
  - Value: `YOUR_PROJECT_ID`
  - Scope: Production (and Preview if desired)

3. Deploy or restart dev server
   - Restart local dev server after setting the env var
   - Redeploy or trigger a rebuild in hosting provider

Notes

- The script is conditionally injected in `app/layout.tsx` only if `NEXT_PUBLIC_CLARITY_ID` is present.
- No data is sent to Clarity if the env variable is not set.
