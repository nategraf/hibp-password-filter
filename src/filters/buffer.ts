import { MutableStorage } from './filter'

export class BufferStorage implements MutableStorage {

  private constructor(
    private readonly buffer: Buffer,
    readonly size: number
  ) {}

  static alloc(size: number) {
    return new BufferStorage(
      Buffer.alloc(size),
      size
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
