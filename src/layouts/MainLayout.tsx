import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Camera, ParkingSquare, Settings, Crosshair, ChevronRight } from "lucide-react";
import { healthApi } from "@/services/api";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cameras", label: "Cameras", icon: Camera },
  { to: "/zones", label: "Parking Zones", icon: ParkingSquare },
  { to: "/calibration", label: "Calibration", icon: Crosshair },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function MainLayout() {
  const [deviceId, setDeviceId] = useState("...");
  const [online, setOnline] = useState(false);

  useEffect(() => {
    healthApi.check()
      .then(({ data }) => { setDeviceId(data.device_id); setOnline(data.status === "healthy"); })
      .catch(() => setOnline(false));
  }, []);

  return (
    <div className="flex min-h-screen" style={{ background: "#f1f5f9" }}>
      <aside style={{ width: 240, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Logo */}
        <div style={{ padding: "0 20px", height: 60, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #0f766e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(13,148,136,0.3)" }}>
            <ParkingSquare size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>AI Parking</div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 2 }}>Edge Device</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl transition-all duration-200 ${isActive ? "" : ""}`
            } style={({ isActive }) => ({
              padding: "10px 12px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              background: isActive ? "#f0fdfa" : "transparent",
              color: isActive ? "#0f766e" : "#64748b",
              border: isActive ? "1px solid #ccfbf1" : "1px solid transparent",
            })}>
              {({ isActive }) => (
                <>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "#0d9488" : "#f1f5f9",
                    color: isActive ? "#fff" : "#94a3b8",
                    boxShadow: isActive ? "0 2px 6px rgba(13,148,136,0.3)" : "none",
                  }}><Icon size={14} strokeWidth={2} /></div>
                  <span style={{ flex: 1 }}>{label}</span>
                  {isActive && <ChevronRight size={14} color="#14b8a6" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#22c55e" : "#ef4444", boxShadow: online ? "0 0 8px rgba(34,197,94,0.5)" : "none" }} />
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{deviceId} · {online ? "Online" : "Offline"}</span>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
