import { MutableFilter } from './filter'
import * as crypto from 'crypto'

export class BloomFilter implements MutableFilter {
  private buffer: Buffer
  private n: number = 0

  constructor(
    readonly m: number,
    readonly k: number,
    readonly seed?: Buffer
  ) {
    if (this.k < 1 || this.k > 255 || this.k % 1 !== 0) {
      throw new Error("k value must be an integer in interval [1, 255]")
    }
    this.buffer = Buffer.alloc(Math.ceil(this.m/8))
  }

  public async add(element: Buffer) {
    for (let i = 0; i < this.k; i++) {
      this.setBit(this.hash(element, i))
    }
    this.n++
  }

  public async has(element: Buffer): Promise<boolean> {
    for (let i = 0; i < this.k; i++) {
      if (!this.bit(this.hash(element, i))) {
        return false
      }
    }
    return true
  }

  /**
   * Approximated error rate based on the bloom filter parameters and number of elements.
   */
  public epsilon() {
    return Math.pow(1 - Math.exp(-this.k*this.n/this.m), this.k)
  }

  public bit(index: number): number {
    return this.buffer[Math.floor(index/8)] & (1 << (index % 8))
  }

  private setBit(index: number) {
    const offset = Math.floor(index/8)
    this.buffer[offset] = this.buffer[offset] | (1 << (index % 8))
  }

  private hash(element: Buffer, index: number): number {
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
