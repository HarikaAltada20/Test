# Button Loading States Guide

## Overview

The enhanced Button component now includes built-in loading state support that automatically shows a spinner and custom loading text when a button is in a processing state. This provides better user feedback and eliminates the need to manually handle loading states in each component.

## Features

- **Automatic Spinner**: Shows a spinning loader icon when `loading={true}`
- **Custom Loading Text**: Display custom text during loading states
- **Automatic Disabling**: Button is automatically disabled when loading
- **Consistent UX**: Standardized loading behavior across the application

## Usage

### Basic Loading State

```tsx
import { Button } from "@/components/ui/button";

function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Your async operation
      await someAsyncOperation();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSubmit}
      loading={isLoading}
      loadingText="Processing..."
    >
      Submit
    </Button>
  );
}
```

### With Custom Loading Text

```tsx
<Button 
  loading={isProcessing}
  loadingText="Creating payment..."
>
  <CreditCard className="mr-2 h-4 w-4" />
  Pay Now
</Button>
```

### Dynamic Loading Text

```tsx
<Button 
  loading={isProcessing}
  loadingText={
    processingStep === 'creating' ? 'Creating payment...' :
    processingStep === 'confirming' ? 'Confirming payment...' :
    processingStep === 'polling' ? 'Verifying payment...' :
    'Processing...'
  }
>
  <CreditCard className="mr-2 h-4 w-4" />
  Add to Wallet
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `loading` | `boolean` | `false` | Whether the button is in a loading state |
| `loadingText` | `string` | - | Text to display when loading (replaces children) |
| `disabled` | `boolean` | - | Whether the button is disabled (automatically true when loading) |

## Migration Guide

### Before (Manual Loading State)

```tsx
<Button
  onClick={handleSubmit}
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </>
  ) : (
    <>
      <Save className="mr-2 h-4 w-4" />
      Save Changes
    </>
  )}
</Button>
```

### After (Enhanced Button)

```tsx
<Button
  onClick={handleSubmit}
  loading={isLoading}
  loadingText="Processing..."
>
  <Save className="mr-2 h-4 w-4" />
  Save Changes
</Button>
```

## Benefits

1. **Cleaner Code**: No more conditional rendering for loading states
2. **Consistent UX**: All buttons behave the same way when loading
3. **Better Maintainability**: Loading logic is centralized in the Button component
4. **Reduced Boilerplate**: Less code to write and maintain
5. **Automatic Accessibility**: Loading states are properly handled for screen readers

## Examples in the Codebase

### Delete Contest Button
```tsx
<Button
  variant="destructive"
  onClick={handleDelete}
  loading={isDeleting}
  loadingText="Deleting..."
>
  Delete Contest
</Button>
```

### Subscription Management
```tsx
<Button
  onClick={() => handleSubscribe(plan.id)}
  loading={isProcessing}
  loadingText="Processing..."
  variant={plan.price === 0 ? "outline" : "default"}
>
  <CreditCard className="h-4 w-4 mr-2" />
  Subscribe
</Button>
```

### Payment Processing
```tsx
<Button
  type="submit"
  disabled={!stripe}
  loading={isProcessing}
  loadingText="Processing Payment..."
  className="w-full"
  size="lg"
>
  <CreditCard className="mr-2 h-4 w-4" />
  Charge Card $50.00
</Button>
```

## Best Practices

1. **Always provide loading text**: Give users clear feedback about what's happening
2. **Use descriptive text**: Instead of "Loading...", use "Saving changes..." or "Processing payment..."
3. **Keep icons in children**: The loading spinner will automatically replace the content, but keep your icons in the children for consistency
4. **Handle errors gracefully**: Make sure to reset loading state in catch blocks
5. **Use appropriate variants**: Loading states work with all button variants

## Implementation Details

The enhanced Button component:
- Automatically imports `Loader2` from lucide-react
- Shows the spinner when `loading={true}`
- Replaces children with `loadingText` when provided
- Automatically sets `disabled={true}` when loading
- Maintains all existing functionality and props

This enhancement provides a much better user experience by giving clear visual feedback during async operations while reducing code complexity across the application. 