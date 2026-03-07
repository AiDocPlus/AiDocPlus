declare module 'gif.js' {
  interface GifOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
    transparent?: string | null;
    background?: string;
  }
  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }
  class GIF {
    constructor(options?: GifOptions);
    addFrame(image: HTMLCanvasElement | HTMLImageElement | ImageData, options?: AddFrameOptions): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    render(): void;
    abort(): void;
  }
  export default GIF;
}
