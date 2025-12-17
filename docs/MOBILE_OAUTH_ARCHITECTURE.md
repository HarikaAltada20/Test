# Mobile OAuth Architecture & Code Snippets

Visual architecture diagrams and ready-to-use code snippets for mobile OAuth implementation.

---

## 🏗️ System Architecture

### Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Flutter Mobile App                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               InAppWebView (WebView Container)             │ │
│  │    - Custom User Agent: GameOfCreators-Mobile              │ │
│  │    - Loads: https://gameofcreators.com                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             Deep Link Handler Service                      │ │
│  │    - Listens: gameofcreators://                           │ │
│  │    - Routes: auth, instagram, youtube                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│              External Browser (Chrome/Safari)                    │
│    - Google OAuth: accounts.google.com                          │
│    - Instagram OAuth: api.instagram.com                         │
│    - YouTube OAuth: accounts.google.com                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│           Next.js Backend (gameofcreators.com)                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐│
│  │ Platform         │  │ Auth Pages       │  │ API Routes    ││
│  │ Detection        │  │ /auth/signin     │  │ /auth/        ││
│  │ - User Agent     │  │ /auth/signup     │  │ /instagram/   ││
│  │ - Redirect URIs  │  │ /choose-username │  │ /youtube/     ││
│  └──────────────────┘  └──────────────────┘  └───────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Supabase    │  │   Google     │  │  Instagram   │         │
│  │  Auth        │  │   OAuth      │  │   OAuth      │         │
│  │  Database    │  │   YouTube    │  │   Basic API  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 OAuth Flow Diagrams

### 1. Google Sign-In Flow (Mobile)

```
┌─────────┐                                                    
│  User   │                                                    
└────┬────┘                                                    
     │                                                         
     │ 1. Clicks "Sign In with Google"                       
     ↓                                                         
┌─────────────────┐                                           
│   WebView       │                                           
│ /auth/signin    │                                           
└────┬────────────┘                                           
     │                                                         
     │ 2. Detects: userAgent.includes('gameofcreators-mobile')
     │    Calls: supabase.auth.signInWithOAuth()             
     │    redirectTo: 'gameofcreators://auth/callback'       
     ↓                                                         
┌─────────────────────────┐                                   
│  Chrome Custom Tab      │                                   
│  accounts.google.com    │                                   
│  (External Browser)     │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 3. User authenticates with Google                     
     │    Google validates credentials                        
     ↓                                                         
┌─────────────────────────┐                                   
│  Google OAuth Server    │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 4. Redirects to:                                      
     │    gameofcreators://auth/callback?code=ABC123         
     ↓                                                         
┌─────────────────────────┐                                   
│  Deep Link Handler      │                                   
│  (Flutter App)          │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 5. Catches deep link                                  
     │    Extracts: code, state                              
     │    Opens WebView to:                                  
     │    https://gameofcreators.com/auth/callback?code=ABC123
     ↓                                                         
┌─────────────────────────┐                                   
│  Backend Callback       │                                   
│  /auth/callback         │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 6. Exchanges code for session                         
     │    Creates/updates user in Supabase                   
     │    Redirects to: /dashboard or /choose-username       
     ↓                                                         
┌─────────────────────────┐                                   
│  WebView                │                                   
│  Loads: /dashboard      │                                   
│  User is signed in ✓    │                                   
└─────────────────────────┘                                   
```

### 2. Instagram Connection Flow (Mobile)

