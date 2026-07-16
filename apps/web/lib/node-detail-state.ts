type NodeDetailViewStateInput = {
  isLoadingList: boolean;
  isLoadingDetail: boolean;
  hasItems: boolean;
  hasDetail: boolean;
};

export function getNodeDetailViewState({
  isLoadingList,
  isLoadingDetail,
  hasItems,
  hasDetail,
}: NodeDetailViewStateInput): "loading" | "ready" | "empty" {
  if (isLoadingList || isLoadingDetail) return "loading";
  if (!hasItems) return "empty";
  if (!hasDetail) return "loading";
  return "ready";
}
