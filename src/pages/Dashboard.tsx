import { useState, useEffect, useCallback, useRef } from "react";
import { cameraApi, slotApi } from "@/services/api";
import type { Camera, ParkingSlot } from "@/types";
import { Monitor, ParkingSquare, Wifi, RefreshCw, Pause, Play, Car } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const STATE_COLORS: Record<string, { fill: string; stroke: string }> = {
  VEHICLE: { fill: "rgba(239,68,68,0.4)", stroke: "#ef4444" },
  EMPTY: { fill: "rgba(34,197,94,0.4)", stroke: "#22c55e" },
  OBSTRUCTED: { fill: "rgba(245,158,11,0.4)", stroke: "#f59e0b" },
};

function CameraCard({ camera, slots }: { camera: Camera; slots: ParkingSlot[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const [imgTs, setImgTs] = useState(Date.now());
  const W = 480, H = 300;

  useEffect(() => {
    const id = setInterval(() => setImgTs(Date.now()), 3000);
    return () => clearInterval(id);
  }, []);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Scale image to fit canvas maintaining aspect ratio (letterbox)
    const fw = camera.frame_width || 1920;
    const fh = camera.frame_height || 1080;
    const imgScale = Math.min(W / fw, H / fh);
    const imgW = fw * imgScale;
    const imgH = fh * imgScale;
    const imgX = (W - imgW) / 2;
    const imgY = (H - imgH) / 2;

    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(imgRef.current, imgX, imgY, imgW, imgH);
      ctx.globalAlpha = 1.0;
    }

    const slotsWithPoly = slots.filter((s) => s.polygon_coords);
    if (slotsWithPoly.length === 0) {
      ctx.fillStyle = "#94a3b8"; ctx.font = "13px Inter, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("No slots configured", W / 2, H / 2);
      return;
    }

    for (const slot of slotsWithPoly) {
      try {
        const pts: number[][] = JSON.parse(slot.polygon_coords!);
        const color = STATE_COLORS[slot.state] || STATE_COLORS.EMPTY;

        // Map original frame coords → canvas coords using actual frame dimensions
        const toX = (x: number) => x * imgScale + imgX;
        const toY = (y: number) => y * imgScale + imgY;

        ctx.beginPath();
        ctx.moveTo(toX(pts[0][0]), toY(pts[0][1]));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i][0]), toY(pts[i][1]));
        ctx.closePath();
        ctx.fillStyle = color.fill; ctx.fill();
        ctx.strokeStyle = color.stroke; ctx.lineWidth = 2; ctx.stroke();

        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;

        const label = slot.label;
        ctx.font = "bold 11px Inter, sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.beginPath();
        ctx.roundRect(toX(cx) - tw / 2 - 6, toY(cy) - 16, tw + 12, 28, 4);
        ctx.fill();

        ctx.fillStyle = "#fff"; ctx.textAlign = "center";
        ctx.fillText(label, toX(cx), toY(cy) - 2);
        ctx.font = "9px Inter, sans-serif"; ctx.fillStyle = color.stroke;
        const displayText = slot.state === "VEHICLE" && slot.detected_vehicle_type
          ? (slot.detected_vehicle_type === "TWO_WHEELER" ? "2W" : "CAR")
          : slot.state;
        ctx.fillText(displayText, toX(cx), toY(cy) + 10);
      } catch {}
    }
  }, [slots, camera.frame_width, camera.frame_height]);

  // Keep drawRef in sync so image loader always calls the latest draw
  useEffect(() => { drawRef.current = draw; }, [draw]);

  // Reload image every 3s; on slot state change just redraw with existing image
  useEffect(() => {
    const tryLoad = (src: string, onErr: () => void) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => { imgRef.current = img; drawRef.current(); };
      img.onerror = onErr;
    };
    tryLoad(
      `${cameraApi.latestFrameUrl(camera.id)}?t=${imgTs}`,
      () => tryLoad(`${cameraApi.snapshotUrl(camera.id)}`, () => drawRef.current()),
    );
  }, [camera.id, imgTs]);  // NOT draw — avoids re-fetching image on every slot state change

  // Redraw immediately when slot states change (no new image fetch needed)
  useEffect(() => { draw(); }, [draw]);

  const vehicle = slots.filter((s) => s.state === "VEHICLE").length;
  const empty = slots.filter((s) => s.state === "EMPTY").length;
  const obstructed = slots.filter((s) => s.state === "OBSTRUCTED").length;
  const occupancy = slots.length > 0 ? Math.round((vehicle / slots.length) * 100) : 0;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{camera.label}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{slots.length} slots · {camera.camera_type} · {camera.detection_interval}s</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span className={camera.status === "ACTIVE" ? "badge badge-success" : "badge badge-danger"}>{camera.status}</span>
          {slots.length > 0 && (
            <span className={`badge ${occupancy > 80 ? "badge-danger" : occupancy > 50 ? "badge-warning" : "badge-success"}`}>{occupancy}%</span>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W, height: H, display: "block" }} />
      <div style={{ padding: "10px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 20, fontSize: 11, fontWeight: 500, color: "#64748b" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(34,197,94,0.3)", border: "1.5px solid #22c55e" }} /> Empty: {empty}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(239,68,68,0.3)", border: "1.5px solid #ef4444" }} /> Vehicle: {vehicle}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(245,158,11,0.3)", border: "1.5px solid #f59e0b" }} /> Obstructed: {obstructed}</span>
      </div>
    </div>
  );
}

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b"];