```
┌─────────┐                                                    
│  User   │                                                    
└────┬────┘                                                    
     │                                                         
     │ 1. Clicks "Connect Instagram"                         
     ↓                                                         
┌──────────────────────┐                                      
│   WebView            │                                      
│ /dashboard/settings  │                                      
└────┬─────────────────┘                                      
     │                                                         
     │ 2. handleInstagramConnect()                           
     │    Detects mobile platform                            
     │    redirectUri = 'gameofcreators://instagram/callback'
     │    window.location.href = Instagram OAuth URL         
     ↓                                                         
┌─────────────────────────┐                                   
│  External Browser       │                                   
│  api.instagram.com/     │                                   
│  oauth/authorize        │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 3. User signs in to Instagram                         
     │    Authorizes app permissions                         
     ↓                                                         
┌─────────────────────────┐                                   
│  Instagram OAuth        │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 4. Redirects to:                                      
     │    gameofcreators://instagram/callback?code=XYZ789    
     ↓                                                         
┌─────────────────────────┐                                   
│  Deep Link Handler      │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 5. Catches deep link                                  
     │    Extracts code                                      
     │    Opens WebView to backend callback with code        
     ↓                                                         
┌─────────────────────────┐                                   
│  Backend Callback       │                                   
│  /api/instagram/callback│                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 6. Exchanges code for short-lived token               
     │    Exchanges for long-lived token (60 days)           
     │    Fetches Instagram profile                          
     │    Stores in creator_profiles.instagram_account       
     │    Redirects: gameofcreators://instagram/success      
     ↓                                                         
┌─────────────────────────┐                                   
│  Deep Link Handler      │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 7. Catches success deep link                          
     │    Shows toast: "Instagram connected!"                
     │    Reloads WebView: /dashboard/settings               
     ↓                                                         
┌─────────────────────────┐                                   
│  WebView                │                                   
│  Shows connected        │                                   
│  Instagram account ✓    │                                   
└─────────────────────────┘                                   
```

### 3. YouTube Connection Flow (Mobile)

```
┌─────────┐                                                    
│  User   │                                                    
└────┬────┘                                                    
     │                                                         
     │ 1. Clicks "Connect YouTube"                           
     ↓                                                         
┌──────────────────────┐                                      
│   WebView            │                                      
│ /dashboard/settings  │                                      
└────┬─────────────────┘                                      
     │                                                         
     │ 2. handleYouTubeConnect()                             
     │    POST /api/youtube/auth                             
     │    body: { platform: 'mobile' }                       
     ↓                                                         
┌─────────────────────────┐                                   
│  Backend API            │                                   
│  /api/youtube/auth      │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 3. Generates OAuth URL                                
     │    redirect_uri = 'gameofcreators://youtube/callback' 
     │    Sets state cookie for CSRF                         
     │    Returns: { authUrl }                               
     ↓                                                         
┌─────────────────────────┐                                   
│  WebView                │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 4. window.location.href = authUrl                     
     │    Opens external browser                             
     ↓                                                         
┌─────────────────────────┐                                   
│  Chrome Custom Tab      │                                   
│  accounts.google.com    │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 5. User authenticates                                 
     │    Grants YouTube permissions                         
     ↓                                                         
┌─────────────────────────┐                                   
│  Google OAuth           │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 6. Redirects to:                                      
     │    gameofcreators://youtube/callback?code=123&state=abc
     ↓                                                         
┌─────────────────────────┐                                   
│  Deep Link Handler      │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 7. Catches deep link                                  
     │    Opens WebView to backend callback                  
     ↓                                                         
┌─────────────────────────┐                                   
│  Backend Callback       │                                   
│  /api/youtube/callback  │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 8. Validates state parameter                          
     │    Exchanges code for tokens                          
     │    Gets channel info                                  
     │    Stores in creator_profiles.youtube_account         
     │    Redirects: gameofcreators://youtube/success        
     ↓                                                         
┌─────────────────────────┐                                   
│  Deep Link Handler      │                                   
└────┬────────────────────┘                                   
     │                                                         
     │ 9. Catches success deep link                          
     │    Shows toast: "YouTube connected!"                  
     │    Reloads WebView: /dashboard/settings               
     ↓                                                         
┌─────────────────────────┐                                   
│  WebView                │                                   
│  Shows connected        │                                   
│  YouTube channel ✓      │                                   
└─────────────────────────┘                                   
```

