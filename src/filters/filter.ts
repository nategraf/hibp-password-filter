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

/**
 * Binary data storage used to hold the filter.
 * @remarks Used to abstract whether the filter is in memory, on disk, or otherwise stored.
 */
export interface Storage {
  readonly size: number

  byte(index: number): Promise<number>
  read(index: number, length: number): Promise<Buffer>
}

export interface MutableStorage extends Storage {
  setByte(index: number, value: number): Promise<void>
  write(index: number, value: Buffer): Promise<void>
}

export interface StorageAllocator<S extends MutableStorage> {
  alloc(size: number): Promise<S>
}
