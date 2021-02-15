import { BufferStorage } from './buffer'
import { Allocator, Filter, MutableFilter, MutableStorage, Storage } from './filter'
import * as crypto from 'crypto'

/**
 *
 * @remarks Storage layout is { n (4 bytes) || m (4 bytes) || k (1 byte) || reserved (3 bytes) || filter bits }
 */
export class BloomFilter<S extends Storage = Storage> implements Filter {

  protected constructor(
    protected readonly storage: S,
    protected n: number,
    readonly m: number,
    readonly k: number,
  ) {
    if (this.m < 0 || this.m % 1 !== 0) {
      throw new Error("m value must be an integer in interval [1, 2^32)")
    }
    if (this.k < 1 || this.k > 255 || this.k % 1 !== 0) {
      throw new Error("k value must be an integer in interval [1, 256)")
    }
  }

  static async from(storage: Storage): Promise<BloomFilter> {
    const parameters = await storage.read(0, 12)
    const n = parameters.readUInt32BE(0)
    const m = parameters.readUInt32BE(4)
    const k = parameters.readUInt8(8)
    return new BloomFilter(storage, n, m, k)
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
    const [i, j] = this.storageIndex(index)
    return (await this.storage.byte(i)) & (1 << j)
  }

  protected hash(element: Buffer, index: number): number {
    // Produce a SHA1 hash of { index || element }
    const hash = crypto.createHash('sha1')
    hash.update(Buffer.from([index]))
    hash.update(element)
    const digest = hash.digest()

    // Cast the digest, interpreted as a big-endian integer, to [0, m).
    // FIXME: Current implementation can introduce error for large m.
    return digest.readUInt32BE() % this.m
  }

  protected storageIndex(bitIndex: number): [number, number] {
    return [Math.floor(bitIndex / 8) + 12, bitIndex % 8]
  }

  protected async readN(): Promise<void> {
    this.n = (await this.storage.read(0, 4)).readUInt32BE()
  }
}

export class MutableBloomFilter extends BloomFilter<MutableStorage> implements MutableFilter {
  static async create(m: number, k: number, allocator: Allocator<MutableStorage> = BufferStorage): Promise<MutableBloomFilter> {
    const size = Math.ceil(m/8) + 12
    const storage = allocator.alloc(size)
    const filter = new MutableBloomFilter(storage, 0, m, k)
    
    // Write the parameter block to storage.
    const buffer = Buffer.alloc(5)
    buffer.writeUInt32BE(m)
    buffer.writeUInt8(k, 4)
    await storage.write(4, buffer)

    return filter
  }

  static async from(storage: MutableStorage): Promise<MutableBloomFilter> {
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
    this.n++
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
