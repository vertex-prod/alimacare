-- AlimaCare — Supabase Migration (PostgreSQL)
-- Run this in your Supabase project's SQL Editor

-- Enable extensions
create extension if not exists pgcrypto;

-- Users (staff / reception / doctor)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null default 'ADMIN',
  password_hash text,
  last_login timestamptz,
  created_at timestamptz default now()
);

-- Patients
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  patient_id text unique not null,
  full_name text not null,
  age int not null,
  sex text not null,
  contact_number text not null,
  classification text not null,
  recommended_doctor text,
  appointment_time text,
  service_type text not null,
  registration_datetime timestamptz default now(),
  status text not null default 'PENDING_RECEPTION',
  queue_number text,
  assigned_doctor text,
  assigned_room text,
  patients_ahead int,
  estimated_wait_minutes int,
  called_time timestamptz,
  consultation_start_time timestamptz,
  completed_time timestamptz,
  created_at timestamptz default now()
);

-- Doctors
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialization text not null,
  availability text not null default 'Available',
  assigned_room text,
  active boolean default true,
  email text,
  phone text,
  created_at timestamptz default now()
);

-- Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  availability text not null default 'Available',
  assigned_doctor text,
  created_at timestamptz default now()
);

-- Queue events (audit trail for status changes)
create table if not exists queue_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  queue_number text,
  status text not null,
  timestamp timestamptz default now(),
  performed_by text,
  notes text
);

-- Audit logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text,
  entity_type text,
  entity_id text,
  details jsonb,
  timestamp timestamptz default now()
);

-- Daily exports
create table if not exists daily_exports (
  id uuid primary key default gen_random_uuid(),
  report_date text,
  generated_at timestamptz default now(),
  file_type text,
  status text default 'pending',
  generated_by text,
  file_path text
);

-- Helpful indexes
create index if not exists idx_patients_status on patients(status);
create index if not exists idx_patients_assigned_doctor on patients(assigned_doctor);