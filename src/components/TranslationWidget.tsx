// SPDX-License-Identifier: Apache-2.0
import { Sun, Moon, Home } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
export default function TranslationWidget() {
  const { language, setLanguage, t } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
      <a href="https://ml-ai-portal.vercel.app" title="Back to Learning Hub"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-900/90 backdrop-blur border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
        <Home className="w-4 h-4" />
      </a>
      <button onClick={toggleTheme} className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-900/90 backdrop-blur border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="flex gap-1 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg p-1">
        <button onClick={() => setLanguage('en')} className={`px-3 py-1 rounded text-sm font-medium transition-colors ${language === 'en' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'}`}>{t('langEn')}</button>
        <button onClick={() => setLanguage('es')} className={`px-3 py-1 rounded text-sm font-medium transition-colors ${language === 'es' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'}`}>{t('langEs')}</button>
      </div>
    </div>
  )
}
