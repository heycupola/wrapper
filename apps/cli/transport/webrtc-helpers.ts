import type { Transport } from "./transport";

export type DataChannelLike = {
  readyState: string;
  send: (data: string) => void;
};

export class DataChannelTransport implements Transport {
  readonly describe = "webrtc";
  private open: boolean;

  constructor(
    private readonly channel: DataChannelLike,
    private readonly closePeer: () => void,
    initiallyOpen: boolean,
  ) {
    this.open = initiallyOpen;
  }

  markOpen(value: boolean): void {
    this.open = value;
  }

  get isOpen(): boolean {
    return this.open;
  }

  send(frame: string): void {
    if (!this.open) return;
    try {
      this.channel.send(frame);
    } catch {
      // The channel's close handler reports the disconnect.
    }
  }

  close(): void {
    this.open = false;
    this.closePeer();
  }
}

export function decodeDataChannelPayload(data: unknown): string | ArrayBuffer | null {
  if (typeof data === "string" || data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new TextDecoder().decode(bytes);
  }
  return null;
}
