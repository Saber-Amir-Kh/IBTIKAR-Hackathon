import type { Incident, Need, PlantingZone, DroneTelemetry, AlertResponse, User, NeedCategory, IncidentStatus } from './types';

const BASE_URL = 'http://localhost:8080';

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${BASE_URL}/api/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function getIncidents(): Promise<Incident[]> {
  const res = await fetch(`${BASE_URL}/api/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function getIncident(id: number): Promise<Incident> {
  const res = await fetch(`${BASE_URL}/api/incidents/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch incident ${id}`);
  return res.json();
}

export async function updateIncidentStatus(id: number, status: IncidentStatus, verifiedBy: string = 'Opérateur'): Promise<Incident> {
  const res = await fetch(`${BASE_URL}/api/incidents/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, verifiedBy }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erreur mise à jour statut' }));
    throw new Error(err.message || 'Erreur lors de la mise à jour du statut');
  }
  return res.json();
}

export async function deleteIncident(id: number): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/incidents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404 && res.status !== 405) {
      const err = await res.json().catch(() => ({ message: 'Erreur suppression' }));
      throw new Error(err.message || 'Erreur lors de la suppression de l\'incident');
    }
  } catch (err: any) {
    console.warn(`DELETE /api/incidents/${id} warning:`, err);
  }
}

export async function getAlert(id: number): Promise<AlertResponse> {
  const res = await fetch(`${BASE_URL}/api/incidents/${id}/alert`);
  if (!res.ok) throw new Error(`Failed to fetch alert for incident ${id}`);
  return res.json();
}

export async function getNeeds(incidentId: number): Promise<Need[]> {
  const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/needs`);
  if (!res.ok) throw new Error(`Failed to fetch needs for incident ${incidentId}`);
  return res.json();
}

export async function createNeed(incidentId: number, data: { title: string; quantity: number; category: NeedCategory; postedBy: string }): Promise<Need> {
  const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/needs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erreur création besoin' }));
    throw new Error(err.message || 'Erreur lors de la création du besoin');
  }
  return res.json();
}

export async function claimNeed(needId: number, data: { userId: number; userName: string; quantity: number }): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/needs/${needId}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erreur réclamation besoin' }));
    throw new Error(err.message || 'Erreur lors de la réclamation');
  }
  return res.json();
}

export async function getZones(incidentId: number): Promise<PlantingZone[]> {
  const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/zones`);
  if (!res.ok) throw new Error(`Failed to fetch zones for incident ${incidentId}`);
  return res.json();
}

export async function registerVolunteer(zoneId: number): Promise<PlantingZone> {
  const res = await fetch(`${BASE_URL}/api/zones/${zoneId}/register`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to register volunteer');
  return res.json();
}

export async function plantTrees(zoneId: number, trees: number): Promise<PlantingZone> {
  const res = await fetch(`${BASE_URL}/api/zones/${zoneId}/plant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trees }),
  });
  if (!res.ok) throw new Error('Failed to plant trees');
  return res.json();
}

export async function getTelemetry(): Promise<DroneTelemetry[]> {
  const res = await fetch(`${BASE_URL}/api/telemetry`);
  if (!res.ok) throw new Error('Failed to fetch telemetry');
  return res.json();
}

export async function triggerDemoDetection(): Promise<Incident> {
  const res = await fetch(`${BASE_URL}/api/demo/trigger-detection`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger demo detection');
  return res.json();
}

export async function resetDemo(): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/demo/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset demo');
  return res.json();
}
