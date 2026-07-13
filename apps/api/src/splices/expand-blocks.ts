export type ExpandableBlockKind = "FUSION" | "RESERVE" | "PASS_THROUGH" | "SPLIT";

export type ExpandBlockInput = {
  fromLegId: string;
  fromFiberStart: number;
  fromFiberEnd: number;
  toLegId: string;
  toFiberStart: number;
  toFiberEnd: number;
  blockKind: ExpandableBlockKind;
};

export type ExpandedFiberConnection = {
  fromLegId: string;
  fromFiberNumber: number;
  toLegId: string;
  toFiberNumber: number;
  connectionKind: ExpandableBlockKind;
};

export function expandBlockInput(input: ExpandBlockInput): ExpandedFiberConnection[] {
  if (input.fromFiberStart > input.fromFiberEnd || input.toFiberStart > input.toFiberEnd) {
    throw new Error("Fiber ranges must be ascending");
  }

  const fromLength = input.fromFiberEnd - input.fromFiberStart;
  const toLength = input.toFiberEnd - input.toFiberStart;

  if (fromLength !== toLength) {
    throw new Error("Fiber block ranges must have the same length");
  }

  const result: ExpandedFiberConnection[] = [];

  for (let offset = 0; offset <= fromLength; offset += 1) {
    result.push({
      fromLegId: input.fromLegId,
      fromFiberNumber: input.fromFiberStart + offset,
      toLegId: input.toLegId,
      toFiberNumber: input.toFiberStart + offset,
      connectionKind: input.blockKind,
    });
  }

  return result;
}
