import { BufferStorage } from './buffer'
import { StorageAllocator, Filter, MutableFilter, MutableStorage, Storage } from './filter'
import * as crypto from 'crypto'

/**
 * Options available when creating a bloom filter.
 *
 * @remarks TODO: Explain how to use this interface.
 */
export interface BloomFilterOptions {
  m: number
  k: number
  n?: number
  epsilon?: number
}

/**
 * BloomFilter implements a bloom filter probabilistic set that can answer "maybe in the set" or "definitly not in the set".
 *
 * @remarks Storage layout is { n (4 bytes) || m (4 bytes) || k (1 byte) || reserved (3 bytes) || filter bits }
 */
export class BloomFilter<S extends Storage = Storage> implements Filter {
  protected _n: number

  protected constructor(
    readonly storage: S,
    n: number,
    readonly m: number,
    readonly k: number,
  ) {
    this._n = n
    if (this.n < 0 || this.n % 1 !== 0) {
      throw new Error("n value must be an integer in interval [0, 2^32)")
    }
    if (this.m < 0 || this.m % 1 !== 0) {
      throw new Error("m value must be an integer in interval [0, 2^32)")
    }
    if (this.k < 1 || this.k > 255 || this.k % 1 !== 0) {
      throw new Error("k value must be an integer in interval [1, 256)")
    }
  }

  /**
   * Calculates an approximate false positive rate with the given number of
   * bits, hash functions, and elements.
   */
  static epsilonWith(options: {m: number, k: number: n: number}) {
    return Math.pow(1 - Math.exp(-options.k*options.n/options.m), options.k)
  }

  /**
   * Populates the given partial struct of options to contain enough
   * information to create a bloom filter that is optimal within the given
   * constraints.
   */
  static populateOptions(options: Partial<BloomFilterOptions>): BloomFilterOptions {
    const { m, k, n, epsilon } = options
    const defined = (x: number|undefined): x is number => x !== undefined
    
    // If both m and k are assigned, then the filter is fully specified.
    if (defined(m) && defined(k)) {
      if (defined(n) && !defined(epsilon)) {
        return { ...options, epsilon: this.epsilonWith({m, k, n}) }
      }
      return { ...options }
    }

    // If m and n are specified, choose an optimal k to minimize the error rate.
    if (defined(m) && defined(n)) {
      const kLower = Math.floor((m / n) * Math.log(2))
      const kUpper = Math.ceil((m / n) * Math.log(2))
      const kOptimal =
        this.epsilonWith({m, n, k: kLower}) < this.epsilonWith({m, n, k: kUpper}) ? kLower : kUpper
      return {
        m, n,
        k: kOptimal,
        epsilon: this.epsilonWith({m, n, k: kOptimal})
      }
    }
    // TODO: Handle the remaining cases
  }

  static async from(storage: Storage): Promise<BloomFilter> {
    // Read the filter metadata from storage.
    const parameters = await storage.read(0, 12)
    const n = parameters.readUInt32BE(0)
    const m = parameters.readUInt32BE(4)
    const k = parameters.readUInt8(8)

    return new BloomFilter(storage, n, m, k)
  }

  get n() {
    return this._n
  }

  async has(element: Buffer): Promise<boolean> {
    for (let i = 0; i < this.k; i++) {
      if (!(await this.bit(this.hash(element, i)))) {
        return false
      }
    }
    return true
  }

  /**
   * Approximated error rate based on the bloom filter parameters and number of elements.
   */
  epsilon() {
    return this.epsilonWith({m: this.m, k: this.k, n: this.n})
  }

  async bit(index: number): Promise<number> {
    const [i, j] = this.storageIndex(index)
    return (await this.storage.byte(i)) & (1 << j)
  }

  /**
   * Hash function to [0, m) taking the element, hash function index, and a
   * counter. Hash uses a recursive implementation of try and increment
   * unbiased random sampling. The counter is used by recursive calls to obtain
   * a new hash result on each call.
   */
  protected hash(element: Buffer, index: number, counter: number = 0): number {
    // Produce a SHA1 hash of { index || element || counter }
    const hash = crypto.createHash('sha1')
    hash.update(Buffer.from([index]))
    hash.update(element)
    const digest = hash.digest()

    // Based on Algorithm 4 of https://arxiv.org/pdf/1805.10941.pdf
    const x = digest.readUInt32BE()
    const r = x % this.m
    if (x - r > (0x100000000 - this.m)) {
      return this.hash(element, index, counter+1)
    }
    return r
  }

  protected storageIndex(bitIndex: number): [number, number] {
    return [Math.floor(bitIndex / 8) + 12, bitIndex % 8]
  }

  protected async readN(): Promise<void> {
    this._n = (await this.storage.read(0, 4)).readUInt32BE()
  }
}

export class MutableBloomFilter<S extends MutableStorage = MutableStorage> extends BloomFilter<S> implements MutableFilter {
  static async create<Z extends MutableStorage>(options: {m: number, k: number, n: number, epsilon: number}, allocator: StorageAllocator<Z>): Promise<MutableBloomFilter<Z>> {
    const size = Math.ceil(options.m/8) + 12
    const storage = await allocator.alloc(size)
    const filter = new MutableBloomFilter(storage, 0, options.m, options.k)
    
    // Write the parameter block to storage.
    const buffer = Buffer.alloc(5)
    buffer.writeUInt32BE(options.m)
    buffer.writeUInt8(options.k, 4)
    await storage.write(4, buffer)

    return filter
  }

  static async from<Z extends MutableStorage>(storage: Z): Promise<MutableBloomFilter<Z>> {
    const parameters = await storage.read(0, 12)
    const n = parameters.readUInt32BE(0)
    const m = parameters.readUInt32BE(4)
    const k = parameters.readUInt8(8)

    return new MutableBloomFilter(storage, n, m, k)
  }

  async add(element: Buffer) {
    for (let i = 0; i < this.k; i++) {
      await this.setBit(this.hash(element, i))
    }
    this._n++
    await this.writeN()
  }

  protected async setBit(index: number) {
    const [i, j] = this.storageIndex(index)
    await this.storage.setByte(i,
      (await this.storage.byte(i)) | (1 << (j % 8))
    )
  }

  protected async writeN(): Promise<void> {
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(this.n)
    await this.storage.write(0, buffer)
  }
}
