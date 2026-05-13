import { useState, useEffect, type FormEvent } from "react";
import { cameraApi } from "@/services/api";
import type { Camera } from "@/types";
import { Plus, Camera as CamIcon, Trash2, CameraIcon, Pencil, X, ImageIcon } from "lucide-react";
import { useToast } from "@/components/Toast";

interface CameraForm {
  label: string;
  source: string;
  camera_type: string;
  detection_interval: number;
}

const defaultForm: CameraForm = { label: "", source: "", camera_type: "USB", detection_interval: 30 };

function CameraModal({ camera, onClose, onSave }: { camera?: Camera; onClose: () => void; onSave: (data: CameraForm) => Promise<void> }) {
  const [form, setForm] = useState<CameraForm>(camera ? { label: camera.label, source: camera.source, camera_type: camera.camera_type, detection_interval: camera.detection_interval } : defaultForm);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); } catch {} finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop animate-fade-in" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="modal-card animate-slide-up" style={{ width: 500, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{camera ? "Edit Camera" : "New Camera"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Label</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="CAM-001-L" className="input-field" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Source</label>
            <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="0, rtsp://..., csi://0" className="input-field" required />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>USB: device index (0, 1). RTSP: full URL. CSI: camera index.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Type</label>
              <select value={form.camera_type} onChange={(e) => setForm({ ...form, camera_type: e.target.value })} className="input-field">
                <option value="USB">USB</option><option value="RTSP">RTSP</option><option value="CSI">CSI (RPi Camera)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Detection Interval (s)</label>
              <input type="number" min={5} max={300} value={form.detection_interval} onChange={(e) => setForm({ ...form, detection_interval: Number(e.target.value) })} className="input-field" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ minWidth: 100 }}>
              {saving ? "Saving..." : camera ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CameraCard({ camera, onEdit, onDelete, onCapture }: {
  camera: Camera; onEdit: () => void; onDelete: () => void; onCapture: () => void;
}) {
  const [imgTs, setImgTs] = useState(Date.now());
  // 0 = latest-frame (detection loop), 1 = live-frame (direct capture), 2 = snapshot (static ref)
  const [imgFallback, setImgFallback] = useState(0);

  useEffect(() => {
    const id = setInterval(() => { setImgTs(Date.now()); setImgFallback(0); }, camera.detection_interval * 1000 || 30000);
    return () => clearInterval(id);
  }, [camera.detection_interval]);

  function handleImgError() {
    setImgFallback((prev) => prev + 1);
  }

  const imgSrc = (() => {
    if (imgFallback === 0) return `${cameraApi.latestFrameUrl(camera.id)}?t=${imgTs}`;
    if (imgFallback === 1) return `${cameraApi.liveFrameUrl(camera.id)}?t=${imgTs}`;
    return camera.reference_snapshot_path ? `${cameraApi.snapshotUrl(camera.id)}?t=${imgTs}` : "";
  })();

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Image */}
      <div style={{ height: 200, background: "#f1f5f9", position: "relative" }}>
        {imgSrc ? (
          <img src={imgSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" onError={handleImgError} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
            <CamIcon size={36} color="#cbd5e1" />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>No snapshot yet</span>
          </div>
        )}
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <span className={camera.status === "ACTIVE" ? "badge badge-success" : "badge badge-danger"} style={{ backdropFilter: "blur(4px)" }}>{camera.status}</span>
        </div>
        {camera.frame_width && (
          <div style={{ position: "absolute", bottom: 10, left: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "3px 8px" }}>
              {camera.frame_width}x{camera.frame_height}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{camera.label}</h3>
          <span className={`badge ${camera.camera_type === "CSI" ? "badge-info" : camera.camera_type === "RTSP" ? "badge-info" : "badge-neutral"}`}>{camera.camera_type}</span>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Source: <span style={{ fontFamily: "monospace", color: "#475569" }}>{camera.source}</span></div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Detection interval: {camera.detection_interval}s</div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCapture} className="btn-secondary" style={{ flex: 1 }}>
            <CameraIcon size={13} /> Snapshot
          </button>
          <button onClick={onEdit} className="btn-secondary" style={{ width: 36, padding: 0 }}>
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="btn-danger" style={{ width: 36 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Cameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [modalCamera, setModalCamera] = useState<Camera | null | "new">(null);
  const toast = useToast();

  const fetchCameras = () => cameraApi.list().then(({ data }) => setCameras(data));
  useEffect(() => { fetchCameras(); }, []);

  async function handleSave(data: CameraForm) {
    if (modalCamera === "new") {
      await cameraApi.create(data as unknown as Record<string, unknown>);
      toast.success("Camera created");
    } else if (modalCamera) {
      await cameraApi.update(modalCamera.id, data as unknown as Record<string, unknown>);
      toast.success("Camera updated");
    }
    fetchCameras();
  }

  async function handleDelete(cam: Camera) {
    if (!confirm(`Delete ${cam.label}?`)) return;
    await cameraApi.delete(cam.id);
    toast.success("Camera deleted");
    fetchCameras();
  }

  async function handleCapture(cam: Camera) {
    try {
      await cameraApi.snapshot(cam.id);
      toast.success(`Snapshot captured for ${cam.label}`);
      fetchCameras();
    } catch {
      toast.error("Snapshot failed. Check camera connection.");
    }
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Cameras</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{cameras.length} camera{cameras.length !== 1 ? "s" : ""} configured</p>
        </div>
        <button onClick={() => setModalCamera("new")} className="btn-primary">
          <Plus size={16} /> Add Camera
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {cameras.map((cam) => (
          <CameraCard key={cam.id} camera={cam} onEdit={() => setModalCamera(cam)} onDelete={() => handleDelete(cam)} onCapture={() => handleCapture(cam)} />
        ))}
      </div>

      {cameras.length === 0 && (
        <div className="card" style={{ padding: 64, textAlign: "center" }}>
          <ImageIcon size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>No cameras configured</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Add a camera to start detecting parking slots.</div>
        </div>
      )}

      {modalCamera && (
        <CameraModal camera={modalCamera === "new" ? undefined : modalCamera} onClose={() => setModalCamera(null)} onSave={handleSave} />
      )}
    </div>
  );
}