---

## 💻 Code Snippets

### Backend Platform Detection

```typescript
// lib/platform-utils.ts

export type Platform = 'web' | 'ios' | 'android';

/**
 * Detect platform from user agent
 * Mobile app should set user agent: 'GameOfCreators-Mobile/Android' or 'GameOfCreators-Mobile/iOS'
 */
export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('gameofcreators-mobile')) {
    if (ua.includes('android')) return 'android';
    if (ua.includes('ios') || ua.includes('iphone')) return 'ios';
  }
  
  return 'web';
}

/**
 * Get appropriate redirect URI based on platform and OAuth flow
 */
export function getRedirectUri(
  platform: Platform,
  flow: 'google' | 'instagram' | 'youtube'
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gameofcreators.com';
  
  if (platform === 'web') {
    switch (flow) {
      case 'google':
        return `${baseUrl}/auth/callback`;
      case 'instagram':
        return `${baseUrl}/api/instagram/callback`;
      case 'youtube':
        return `${baseUrl}/api/youtube/callback`;
    }
  }
  
  // Mobile deep link scheme
  const scheme = process.env.NEXT_PUBLIC_MOBILE_SCHEME || 'gameofcreators://';
  switch (flow) {
    case 'google':
      return `${scheme}auth/callback`;
    case 'instagram':
      return `${scheme}instagram/callback`;
    case 'youtube':
      return `${scheme}youtube/callback`;
  }
}

/**
 * Check if request is from mobile app
 */
export function isMobileApp(userAgent: string): boolean {
  return /gameofcreators-mobile/i.test(userAgent);
}
```

### Frontend OAuth Handlers

```typescript
// components/auth/SignInPage.tsx or SignUpPage.tsx

const handleGoogleSignIn = async () => {
  setError(null);
  setIsGoogleLoading(true);

  try {
    // Detect if running in mobile WebView
    const isMobile = /gameofcreators-mobile/i.test(navigator.userAgent);
    const origin = window.location.origin;
    
    const redirectTo = isMobile 
      ? 'gameofcreators://auth/callback'
      : `${origin}/auth/callback`;

    console.log('OAuth redirect URI:', redirectTo);

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (signInError) {
      throw signInError;
    }

    // For mobile, the redirect will be caught by the app
    // For web, OAuth redirect will handle the rest
  } catch (err: any) {
    console.error("Google sign-in error:", err);
    setError(err.message || "Failed to sign in with Google");
    toast({
      variant: "destructive",
      title: "Google Access Failed",
      description: err.message || "Failed to sign in with Google. Please try again.",
      duration: TOAST_DURATION_MEDIUM,
    });
    setIsGoogleLoading(false);
  }
};
```

```typescript
// app/dashboard/settings/client.tsx

const handleInstagramConnect = async () => {
  setInstagramConnecting(true);
  try {
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    
    if (!clientId) {
      throw new Error("Instagram Client ID not configured");
    }

    // Detect if running in mobile WebView
    const isMobile = /gameofcreators-mobile/i.test(navigator.userAgent);
    const origin = window.location.origin;
    
    const redirectUri = isMobile
      ? 'gameofcreators://instagram/callback'
      : `${origin}/api/instagram/callback`;

    console.log('Instagram redirect URI:', redirectUri);

    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=user_profile,user_media&response_type=code`;

    // Store a flag to know we're returning from Instagram auth
    sessionStorage.setItem("instagram_auth_pending", "true");

    // For mobile, the app will handle the redirect
    // For web, redirect normally
    window.location.href = authUrl;
  } catch (error: any) {
    console.error("Error connecting Instagram:", error);
    toast({
      title: "Connection Failed",
      description: error.message || "Failed to connect Instagram account",
      variant: "destructive",
    });
    setInstagramConnecting(false);
  }
};

