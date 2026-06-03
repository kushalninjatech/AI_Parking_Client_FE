export interface Camera {
  id: number;
  label: string;
  source: string;
  camera_type: "USB" | "RTSP" | "CSI";
  status: "ACTIVE" | "INACTIVE" | "FAILED";
  detection_interval: number;
  is_active: boolean;
  worker_running: boolean;
  frame_width: number | null;
  frame_height: number | null;
  reference_snapshot_path: string | null;
}

export interface ParkingSlot {
  id: number;
  label: string;
  camera_id: number;
  state: "VEHICLE" | "EMPTY" | "OBSTRUCTED";
  slot_type: "CAR" | "TWO_WHEELER" | "GENERAL";
  detected_vehicle_type: "CAR" | "TWO_WHEELER" | null;
  capacity_car: number;
  capacity_two_wheeler: number;
  occupied_car: number;
  occupied_two_wheeler: number;
  polygon_coords: string | null;
  pos_x1: number | null;
  pos_y1: number | null;
  pos_x2: number | null;
  pos_y2: number | null;
}

export interface HealthStatus {
  status: string;
  device_id: string;
}
