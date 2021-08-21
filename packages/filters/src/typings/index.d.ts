export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      // Support the toBeWithinTolerance matcher in src/filter.test.ts
      toBeWithinTolerance(expected: number, tolerance: number): R
    }
  }
}
