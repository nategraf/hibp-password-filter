import { Greeter } from './foo'

describe('Greeter', () => {
  it('should use the provided greeting and name', () => {
    const hello = new Greeter("Hello")
    expect(hello.greet("Victor")).toEqual("Hello, Victor")

    const bonjour = new Greeter("Bonjour")
    expect(bonjour.greet("Alice")).toEqual("Bonjour, Alice")
  })

  it('default to using stranger', () => {
    const hello = new Greeter("Hello")
    expect(hello.greet()).toEqual("Hello, stranger")
  })
})
