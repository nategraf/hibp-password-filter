import { MutableStorage } from './filter'

export class BufferStorage implements MutableStorage {
  private buffer: Buffer

  constructor(readonly size: number) {
    this.buffer = Buffer.alloc(this.size)
  }

  async byte(index: number) {
    return this.buffer[index]
  }

  async setByte(index: number, value: number) {
    this.buffer[index] = value & 0xFF
  }
}
