export interface IStorage {
  save(key: string, value: unknown): void
  load<T>(key: string): T | null
  clear(): void
}
