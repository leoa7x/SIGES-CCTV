"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../lib/api";
import { tabClass } from "../../../lib/ui";

type RouteItem = {
  id: string;
  identifier: string;
  type: string;
  state: string;
  center: { id: string; name: string };
  _count: { nodes: number; fiberCables: number; spliceClosures: number };
};

type CenterRef = { id: string; name: string };
type NodeRef = { id: string; code: string; name: string; lat: number; lng: number; };

type FiberPoint = {
  id: string;
  kind: "NODE" | "SPLICE";
  name: string;
  latitude: number;
  longitude: number;
  node?: { id: string; code: string; name: string } | null;
  splice?: { id: string; code: string; name: string; closureType: string; documentStatus: string } | null;
};

type FiberCable = {
  id: string;
  code: string;
  kind: "TRONCAL" | "DERIVACION";
  fiberCount: number;
  documentStatus: string;
  notes?: string | null;
  parentCable?: { id: string; code: string; kind: string } | null;
  childCables: { id: string; code: string; kind: string; documentStatus: string }[];
  sourceSplice?: { id: string; code: string; name: string } | null;
  originPoint: { id: string; name: string; kind: string };
  destinationPoint: { id: string; name: string; kind: string };
  spliceLegs: { id: string; direction: string; fiberCount: number; reservedFiberCount: number }[];
};

type SpliceClosure = {
  id: string;
  code: string;
  name: string;
  closureType: string;
  fiberCapacity: number;
  trayCount: number;
  documentStatus: string;
  notes?: string | null;
  point?: { id: string; name: string } | null;
  cableLegs: {
    id: string;
    direction: "IN" | "OUT";
    fiberCount: number;
    reservedFiberCount: number;
    bufferLabel?: string | null;
    fiberCable: { id: string; code: string; kind: string; fiberCount: number };
  }[];
  blockInputs: {
    id: string;
    fromLegId: string;
    fromFiberStart: number;
    fromFiberEnd: number;
    toLegId: string;
    toFiberStart: number;
    toFiberEnd: number;
    blockKind: string;
  }[];
  connections: {
    id: string;
    fromLegId: string;
    fromFiberNumber: number;
    toLegId: string;
    toFiberNumber: number;
    connectionKind: string;
  }[];
};

type RouteDetail = {
  id: string;
  identifier: string;
  type: string;
  state: string;
  center: { id: string; name: string };
  nodes: NodeRef[];
  fiberPoints: FiberPoint[];
  fiberCables: FiberCable[];
  spliceClosures: SpliceClosure[];
};

type CreateForm = { identifier: string; type: string; monitoringCenterId: string };
type EditForm = { identifier: string; type: string; state: string };
type PointForm = {
  kind: "NODE" | "SPLICE";
  name: string;
  latitude: string;
  longitude: string;
  nodeId: string;
  spliceCode: string;
  closureType: string;
  trayCount: string;
  fiberCapacity: string;
  notes: string;
};
type CableForm = {
  code: string;
  kind: "TRONCAL" | "DERIVACION";
  fiberCount: string;
  originPointId: string;
  destinationPointId: string;
  parentCableId: string;
  sourceSpliceId: string;
  notes: string;
};
type LegForm = {
  spliceId: string;
  fiberCableId: string;
  direction: "IN" | "OUT";
  fiberCount: string;
  reservedFiberCount: string;
  bufferLabel: string;
  notes: string;
};
type BlockForm = {
  spliceId: string;
  fromLegId: string;
  fromFiberStart: string;
  fromFiberEnd: string;
  toLegId: string;
  toFiberStart: string;
  toFiberEnd: string;
  blockKind: "FUSION" | "RESERVE" | "PASS_THROUGH" | "SPLIT";
  notes: string;
};

type PointEditForm = {
  name: string;
  latitude: string;
  longitude: string;
};

type CableEditForm = {
  code: string;
  fiberCount: string;
  notes: string;
};

type SpliceEditForm = {
  name: string;
  closureType: string;
  trayCount: string;
  fiberCapacity: string;
  notes: string;
};

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const PANEL = "rounded-ops border border-ops-border bg-ops-panel p-4";
const ROUTE_TYPES = ["FIBER", "WIRELESS", "HYBRID"];

const WIZARD_STEPS: { id: 1 | 2 | 3 | 4; label: string }[] = [
  { id: 1, label: "Punto de fibra" },
  { id: 2, label: "Cable" },
  { id: 3, label: "Composición del empalme" },
  { id: 4, label: "Bloque de fusión" },
];

