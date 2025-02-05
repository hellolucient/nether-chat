import 'react'

declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void]
  export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: ReadonlyArray<any>): T
  export function useRef<T>(initialValue: T | null): { current: T | null }
} 