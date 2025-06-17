"use client"

import { useState, useEffect, useCallback } from 'react'

export function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isClient, setIsClient] = useState(false)

    // Check if fullscreen is supported
    const isSupported = typeof document !== 'undefined' &&
        (document.fullscreenEnabled ||
            (document as any).webkitFullscreenEnabled ||
            (document as any).mozFullScreenEnabled ||
            (document as any).msFullscreenEnabled)

    // Update fullscreen state
    const updateFullscreenState = useCallback(() => {
        const isCurrentlyFullscreen = Boolean(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
        )
        setIsFullscreen(isCurrentlyFullscreen)
    }, [])

    // Enter fullscreen
    const enterFullscreen = useCallback(async () => {
        if (!isSupported) return false

        const element = document.documentElement
        try {
            if (element.requestFullscreen) {
                await element.requestFullscreen()
            } else if ((element as any).webkitRequestFullscreen) {
                await (element as any).webkitRequestFullscreen()
            } else if ((element as any).mozRequestFullScreen) {
                await (element as any).mozRequestFullScreen()
            } else if ((element as any).msRequestFullscreen) {
                await (element as any).msRequestFullscreen()
            }
            return true
        } catch (error) {
            console.error('Error entering fullscreen:', error)
            return false
        }
    }, [isSupported])

    // Exit fullscreen
    const exitFullscreen = useCallback(async () => {
        if (!isSupported) return false

        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen()
            } else if ((document as any).webkitExitFullscreen) {
                await (document as any).webkitExitFullscreen()
            } else if ((document as any).mozCancelFullScreen) {
                await (document as any).mozCancelFullScreen()
            } else if ((document as any).msExitFullscreen) {
                await (document as any).msExitFullscreen()
            }
            return true
        } catch (error) {
            console.error('Error exiting fullscreen:', error)
            return false
        }
    }, [isSupported])

    // Toggle fullscreen
    const toggleFullscreen = useCallback(async () => {
        if (isFullscreen) {
            return await exitFullscreen()
        } else {
            return await enterFullscreen()
        }
    }, [isFullscreen, enterFullscreen, exitFullscreen])

    // Handle client-side hydration
    useEffect(() => {
        setIsClient(true)
    }, [])

    // Handle fullscreen change events
    useEffect(() => {
        if (!isClient || !isSupported) return

        const handleFullscreenChange = () => {
            updateFullscreenState()
        }

        // Add event listeners for different browsers
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
        document.addEventListener('mozfullscreenchange', handleFullscreenChange)
        document.addEventListener('msfullscreenchange', handleFullscreenChange)

        // Set initial state
        updateFullscreenState()

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
            document.removeEventListener('msfullscreenchange', handleFullscreenChange)
        }
    }, [updateFullscreenState, isSupported, isClient])

    return {
        isFullscreen,
        isSupported: isClient && isSupported,
        isClient,
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen
    }
} 