const handleYouTubeConnect = async () => {
  setYoutubeConnecting(true);
  try {
    // Detect if running in mobile WebView
    const isMobile = /gameofcreators-mobile/i.test(navigator.userAgent);
    
    console.log('YouTube connect - Platform:', isMobile ? 'mobile' : 'web');

    const response = await fetch("/api/youtube/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: isMobile ? 'mobile' : 'web'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to initiate YouTube connection");
    }

    const { authUrl } = await response.json();

    // Store a flag to know we're returning from YouTube auth
    sessionStorage.setItem("youtube_auth_pending", "true");

    // For mobile, the app will handle the redirect
    // For web, redirect normally
    window.location.href = authUrl;
  } catch (error: any) {
    console.error("Error connecting YouTube:", error);
    toast({
      title: "Connection Failed",
      description: error.message || "Failed to connect YouTube account",
      variant: "destructive",
    });
    setYoutubeConnecting(false);
  }
};
```

### Backend Callback Handlers

```typescript
// app/auth/callback/route.ts - Add mobile redirect

export async function GET(request: NextRequest) {
  // ... existing code ...

  try {
    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError || !data.user) {
      // handle error
    }

    // ... profile creation/update logic ...

    // Determine redirect path
    let redirectPath = "/dashboard";
    if (!userProfile || !userProfile.username) {
      redirectPath = "/choose-username";
    }

    // Check if mobile platform
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /gameofcreators-mobile/i.test(userAgent);

    console.log('OAuth callback - Platform:', isMobile ? 'mobile' : 'web');
    console.log('Redirecting to:', redirectPath);

    if (isMobile) {
      // For mobile, redirect to deep link with parameters
      const mobileRedirectUrl = `gameofcreators://auth/success?user_id=${data.user.id}&redirect=${encodeURIComponent(redirectPath)}`;
      return NextResponse.redirect(mobileRedirectUrl);
    } else {
      // Web redirect
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  } catch (error) {
    // handle error
  }
}
```

```typescript
// app/api/instagram/callback/route.ts - Add mobile redirect

