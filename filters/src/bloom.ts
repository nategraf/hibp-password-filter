import { StorageAllocator, Filter, MutableFilter, MutableStorage, Storage } from './filter'
import * as crypto from 'crypto'

// TODO(victor): Clean up these functions, they are gross.
function readUInt64BE(buffer: Buffer, offset: number = 0): number {
  // split 64-bit number into two 32-bit parts
  const left =  buffer.readUInt32BE(offset)
  const right = buffer.readUInt32BE(offset+4)

  // combine the two 32-bit values
  const combined = 2**32*left + right

  if (!Number.isSafeInteger(combined)) {
    throw new Error('Read number value exceeds MAX_SAFE_INTEGER')
  }
  return combined
}

function writeUInt64BE(buffer: Buffer, value: number, offset: number = 0) {
  if (!Number.isSafeInteger(value)) {
    throw new Error('Cannot write value which exceeds MAX_SAFE_INTEGER')
  }

  // split 64-bit number into two 32-bit parts
  buffer.writeUInt32BE(Math.floor(value / 2**32), offset)
  buffer.writeUInt32BE(value % 2**32, offset+4)
}

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
 * @remarks Storage layout is { n (8 bytes) || m (8 bytes) || k (1 byte) || reserved (3 bytes) || filter bits }
 */
export class BloomFilter<S extends Storage = Storage> implements Filter {
  static readonly METADATA_SIZE_BYTES = 20
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
  static epsilonWith(options: {m: number, k: number, n: number}): number {
    return Math.pow(1 - Math.exp(-options.k*options.n/options.m), options.k)
  }

  /**
   * Populates the given partial struct of options to contain enough
   * information to create a bloom filter that is optimal within the given
   * constraints.
   *
   * @privateRemarks Equations for optimal parameter settings come from
   * https://en.wikipedia.org/wiki/Bloom_filter#Optimal_number_of_hash_functions
   */
  static populateOptions(options: Partial<BloomFilterOptions>): BloomFilterOptions {
    const { m, k, n, epsilon } = options
    const defined = (x: number|undefined): x is number => x !== undefined

    // Function for optimal to minimize epsilon k given m and n.
    const kOptimal = (m: number, n: number): number => {
      const kLower = Math.floor((m / n) * Math.log(2))
      const kUpper = Math.ceil((m / n) * Math.log(2))
      return (
        this.epsilonWith({m, n, k: kLower}) < this.epsilonWith({m, n, k: kUpper}) ? kLower : kUpper
      )
    }

    // Function to find the maximun number of elements to maintain a given error rate.
    const nMax = (m: number, k: number, epsilon: number): number => {
      let [low, high] = [0, Number.MAX_SAFE_INTEGER]
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (this.epsilonWith({m, k, n: mid}) <= epsilon) {
          low = mid
        } else {
          high = mid - 1
        }
      }
      return low
    }