export default function Dashboard() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [slotsByCamera, setSlotsByCamera] = useState<Record<number, ParkingSlot[]>>({});
  const [polling, setPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: cams } = await cameraApi.list();
      setCameras(cams);
      const slotsMap: Record<number, ParkingSlot[]> = {};
      await Promise.all(cams.map(async (cam) => {
        const { data } = await slotApi.list(cam.id);
        slotsMap[cam.id] = data;
      }));
      setSlotsByCamera(slotsMap);
      setLastUpdate(new Date());
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    if (!polling) return;
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [fetchData, polling]);

  const totalSlots = Object.values(slotsByCamera).flat();
  const vehicle = totalSlots.filter((s) => s.state === "VEHICLE").length;
  const empty = totalSlots.filter((s) => s.state === "EMPTY").length;
  const obstructed = totalSlots.filter((s) => s.state === "OBSTRUCTED").length;
  const occupancy = totalSlots.length > 0 ? Math.round((vehicle / totalSlots.length) * 100) : 0;

  const pieData = [
    { name: "Empty", value: empty },
    { name: "Occupied", value: vehicle },
    { name: "Obstructed", value: obstructed },
  ].filter((d) => d.value > 0);

  const cameraOccupancy = cameras.map((cam) => {
    const camSlots = slotsByCamera[cam.id] || [];
    const camVehicle = camSlots.filter((s) => s.state === "VEHICLE").length;
    return { camera: cam, total: camSlots.length, occupied: camVehicle, pct: camSlots.length > 0 ? Math.round((camVehicle / camSlots.length) * 100) : 0 };
  });

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdate && <span style={{ fontSize: 11, color: "#94a3b8" }}>Updated {lastUpdate.toLocaleTimeString()}</span>}
          <button onClick={() => setPolling(!polling)} className={polling ? "btn-secondary" : "btn-secondary"} style={{
            width: 34, height: 34, padding: 0, background: polling ? "#f0fdfa" : "#fff",
            borderColor: polling ? "#99f6e4" : "#cbd5e1", color: polling ? "#0d9488" : "#94a3b8",
          }}>
            {polling ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button onClick={fetchData} className="btn-secondary" style={{ width: 34, height: 34, padding: 0 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { icon: Monitor, color: "#0d9488", bg: "#f0fdfa", label: "Cameras", value: cameras.length, sub: `${cameras.filter((c) => c.status === "ACTIVE").length} active`, subColor: "#059669" },
          { icon: ParkingSquare, color: "#7c3aed", bg: "#f5f3ff", label: "Total Slots", value: totalSlots.length, sub: `${empty} empty · ${vehicle} occupied`, subColor: "#64748b" },
          { icon: Car, color: occupancy > 80 ? "#ef4444" : occupancy > 50 ? "#f59e0b" : "#22c55e", bg: occupancy > 80 ? "#fef2f2" : occupancy > 50 ? "#fffbeb" : "#f0fdf4", label: "Occupancy", value: `${occupancy}%`, sub: null, subColor: "" },
          { icon: Wifi, color: "#059669", bg: "#f0fdf4", label: "MQTT Status", value: "Connected", sub: "Live", subColor: "#059669" },
        ].map(({ icon: Icon, color, bg, label, value, sub, subColor }) => (
          <div key={label} className="stat-card">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon size={20} color={color} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{label}</div>
            {label === "Occupancy" && (
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-bar-fill" style={{ width: `${occupancy}%`, background: color }} />
              </div>
            )}
            {sub && <div style={{ fontSize: 11, color: subColor, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      {totalSlots.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 28 }}>
          {/* Pie Chart */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Slot Distribution</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} slots`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, fontSize: 11, fontWeight: 500 }}>
              {[{ c: "#22c55e", l: "Empty" }, { c: "#ef4444", l: "Occupied" }, { c: "#f59e0b", l: "Obstructed" }].map(({ c, l }) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>
              ))}
            </div>
          </div>

          {/* Camera Occupancy */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Camera Occupancy</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {cameraOccupancy.map(({ camera, total, occupied, pct }) => (
                <div key={camera.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{camera.label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{occupied}/{total} occupied</div>
                  </div>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 40, textAlign: "right", color: pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#059669" }}>{pct}%</span>
                </div>
              ))}
              {cameraOccupancy.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 16 }}>No cameras configured</p>}
            </div>
          </div>
        </div>
      )}

      {/* Live Camera View */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Live Camera View</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
        {cameras.map((cam) => <CameraCard key={cam.id} camera={cam} slots={slotsByCamera[cam.id] || []} />)}
      </div>
      {cameras.length === 0 && (
        <div className="card" style={{ padding: 64, textAlign: "center" }}>
          <Monitor size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>No cameras configured</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Add one from the Cameras page.</div>
        </div>
      )}
    </div>
  );
}
