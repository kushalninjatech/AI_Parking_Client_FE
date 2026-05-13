import axios from "axios";
import type { Camera, ParkingSlot, HealthStatus } from "@/types";

const api = axios.create({ baseURL: "/api/v1" });

export const healthApi = {
  check: () => axios.get<HealthStatus>("/health"),
};

export const cameraApi = {
  list: () => api.get<Camera[]>("/cameras"),
  get: (id: number) => api.get<Camera>(`/cameras/${id}`),
  create: (d: Record<string, unknown>) => api.post<Camera>("/cameras", d),
  update: (id: number, d: Record<string, unknown>) => api.patch<Camera>(`/cameras/${id}`, d),
  delete: (id: number) => api.delete(`/cameras/${id}`),
  snapshot: (id: number) => api.post(`/cameras/${id}/snapshot`),
  snapshotUrl: (id: number) => `/api/v1/cameras/${id}/snapshot`,
  latestFrameUrl: (id: number) => `/api/v1/cameras/${id}/latest-frame`,
  liveFrameUrl: (id: number) => `/api/v1/cameras/${id}/live-frame`,
};

export const slotApi = {
  list: (cameraId?: number) => api.get<ParkingSlot[]>(`/slots${cameraId ? `?camera_id=${cameraId}` : ""}`),
  get: (id: number) => api.get<ParkingSlot>(`/slots/${id}`),
  create: (d: Record<string, unknown>) => api.post<ParkingSlot>("/slots", d),
  update: (id: number, d: Record<string, unknown>) => api.patch<ParkingSlot>(`/slots/${id}`, d),
  delete: (id: number) => api.delete(`/slots/${id}`),
  calibrate: (id: number) => api.post(`/slots/${id}/calibrate`),
};

export default api;
