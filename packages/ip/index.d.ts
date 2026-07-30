export function isLoopback(address: string): boolean;
export function isPrivate(address: string): boolean;
export function isPublic(address: string): boolean;
export function isV4Format(address: string): boolean;
export function isV6Format(address: string): boolean;
export function toBuffer(address: string, buffer?: Buffer, offset?: number): Buffer;
export function toString(buffer: Buffer, offset?: number, length?: number): string;

declare const ip: {
  isLoopback: typeof isLoopback;
  isPrivate: typeof isPrivate;
  isPublic: typeof isPublic;
  isV4Format: typeof isV4Format;
  isV6Format: typeof isV6Format;
  toBuffer: typeof toBuffer;
  toString: typeof toString;
};

export default ip;
