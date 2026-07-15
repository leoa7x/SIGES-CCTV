type CleanupMap = {
  getLayer: (id: string) => unknown;
  removeLayer: (id: string) => void;
  getSource: (id: string) => unknown;
  removeSource: (id: string) => void;
};

function canReadMapStyle(error: unknown): boolean {
  return !(
    error instanceof TypeError &&
    /reading 'getLayer'|reading 'getSource'/.test(error.message)
  );
}

export function removeMapArtifacts(
  map: CleanupMap,
  layerIds: string[],
  sourceIds: string[],
): void {
  try {
    layerIds.forEach((id) => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    });
  } catch (error) {
    if (canReadMapStyle(error)) {
      throw error;
    }
    return;
  }

  try {
    sourceIds.forEach((id) => {
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    });
  } catch (error) {
    if (canReadMapStyle(error)) {
      throw error;
    }
  }
}
