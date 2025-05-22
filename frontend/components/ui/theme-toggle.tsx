"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ThemeToggleProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "icon" | "button" | "glass"
}

export function ThemeToggle({ 
  className, 
  size = "md", 
  variant = "icon" 
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Initialize with localStorage value if available
  useEffect(() => {
    setMounted(true)
    const storedTheme = localStorage.getItem("theme")
    if (storedTheme && (storedTheme === "dark" || storedTheme === "light")) {
      setTheme(storedTheme)
    }
  }, [setTheme])

  // Update localStorage when theme changes
  useEffect(() => {
    if (mounted && theme) {
      localStorage.setItem("theme", theme)
    }
  }, [theme, mounted])

  // Handle toggle
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  // Don't render during SSR
  if (!mounted) {
    return null
  }

  // Size mapping for icons
  const iconSize = {
    sm: 16,
    md: 20,
    lg: 24
  }

  // Button size mapping
  const buttonSize = {
    sm: "sm",
    md: "default",
    lg: "lg"
  } as const

  // Render icon-only version
  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={`rounded-full ${className}`}
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {theme === "dark" ? (
              <Moon size={iconSize[size]} className="text-primary" />
            ) : (
              <Sun size={iconSize[size]} className="text-primary" />
            )}
          </motion.div>
        </AnimatePresence>
      </Button>
    )
  }

  // Render glass button version
  if (variant === "glass") {
    return (
      <Button
        variant="glass"
        size={buttonSize[size]}
        onClick={toggleTheme}
        className={className}
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            {theme === "dark" ? (
              <>
                <Moon size={iconSize[size]} />
                <span>Тёмная</span>
              </>
            ) : (
              <>
                <Sun size={iconSize[size]} />
                <span>Светлая</span>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </Button>
    )
  }

  // Render default button version
  return (
    <Button
      variant="secondary"
      size={buttonSize[size]}
      onClick={toggleTheme}
      className={className}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2"
        >
          {theme === "dark" ? (
            <>
              <Moon size={iconSize[size]} />
              <span>Тёмная тема</span>
            </>
          ) : (
            <>
              <Sun size={iconSize[size]} />
              <span>Светлая тема</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Button>
  )
}