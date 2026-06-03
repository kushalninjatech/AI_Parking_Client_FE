import { useState, useEffect, useCallback } from "react";
import { cameraApi, slotApi } from "@/services/api";
import PolygonDrawer from "@/components/PolygonDrawer";
import type { Camera, ParkingSlot } from "@/types";
import { Trash2, Crosshair, Eye, PenTool, RefreshCw, AlertTriangle, Square, Pentagon } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function ParkingZones() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [nextLabel, setNextLabel] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [shapeMode, setShapeMode] = useState<"rectangle" | "polygon">("rectangle");
  const [slotType, setSlotType] = useState("GENERAL");
  const [capCar, setCapCar] = useState("1");
  const [cap2w, setCap2w] = useState("0");
  const [imgTs, setImgTs] = useState(Date.now());
  const [pendingPolygon, setPendingPolygon] = useState<number[][] | null>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
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

  function handlePolygonComplete(polygon: number[][]) {
    if (!selectedCamera) return;
    setPendingPolygon(polygon);
    setSlotType("GENERAL");
    setCapCar("1");
    setCap2w("0");
    setShowSlotModal(true);
  }

  async function handleSlotModalSave() {
    if (!selectedCamera || !pendingPolygon) return;
    const label = nextLabel.trim();
    if (!label) { toast.error("Enter a slot label"); return; }
    setModalSaving(true);
    try {
      await slotApi.create({
        label, camera_id: selectedCamera.id,
        polygon_coords: JSON.stringify(pendingPolygon), slot_type: slotType,
        capacity_car: parseInt(capCar) || 0, capacity_two_wheeler: parseInt(cap2w) || 0,
      });
      toast.success(`Slot ${label} created`);
      setShowSlotModal(false);
      setPendingPolygon(null);
      loadSlots();
    } catch {
      toast.error("Failed to create slot");
    } finally {
      setModalSaving(false);
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

  const mismatched = slots.filter((s) => s.state === "VEHICLE" && s.slot_type !== "GENERAL" && s.detected_vehicle_type != null && s.detected_vehicle_type !== s.slot_type).length;
  const vehicle = slots.filter((s) => s.state === "VEHICLE").length - mismatched;
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
                    {/* Shape toggle */}
                    <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #cbd5e1" }}>
                      <button onClick={() => setShapeMode("rectangle")} title="Rectangle" style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                        background: shapeMode === "rectangle" ? "#0d9488" : "#fff", color: shapeMode === "rectangle" ? "#fff" : "#64748b",
                      }}>
                        <Square size={12} /> Rect
                      </button>
                      <button onClick={() => setShapeMode("polygon")} title="Polygon" style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                        background: shapeMode === "polygon" ? "#0d9488" : "#fff", color: shapeMode === "polygon" ? "#fff" : "#64748b",
                        borderLeft: "1px solid #cbd5e1",
                      }}>
                        <Pentagon size={12} /> Poly
                      </button>
                    </div>
                    <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Label:</label>
                    <input value={nextLabel} onChange={(e) => setNextLabel(e.target.value)} className="input-field" style={{ width: 80, height: 32, fontSize: 12 }} />
                  </div>
                )}
              </div>
              {drawMode && <span style={{ fontSize: 11, color: "#0d9488", fontWeight: 500 }}>{shapeMode === "rectangle" ? "Click first corner, then opposite corner." : "Click to draw polygon. Click near first point to close. ESC to cancel."}</span>}
            </div>

            <PolygonDrawer
              imageUrl={snapshotUrl}
              fallbackUrl={fallbackUrl}
              existingSlots={slots}
              onComplete={drawMode ? handlePolygonComplete : undefined}
              onSlotClick={!drawMode ? (s) => handleDeleteSlot(s) : undefined}
              drawingEnabled={drawMode}
              drawingMode={shapeMode}
            />

            {/* Legend */}
            {slots.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 20, fontSize: 11, fontWeight: 500, color: "#64748b" }}>
                {[
                  { c: "#22c55e", l: "Empty", v: empty },
                  { c: "#ef4444", l: "Vehicle", v: vehicle },
                  { c: "#f59e0b", l: "Obstructed", v: obstructed },
                  ...(mismatched > 0 ? [{ c: "#3b82f6", l: "Mismatched", v: mismatched }] : []),
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
                const isMismatched = s.state === "VEHICLE" && s.slot_type !== "GENERAL" && s.detected_vehicle_type != null && s.detected_vehicle_type !== s.slot_type;
                const stateConfig = isMismatched
                  ? { bg: "#eff6ff", border: "#bfdbfe", color: "#2563eb" }
                  : s.state === "VEHICLE"
                  ? { bg: "#fef2f2", border: "#fecaca", color: "#dc2626" }
                  : s.state === "OBSTRUCTED"
                  ? { bg: "#fffbeb", border: "#fed7aa", color: "#d97706" }
                  : { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" };
                return (
                  <div key={s.id} style={{ borderRadius: 12, border: `1px solid ${stateConfig.border}`, background: stateConfig.bg, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <input
                        defaultValue={s.label}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          if (val && val !== s.label) {
                            try { await slotApi.update(s.id, { label: val }); loadSlots(); }
                            catch { toast.error("Failed to update label"); e.target.value = s.label; }
                          } else { e.target.value = s.label; }
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", background: "transparent", border: "none", borderBottom: "1px solid transparent", width: 80, padding: 0, outline: "none" }}
                        onFocus={(e) => { e.target.style.borderBottomColor = "#0d9488"; }}
                        onMouseOver={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = "#cbd5e1"; }}
                        onMouseOut={(e) => { if (document.activeElement !== e.target) (e.target as HTMLInputElement).style.borderBottomColor = "transparent"; }}
                      />
                      <span style={{ fontSize: 10, fontWeight: 700, color: stateConfig.color }}>
                        {s.state === "VEHICLE" && s.detected_vehicle_type ? (s.detected_vehicle_type === "TWO_WHEELER" ? "2W" : "Car") : s.state}
                      </span>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <select
                        value={s.slot_type || "GENERAL"}
                        onChange={async (e) => {
                          try {
                            await slotApi.update(s.id, { slot_type: e.target.value });
                            loadSlots();
                          } catch { toast.error("Failed to update slot type"); }
                        }}
                        className="input-field"
                        style={{ width: "100%", height: 26, fontSize: 10 }}
                      >
                        <option value="GENERAL">General</option>
                        <option value="CAR">Car</option>
                        <option value="TWO_WHEELER">2-Wheeler</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>Car Cap</label>
                        <input type="number" min="0" value={s.capacity_car ?? 0}
                          onChange={async (e) => {
                            try { await slotApi.update(s.id, { capacity_car: parseInt(e.target.value) || 0 }); loadSlots(); }
                            catch { toast.error("Failed to update"); }
                          }}
                          className="input-field" style={{ width: "100%", height: 24, fontSize: 10, textAlign: "center" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>2W Cap</label>
                        <input type="number" min="0" value={s.capacity_two_wheeler ?? 0}
                          onChange={async (e) => {
                            try { await slotApi.update(s.id, { capacity_two_wheeler: parseInt(e.target.value) || 0 }); loadSlots(); }
                            catch { toast.error("Failed to update"); }
                          }}
                          className="input-field" style={{ width: "100%", height: 24, fontSize: 10, textAlign: "center" }} />
                      </div>
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
      {/* Slot Creation Modal */}
      {showSlotModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => { setShowSlotModal(false); setPendingPolygon(null); }} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 16, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>New Parking Slot</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Label</label>
                <input value={nextLabel} onChange={(e) => setNextLabel(e.target.value)} className="input-field" style={{ width: "100%", height: 36, fontSize: 13, marginTop: 4 }} placeholder="A-01" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Slot Type</label>
                <select value={slotType} onChange={(e) => {
                  setSlotType(e.target.value);
                  if (e.target.value === "CAR") { setCapCar("1"); setCap2w("0"); }
                  else if (e.target.value === "TWO_WHEELER") { setCapCar("0"); setCap2w("1"); }
                  else { setCapCar("1"); setCap2w("0"); }
                }} className="input-field" style={{ width: "100%", height: 36, fontSize: 13, marginTop: 4 }}>
                  <option value="GENERAL">General (Any Vehicle)</option>
                  <option value="CAR">Car</option>
                  <option value="TWO_WHEELER">2-Wheeler</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Car Capacity</label>
                  <input type="number" min="0" value={capCar} onChange={(e) => setCapCar(e.target.value)} className="input-field" style={{ width: "100%", height: 36, fontSize: 13, textAlign: "center", marginTop: 4 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>2W Capacity</label>
                  <input type="number" min="0" value={cap2w} onChange={(e) => setCap2w(e.target.value)} className="input-field" style={{ width: "100%", height: 36, fontSize: 13, textAlign: "center", marginTop: 4 }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowSlotModal(false); setPendingPolygon(null); }} className="btn-secondary" style={{ height: 36, fontSize: 13, padding: "0 16px" }}>Cancel</button>
              <button onClick={handleSlotModalSave} disabled={modalSaving} className="btn-primary" style={{ height: 36, fontSize: 13, padding: "0 20px" }}>
                {modalSaving ? "Creating..." : "Create Slot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
