declare module '*.js' {
  export function initEngine(data: unknown, init?: { m?: string; paso?: number }): { getState: () => { m: string; paso: number } }
}