export async function GET(request: NextRequest) {
  // ... existing code for token exchange and profile fetching ...

  try {
    // Update creator profile with Instagram data
    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({
        instagram_account: instagramAccountData
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Check if mobile platform
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /gameofcreators-mobile/i.test(userAgent);

    console.log('Instagram callback - Platform:', isMobile ? 'mobile' : 'web');

    const baseRedirectUrl = new URL('/dashboard/settings', request.url);
    baseRedirectUrl.searchParams.set('success', 'instagram_connected');

    if (isMobile) {
      const mobileRedirectUrl = `gameofcreators://instagram/success?user_id=${user.id}`;
      return NextResponse.redirect(mobileRedirectUrl);
    } else {
      return NextResponse.redirect(baseRedirectUrl);
    }
  } catch (error) {
    // handle error
  }
}
```

### Flutter Deep Link Handler

```dart
// lib/services/deep_link_service.dart

import 'dart:async';
import 'package:uni_links/uni_links.dart';
import 'package:flutter/services.dart';

class DeepLinkService {
  StreamSubscription? _sub;
  
  // Callback functions for different deep links
  Function(Uri)? onAuthCallback;
  Function(Uri)? onInstagramCallback;
  Function(Uri)? onYouTubeCallback;
  
  /// Initialize deep link listener
  Future<void> initialize() async {
    // Check if app was opened with a deep link
    try {
      final initialUri = await getInitialUri();
      if (initialUri != null) {
        print('Initial deep link: $initialUri');
        _handleDeepLink(initialUri);
      }
    } on PlatformException catch (e) {
      print('Failed to get initial URI: ${e.message}');
    }

    // Listen for deep links while app is running
    _sub = uriLinkStream.listen(
      (Uri? uri) {
        if (uri != null) {
          print('Deep link received: $uri');
          _handleDeepLink(uri);
        }
      },
      onError: (err) {
        print('Deep link error: $err');
      },
    );
  }

  void _handleDeepLink(Uri uri) {
    print('Handling deep link: ${uri.toString()}');
    print('Host: ${uri.host}, Path: ${uri.path}');
    print('Query params: ${uri.queryParameters}');
    
    // Route based on host or path
    if (uri.host == 'auth' || uri.path.contains('/auth/')) {
      print('Routing to auth callback');
      onAuthCallback?.call(uri);
    } else if (uri.host == 'instagram' || uri.path.contains('/instagram/')) {
      print('Routing to Instagram callback');
      onInstagramCallback?.call(uri);
    } else if (uri.host == 'youtube' || uri.path.contains('/youtube/')) {
      print('Routing to YouTube callback');
      onYouTubeCallback?.call(uri);
    } else {
      print('Unknown deep link host: ${uri.host}');
    }
  }

  void dispose() {
    _sub?.cancel();
  }
}
```

### Flutter WebView with OAuth Handling

```dart
// lib/screens/webview_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:io' show Platform;
import '../services/deep_link_service.dart';

class WebViewScreen extends StatefulWidget {
  final String initialUrl;
  
  const WebViewScreen({Key? key, required this.initialUrl}) : super(key: key);

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  InAppWebViewController? webViewController;
  final DeepLinkService _deepLinkService = DeepLinkService();
  bool _isLoading = true;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _initializeDeepLinks();
  }

  void _initializeDeepLinks() {
    _deepLinkService.initialize();
    
    // Handle Google OAuth callback
    _deepLinkService.onAuthCallback = (uri) {
      print('Auth callback received: $uri');
      _handleAuthCallback(uri);
    };
    
    // Handle Instagram callback
    _deepLinkService.onInstagramCallback = (uri) {
      print('Instagram callback received: $uri');
      _handleSocialCallback(uri, 'Instagram');
    };
    
    // Handle YouTube callback
    _deepLinkService.onYouTubeCallback = (uri) {
      print('YouTube callback received: $uri');
      _handleSocialCallback(uri, 'YouTube');
    };
  }

  Future<void> _handleAuthCallback(Uri uri) async {
    print('Processing auth callback...');
    
    // Extract parameters from deep link
    final redirect = uri.queryParameters['redirect'];
    final userId = uri.queryParameters['user_id'];
    
    print('Redirect: $redirect, User ID: $userId');
    
    if (redirect != null) {
      // Navigate to the redirect path in WebView
      final redirectUrl = 'https://gameofcreators.com$redirect';
      print('Navigating to: $redirectUrl');
      
      await webViewController?.loadUrl(
        urlRequest: URLRequest(url: Uri.parse(redirectUrl))
      );
    } else {
      // Default redirect
      await webViewController?.loadUrl(
        urlRequest: URLRequest(
          url: Uri.parse('https://gameofcreators.com/dashboard')
        )
      );
    }
  }

  Future<void> _handleSocialCallback(Uri uri, String platform) async {
    print('Processing $platform callback...');
    
    // Show success message
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$platform connected successfully!'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 3),
        ),
      );
    }
    
    // Reload settings page to show connected account
    await webViewController?.loadUrl(
      urlRequest: URLRequest(
        url: Uri.parse('https://gameofcreators.com/dashboard/settings')
      )
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            InAppWebView(
              initialUrlRequest: URLRequest(
                url: Uri.parse(widget.initialUrl),
              ),
              initialOptions: InAppWebViewGroupOptions(
                crossPlatform: InAppWebViewOptions(
                  useShouldOverrideUrlLoading: true,
                  mediaPlaybackRequiresUserGesture: false,
                  javaScriptEnabled: true,
                  // Custom user agent to identify mobile app
                  userAgent: 'GameOfCreators-Mobile/${Platform.isAndroid ? "Android" : "iOS"}/1.0.0',
                ),
                android: AndroidInAppWebViewOptions(
                  useHybridComposition: true,
                  domStorageEnabled: true,
                ),
                ios: IOSInAppWebViewOptions(
                  allowsInlineMediaPlayback: true,
                ),
              ),
              onWebViewCreated: (controller) {
                webViewController = controller;
                print('WebView created');
              },
              onLoadStart: (controller, url) {
                print('Loading started: $url');
                setState(() {
                  _isLoading = true;
                });
              },
              onLoadStop: (controller, url) async {
                print('Loading finished: $url');
                setState(() {
                  _isLoading = false;
                });
              },
              onProgressChanged: (controller, progress) {
                setState(() {
                  _progress = progress / 100;
                });
              },
              shouldOverrideUrlLoading: (controller, navigationAction) async {
                final uri = navigationAction.request.url!;
                
                print('Intercepted URL: $uri');
                
                // Check if this is an OAuth URL
                if (_isOAuthUrl(uri)) {
                  print('OAuth URL detected, opening in external browser');
                  // Open in external browser or custom tabs for OAuth
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(
                      uri,
                      mode: LaunchMode.externalApplication,
                    );
                    return NavigationActionPolicy.CANCEL;
                  }
                }
                
                // Check if this is a deep link that should be handled
                if (uri.scheme == 'gameofcreators') {
                  print('Deep link detected, canceling navigation');
                  return NavigationActionPolicy.CANCEL;
                }
                
                return NavigationActionPolicy.ALLOW;
              },
              onLoadError: (controller, url, code, message) {
                print('Load error: $message (code: $code)');
              },
            ),
            
            // Loading indicator
            if (_isLoading)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  value: _progress,
                  backgroundColor: Colors.grey[200],
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.purple),
                ),
              ),
            
            if (_isLoading && _progress == 0)
              const Center(
                child: CircularProgressIndicator(),
              ),
          ],
        ),
      ),
    );
  }

  bool _isOAuthUrl(Uri uri) {
    // Check if URL is an OAuth provider URL
    final oauthDomains = [
      'accounts.google.com',
      'api.instagram.com',
      'www.instagram.com',
    ];
    
    return oauthDomains.any((domain) => uri.host.contains(domain));
  }

  @override
  void dispose() {
    _deepLinkService.dispose();
    super.dispose();
  }
}
```

---

## 🧪 Testing Commands

### Android Deep Link Testing

```bash
# Test auth callback
adb shell am start -W -a android.intent.action.VIEW \
  -d "gameofcreators://auth/callback?code=test123&user_id=abc"