export default function RoutesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<RouteItem[]>([]);
  const [centers, setCenters] = useState<CenterRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RouteItem | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeDetail, setRouteDetail] = useState<RouteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeFilter, setRouteFilter] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<"wizard" | "inventory">("wizard");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [inventoryTab, setInventoryTab] = useState<"cables" | "points" | "splices">("cables");
  const [expandedSpliceId, setExpandedSpliceId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ identifier: "", type: "FIBER", monitoringCenterId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ identifier: "", type: "FIBER", state: "ACTIVE" });
  const [pointForm, setPointForm] = useState<PointForm>({
    kind: "NODE",
    name: "",
    latitude: "",
    longitude: "",
    nodeId: "",
    spliceCode: "",
    closureType: "MUFLA",
    trayCount: "1",
    fiberCapacity: "12",
    notes: "",
  });
  const [cableForm, setCableForm] = useState<CableForm>({
    code: "",
    kind: "TRONCAL",
    fiberCount: "12",
    originPointId: "",
    destinationPointId: "",
    parentCableId: "",
    sourceSpliceId: "",
    notes: "",
  });
  const [legForm, setLegForm] = useState<LegForm>({
    spliceId: "",
    fiberCableId: "",
    direction: "IN",
    fiberCount: "12",
    reservedFiberCount: "0",
    bufferLabel: "",
    notes: "",
  });
  const [blockForm, setBlockForm] = useState<BlockForm>({
    spliceId: "",
    fromLegId: "",
    fromFiberStart: "1",
    fromFiberEnd: "12",
    toLegId: "",
    toFiberStart: "1",
    toFiberEnd: "12",
    blockKind: "FUSION",
    notes: "",
  });
  const [editingPoint, setEditingPoint] = useState<FiberPoint | null>(null);
  const [editingCable, setEditingCable] = useState<FiberCable | null>(null);
  const [editingSplice, setEditingSplice] = useState<SpliceClosure | null>(null);
  const [pointEditForm, setPointEditForm] = useState<PointEditForm>({ name: "", latitude: "", longitude: "" });
  const [cableEditForm, setCableEditForm] = useState<CableEditForm>({ code: "", fiberCount: "", notes: "" });
  const [spliceEditForm, setSpliceEditForm] = useState<SpliceEditForm>({ name: "", closureType: "", trayCount: "", fiberCapacity: "", notes: "" });
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState("");
  const [deletingPointId, setDeletingPointId] = useState("");
  const [deletingCableId, setDeletingCableId] = useState("");
  const [deletingSpliceId, setDeletingSpliceId] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [routes, centersData] = await Promise.all([
        apiGet<RouteItem[]>("/routes", accessToken),
        apiGet<CenterRef[]>("/monitoring-centers", accessToken),
      ]);
      setItems(routes);
      setCenters(centersData);
      if (!selectedRouteId && routes[0]?.id) {
        setSelectedRouteId(routes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedRouteId]);

  const loadRouteDetail = useCallback(async (routeId: string) => {
    if (!accessToken || !routeId) return;
    setLoadingDetail(true);
    try {
      const detail = await apiGet<RouteDetail>(`/routes/${routeId}`, accessToken);
      setRouteDetail(detail);
      setPointForm((current) => ({
        ...current,
        nodeId: detail.nodes[0]?.id ?? "",
        name: current.kind === "NODE" ? (detail.nodes[0]?.name ?? "") : current.name,
        latitude: current.kind === "NODE" && detail.nodes[0] ? String(detail.nodes[0].lat) : current.latitude,
        longitude: current.kind === "NODE" && detail.nodes[0] ? String(detail.nodes[0].lng) : current.longitude,
      }));
      setCableForm((current) => ({
        ...current,
        originPointId: current.originPointId || detail.fiberPoints[0]?.id || "",
        destinationPointId: current.destinationPointId || detail.fiberPoints[1]?.id || detail.fiberPoints[0]?.id || "",
        parentCableId: current.parentCableId || detail.fiberCables[0]?.id || "",
        sourceSpliceId: current.sourceSpliceId || detail.spliceClosures[0]?.id || "",
      }));
      setLegForm((current) => ({
        ...current,
        spliceId: current.spliceId || detail.spliceClosures[0]?.id || "",
        fiberCableId: current.fiberCableId || detail.fiberCables[0]?.id || "",
      }));
      setBlockForm((current) => ({
        ...current,
        spliceId: current.spliceId || detail.spliceClosures[0]?.id || "",
      }));
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selectedRouteId) void loadRouteDetail(selectedRouteId); }, [selectedRouteId, loadRouteDetail]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ identifier: "", type: "FIBER", monitoringCenterId: centers[0]?.id ?? "" });
    setModalOpen(true);
  }

  function openEdit(item: RouteItem) {
    setEditing(item);
    setEditForm({ identifier: item.identifier, type: item.type, state: item.state });
    setModalOpen(true);
  }

  function openPointEditor(point: FiberPoint) {
    setEditingCable(null);
    setEditingSplice(null);
    setEditingPoint(point);
    setPointEditForm({
      name: point.name,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
    });
    setInventoryModalOpen(true);
  }

  function openCableEditor(cable: FiberCable) {
    setEditingPoint(null);
    setEditingSplice(null);
    setEditingCable(cable);
    setCableEditForm({
      code: cable.code,
      fiberCount: String(cable.fiberCount),
      notes: cable.notes ?? "",
    });
    setInventoryModalOpen(true);
  }

  function openSpliceEditor(splice: SpliceClosure) {
    setEditingPoint(null);
    setEditingCable(null);
    setEditingSplice(splice);
    setSpliceEditForm({
      name: splice.name,
      closureType: splice.closureType,
      trayCount: String(splice.trayCount),
      fiberCapacity: String(splice.fiberCapacity),
      notes: splice.notes ?? "",
    });
    setInventoryModalOpen(true);
  }

  function closeInventoryModal() {
    setInventoryModalOpen(false);
    setEditingPoint(null);
    setEditingCable(null);
    setEditingSplice(null);
  }

  async function handleRouteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/routes/${editing.id}`, accessToken, editForm);
      } else {
        await apiPost("/routes", accessToken, createForm);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la ruta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoute(item: RouteItem) {
    if (!accessToken) return;
    if (item._count.nodes > 0) {
      window.alert(`No se puede eliminar ${item.identifier} porque todavía tiene ${item._count.nodes} nodos asociados.`);
      return;
    }
    if (!window.confirm(`Eliminar la ruta ${item.identifier} y toda su documentación de fibra?`)) return;

    setDeletingRouteId(item.id);
    try {
      await apiDelete(`/routes/${item.id}`, accessToken);
      const remaining = items.filter((route) => route.id !== item.id);
      setSelectedRouteId(remaining[0]?.id ?? "");
      if (selectedRouteId === item.id) {
        setRouteDetail(null);
      }
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo eliminar la ruta.");
    } finally {
      setDeletingRouteId("");
    }
  }

  async function handleCreatePoint(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !routeDetail) return;
    setSaving(true);
    try {
      if (pointForm.kind === "NODE") {
        const selectedNode = routeDetail.nodes.find((node) => node.id === pointForm.nodeId);
        if (!selectedNode) return;
        await apiPost("/fiber-points", accessToken, {
          routeId: routeDetail.id,
          kind: "NODE",
          name: selectedNode.name,
          latitude: selectedNode.lat,
          longitude: selectedNode.lng,
          nodeId: selectedNode.id,
        });
      } else {
        const splice = await apiPost<{ id: string; name: string; latitude: number; longitude: number }>("/splices", accessToken, {
          routeId: routeDetail.id,
          code: pointForm.spliceCode,
          name: pointForm.name,
          closureType: pointForm.closureType,
          latitude: Number(pointForm.latitude),
          longitude: Number(pointForm.longitude),
          trayCount: Number(pointForm.trayCount),
          fiberCapacity: Number(pointForm.fiberCapacity),
          notes: pointForm.notes || undefined,
        });
        await apiPost("/fiber-points", accessToken, {
          routeId: routeDetail.id,
          kind: "SPLICE",
          name: splice.name,
          latitude: splice.latitude,
          longitude: splice.longitude,
          spliceId: splice.id,
        });
      }
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar el punto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCable(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !routeDetail) return;
    setSaving(true);
    try {
      await apiPost("/fiber-cables", accessToken, {
        routeId: routeDetail.id,
        code: cableForm.code,
        kind: cableForm.kind,
        fiberCount: Number(cableForm.fiberCount),
        originPointId: cableForm.originPointId,
        destinationPointId: cableForm.destinationPointId,
        parentCableId: cableForm.kind === "DERIVACION" ? cableForm.parentCableId || undefined : undefined,
        sourceSpliceId: cableForm.kind === "DERIVACION" ? cableForm.sourceSpliceId || undefined : undefined,
        notes: cableForm.notes || undefined,
      });
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar el cable.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLeg(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !routeDetail || !legForm.spliceId) return;
    setSaving(true);
    try {
      await apiPost(`/splices/${legForm.spliceId}/legs`, accessToken, {
        fiberCableId: legForm.fiberCableId,
        direction: legForm.direction,
        fiberCount: Number(legForm.fiberCount),
        reservedFiberCount: Number(legForm.reservedFiberCount),
        bufferLabel: legForm.bufferLabel || undefined,
        notes: legForm.notes || undefined,
      });
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la pata del empalme.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !routeDetail || !blockForm.spliceId) return;
    setSaving(true);
    try {
      await apiPost(`/splices/${blockForm.spliceId}/block-inputs`, accessToken, {
        fromLegId: blockForm.fromLegId,
        fromFiberStart: Number(blockForm.fromFiberStart),
        fromFiberEnd: Number(blockForm.fromFiberEnd),
        toLegId: blockForm.toLegId,
        toFiberStart: Number(blockForm.toFiberStart),
        toFiberEnd: Number(blockForm.toFiberEnd),
        blockKind: blockForm.blockKind,
        notes: blockForm.notes || undefined,
      });
      await apiPost(`/splices/${blockForm.spliceId}/expand-blocks`, accessToken, {});
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar el bloque de fusión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInventorySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !routeDetail) return;
    setSaving(true);
    try {
      if (editingPoint) {
        await apiPatch(`/fiber-points/${editingPoint.id}`, accessToken, {
          name: pointEditForm.name,
          latitude: Number(pointEditForm.latitude),
          longitude: Number(pointEditForm.longitude),
        });
      } else if (editingCable) {
        await apiPatch(`/fiber-cables/${editingCable.id}`, accessToken, {
          code: cableEditForm.code,
          fiberCount: Number(cableEditForm.fiberCount),
          notes: cableEditForm.notes || undefined,
        });
      } else if (editingSplice) {
        await apiPatch(`/splices/${editingSplice.id}`, accessToken, {
          name: spliceEditForm.name,
          closureType: spliceEditForm.closureType,
          trayCount: Number(spliceEditForm.trayCount),
          fiberCapacity: Number(spliceEditForm.fiberCapacity),
          notes: spliceEditForm.notes || undefined,
        });
      }
      closeInventoryModal();
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePoint(point: FiberPoint) {
    if (!accessToken || !routeDetail) return;
    if (!window.confirm(`Eliminar el punto ${point.name}?`)) return;

    setDeletingPointId(point.id);
    try {
      await apiDelete(`/fiber-points/${point.id}`, accessToken);
      if (editingPoint?.id === point.id) {
        closeInventoryModal();
      }
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo eliminar el punto.");
    } finally {
      setDeletingPointId("");
    }
  }

  async function handleDeleteCable(cable: FiberCable) {
    if (!accessToken || !routeDetail) return;
    if (!window.confirm(`Eliminar el cable ${cable.code}?`)) return;

    setDeletingCableId(cable.id);
    try {
      await apiDelete(`/fiber-cables/${cable.id}`, accessToken);
      if (editingCable?.id === cable.id) {
        closeInventoryModal();
      }
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo eliminar el cable.");
    } finally {
      setDeletingCableId("");
    }
  }

  async function handleDeleteSplice(splice: SpliceClosure) {
    if (!accessToken || !routeDetail) return;
    if (!window.confirm(`Eliminar el empalme ${splice.code} y su punto asociado?`)) return;

    setDeletingSpliceId(splice.id);
    try {
      await apiDelete(`/splices/${splice.id}`, accessToken);
      if (expandedSpliceId === splice.id) {
        setExpandedSpliceId(null);
      }
      if (editingSplice?.id === splice.id) {
        closeInventoryModal();
      }
      await loadRouteDetail(routeDetail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo eliminar el empalme.");
    } finally {
      setDeletingSpliceId("");
    }
  }

  const expandedSplice = routeDetail?.spliceClosures.find((splice) => splice.id === expandedSpliceId) ?? null;
  const filteredItems = items.filter((item) => {
    const q = routeFilter.trim().toLowerCase();
    if (!q) return true;
    return item.identifier.toLowerCase().includes(q) || item.center.name.toLowerCase().includes(q);
  });

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    setWorkspaceTab("wizard");
    setWizardStep(1);
    setInventoryTab("cables");
    setExpandedSpliceId(null);
  }

  return (
    <OpsShell eyebrow="Administración" title="Rutas">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} rutas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nueva ruta</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr] xl:items-start">
        <section className={`${PANEL} xl:sticky xl:top-6`}>
          <input
            className={`${INPUT} mb-3`}
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            placeholder="Buscar por identificador o CMC…"
          />
          {loading ? (
            <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
          ) : (
            <div className="overflow-hidden rounded-ops border border-ops-border">
              <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-ops-border bg-ops-panel text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                      <th className="px-4 py-3">Ruta</th>
                      <th className="px-4 py-3">CMC</th>
                      <th className="px-4 py-3">Nodos</th>
                      <th className="px-4 py-3">Cables</th>
                      <th className="px-4 py-3">Empalmes</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ops-border">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className={selectedRouteId === item.id ? "bg-ops-surface" : "hover:bg-ops-surface"}>
                        <td className="px-4 py-3 font-mono text-sm text-ops-text">{item.identifier}</td>
                        <td className="px-4 py-3 text-ops-muted">{item.center.name}</td>
                        <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.nodes}</td>
                        <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.fiberCables}</td>
                        <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.spliceClosures}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => selectRoute(item.id)} className="text-[11px] text-ops-blue hover:underline">Documentar</button>
                            <button onClick={() => openEdit(item)} className="text-[11px] text-ops-muted hover:text-ops-text">Editar</button>
                            <button
                              onClick={() => void handleDeleteRoute(item)}
                              disabled={deletingRouteId === item.id}
                              className="text-[11px] text-red-300 hover:text-red-200 disabled:opacity-50"
                            >
                              {deletingRouteId === item.id ? "Eliminando…" : "Eliminar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-ops-muted">Sin resultados para “{routeFilter}”.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {!routeDetail ? (
            <div className={PANEL}>
              <p className="text-sm text-ops-muted">Selecciona una ruta para empezar a documentar el dato técnico de fibra.</p>
            </div>
          ) : (
            <>
              <div className={PANEL}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ruta seleccionada</p>
                    <h2 className="mt-1 text-lg font-semibold text-ops-text">{routeDetail.identifier}</h2>
                    <p className="text-sm text-ops-muted">{routeDetail.center.name} · {routeDetail.type}</p>
                  </div>
                  {loadingDetail && <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-ops border border-ops-border bg-ops-surface p-3">
                    <p className="text-[10px] uppercase tracking-wide text-ops-muted">Puntos</p>
                    <p className="mt-1 text-xl font-semibold text-ops-text">{routeDetail.fiberPoints.length}</p>
                  </div>
                  <div className="rounded-ops border border-ops-border bg-ops-surface p-3">
                    <p className="text-[10px] uppercase tracking-wide text-ops-muted">Cables</p>
                    <p className="mt-1 text-xl font-semibold text-ops-text">{routeDetail.fiberCables.length}</p>
                  </div>
                  <div className="rounded-ops border border-ops-border bg-ops-surface p-3">
                    <p className="text-[10px] uppercase tracking-wide text-ops-muted">Empalmes</p>
                    <p className="mt-1 text-xl font-semibold text-ops-text">{routeDetail.spliceClosures.length}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" className={tabClass(workspaceTab === "wizard")} onClick={() => setWorkspaceTab("wizard")}>Documentar</button>
                <button type="button" className={tabClass(workspaceTab === "inventory")} onClick={() => setWorkspaceTab("inventory")}>
                  Inventario · {routeDetail.fiberCables.length + routeDetail.fiberPoints.length + routeDetail.spliceClosures.length}
                </button>
              </div>

              {workspaceTab === "wizard" && (
              <div className={PANEL}>
                <div className="flex flex-wrap gap-2">
                  {WIZARD_STEPS.map((step) => (
                    <button key={step.id} type="button" className={tabClass(wizardStep === step.id)} onClick={() => setWizardStep(step.id)}>
                      {step.id}. {step.label}
                    </button>
                  ))}
                </div>

                {wizardStep === 1 && (
                <form onSubmit={handleCreatePoint} className="mt-4">
                  <div className="space-y-3">
                    <select className={INPUT} value={pointForm.kind} onChange={(e) => setPointForm((f) => ({ ...f, kind: e.target.value as "NODE" | "SPLICE" }))}>
                      <option value="NODE">Reusar nodo existente</option>
                      <option value="SPLICE">Crear empalme nuevo</option>
                    </select>
                    {pointForm.kind === "NODE" ? (
                      <select className={INPUT} value={pointForm.nodeId} onChange={(e) => {
                        const node = routeDetail.nodes.find((item) => item.id === e.target.value);
                        setPointForm((f) => ({
                          ...f,
                          nodeId: e.target.value,
                          name: node?.name ?? "",
                          latitude: node ? String(node.lat) : "",
                          longitude: node ? String(node.lng) : "",
                        }));
                      }}>
                        <option value="">Seleccionar nodo…</option>
                        {routeDetail.nodes.map((node) => <option key={node.id} value={node.id}>{node.code} · {node.name}</option>)}
                      </select>
                    ) : (
                      <>
                        <input className={INPUT} value={pointForm.spliceCode} onChange={(e) => setPointForm((f) => ({ ...f, spliceCode: e.target.value }))} placeholder="Código empalme" required />
                        <input className={INPUT} value={pointForm.name} onChange={(e) => setPointForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre empalme" required />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input className={INPUT} value={pointForm.latitude} onChange={(e) => setPointForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="Latitud" required />
                          <input className={INPUT} value={pointForm.longitude} onChange={(e) => setPointForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="Longitud" required />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input className={INPUT} value={pointForm.closureType} onChange={(e) => setPointForm((f) => ({ ...f, closureType: e.target.value }))} placeholder="Tipo cierre" required />
                          <input className={INPUT} value={pointForm.trayCount} onChange={(e) => setPointForm((f) => ({ ...f, trayCount: e.target.value }))} placeholder="Bandejas" required />
                        </div>
                        <input className={INPUT} value={pointForm.fiberCapacity} onChange={(e) => setPointForm((f) => ({ ...f, fiberCapacity: e.target.value }))} placeholder="Capacidad hilos" required />
                      </>
                    )}
                    <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
                      Guardar punto
                    </button>
                  </div>
                </form>
                )}

                {wizardStep === 2 && (
                <form onSubmit={handleCreateCable} className="mt-4">
                  <h3 className="text-base font-semibold text-ops-text">Cable troncal o derivación</h3>
                  <div className="mt-4 space-y-3">
                    <input className={INPUT} value={cableForm.code} onChange={(e) => setCableForm((f) => ({ ...f, code: e.target.value }))} placeholder="Código cable" required />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select className={INPUT} value={cableForm.kind} onChange={(e) => setCableForm((f) => ({ ...f, kind: e.target.value as "TRONCAL" | "DERIVACION" }))}>
                        <option value="TRONCAL">TRONCAL</option>
                        <option value="DERIVACION">DERIVACION</option>
                      </select>
                      <input className={INPUT} value={cableForm.fiberCount} onChange={(e) => setCableForm((f) => ({ ...f, fiberCount: e.target.value }))} placeholder="Cantidad de hilos" required />
                    </div>
                    <select className={INPUT} value={cableForm.originPointId} onChange={(e) => setCableForm((f) => ({ ...f, originPointId: e.target.value }))}>
                      <option value="">Punto A…</option>
                      {routeDetail.fiberPoints.map((point) => <option key={point.id} value={point.id}>{point.name} · {point.kind}</option>)}
                    </select>
                    <select className={INPUT} value={cableForm.destinationPointId} onChange={(e) => setCableForm((f) => ({ ...f, destinationPointId: e.target.value }))}>
                      <option value="">Punto B…</option>
                      {routeDetail.fiberPoints.map((point) => <option key={point.id} value={point.id}>{point.name} · {point.kind}</option>)}
                    </select>
                    {cableForm.kind === "DERIVACION" && (
                      <>
                        <select className={INPUT} value={cableForm.parentCableId} onChange={(e) => setCableForm((f) => ({ ...f, parentCableId: e.target.value }))}>
                          <option value="">Cable padre…</option>
                          {routeDetail.fiberCables.map((cable) => <option key={cable.id} value={cable.id}>{cable.code}</option>)}
                        </select>
                        <select className={INPUT} value={cableForm.sourceSpliceId} onChange={(e) => setCableForm((f) => ({ ...f, sourceSpliceId: e.target.value }))}>
                          <option value="">Empalme origen…</option>
                          {routeDetail.spliceClosures.map((splice) => <option key={splice.id} value={splice.id}>{splice.code} · {splice.name}</option>)}
                        </select>
                      </>
                    )}
                    <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
                      Guardar cable
                    </button>
                  </div>
                </form>
                )}

                {wizardStep === 3 && (
                <form onSubmit={handleCreateLeg} className="mt-4">
                  <h3 className="text-base font-semibold text-ops-text">Composición del empalme</h3>
                  <div className="mt-4 space-y-3">
                    <select className={INPUT} value={legForm.spliceId} onChange={(e) => setLegForm((f) => ({ ...f, spliceId: e.target.value }))}>
                      <option value="">Empalme…</option>
                      {routeDetail.spliceClosures.map((splice) => <option key={splice.id} value={splice.id}>{splice.code} · {splice.name}</option>)}
                    </select>
                    <select className={INPUT} value={legForm.fiberCableId} onChange={(e) => setLegForm((f) => ({ ...f, fiberCableId: e.target.value }))}>
                      <option value="">Cable…</option>
                      {routeDetail.fiberCables.map((cable) => <option key={cable.id} value={cable.id}>{cable.code} · {cable.kind}</option>)}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select className={INPUT} value={legForm.direction} onChange={(e) => setLegForm((f) => ({ ...f, direction: e.target.value as "IN" | "OUT" }))}>
                        <option value="IN">IN</option>
                        <option value="OUT">OUT</option>
                      </select>
                      <input className={INPUT} value={legForm.fiberCount} onChange={(e) => setLegForm((f) => ({ ...f, fiberCount: e.target.value }))} placeholder="Hilos" required />
                      <input className={INPUT} value={legForm.reservedFiberCount} onChange={(e) => setLegForm((f) => ({ ...f, reservedFiberCount: e.target.value }))} placeholder="Reserva" required />
                    </div>
                    <input className={INPUT} value={legForm.bufferLabel} onChange={(e) => setLegForm((f) => ({ ...f, bufferLabel: e.target.value }))} placeholder="Buffer / tubo" />
                    <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
                      Agregar cable al empalme
                    </button>
                  </div>
                </form>
                )}

                {wizardStep === 4 && (
                <form onSubmit={handleCreateBlock} className="mt-4">
                  <h3 className="text-base font-semibold text-ops-text">Bloque de fusión</h3>
                  <div className="mt-4 space-y-3">
                    <select className={INPUT} value={blockForm.spliceId} onChange={(e) => setBlockForm((f) => ({ ...f, spliceId: e.target.value, fromLegId: "", toLegId: "" }))}>
                      <option value="">Empalme…</option>
                      {routeDetail.spliceClosures.map((splice) => <option key={splice.id} value={splice.id}>{splice.code} · {splice.name}</option>)}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select className={INPUT} value={blockForm.fromLegId} onChange={(e) => setBlockForm((f) => ({ ...f, fromLegId: e.target.value }))}>
                        <option value="">Leg IN…</option>
                        {(routeDetail.spliceClosures.find((item) => item.id === blockForm.spliceId)?.cableLegs ?? []).map((leg) => (
                          <option key={leg.id} value={leg.id}>{leg.fiberCable.code} · {leg.direction}</option>
                        ))}
                      </select>
                      <select className={INPUT} value={blockForm.toLegId} onChange={(e) => setBlockForm((f) => ({ ...f, toLegId: e.target.value }))}>
                        <option value="">Leg OUT…</option>
                        {(routeDetail.spliceClosures.find((item) => item.id === blockForm.spliceId)?.cableLegs ?? []).map((leg) => (
                          <option key={leg.id} value={leg.id}>{leg.fiberCable.code} · {leg.direction}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className={INPUT} value={blockForm.fromFiberStart} onChange={(e) => setBlockForm((f) => ({ ...f, fromFiberStart: e.target.value }))} placeholder="Desde hilo" required />
                      <input className={INPUT} value={blockForm.fromFiberEnd} onChange={(e) => setBlockForm((f) => ({ ...f, fromFiberEnd: e.target.value }))} placeholder="Hasta hilo" required />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className={INPUT} value={blockForm.toFiberStart} onChange={(e) => setBlockForm((f) => ({ ...f, toFiberStart: e.target.value }))} placeholder="Desde hilo destino" required />
                      <input className={INPUT} value={blockForm.toFiberEnd} onChange={(e) => setBlockForm((f) => ({ ...f, toFiberEnd: e.target.value }))} placeholder="Hasta hilo destino" required />
                    </div>
                    <select className={INPUT} value={blockForm.blockKind} onChange={(e) => setBlockForm((f) => ({ ...f, blockKind: e.target.value as BlockForm["blockKind"] }))}>
                      <option value="FUSION">FUSION</option>
                      <option value="RESERVE">RESERVE</option>
                      <option value="PASS_THROUGH">PASS_THROUGH</option>
                      <option value="SPLIT">SPLIT</option>
                    </select>
                    <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
                      Guardar y expandir bloque
                    </button>
                  </div>
                </form>
                )}
              </div>
              )}

              {workspaceTab === "inventory" && (
              <div className={PANEL}>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={tabClass(inventoryTab === "cables")} onClick={() => setInventoryTab("cables")}>
                    Cables · {routeDetail.fiberCables.length}
                  </button>
                  <button type="button" className={tabClass(inventoryTab === "points")} onClick={() => setInventoryTab("points")}>
                    Puntos · {routeDetail.fiberPoints.length}
                  </button>
                  <button type="button" className={tabClass(inventoryTab === "splices")} onClick={() => setInventoryTab("splices")}>
                    Empalmes · {routeDetail.spliceClosures.length}
                  </button>
                </div>

                {inventoryTab === "cables" && (
                  <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {routeDetail.fiberCables.length === 0 && <p className="text-sm text-ops-muted">Aún no hay cables documentados.</p>}
                    {routeDetail.fiberCables.map((cable) => (
                      <div key={cable.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm text-ops-text">{cable.code}</p>
                            <p className="text-xs text-ops-muted">{cable.kind} · {cable.fiberCount} hilos</p>
                            <p className="text-xs text-ops-muted">{cable.originPoint.name} → {cable.destinationPoint.name}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded border border-ops-border px-2 py-0.5 text-[10px] text-ops-muted">{cable.documentStatus}</span>
                            <button type="button" onClick={() => openCableEditor(cable)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCable(cable)}
                              disabled={deletingCableId === cable.id}
                              className="text-[11px] text-red-300 hover:text-red-200 disabled:opacity-50"
                            >
                              {deletingCableId === cable.id ? "Eliminando…" : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {inventoryTab === "points" && (
                  <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {routeDetail.fiberPoints.length === 0 && <p className="text-sm text-ops-muted">Aún no hay puntos documentados.</p>}
                    {routeDetail.fiberPoints.map((point) => (
                      <div key={point.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-ops-text">{point.name}</p>
                            <p className="text-xs text-ops-muted">{point.kind} · {point.latitude}, {point.longitude}</p>
                            {point.node && <p className="text-xs text-ops-muted">Nodo: {point.node.code}</p>}
                            {point.splice && <p className="text-xs text-ops-muted">Empalme: {point.splice.code}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => openPointEditor(point)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePoint(point)}
                              disabled={deletingPointId === point.id}
                              className="text-[11px] text-red-300 hover:text-red-200 disabled:opacity-50"
                            >
                              {deletingPointId === point.id ? "Eliminando…" : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {inventoryTab === "splices" && (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                      {routeDetail.spliceClosures.length === 0 && <p className="text-sm text-ops-muted">Aún no hay empalmes documentados.</p>}
                      {routeDetail.spliceClosures.map((splice) => (
                        <button
                          key={splice.id}
                          type="button"
                          onClick={() => setExpandedSpliceId(expandedSpliceId === splice.id ? null : splice.id)}
                          className={`w-full rounded-ops border p-3 text-left transition-colors ${
                            expandedSpliceId === splice.id ? "border-ops-blue bg-ops-surface" : "border-ops-border bg-ops-surface hover:border-ops-blue/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-mono text-sm text-ops-text">{splice.code}</p>
                              <p className="text-xs text-ops-muted">{splice.name} · {splice.closureType}</p>
                              <p className="text-xs text-ops-muted">{splice.cableLegs.length} patas · {splice.connections.length} fusiones</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded border border-ops-border px-2 py-0.5 text-[10px] text-ops-muted">{splice.documentStatus}</span>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); openSpliceEditor(splice); }}
                                className="text-[11px] text-ops-blue hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); void handleDeleteSplice(splice); }}
                                disabled={deletingSpliceId === splice.id}
                                className="text-[11px] text-red-300 hover:text-red-200 disabled:opacity-50"
                              >
                                {deletingSpliceId === splice.id ? "Eliminando…" : "Eliminar"}
                              </button>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {expandedSplice ? (
                      <div className="rounded-ops border border-ops-border bg-ops-surface p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Detalle operativo</p>
                        <h3 className="mt-1 text-sm font-semibold text-ops-text">{expandedSplice.code} · {expandedSplice.name}</h3>
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ops-muted">Patas del empalme</p>
                          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                            {expandedSplice.cableLegs.length === 0 && <p className="text-xs text-ops-muted">Sin patas registradas.</p>}
                            {expandedSplice.cableLegs.map((leg) => (
                              <div key={leg.id} className="rounded-ops border border-ops-border bg-ops-panel p-3 text-xs text-ops-muted">
                                <p className="font-medium text-ops-text">{leg.fiberCable.code} · {leg.direction}</p>
                                <p>{leg.fiberCount} hilos · reserva {leg.reservedFiberCount}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ops-muted">Fusiones expandidas</p>
                          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                            {expandedSplice.connections.length === 0 && <p className="text-xs text-ops-muted">Sin fusiones expandidas todavía.</p>}
                            {expandedSplice.connections.map((connection) => (
                              <div key={connection.id} className="rounded-ops border border-ops-border bg-ops-panel p-3 text-xs text-ops-muted">
                                <p className="text-ops-text">
                                  {connection.fromLegId}:{connection.fromFiberNumber} → {connection.toLegId}:{connection.toFiberNumber}
                                </p>
                                <p>{connection.connectionKind}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-ops border border-dashed border-ops-border p-6 text-center text-sm text-ops-muted">
                        Selecciona un empalme para ver sus patas y fusiones.
                      </div>
                    )}
                  </div>
                )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <OpsModal open={modalOpen} title={editing ? "Editar ruta" : "Nueva ruta"} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleRouteSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Identificador</label>
            <input className={INPUT} value={editing ? editForm.identifier : createForm.identifier} onChange={(e) => editing ? setEditForm((f) => ({ ...f, identifier: e.target.value })) : setCreateForm((f) => ({ ...f, identifier: e.target.value }))} required placeholder="RUTA-001" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
            <select className={INPUT} value={editing ? editForm.type : createForm.type} onChange={(e) => editing ? setEditForm((f) => ({ ...f, type: e.target.value })) : setCreateForm((f) => ({ ...f, type: e.target.value }))}>
              {ROUTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">CMC</label>
              <select className={INPUT} value={createForm.monitoringCenterId} onChange={(e) => setCreateForm((f) => ({ ...f, monitoringCenterId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>

      <OpsModal
        open={inventoryModalOpen}
        title={editingPoint ? "Editar punto" : editingCable ? "Editar cable" : editingSplice ? "Editar empalme" : "Editar"}
        onClose={closeInventoryModal}
      >
        <form onSubmit={handleInventorySubmit} className="space-y-4">
          {editingPoint && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
                <input className={INPUT} value={pointEditForm.name} onChange={(e) => setPointEditForm((form) => ({ ...form, name: e.target.value }))} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Latitud</label>
                  <input className={INPUT} value={pointEditForm.latitude} onChange={(e) => setPointEditForm((form) => ({ ...form, latitude: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Longitud</label>
                  <input className={INPUT} value={pointEditForm.longitude} onChange={(e) => setPointEditForm((form) => ({ ...form, longitude: e.target.value }))} required />
                </div>
              </div>
            </>
          )}

          {editingCable && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código</label>
                <input className={INPUT} value={cableEditForm.code} onChange={(e) => setCableEditForm((form) => ({ ...form, code: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Cantidad de hilos</label>
                <input className={INPUT} value={cableEditForm.fiberCount} onChange={(e) => setCableEditForm((form) => ({ ...form, fiberCount: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Notas</label>
                <textarea className={`${INPUT} min-h-24`} value={cableEditForm.notes} onChange={(e) => setCableEditForm((form) => ({ ...form, notes: e.target.value }))} />
              </div>
            </>
          )}

          {editingSplice && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
                <input className={INPUT} value={spliceEditForm.name} onChange={(e) => setSpliceEditForm((form) => ({ ...form, name: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo de cierre</label>
                <input className={INPUT} value={spliceEditForm.closureType} onChange={(e) => setSpliceEditForm((form) => ({ ...form, closureType: e.target.value }))} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Bandejas</label>
                  <input className={INPUT} value={spliceEditForm.trayCount} onChange={(e) => setSpliceEditForm((form) => ({ ...form, trayCount: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Capacidad de hilos</label>
                  <input className={INPUT} value={spliceEditForm.fiberCapacity} onChange={(e) => setSpliceEditForm((form) => ({ ...form, fiberCapacity: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Notas</label>
                <textarea className={`${INPUT} min-h-24`} value={spliceEditForm.notes} onChange={(e) => setSpliceEditForm((form) => ({ ...form, notes: e.target.value }))} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeInventoryModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
