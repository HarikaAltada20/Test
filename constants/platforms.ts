/**
 * Platform Configuration - Scalable system for social media platforms
 * 
 * This file defines all supported platforms and their properties.
 * To add a new platform (e.g., LinkedIn), add it to the PLATFORMS object
 * and update the related types.
 */

export type PlatformType = "youtube" | "instagram" | "twitter" | "linkedin";

export type ContestFormat = "video" | "text_image";

export interface PlatformConfig {
  id: PlatformType;
  name: string;
  displayName: string;
  supportedFormats: ContestFormat[];
  requiresOAuth: boolean;
  contentType: "video" | "text";
  iconColor?: string;
}

/**
 * Platform configurations
 * Add new platforms here to make them available throughout the app
 */
export const PLATFORMS: Record<PlatformType, PlatformConfig> = {
  youtube: {
    id: "youtube",
    name: "youtube",
    displayName: "YouTube",
    supportedFormats: ["video"],
    requiresOAuth: true,
    contentType: "video",
    iconColor: "#FF0000",
  },
  instagram: {
    id: "instagram",
    name: "instagram",
    displayName: "Instagram",
    supportedFormats: ["video"],
    requiresOAuth: true,
    contentType: "video",
    iconColor: "url(#instagram-gradient)",
  },
  twitter: {
    id: "twitter",
    name: "twitter",
    displayName: "Twitter / X",
    supportedFormats: ["text_image"],
    requiresOAuth: false, // Uses RapidAPI instead
    contentType: "text",
    iconColor: "#1DA1F2",
  },
  linkedin: {
    id: "linkedin",
    name: "linkedin",
    displayName: "LinkedIn",
    supportedFormats: ["text_image"],
    requiresOAuth: true,
    contentType: "text",
    iconColor: "#0077B5",
  },
};

/**
 * Get platform config by ID
 */
export function getPlatformConfig(platformId: string | null | undefined): PlatformConfig | null {
  if (!platformId) return null;
  const normalized = platformId.toLowerCase() as PlatformType;
  return PLATFORMS[normalized] || null;
}

/**
 * Get all platforms that support a specific format
 */
export function getPlatformsByFormat(format: ContestFormat): PlatformConfig[] {
  return Object.values(PLATFORMS).filter((p) => p.supportedFormats.includes(format));
}

/**
 * Get all video platforms
 */
export function getVideoPlatforms(): PlatformConfig[] {
  return getPlatformsByFormat("video");
}

/**
 * Get all text/image platforms
 */
export function getTextImagePlatforms(): PlatformConfig[] {
  return getPlatformsByFormat("text_image");
}

/**
 * Check if platform supports format
 */
export function platformSupportsFormat(platformId: string | null | undefined, format: ContestFormat): boolean {
  const config = getPlatformConfig(platformId);
  return config ? config.supportedFormats.includes(format) : false;
}

/**
 * Platform filter types for UI components
 */
export type PlatformFilterType = "all" | PlatformType;

/**
 * Get all platform IDs as array
 */
export function getAllPlatformIds(): PlatformType[] {
  return Object.keys(PLATFORMS) as PlatformType[];
}

