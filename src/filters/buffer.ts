import { MutableStorage } from './filter'

export class BufferStorage implements MutableStorage {
  readonly size

  private constructor(
    readonly buffer: Buffer,
  ) {
    this.size = this.buffer.length
  }

  static async alloc(size: number): Promise<BufferStorage> {
    return new BufferStorage(
      Buffer.alloc(size)
    )
  }

  async byte(index: number) {
    return this.buffer[index]
  }

  async read(index: number, length: number) {
    return this.buffer.slice(index, index+length)
  }

  async setByte(index: number, value: number) {
    this.buffer[index] = value & 0xFF
  }

  async write(index: number, value: Buffer) {
    value.copy(this.buffer, index)
  }
}
