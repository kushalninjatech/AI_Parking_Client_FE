import { useState, useEffect, useCallback } from "react";
import { cameraApi, slotApi } from "@/services/api";
import PolygonDrawer from "@/components/PolygonDrawer";
import type { Camera, ParkingSlot } from "@/types";
import { Trash2, Crosshair, Eye, PenTool, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function ParkingZones() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [nextLabel, setNextLabel] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [imgTs, setImgTs] = useState(Date.now());
  const toast = useToast();

  useEffect(() => {
    cameraApi.list().then(({ data }) => {
      setCameras(data);
      if (data.length > 0 && !selectedCamera) setSelectedCamera(data[0]);
    });
  }, []);

  const loadSlots = useCallback(() => {
    if (!selectedCamera) return;
    slotApi.list(selectedCamera.id).then(({ data }) => {
      setSlots(data);
      setNextLabel(`${String.fromCharCode(65 + Math.floor(data.length / 10))}-${String(data.length % 10 + 1).padStart(2, "0")}`);
    });
  }, [selectedCamera]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  async function handlePolygonComplete(polygon: number[][]) {
    if (!selectedCamera) return;
    try {
      await slotApi.create({ label: nextLabel || `S-${slots.length + 1}`, camera_id: selectedCamera.id, polygon_coords: JSON.stringify(polygon) });
      toast.success(`Slot ${nextLabel} created`);
      loadSlots();
    } catch {
      toast.error("Failed to create slot");
    }
  }

  async function handleDeleteSlot(slot: ParkingSlot) {
    if (!confirm(`Delete slot ${slot.label}?`)) return;
    await slotApi.delete(slot.id);
    toast.success(`Slot ${slot.label} deleted`);
    loadSlots();
  }

  async function handleCalibrateSlot(slot: ParkingSlot) {
    try {
      await slotApi.calibrate(slot.id);
      toast.success(`${slot.label} calibrated`);
    } catch {
      toast.error(`Calibration failed for ${slot.label}`);
    }
  }

  const snapshotUrl = selectedCamera ? `${cameraApi.latestFrameUrl(selectedCamera.id)}?t=${imgTs}` : "";
  const fallbackUrl = selectedCamera ? `${cameraApi.snapshotUrl(selectedCamera.id)}?t=${imgTs}` : "";

  const vehicle = slots.filter((s) => s.state === "VEHICLE").length;
  const empty = slots.filter((s) => s.state === "EMPTY").length;
  const obstructed = slots.filter((s) => s.state === "OBSTRUCTED").length;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Parking Zones</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Draw polygon ROI for each parking slot</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={selectedCamera?.id || ""} onChange={(e) => { setSelectedCamera(cameras.find((c) => c.id === Number(e.target.value)) || null); setDrawMode(false); }}
            className="input-field" style={{ width: 160 }}>
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={() => setImgTs(Date.now())} className="btn-secondary" style={{ width: 36, padding: 0 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {!selectedCamera?.reference_snapshot_path ? (
        <div className="card" style={{ padding: 64, textAlign: "center" }}>
          <AlertTriangle size={36} color="#f59e0b" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No reference snapshot</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Capture a snapshot from the Cameras page first.</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20 }}>
          {/* Canvas Area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mode Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #cbd5e1" }}>
                  <button onClick={() => setDrawMode(false)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                    background: !drawMode ? "#0d9488" : "#fff", color: !drawMode ? "#fff" : "#64748b",
                  }}>
                    <Eye size={13} /> View
                  </button>
                  <button onClick={() => setDrawMode(true)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                    background: drawMode ? "#0d9488" : "#fff", color: drawMode ? "#fff" : "#64748b",
                    borderLeft: "1px solid #cbd5e1",
                  }}>
                    <PenTool size={13} /> Draw
                  </button>
                </div>
                {drawMode && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Label:</label>
                    <input value={nextLabel} onChange={(e) => setNextLabel(e.target.value)} className="input-field" style={{ width: 80, height: 32, fontSize: 12 }} />
                  </div>
                )}
              </div>
              {drawMode && <span style={{ fontSize: 11, color: "#0d9488", fontWeight: 500 }}>Click to draw. Click near first point to close. ESC to cancel.</span>}
            </div>

            <PolygonDrawer
              imageUrl={snapshotUrl}
              fallbackUrl={fallbackUrl}
              existingSlots={slots}
              onComplete={drawMode ? handlePolygonComplete : undefined}
              onSlotClick={!drawMode ? (s) => handleDeleteSlot(s) : undefined}
              drawingEnabled={drawMode}
            />

            {/* Legend */}
            {slots.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 20, fontSize: 11, fontWeight: 500, color: "#64748b" }}>
                {[
                  { c: "#22c55e", l: "Empty", v: empty },
                  { c: "#ef4444", l: "Vehicle", v: vehicle },
                  { c: "#f59e0b", l: "Obstructed", v: obstructed },
                ].map(({ c, l, v }) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: `${c}33`, border: `1.5px solid ${c}` }} />
                    {l}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Slots Sidebar */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Slots ({slots.length})</h2>
              {slots.length > 0 && (
                <span className={`badge ${vehicle > 0 ? "badge-danger" : "badge-success"}`}>{vehicle}/{slots.length}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 550, overflowY: "auto", paddingRight: 4 }}>
              {slots.map((s) => {
                const stateConfig = s.state === "VEHICLE"
                  ? { bg: "#fef2f2", border: "#fecaca", color: "#dc2626" }
                  : s.state === "OBSTRUCTED"
                  ? { bg: "#fffbeb", border: "#fed7aa", color: "#d97706" }
                  : { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" };
                return (
                  <div key={s.id} style={{ borderRadius: 12, border: `1px solid ${stateConfig.border}`, background: stateConfig.bg, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{s.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: stateConfig.color }}>{s.state}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleCalibrateSlot(s)} className="btn-secondary" style={{ flex: 1, height: 28, fontSize: 10 }}>
                        <Crosshair size={10} /> Calibrate
                      </button>
                      <button onClick={() => handleDeleteSlot(s)} className="btn-danger" style={{ height: 28, width: 28, padding: 0 }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {slots.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 24 }}>Draw polygons to create slots</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
