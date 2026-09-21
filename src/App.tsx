// SPDX-License-Identifier: Apache-2.0
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import TranslationWidget from './components/TranslationWidget'
import Hero from './components/Hero'
import Playground from './components/Playground'
import Sandbox from './components/Sandbox'
import NotebooksSection from './components/NotebooksSection'
import References from './components/References'
import Footer from './components/Footer'

function AppInner() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <TranslationWidget />
      <Hero />
      <main>
        <Playground />
        <Sandbox />
        <NotebooksSection />
        <References />
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </ThemeProvider>
  )
}
