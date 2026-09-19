export type UserRole = 'COORDINATOR' | 'COMMITTEE_HEAD' | 'VOLUNTEER' | 'ECO_CLUB';

export interface User {
  id: number;
  name: string;
  role: UserRole;
}

export type IncidentStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISMISSED' | 'CONTAINED' | 'REFORESTATION';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Incident {
  id: number;
  droneId: string;
  lat: number;
  lon: number;
  confidence: number;
  label: string;
  snapshotUrl: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export type NeedCategory = 'WATER' | 'TOOLS' | 'SAFETY' | 'TRANSPORT' | 'OTHER';
export type NeedStatus = 'OPEN' | 'FULFILLED';

export interface Need {
  id: number;
  incidentId: number;
  title: string;
  quantity: number;
  quantityClaimed: number;
  category: NeedCategory;
  postedBy: string;
  status: NeedStatus;
}

export interface Claim {
  id: number;
  needId: number;
  userId: number;
  userName: string;
  quantity: number;
  createdAt: string;
}

export type ZoneStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';

export interface PlantingZone {
  id: number;
  incidentId: number;
  name: string;
  polygonGeoJson: string;
  targetTrees: number;
  registeredVolunteers: number;
  treesPlanted: number;
  status: ZoneStatus;
}

export interface DroneTelemetry {
  droneId: string;
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  battery: number;
  heading: number;
  status: string;
}

export interface AlertResponse {
  incidentId: number;
  titleFr: string;
  titleAr: string;
  location: string;
  severityFr: string;
  severityAr: string;
  timestamp: string;
  committeeFr: string;
  committeeAr: string;
  safeObjectivesFr: string[];
  safeObjectivesAr: string[];
  rawBroadcastFr: string;
  rawBroadcastAr: string;
}

export interface WsMessage {
  type: string;
  payload: any;
}

export interface EventLogItem {
  id: string;
  time: string;
  type: string;
  text: string;
}