# Test Instagram callback
adb shell am start -W -a android.intent.action.VIEW \
  -d "gameofcreators://instagram/success?user_id=abc"

# Test YouTube callback
adb shell am start -W -a android.intent.action.VIEW \
  -d "gameofcreators://youtube/success?user_id=abc"

# Check if deep link scheme is registered
adb shell dumpsys package d | grep gameofcreators

# Clear app data (useful for testing fresh installs)
adb shell pm clear com.gameofcreators.mobile
```

### iOS Deep Link Testing

```bash
# Test auth callback (simulator)
xcrun simctl openurl booted \
  "gameofcreators://auth/callback?code=test123&user_id=abc"

# Test Instagram callback (simulator)
xcrun simctl openurl booted \
  "gameofcreators://instagram/success?user_id=abc"

# Test YouTube callback (simulator)
xcrun simctl openurl booted \
  "gameofcreators://youtube/success?user_id=abc"

# Test on physical device (requires device name)
xcrun devicectl device info URI \
  --device "Your iPhone" \
  "gameofcreators://auth/callback?code=test"
```

### Backend Testing

```bash
# Test platform detection endpoint (if you create one)
curl -X POST https://gameofcreators.com/api/platform-detect \
  -H "User-Agent: GameOfCreators-Mobile/Android" \
  -H "Content-Type: application/json"

