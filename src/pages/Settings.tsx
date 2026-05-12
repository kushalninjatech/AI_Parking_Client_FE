import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Wifi, Cpu, Timer, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { healthApi, cameraApi } from "@/services/api";
import type { Camera } from "@/types";

function InfoCard({ icon: Icon, title, items, statusOk }: {
  icon: React.ElementType; title: string;
  items: { l: string; v: string }[];
  statusOk?: boolean | null;
}) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f0fdfa", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color="#0d9488" />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", flex: 1 }}>{title}</h2>
        {statusOk === true && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#059669", fontWeight: 600 }}><CheckCircle size={14} /> Connected</span>}
        {statusOk === false && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#ef4444", fontWeight: 600 }}><AlertCircle size={14} /> Offline</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {items.map(({ l, v }) => (
          <div key={l}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const [deviceId, setDeviceId] = useState("...");
  const [healthStatus, setHealthStatus] = useState<boolean | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    setLoading(true);
    try {
      const [healthRes, camerasRes] = await Promise.all([healthApi.check(), cameraApi.list()]);
      setDeviceId(healthRes.data.device_id);
      setHealthStatus(healthRes.data.status === "healthy");
      setCameras(camerasRes.data);
    } catch {
      setHealthStatus(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  const activeCameras = cameras.filter((c) => c.status === "ACTIVE").length;
  const intervals = cameras.map((c) => c.detection_interval);
  const avgInterval = intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 30;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Settings</h1>
        <button onClick={fetchStatus} disabled={loading} className="btn-secondary" style={{ width: 36, padding: 0 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <InfoCard icon={SettingsIcon} title="Device Info" statusOk={healthStatus} items={[
          { l: "Device ID", v: deviceId },
          { l: "Status", v: healthStatus ? "Online" : healthStatus === false ? "Offline" : "..." },
          { l: "Cameras", v: `${activeCameras}/${cameras.length} active` },
          { l: "API Port", v: "8300" },
        ]} />
        <InfoCard icon={Wifi} title="MQTT Connection" items={[
          { l: "Broker", v: "15.235.50.88" },
          { l: "Port", v: "41883" },
          { l: "Status", v: "Connected" },
          { l: "Topic Prefix", v: `parking/+/${deviceId}` },
        ]} />
        <InfoCard icon={Cpu} title="Detection Models" items={[
          { l: "YOLO Model", v: "yolo26n (NCNN)" },
          { l: "YOLO Confidence", v: "0.15" },
          { l: "Depth Model", v: "depth-anything-v2-small" },
          { l: "Depth Input", v: "384px" },
        ]} />
        <InfoCard icon={Timer} title="Detection Settings" items={[
          { l: "Avg Interval", v: `${avgInterval} seconds` },
          { l: "Vehicle Classes", v: "car, motorcycle, bus, truck" },
          { l: "Camera Types", v: [...new Set(cameras.map((c) => c.camera_type))].join(", ") || "None" },
          { l: "Total Cameras", v: String(cameras.length) },
        ]} />
      </div>
    </div>
  );
}
