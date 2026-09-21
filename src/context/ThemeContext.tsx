// SPDX-License-Identifier: Apache-2.0
import React, { createContext, useContext, useState, useEffect } from 'react'
type Theme = 'dark' | 'light'
interface ThemeContextType { theme: Theme; toggleTheme: () => void }
const ThemeContext = createContext<ThemeContextType | null>(null)
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('portal-theme') as Theme) || 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('portal-theme', theme)
  }, [theme])
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
