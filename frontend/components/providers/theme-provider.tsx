"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useEffect } from "react"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Use stored theme from localStorage on initial mount
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme")
    if (storedTheme) {
      document.documentElement.classList.toggle("dark", storedTheme === "dark")
    }
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}