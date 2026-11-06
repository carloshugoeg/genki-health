export interface IdPort {
  nextInt(sequence: string): Promise<number>;
}
