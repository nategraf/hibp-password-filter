export class Greeter {
  constructor(public greeting: string) {}

  public greet(name?: string): string {
    return `${this.greeting}, ${name ?? 'stranger'}`
  }
}
