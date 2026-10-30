"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group pointer-events-auto"
      // Above modal overlays (z-50) so toasts remain visible and clickable
      style={{ zIndex: 100 }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border !border-[#ececef] !bg-white !text-[#171717] !shadow-[0_12px_40px_rgba(16,16,20,0.12)] dark:!border-white/10 dark:!bg-[#161616] dark:!text-white",
          title: "!text-[#171717] !font-semibold dark:!text-white",
          description: "!text-[#737373] dark:!text-white/65",
          actionButton:
            "!rounded-full !bg-[#1a1a1a] !text-white dark:!bg-white dark:!text-[#1a1a1a]",
          cancelButton:
            "!rounded-full !border !border-[#ececef] !bg-[#f6f6f7] !text-[#1a1a1a] dark:!border-white/10 dark:!bg-white/10 dark:!text-white",
          closeButton:
            "!border-[#ececef] !bg-white !text-[#737373] hover:!bg-[#e6e6e8] dark:!border-white/10 dark:!bg-[#161616] dark:!text-white/70",
          success: "!border-l-[3px] !border-l-emerald-600",
          error: "!border-l-[3px] !border-l-red-600",
          warning: "!border-l-[3px] !border-l-amber-500",
          info: "!border-l-[3px] !border-l-[#1a1a1a] dark:!border-l-white",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
