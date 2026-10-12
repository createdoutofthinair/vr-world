declare module "pako" {
  export function inflate(input: Uint8Array): Uint8Array;
  export function deflate(input: Uint8Array): Uint8Array;
  export class Inflate {
    onData: (chunk: Uint8Array) => void;
    err: number;
    msg: string;
    push(input: Uint8Array, final: boolean): boolean;
  }
  const pako: {
    deflate: typeof deflate;
    inflate: typeof inflate;
    Inflate: typeof Inflate;
  };
  export default pako;
}