# Test YouTube auth endpoint
curl -X POST https://gameofcreators.com/api/youtube/auth \
  -H "Content-Type: application/json" \
  -d '{"platform":"mobile"}' \
  -H "Cookie: supabase-auth-token=your-token"

# Monitor logs during OAuth flow
# (in your Next.js terminal)
npm run dev -- --verbose
```

---

## 📊 Data Flow

### Token Storage Flow

```
OAuth Provider (Google/Instagram)
         ↓
   [Access Token + Refresh Token]
         ↓
Backend (Next.js API Routes)
         ↓
Exchange/Validate Tokens
         ↓
Supabase Database
├─ users table (basic profile)
└─ creator_profiles table
   ├─ instagram_account (JSONB)
   │  ├─ access_token (long-lived, 60 days)
   │  ├─ instagram_user_id
   │  ├─ username
   │  ├─ followers_count
   │  └─ token_expiry
   │
   └─ youtube_account (JSONB)
      ├─ access_token (short-lived, 1 hour)
      ├─ refresh_token (long-lived)
      ├─ channel_id
      ├─ channel_title
      ├─ subscriber_count
      └─ expires_at
```

### Mobile App Session Flow

```
1. App Launch
   ↓
2. Load WebView with custom user agent
   ↓
3. WebView loads: https://gameofcreators.com
   ↓
4. Supabase checks session (via cookies)
   ↓
5. If authenticated → Dashboard
   If not authenticated → Sign In page
   ↓
6. User initiates OAuth
   ↓
7. External browser opens
   ↓
8. OAuth completes → Deep link
   ↓
9. App catches deep link
   ↓
10. WebView navigates to callback URL
    ↓
11. Backend processes, sets session
    ↓
12. WebView now authenticated
```

---

## 🔒 Security Architecture

### CSRF Protection

```
User initiates OAuth
         ↓
Backend generates random state parameter
         ↓
Store state in HTTP-only cookie
         ↓
Include state in OAuth URL
         ↓
OAuth provider redirects with state
         ↓
Backend validates: cookie state === URL state
         ↓
If valid → Process OAuth
If invalid → Reject request
```

### Token Security

```
✓ Access tokens stored server-side only (Supabase)
✓ Never exposed in mobile app
✓ Transmitted only over HTTPS
✓ Short-lived tokens (1 hour for YouTube)
✓ Long-lived tokens encrypted at rest
✓ Refresh tokens used to get new access tokens
✓ Tokens revoked on disconnect
```

---

## 📈 Monitoring & Analytics

### Key Metrics to Track

```typescript
// Example analytics events

// OAuth initiation
analytics.track('oauth_initiated', {
  provider: 'google' | 'instagram' | 'youtube',
  platform: 'web' | 'ios' | 'android',
  timestamp: Date.now(),
});

// OAuth completion
analytics.track('oauth_completed', {
  provider: 'google' | 'instagram' | 'youtube',
  platform: 'web' | 'ios' | 'android',
  duration_ms: 15000,
  success: true,
});

// OAuth failure
analytics.track('oauth_failed', {
  provider: 'google' | 'instagram' | 'youtube',
  platform: 'web' | 'ios' | 'android',
  error_type: 'cancelled' | 'network' | 'provider_error',
  error_message: 'User cancelled authentication',
});

// Deep link received
analytics.track('deep_link_received', {
  scheme: 'gameofcreators',
  host: 'auth' | 'instagram' | 'youtube',
  path: '/callback',
  has_code: true,
});
```

---

## 🎯 Summary

This architecture ensures:

✅ **Seamless User Experience**: Users stay within the app context
✅ **Platform Flexibility**: Same backend serves web and mobile
✅ **Security**: OAuth best practices with CSRF protection
✅ **Maintainability**: Clear separation of concerns
✅ **Scalability**: Easy to add new OAuth providers
✅ **Debugging**: Comprehensive logging and monitoring

---

**Last Updated**: December 13, 2025  
**Version**: 1.0.0
