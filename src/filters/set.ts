import { MutableFilter } from './filter'
import * as crypto from 'crypto'

/**
 * Simple filter directly implemented as a set in memory.
 */
export class SetFilter implements MutableFilter {
  private set: Set<number>

  constructor() {
    this.set = new Set()
  }

  public async add(element: Buffer) {
    this.set.add(this.hash(element))
  }

  public async has(element: Buffer): Promise<boolean> {
    return this.set.has(this.hash(element))
  }

  /**
   * False positive error rate is based on the SHA1 collision resistance, which
   * makes it effectively zero.
   */
  public epsilon = (): number => 0

  private hash(element: Buffer) {
    return crypto.createHash('sha1').update(element).digest().readUInt32BE()
  }
}
