export interface ITranscoderPort {
  trim(inputPath: string, outputPath: string, start: number, end: number): Promise<void>;
  createGif(inputPath: string, outputPath: string, start: number, end: number): Promise<void>;
  extractMp3(inputPath: string, outputPath: string, start?: number, end?: number): Promise<void>;
}
