export type NtopngObservedHost = {
  ip?: string;
  mac?: string;
  hostname?: string;
  bytesIn: number;
  bytesOut: number;
  flowCount: number;
  lastSeenAt: string;
  protocols?: Array<{
    name: string;
    bytes: number;
    flowCount: number;
  }>;
};
