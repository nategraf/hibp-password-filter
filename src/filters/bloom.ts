import { BufferStorage } from './buffer'
import { Filter, MutableFilter, MutableStorage, Storage } from './filter'
import * as crypto from 'crypto'

export class BloomFilter<S extends Storage = Storage> implements Filter {
  protected readonly storage: S | MutableStorage
  protected n: number = 0

  constructor(
    readonly m: number,
    readonly k: number,
    storage?: S,
    readonly seed?: Buffer
  ) {
    if (this.k < 1 || this.k > 255 || this.k % 1 !== 0) {
      throw new Error("k value must be an integer in interval [1, 255]")
    }
    // Default to creating a new memory buffer to use as storage.
    this.storage = storage ?? new BufferStorage(Math.ceil(this.m/8))
    if (this.storage.size * 8 < this.m) {
      throw new Error("storage object is not large enough")
    }
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
    return Math.pow(1 - Math.exp(-this.k*this.n/this.m), this.k)
  }

  async bit(index: number): Promise<number> {
    return (await this.storage.byte(Math.floor(index/8))) & (1 << (index % 8))
  }

  protected hash(element: Buffer, index: number): number {
    // Produce a SHA1 hash of { seed || index || element }
    const hash = crypto.createHash('sha1')
    if (this.seed) {
      hash.update(this.seed)
    }
    hash.update(Buffer.from([index]))
    hash.update(element)
    const digest = hash.digest()

    // Cast the digest, interpreted as a big-endian integer, to [0, m).
    // FIXME: Current implementation can introduce error for large m.
    return digest.readUInt32BE() % this.m
  }
}

export class MutableBloomFilter extends BloomFilter<MutableStorage> {
  async add(element: Buffer) {
    for (let i = 0; i < this.k; i++) {
      await this.setBit(this.hash(element, i))
    }
    this.n++
  }

  protected async setBit(index: number) {
    const offset = Math.floor(index/8)
    await this.storage.setByte(offset,
      (await this.storage.byte(offset)) | (1 << (index % 8))
    )
  }
}
