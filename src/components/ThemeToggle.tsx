"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-[transform,opacity] duration-200 dark:-rotate-90 dark:scale-0 dark:opacity-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 opacity-0 transition-[transform,opacity] duration-200 dark:rotate-0 dark:scale-100 dark:opacity-100" />
    </button>
  )
}
