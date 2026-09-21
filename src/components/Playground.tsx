// SPDX-License-Identifier: Apache-2.0
// Monta el motor (vanilla JS) de las nueve pestañas. Al cambiar de idioma se vuelve a
// inyectar el cuerpo en ese idioma y se reinicia el motor conservando pestaña y paso.
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import bodyEs from '../engine/body.es.html?raw'
import bodyEn from '../engine/body.en.html?raw'
import dataEs from '../engine/data.es.json'
import dataEn from '../engine/data.en.json'
import { initEngine as initEs } from '../engine/engine.es.js'
import { initEngine as initEn } from '../engine/engine.en.js'
import '../engine/engine.css'

type EngineState = { m: string; paso: number }
type Engine = { getState: () => EngineState }

declare global {
  interface Window { MathJax?: { typesetPromise?: (nodes?: Element[]) => Promise<void>; typesetClear?: (nodes?: Element[]) => void } }
}

const ENGINES = {
  es: { body: bodyEs, data: dataEs, init: initEs as (d: unknown, init?: Partial<EngineState>) => Engine },
  en: { body: bodyEn, data: dataEn, init: initEn as (d: unknown, init?: Partial<EngineState>) => Engine },
}

function typeset(node: HTMLElement) {
  const mj = window.MathJax
  if (mj && mj.typesetPromise) mj.typesetPromise([node]).catch(() => {})
}

export default function Playground() {
  const { language } = useLanguage()
  const rootRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const firstRef = useRef(true)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    // Estado previo (pestaña y paso) para conservarlo al cambiar de idioma. La primera
    // carga siempre entra por la primera pestaña, paso 0.
    const prev = firstRef.current ? undefined : engineRef.current?.getState()
    firstRef.current = false
    const { body, data, init } = ENGINES[language]
    root.innerHTML = body
    engineRef.current = init(data, prev)
    // MathJax puede cargar después del primer render: reintenta hasta que esté listo.
    let tries = 0
    const tick = () => {
      if (window.MathJax && window.MathJax.typesetPromise) typeset(root)
      else if (tries++ < 40) setTimeout(tick, 250)
    }
    tick()
  }, [language])

  return <section id="playground" className="tfp scroll-mt-16"><div ref={rootRef} /></section>
}
