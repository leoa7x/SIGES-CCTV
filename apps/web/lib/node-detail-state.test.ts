import assert from "node:assert/strict";
import test from "node:test";

import { getNodeDetailViewState } from "./node-detail-state";

test("returns empty when there are no nodes left after loading finishes", () => {
  assert.equal(
    getNodeDetailViewState({
      isLoadingList: false,
      isLoadingDetail: false,
      hasItems: false,
      hasDetail: false,
    }),
    "empty",
  );
});

test("returns loading while detail is still being fetched for existing nodes", () => {
  assert.equal(
    getNodeDetailViewState({
      isLoadingList: false,
      isLoadingDetail: true,
      hasItems: true,
      hasDetail: false,
    }),
    "loading",
  );
});

test("returns ready when nodes exist and a detail is selected", () => {
  assert.equal(
    getNodeDetailViewState({
      isLoadingList: false,
      isLoadingDetail: false,
      hasItems: true,
      hasDetail: true,
    }),
    "ready",
  );
});
