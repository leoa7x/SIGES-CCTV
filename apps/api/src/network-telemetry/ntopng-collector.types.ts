export type NtopngObservedHost = {
  ip?: string;
  mac?: string;
  hostname?: string;
  bytesIn: number;
  bytesOut: number;
  flowCount: number;
  lastSeenAt: string;
};
