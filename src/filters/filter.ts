/**
 * Interface for a probabilistic set construct. Supports querying for elements
 * with a defined chance of reporting a false positive, and zero probability of
 * false negatives. 
 */
export interface Filter {
  has(element: Buffer): Promise<boolean>
  epsilon(): number
}

export interface MutableFilter extends Filter {
  add(element: Buffer): Promise<void>
}
