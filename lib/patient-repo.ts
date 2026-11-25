import type { PublicPatient, Patient } from "./types";
import { supabase } from "./supabase";

export interface CreatePatientInput {
  patientId?: string;
  fullName: string;
  age: number;
  sex: string;
  contactNumber: string;
  classification: Patient["classification"];
  serviceType: string;
  recommendedDoctor?: string;
  appointmentTime?: string;
  status?: Patient["status"];
  queueNumber?: number;
  assignedDoctor?: string;
  assignedRoom?: string;
  estimatedWaitMinutes?: number;
}

export async function createPatient(
  input: CreatePatientInput
): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert([
      {
        patient_id: input.patientId ?? "PENDING",
        full_name: input.fullName,
        age: input.age,
        sex: input.sex,
        contact_number: input.contactNumber,
        classification: input.classification,
        recommended_doctor: input.recommendedDoctor,
        appointment_time: input.appointmentTime,
        service_type: input.serviceType,
        status: input.status ?? "PENDING_RECEPTION",
        queue_number: input.queueNumber,
        assigned_doctor: input.assignedDoctor,
        assigned_room: input.assignedRoom,
        estimated_wait_minutes: input.estimatedWaitMinutes,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    patientId: data.patient_id,
    fullName: data.full_name,
    age: input.age,
    sex: input.sex,
    contactNumber: input.contactNumber,
    classification: input.classification,
    serviceType: input.serviceType,
    status: (input.status ?? "PENDING_RECEPTION") as Patient["status"],
    queueNumber: data.queue_number ?? undefined,
    assignedRoom: data.assigned_room ?? undefined,
    estimatedWaitMinutes: data.estimated_wait_minutes ?? undefined,
    assignedDoctor: data.assigned_doctor ?? undefined,
    completedTime: data.completed_time ?? undefined,
  };
}

export async function getPendingPatients(): Promise<PublicPatient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("patient_id, full_name, status, queue_number, assigned_room, estimated_wait_minutes, assigned_doctor")
    .eq("status", "PENDING_RECEPTION")
    .order("registration_datetime", { ascending: true });

  if (error) return [];

  return data.map((row) => ({
    patientId: row.patient_id,
    fullName: row.full_name,
    status: row.status as PublicPatient["status"],
    queueNumber: row.queue_number ?? undefined,
    assignedRoom: row.assigned_room ?? undefined,
    estimatedWaitMinutes: row.estimated_wait_minutes ?? undefined,
    assignedDoctor: row.assigned_doctor ?? undefined,
  }));
}

export async function getWaitingPatients(): Promise<PublicPatient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("patient_id, full_name, status, queue_number, assigned_room, estimated_wait_minutes, assigned_doctor")
    .in("status", ["WAITING", "CALLED", "ONGOING"])
    .order("registration_datetime", { ascending: true });

  if (error) return [];

  return data.map((row) => ({
    patientId: row.patient_id,
    fullName: row.full_name,
    status: row.status as PublicPatient["status"],
    queueNumber: row.queue_number ?? undefined,
    assignedRoom: row.assigned_room ?? undefined,
    estimatedWaitMinutes: row.estimated_wait_minutes ?? undefined,
    assignedDoctor: row.assigned_doctor ?? undefined,
  }));
}

export async function getPatientById(patientId: string): Promise<PublicPatient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("patient_id, full_name, status, queue_number, assigned_room, estimated_wait_minutes, assigned_doctor, completed_time, patients_ahead")
    .eq("patient_id", patientId)
    .single();

  if (error || !data) return null;

  return {
    patientId: data.patient_id,
    fullName: data.full_name,
    status: data.status as PublicPatient["status"],
    queueNumber: data.queue_number ?? undefined,
    assignedRoom: data.assigned_room ?? undefined,
    estimatedWaitMinutes: data.estimated_wait_minutes ?? undefined,
    assignedDoctor: data.assigned_doctor ?? undefined,
    completedTime: data.completed_time ?? undefined,
    patientsAhead: data.patients_ahead ?? undefined,
  };
}

export async function updatePatientStatus(
  patientId: string,
  status: PublicPatient["status"],
  updates: { queueNumber?: string; assignedRoom?: string; assignedDoctor?: string } = {}
) {
  const updateData: Record<string, unknown> = { status };

  if (updates.queueNumber !== undefined) updateData.queue_number = updates.queueNumber;
  if (updates.assignedRoom !== undefined) updateData.assigned_room = updates.assignedRoom;
  if (updates.assignedDoctor !== undefined) updateData.assigned_doctor = updates.assignedDoctor;

  const { error } = await supabase
    .from("patients")
    .update(updateData)
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}

export async function archivePatient(
  patientId: string,
  disposition: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "ARCHIVED"
) {
  const { error } = await supabase
    .from("patients")
    .update({ status: disposition, completed_time: new Date().toISOString() })
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}

export async function updatePatientDetails(
  patientId: string,
  details: Partial<Pick<Patient, "queueNumber" | "assignedRoom" | "assignedDoctor" | "estimatedWaitMinutes" | "status">>
) {
  const updateData: Record<string, unknown> = {};

  if (details.queueNumber !== undefined) updateData.queue_number = details.queueNumber;
  if (details.assignedRoom !== undefined) updateData.assigned_room = details.assignedRoom;
  if (details.assignedDoctor !== undefined) updateData.assigned_doctor = details.assignedDoctor;
  if (details.estimatedWaitMinutes !== undefined) updateData.estimated_wait_minutes = details.estimatedWaitMinutes;
  if (details.status !== undefined) updateData.status = details.status;

  const { error } = await supabase
    .from("patients")
    .update(updateData)
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}

export async function approvePatient(
  patientId: string,
  assignedDoctor: string,
  assignedRoom: string
) {
  const { error } = await supabase
    .from("patients")
    .update({
      status: "APPROVED",
      assigned_doctor: assignedDoctor,
      assigned_room: assignedRoom,
    })
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}

export async function callPatient(
  patientId: string,
  performedBy: "doctor" | "reception"
) {
  const { error } = await supabase
    .from("patients")
    .update({
      status: "CALLED",
    })
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}

export async function completeConsultation(
  patientId: string,
  performedBy: "doctor"
) {
  const { error } = await supabase
    .from("patients")
    .update({
      status: "COMPLETED",
      completed_time: new Date().toISOString(),
    })
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}

export async function startConsultation(
  patientId: string,
  performedBy: "doctor"
) {
  const { error } = await supabase
    .from("patients")
    .update({
      status: "ONGOING",
    })
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
}