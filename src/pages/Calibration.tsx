import { useState, useEffect } from "react";
import { cameraApi, slotApi } from "@/services/api";
import type { Camera, ParkingSlot } from "@/types";
import { Crosshair, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function Calibration() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [calibrating, setCalibrating] = useState<number | null>(null);
  const [calibratingAll, setCalibratingAll] = useState(false);
  const [results, setResults] = useState<Record<number, "success" | "error">>({});
  const toast = useToast();

  useEffect(() => { cameraApi.list().then(({ data }) => { setCameras(data); if (data.length > 0) setSelectedCamera(data[0]); }); }, []);
  useEffect(() => { if (selectedCamera) { slotApi.list(selectedCamera.id).then(({ data }) => setSlots(data)); setResults({}); } }, [selectedCamera]);

  async function calibrateSlot(id: number) {
    setCalibrating(id);
    try {
      await slotApi.calibrate(id);
      setResults((p) => ({ ...p, [id]: "success" }));
    } catch {
      setResults((p) => ({ ...p, [id]: "error" }));
    } finally {
      setCalibrating(null);
    }
  }

  async function calibrateAll() {
    setCalibratingAll(true);
    for (const s of slots) await calibrateSlot(s.id);
    setCalibratingAll(false);
    toast.success(`Calibrated ${slots.length} slots`);
  }

  const calibrated = Object.values(results).filter((r) => r === "success").length;
  const failed = Object.values(results).filter((r) => r === "error").length;

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Calibration</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Capture empty reference for depth estimation</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={selectedCamera?.id || ""} onChange={(e) => setSelectedCamera(cameras.find((c) => c.id === Number(e.target.value)) || null)}
            className="input-field" style={{ width: 160 }}>
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={calibrateAll} disabled={slots.length === 0 || calibratingAll} className="btn-primary">
            {calibratingAll && <Loader2 size={14} className="animate-spin" />}
            Calibrate All
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        {/* Warning */}
        <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontWeight: 500 }}>
          Ensure all parking slots are <strong>EMPTY</strong> before calibrating. The system captures depth reference from current frame.
        </div>

        {/* Progress */}
        {Object.keys(results).length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div className="progress-bar" style={{ flex: 1 }}>
              <div className="progress-bar-fill" style={{ width: `${(calibrated / slots.length) * 100}%`, background: "#22c55e" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{calibrated}/{slots.length}</span>
            {failed > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{failed} failed</span>}
          </div>
        )}

        {/* Slots */}
        {slots.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Crosshair size={32} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 13, color: "#94a3b8" }}>No slots. Create them in Parking Zones first.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {slots.map((s) => {
              const result = results[s.id];
              const bg = result === "success" ? "#f0fdf4" : result === "error" ? "#fef2f2" : "#f8fafc";
              const border = result === "success" ? "#bbf7d0" : result === "error" ? "#fecaca" : "#e2e8f0";
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 12, background: bg, border: `1px solid ${border}`, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Crosshair size={18} color={result === "success" ? "#22c55e" : result === "error" ? "#ef4444" : "#0d9488"} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{s.polygon_coords ? "Polygon set" : "No polygon"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {result === "success" && <CheckCircle size={18} color="#22c55e" />}
                    {result === "error" && <AlertCircle size={18} color="#ef4444" />}
                    <button onClick={() => calibrateSlot(s.id)} disabled={calibrating === s.id || !s.polygon_coords} className="btn-secondary" style={{ minWidth: 100 }}>
                      {calibrating === s.id ? <><Loader2 size={12} className="animate-spin" /> Calibrating...</> : "Calibrate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