    // Function to find the minimum number of bits to maintain a given error rate.
    const mMin = (k: number, n: number, epsilon: number): number => {
      let [low, high] = [1, Number.MAX_SAFE_INTEGER]
      while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (this.epsilonWith({m: mid, k, n}) <= epsilon) {
          high = mid
        } else {
          low = mid + 1
        }
      }
      if (low >= Number.MAX_SAFE_INTEGER) {
        throw new Error("minimum m value exceeds supported maximum size")
      }
      return low
    }
    
    // If all parameters are specified, return a copy of the options.
    if (defined(m) && defined(k) && defined(n) && defined(epsilon)) {
      // Check to see if the provided paramters are consistent.
      if (this.epsilonWith({ m, n, k }) > epsilon) {
        throw new Error("provided parameters are inconsistent")
      }
      return { m, k, n, epsilon }
    }

    // If any one paramter is missing, choose an optimal value.
    if (defined(m) && defined(k) && defined(n)) {
      return { m, k, n, epsilon: this.epsilonWith({m, k, n}) }
    }
    
    if (defined(m) && defined(k) && defined(epsilon)) {
      return { m, k, epsilon, n: nMax(m, k, epsilon) }
    }

    if (defined(m) && defined(n) && defined(epsilon)) {
      // Check to see if the provided paramters are consistent.
      if (this.epsilonWith({ m, n, k: kOptimal(m, n) }) > epsilon) {
        throw new Error("provided parameters are inconsistent")
      }
      return { m, n, epsilon, k: kOptimal(m, n) }
    }

    if (defined(k) && defined(n) && defined(epsilon)) {
      return { k, n, epsilon, m: Math.ceil(mMin(k, n, epsilon) / 8) * 8 }
    }

    // An optimal k exists for any 2 of 3 (m, n, epsilon). Use it to populate
    // the missing paramters.
    if (defined(m) && defined(n)) {
      return {
        m, n,
        k: kOptimal(m, n),
        epsilon: this.epsilonWith({m, n, k: kOptimal(m, n)})
      }
    }

    if (defined(m) && defined(epsilon)) {
      const nLimit = Math.floor(-(m / Math.log(epsilon)) * Math.pow(Math.log(2), 2))
      return {
        m, epsilon,
        n: nLimit,
        k: kOptimal(m, nLimit)
      }
    }

    if (defined(n) && defined(epsilon)) {
      // Because k must be an integrer, we use a two step process of calculating an optimal m, an
      // optimal k, then a minimal m to ensure e does not exceed the provided value.
      const mOptimal = -(n*Math.log(epsilon)) / Math.pow(Math.log(2), 2)
      const kOpt = kOptimal(mOptimal, n)
      return {
        n, epsilon,
        m: Math.ceil(mMin(kOpt, n, epsilon) / 8) * 8,
        k: kOpt,
      }
    }

    // In all other cases, no additional information can be inferred.
    if (defined(m) && defined(k)) {
      return { m, k }
    }

    throw new Error("incomplete specification: complete bloom filter options cannot be inferred from the provided parameters")
  }

  static async from(storage: Storage): Promise<BloomFilter> {
    // Read the filter metadata from storage.
    const parameters = await storage.read(0, BloomFilter.METADATA_SIZE_BYTES)
    const n = readUInt64BE(parameters, 0)
    const m = readUInt64BE(parameters, 8)
    const k = parameters.readUInt8(16)

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
    return BloomFilter.epsilonWith({m: this.m, k: this.k, n: this.n})
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
    // Produce a SHA1 hash of { index || counter || element  }
    const hash = crypto.createHash('sha1')
    hash.update(Buffer.from([index]))
    hash.update(Buffer.from([counter]))
    hash.update(element)
    const digest = hash.digest()

    // Based on Algorithm 4 of https://arxiv.org/pdf/1805.10941.pdf
    // First sample a 53-bit value, then cast it into the correct range.
    const x = ((digest.readUInt32BE(0) % 2**21) * 2**32) + digest.readUInt32BE(4)
    const r = x % this.m
    if (x - r > (2**53 - this.m)) {
      return this.hash(element, index, counter+1)
    }
    return r
  }

  protected storageIndex(bitIndex: number): [number, number] {
    return [Math.floor(bitIndex / 8) + BloomFilter.METADATA_SIZE_BYTES, bitIndex % 8]
  }

  protected async readN(): Promise<void> {
    this._n = readUInt64BE(await this.storage.read(0, 8))
  }
}

export class MutableBloomFilter<S extends MutableStorage = MutableStorage> extends BloomFilter<S> implements MutableFilter {
  static async create<Z extends MutableStorage>(options: Partial<BloomFilterOptions>, allocator: StorageAllocator<Z>): Promise<MutableBloomFilter<Z>> {
    const populated = this.populateOptions(options)
    const size = Math.ceil(populated.m/8) + BloomFilter.METADATA_SIZE_BYTES
    const storage = await allocator.alloc(size)
    const filter = new MutableBloomFilter(storage, 0, populated.m, populated.k)
    
    // Write the parameter block to storage.
    const buffer = Buffer.alloc(9)
    writeUInt64BE(buffer, populated.m)
    buffer.writeUInt8(populated.k, 8)
    await storage.write(8, buffer)

    return filter
  }

  static async from<Z extends MutableStorage>(storage: Z): Promise<MutableBloomFilter<Z>> {
    const parameters = await storage.read(0, BloomFilter.METADATA_SIZE_BYTES)
    const n = readUInt64BE(parameters, 0)
    const m = readUInt64BE(parameters, 8)
    const k = parameters.readUInt8(16)

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
    const buffer = Buffer.alloc(8)
    writeUInt64BE(buffer, this.n)
    await this.storage.write(0, buffer)
  }
}
