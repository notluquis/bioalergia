--
-- PostgreSQL database dump
--

-- removed psql metacommand: \restrict

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: personal; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS personal;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: AttachmentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttachmentType" AS ENUM (
    'CONSENT',
    'EXAM',
    'RECIPE',
    'OTHER'
);


--
-- Name: BudgetStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BudgetStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED'
);


--
-- Name: ClinicalSeriesKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClinicalSeriesKind" AS ENUM (
    'PATCH_TEST',
    'SKIN_TEST',
    'SUBCUTANEOUS_TREATMENT'
);


--
-- Name: ClinicalSeriesStageKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClinicalSeriesStageKind" AS ENUM (
    'INSTALLATION',
    'READING',
    'DOSE',
    'MAINTENANCE'
);


--
-- Name: ClinicalSeriesStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClinicalSeriesStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: CompensationAllocationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CompensationAllocationType" AS ENUM (
    'ORIGINAL',
    'ROLLOVER_OUT',
    'ROLLOVER_IN',
    'MANUAL_ADJUST'
);


--
-- Name: CounterpartCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CounterpartCategory" AS ENUM (
    'SUPPLIER',
    'CLIENT',
    'EMPLOYEE',
    'PARTNER',
    'LENDER',
    'OTHER',
    'PERSONAL_EXPENSE'
);


--
-- Name: DTEType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DTEType" AS ENUM (
    'PURCHASE',
    'SALE'
);


--
-- Name: EmployeeSalaryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmployeeSalaryType" AS ENUM (
    'HOURLY',
    'FIXED'
);


--
-- Name: EmployeeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmployeeStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'TERMINATED'
);


--
-- Name: LoanBorrowerType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoanBorrowerType" AS ENUM (
    'PERSON',
    'COMPANY'
);


--
-- Name: LoanFrequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoanFrequency" AS ENUM (
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY'
);


--
-- Name: LoanInterestType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoanInterestType" AS ENUM (
    'SIMPLE',
    'COMPOUND'
);


--
-- Name: LoanScheduleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoanScheduleStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'OVERDUE',
    'SKIPPED'
);


--
-- Name: LoanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoanStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'DEFAULTED'
);


--
-- Name: PersonType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PersonType" AS ENUM (
    'NATURAL',
    'JURIDICAL'
);


--
-- Name: ServiceAmountIndexation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceAmountIndexation" AS ENUM (
    'NONE',
    'UF'
);


--
-- Name: ServiceEmissionMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceEmissionMode" AS ENUM (
    'FIXED_DAY',
    'DATE_RANGE',
    'SPECIFIC_DATE'
);


--
-- Name: ServiceFrequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceFrequency" AS ENUM (
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY',
    'BIMONTHLY',
    'QUARTERLY',
    'SEMIANNUAL',
    'ANNUAL',
    'ONCE'
);


--
-- Name: ServiceLateFeeMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceLateFeeMode" AS ENUM (
    'NONE',
    'FIXED',
    'PERCENTAGE'
);


--
-- Name: ServiceObligationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceObligationType" AS ENUM (
    'SERVICE',
    'DEBT',
    'LOAN',
    'OTHER'
);


--
-- Name: ServiceOwnership; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceOwnership" AS ENUM (
    'COMPANY',
    'OWNER',
    'MIXED',
    'THIRD_PARTY'
);


--
-- Name: ServiceRecurrenceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceRecurrenceType" AS ENUM (
    'RECURRING',
    'ONE_OFF'
);


--
-- Name: ServiceScheduleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceScheduleStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'SKIPPED'
);


--
-- Name: ServiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);


--
-- Name: ServiceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceType" AS ENUM (
    'BUSINESS',
    'PERSONAL',
    'SUPPLIER',
    'TAX',
    'UTILITY',
    'LEASE',
    'SOFTWARE',
    'OTHER'
);


--
-- Name: TransactionDirection; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TransactionDirection" AS ENUM (
    'IN',
    'OUT',
    'NEUTRO'
);


--
-- Name: TransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TransactionType" AS ENUM (
    'INCOME',
    'EXPENSE'
);


--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserStatus" AS ENUM (
    'PENDING_SETUP',
    'ACTIVE',
    'SUSPENDED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: credit_installments; Type: TABLE; Schema: personal; Owner: -
--

CREATE TABLE personal.credit_installments (
    id integer NOT NULL,
    credit_id integer NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    capital_amount numeric(15,2),
    interest_amount numeric(15,2),
    other_charges numeric(15,2),
    status text DEFAULT 'PENDING'::text NOT NULL,
    paid_at timestamp(3) without time zone,
    paid_amount numeric(15,2),
    paid_amount_clp numeric(15,2)
);


--
-- Name: credit_installments_id_seq; Type: SEQUENCE; Schema: personal; Owner: -
--

CREATE SEQUENCE personal.credit_installments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_installments_id_seq; Type: SEQUENCE OWNED BY; Schema: personal; Owner: -
--

ALTER SEQUENCE personal.credit_installments_id_seq OWNED BY personal.credit_installments.id;


--
-- Name: credits; Type: TABLE; Schema: personal; Owner: -
--

CREATE TABLE personal.credits (
    id integer NOT NULL,
    bank_name text NOT NULL,
    credit_number text NOT NULL,
    description text,
    total_amount numeric(15,2) NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    interest_rate numeric(5,2),
    start_date date NOT NULL,
    total_installments integer NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: credits_id_seq; Type: SEQUENCE; Schema: personal; Owner: -
--

CREATE SEQUENCE personal.credits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credits_id_seq; Type: SEQUENCE OWNED BY; Schema: personal; Owner: -
--

ALTER SEQUENCE personal.credits_id_seq OWNED BY personal.credits.id;


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_logs (
    id text NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    level text NOT NULL,
    message text NOT NULL,
    context jsonb,
    job_id text
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    title text NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    discount numeric(15,2) DEFAULT 0 NOT NULL,
    final_amount numeric(15,2) NOT NULL,
    status public."BudgetStatus" DEFAULT 'DRAFT'::public."BudgetStatus" NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: calendar_sync_log_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_sync_log_entries (
    id integer NOT NULL,
    sync_log_id integer NOT NULL,
    message text,
    severity text DEFAULT 'info'::text NOT NULL,
    attributes jsonb,
    tags jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: calendar_sync_log_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_sync_log_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_sync_log_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_sync_log_entries_id_seq OWNED BY public.calendar_sync_log_entries.id;


--
-- Name: calendar_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_sync_logs (
    id integer NOT NULL,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp(3) without time zone,
    status text DEFAULT 'PENDING'::text NOT NULL,
    events_synced integer DEFAULT 0 NOT NULL,
    error_message text,
    trigger_source text,
    trigger_user_id integer,
    trigger_label text,
    fetched_at timestamp(3) without time zone,
    inserted integer DEFAULT 0,
    updated integer DEFAULT 0,
    skipped integer DEFAULT 0,
    excluded integer DEFAULT 0,
    change_details jsonb
);


--
-- Name: calendar_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_sync_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_sync_logs_id_seq OWNED BY public.calendar_sync_logs.id;


--
-- Name: calendar_watch_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_watch_channels (
    id integer NOT NULL,
    calendar_id integer NOT NULL,
    channel_id text NOT NULL,
    resource_id text NOT NULL,
    expiration timestamp(3) without time zone NOT NULL,
    webhook_url text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: calendar_watch_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_watch_channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_watch_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_watch_channels_id_seq OWNED BY public.calendar_watch_channels.id;


--
-- Name: calendars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendars (
    id integer NOT NULL,
    google_id text NOT NULL,
    name text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_token text
);


--
-- Name: calendars_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendars_id_seq OWNED BY public.calendars.id;


--
-- Name: clinical_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_series (
    id integer NOT NULL,
    kind public."ClinicalSeriesKind" NOT NULL,
    status public."ClinicalSeriesStatus" DEFAULT 'ACTIVE'::public."ClinicalSeriesStatus" NOT NULL,
    display_name text,
    patient_name text,
    patient_rut text,
    expected_sessions integer,
    notes text,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: clinical_series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clinical_series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinical_series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clinical_series_id_seq OWNED BY public.clinical_series.id;


--
-- Name: common_supplies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.common_supplies (
    id integer NOT NULL,
    name text NOT NULL,
    brand text,
    model text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: common_supplies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.common_supplies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: common_supplies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.common_supplies_id_seq OWNED BY public.common_supplies.id;


--
-- Name: compensation_period_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compensation_period_budgets (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    period character varying(7) NOT NULL,
    base_amount numeric(19,4) NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT compensation_period_budgets_period_format_chk CHECK (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text))
);


--
-- Name: compensation_period_budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compensation_period_budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compensation_period_budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compensation_period_budgets_id_seq OWNED BY public.compensation_period_budgets.id;


--
-- Name: compensation_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compensation_profiles (
    id integer NOT NULL,
    name text NOT NULL,
    category_id integer NOT NULL,
    counterpart_id integer,
    is_active boolean DEFAULT true NOT NULL,
    timezone text DEFAULT 'America/Santiago'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: compensation_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compensation_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compensation_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compensation_profiles_id_seq OWNED BY public.compensation_profiles.id;


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultations (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    event_id integer,
    date date NOT NULL,
    reason text NOT NULL,
    diagnosis text,
    treatment text,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: consultations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consultations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consultations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consultations_id_seq OWNED BY public.consultations.id;


--
-- Name: counterpart_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counterpart_accounts (
    id integer NOT NULL,
    counterpart_id integer NOT NULL,
    bank_name text,
    account_type text,
    account_number text NOT NULL
);


--
-- Name: counterpart_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.counterpart_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: counterpart_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.counterpart_accounts_id_seq OWNED BY public.counterpart_accounts.id;


--
-- Name: counterparts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counterparts (
    id integer NOT NULL,
    category public."CounterpartCategory" DEFAULT 'SUPPLIER'::public."CounterpartCategory" NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bank_account_holder character varying(255) NOT NULL,
    identification_number character varying(50) NOT NULL
);


--
-- Name: counterparts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.counterparts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: counterparts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.counterparts_id_seq OWNED BY public.counterparts.id;


--
-- Name: daily_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_balances (
    id integer NOT NULL,
    date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    note text,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: daily_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_balances_id_seq OWNED BY public.daily_balances.id;


--
-- Name: daily_production_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_production_balances (
    id integer NOT NULL,
    balance_date date NOT NULL,
    ingreso_tarjetas integer DEFAULT 0 NOT NULL,
    ingreso_transferencias integer DEFAULT 0 NOT NULL,
    ingreso_efectivo integer DEFAULT 0 NOT NULL,
    gastos_diarios integer DEFAULT 0 NOT NULL,
    otros_abonos integer DEFAULT 0 NOT NULL,
    comentarios text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    change_reason text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    consultas_monto integer DEFAULT 0 NOT NULL,
    controles_monto integer DEFAULT 0 NOT NULL,
    licencias_monto integer DEFAULT 0 NOT NULL,
    roxair_monto integer DEFAULT 0 NOT NULL,
    tests_monto integer DEFAULT 0 NOT NULL,
    vacunas_monto integer DEFAULT 0 NOT NULL
);


--
-- Name: daily_production_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_production_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_production_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_production_balances_id_seq OWNED BY public.daily_production_balances.id;


--
-- Name: doctoralia_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_addresses (
    id integer NOT NULL,
    doctor_id integer NOT NULL,
    external_id text NOT NULL,
    name text,
    city_name text,
    post_code text,
    street text,
    online_only boolean DEFAULT false NOT NULL,
    calendar_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_addresses_id_seq OWNED BY public.doctoralia_addresses.id;


--
-- Name: doctoralia_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_bookings (
    id integer NOT NULL,
    address_id integer NOT NULL,
    external_id text NOT NULL,
    status text DEFAULT 'booked'::text NOT NULL,
    start_at timestamp(3) without time zone NOT NULL,
    end_at timestamp(3) without time zone NOT NULL,
    duration integer NOT NULL,
    booked_by text,
    booked_at timestamp(3) without time zone,
    canceled_by text,
    canceled_at timestamp(3) without time zone,
    patient_name text,
    patient_surname text,
    patient_email text,
    patient_phone text,
    comment text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_bookings_id_seq OWNED BY public.doctoralia_bookings.id;


--
-- Name: doctoralia_calendar_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_calendar_appointments (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    external_id integer NOT NULL,
    title text NOT NULL,
    start_at timestamp(3) without time zone NOT NULL,
    end_at timestamp(3) without time zone NOT NULL,
    is_block boolean DEFAULT false NOT NULL,
    event_type integer NOT NULL,
    scheduled_by integer NOT NULL,
    status integer NOT NULL,
    has_patient boolean NOT NULL,
    has_waiting_room boolean,
    insurance_id integer,
    insurance_name text,
    comments text,
    service_id integer NOT NULL,
    service_name text NOT NULL,
    event_services jsonb,
    service_color_schema_id integer NOT NULL,
    service_is_deleted boolean DEFAULT false NOT NULL,
    attendance integer DEFAULT 0 NOT NULL,
    patient_external_id integer NOT NULL,
    patient_reference_id text NOT NULL,
    patient_phone text,
    patient_email text,
    patient_birth_date timestamp(3) without time zone,
    patient_arrival_time timestamp(3) without time zone,
    is_patient_first_time boolean DEFAULT false NOT NULL,
    is_patient_first_admin_booking boolean DEFAULT false NOT NULL,
    is_booked_via_secretary_ai boolean DEFAULT false NOT NULL,
    online_payment_type text,
    online_payment_status text,
    is_paid_online boolean DEFAULT false NOT NULL,
    communication_channel text,
    fake boolean DEFAULT false NOT NULL,
    is_event_with_voucher boolean DEFAULT false NOT NULL,
    duration integer NOT NULL,
    can_notify_patient boolean NOT NULL,
    no_show_protection boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_calendar_appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_calendar_appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_calendar_appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_calendar_appointments_id_seq OWNED BY public.doctoralia_calendar_appointments.id;


--
-- Name: doctoralia_calendar_breaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_calendar_breaks (
    id integer NOT NULL,
    address_id integer NOT NULL,
    external_id text NOT NULL,
    since timestamp(3) without time zone NOT NULL,
    till timestamp(3) without time zone NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_calendar_breaks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_calendar_breaks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_calendar_breaks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_calendar_breaks_id_seq OWNED BY public.doctoralia_calendar_breaks.id;


--
-- Name: doctoralia_calendar_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_calendar_sync_logs (
    id integer NOT NULL,
    trigger_source text,
    trigger_user_id integer,
    status text DEFAULT 'PENDING'::text NOT NULL,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp(3) without time zone,
    schedules_synced integer DEFAULT 0 NOT NULL,
    appointments_synced integer DEFAULT 0 NOT NULL,
    work_periods_synced integer DEFAULT 0 NOT NULL,
    error_message text
);


--
-- Name: doctoralia_calendar_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_calendar_sync_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_calendar_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_calendar_sync_logs_id_seq OWNED BY public.doctoralia_calendar_sync_logs.id;


--
-- Name: doctoralia_doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_doctors (
    id integer NOT NULL,
    facility_id integer NOT NULL,
    external_id text NOT NULL,
    name text NOT NULL,
    surname text NOT NULL,
    profile_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_doctors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_doctors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_doctors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_doctors_id_seq OWNED BY public.doctoralia_doctors.id;


--
-- Name: doctoralia_facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_facilities (
    id integer NOT NULL,
    external_id text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_facilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_facilities_id_seq OWNED BY public.doctoralia_facilities.id;


--
-- Name: doctoralia_insurance_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_insurance_providers (
    id integer NOT NULL,
    address_id integer NOT NULL,
    insurance_provider_id text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_insurance_providers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_insurance_providers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_insurance_providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_insurance_providers_id_seq OWNED BY public.doctoralia_insurance_providers.id;


--
-- Name: doctoralia_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_schedules (
    id integer NOT NULL,
    external_id integer NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    facility_id integer,
    speciality_id integer,
    doctor_id integer,
    province_id integer,
    city_id integer,
    has_waiting_room boolean,
    schedule_type integer DEFAULT 0 NOT NULL,
    color_schema_id integer,
    is_virtual boolean DEFAULT false NOT NULL,
    patients_notification_type integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_schedules_id_seq OWNED BY public.doctoralia_schedules.id;


--
-- Name: doctoralia_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_services (
    id integer NOT NULL,
    address_id integer NOT NULL,
    external_id text NOT NULL,
    service_id text,
    name text NOT NULL,
    price integer,
    is_price_from boolean DEFAULT false NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    description text,
    default_duration integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_services_id_seq OWNED BY public.doctoralia_services.id;


--
-- Name: doctoralia_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_slots (
    id integer NOT NULL,
    address_id integer NOT NULL,
    start_at timestamp(3) without time zone NOT NULL,
    end_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_slots_id_seq OWNED BY public.doctoralia_slots.id;


--
-- Name: doctoralia_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_sync_logs (
    id integer NOT NULL,
    trigger_source text,
    trigger_user_id integer,
    status text DEFAULT 'PENDING'::text NOT NULL,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp(3) without time zone,
    facilities_synced integer DEFAULT 0 NOT NULL,
    doctors_synced integer DEFAULT 0 NOT NULL,
    slots_synced integer DEFAULT 0 NOT NULL,
    bookings_synced integer DEFAULT 0 NOT NULL,
    error_message text
);


--
-- Name: doctoralia_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_sync_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_sync_logs_id_seq OWNED BY public.doctoralia_sync_logs.id;


--
-- Name: doctoralia_work_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctoralia_work_periods (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    start_at timestamp(3) without time zone NOT NULL,
    end_at timestamp(3) without time zone NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: doctoralia_work_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctoralia_work_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctoralia_work_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctoralia_work_periods_id_seq OWNED BY public.doctoralia_work_periods.id;


--
-- Name: dte_purchase_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dte_purchase_details (
    id text NOT NULL,
    period character varying(6),
    register_number integer NOT NULL,
    document_type integer DEFAULT 33 NOT NULL,
    purchase_type text NOT NULL,
    provider_rut character varying(20) NOT NULL,
    provider_name text NOT NULL,
    folio character varying(20) NOT NULL,
    document_date date NOT NULL,
    receipt_date date NOT NULL,
    acknowledge_date date,
    exempt_amount numeric(15,2) DEFAULT 0 NOT NULL,
    net_amount numeric(15,2) DEFAULT 0 NOT NULL,
    recoverable_iva numeric(15,2) DEFAULT 0 NOT NULL,
    non_recoverable_iva numeric(15,2) DEFAULT 0 NOT NULL,
    non_recoverable_iva_code character varying(10),
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    fixed_asset_net_amount numeric(15,2) DEFAULT 0 NOT NULL,
    common_use_iva numeric(15,2) DEFAULT 0 NOT NULL,
    non_creditable_tax numeric(15,2) DEFAULT 0 NOT NULL,
    non_retained_iva numeric(15,2) DEFAULT 0 NOT NULL,
    pure_tobacco numeric(15,2) DEFAULT 0 NOT NULL,
    cigarette_tobacco numeric(15,2) DEFAULT 0 NOT NULL,
    elaborated_tobacco numeric(15,2) DEFAULT 0 NOT NULL,
    other_tax_code character varying(10),
    other_tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    other_tax_rate numeric(5,2),
    reference_doc_note text,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: dte_sale_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dte_sale_details (
    id text NOT NULL,
    period character varying(6),
    register_number integer NOT NULL,
    document_type integer NOT NULL,
    sale_type text NOT NULL,
    client_rut character varying(20) NOT NULL,
    client_name text NOT NULL,
    folio character varying(20) NOT NULL,
    document_date date NOT NULL,
    receipt_date date NOT NULL,
    receipt_acknowledge_date date,
    claim_date date,
    exempt_amount numeric(15,2) DEFAULT 0 NOT NULL,
    net_amount numeric(15,2) DEFAULT 0 NOT NULL,
    iva_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total_retained_iva numeric(15,2) DEFAULT 0 NOT NULL,
    partial_retained_iva numeric(15,2) DEFAULT 0 NOT NULL,
    non_retained_iva numeric(15,2) DEFAULT 0 NOT NULL,
    own_iva numeric(15,2) DEFAULT 0 NOT NULL,
    third_party_iva numeric(15,2) DEFAULT 0 NOT NULL,
    late_iva numeric(15,2) DEFAULT 0 NOT NULL,
    emitter_rut character varying(20),
    commission_net_amount numeric(15,2) DEFAULT 0 NOT NULL,
    commission_exempt_amount numeric(15,2) DEFAULT 0 NOT NULL,
    commission_iva numeric(15,2) DEFAULT 0 NOT NULL,
    reference_doc_type character varying(10),
    reference_doc_folio character varying(20),
    foreign_buyer_identifier character varying(20),
    foreign_buyer_nationality character varying(50),
    constructor_credit_amount numeric(15,2) DEFAULT 0 NOT NULL,
    free_trade_zone_amount numeric(15,2) DEFAULT 0 NOT NULL,
    container_guarantee_amount numeric(15,2) DEFAULT 0 NOT NULL,
    non_billable_amount numeric(15,2) DEFAULT 0 NOT NULL,
    international_transport_amount numeric(15,2) DEFAULT 0 NOT NULL,
    internal_number integer,
    branch_code character varying(20),
    origin character varying(20),
    informative_note text,
    payment_note text,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    national_transport_passage_amount numeric(15,2) DEFAULT 0 NOT NULL,
    non_cost_sale_indicator integer DEFAULT 0 NOT NULL,
    periodic_service_indicator integer DEFAULT 0 NOT NULL,
    total_period_amount numeric(15,2) DEFAULT 0 NOT NULL
);


--
-- Name: dte_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dte_sync_logs (
    id text NOT NULL,
    period character varying(6) NOT NULL,
    "docTypes" character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    total_processed integer DEFAULT 0 NOT NULL,
    total_inserted integer DEFAULT 0 NOT NULL,
    total_updated integer DEFAULT 0 NOT NULL,
    total_skipped integer DEFAULT 0 NOT NULL,
    sales_inserted integer DEFAULT 0 NOT NULL,
    purchases_inserted integer DEFAULT 0 NOT NULL,
    error_message text,
    "triggerSource" character varying(20),
    trigger_user_id text,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone
);


--
-- Name: employee_timesheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_timesheets (
    id bigint NOT NULL,
    employee_id integer NOT NULL,
    work_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    worked_minutes integer NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    comment text
);


--
-- Name: employee_timesheets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_timesheets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_timesheets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_timesheets_id_seq OWNED BY public.employee_timesheets.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    person_id integer NOT NULL,
    "position" text NOT NULL,
    department text,
    start_date date NOT NULL,
    end_date date,
    status public."EmployeeStatus" DEFAULT 'ACTIVE'::public."EmployeeStatus" NOT NULL,
    salary_type public."EmployeeSalaryType" DEFAULT 'FIXED'::public."EmployeeSalaryType" NOT NULL,
    base_salary numeric(12,2) DEFAULT 0 NOT NULL,
    hourly_rate numeric(10,2),
    bank_name text,
    bank_account_type text,
    bank_account_number text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb,
    overtime_rate numeric(10,2),
    retention_rate numeric(5,4) DEFAULT 0.145 NOT NULL
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    calendar_id integer NOT NULL,
    external_event_id text NOT NULL,
    event_status text,
    event_type text,
    summary text,
    description text,
    start_date date,
    start_date_time timestamp(3) without time zone,
    start_time_zone text,
    end_date date,
    end_date_time timestamp(3) without time zone,
    end_time_zone text,
    event_created_at timestamp(3) without time zone,
    event_updated_at timestamp(3) without time zone,
    color_id text,
    location text,
    transparency text,
    dosage_unit text,
    dosage_value double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    amount_expected integer,
    amount_paid integer,
    attended boolean,
    category text,
    control_included boolean DEFAULT false NOT NULL,
    hangout_link text,
    is_domicilio boolean DEFAULT false NOT NULL,
    last_synced_at timestamp(3) without time zone,
    raw_event jsonb,
    treatment_stage text,
    visibility text,
    test_metadata jsonb,
    clinical_series_id integer,
    series_stage_kind public."ClinicalSeriesStageKind",
    series_stage_number integer,
    series_stage_label text
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: financial_auto_category_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_auto_category_rules (
    id integer NOT NULL,
    name text NOT NULL,
    type public."TransactionType" DEFAULT 'EXPENSE'::public."TransactionType" NOT NULL,
    counterpart_id integer,
    category_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    min_amount numeric(19,4),
    max_amount numeric(19,4),
    comment_contains text,
    description_contains text
);


--
-- Name: financial_auto_category_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_auto_category_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_auto_category_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_auto_category_rules_id_seq OWNED BY public.financial_auto_category_rules.id;


--
-- Name: financial_transaction_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_transaction_allocations (
    id integer NOT NULL,
    transaction_id integer NOT NULL,
    profile_id integer NOT NULL,
    period character varying(7) NOT NULL,
    amount numeric(19,4) NOT NULL,
    allocation_type public."CompensationAllocationType" DEFAULT 'MANUAL_ADJUST'::public."CompensationAllocationType" NOT NULL,
    source_allocation_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT financial_transaction_allocations_amount_positive_chk CHECK ((amount > (0)::numeric)),
    CONSTRAINT financial_transaction_allocations_period_format_chk CHECK (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text))
);


--
-- Name: financial_transaction_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_transaction_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_transaction_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_transaction_allocations_id_seq OWNED BY public.financial_transaction_allocations.id;


--
-- Name: financial_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_transactions (
    id integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    description text NOT NULL,
    amount numeric(19,4) NOT NULL,
    type public."TransactionType" NOT NULL,
    source_id text,
    category_id integer,
    comment text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    counterpart_id integer
);


--
-- Name: financial_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_transactions_id_seq OWNED BY public.financial_transactions.id;


--
-- Name: haulmer_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.haulmer_sync_logs (
    id text NOT NULL,
    period character varying(6) NOT NULL,
    rut character varying(20) NOT NULL,
    doc_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    rows_created integer DEFAULT 0 NOT NULL,
    rows_updated integer DEFAULT 0 NOT NULL,
    rows_skipped integer DEFAULT 0 NOT NULL,
    csv_size integer,
    error_message text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_categories_id_seq OWNED BY public.inventory_categories.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    category_id integer,
    name text NOT NULL,
    description text,
    current_stock integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    item_id integer NOT NULL,
    quantity_change integer NOT NULL,
    reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- Name: loan_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_schedules (
    id integer NOT NULL,
    loan_id integer NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    expected_amount numeric(15,2) NOT NULL,
    status public."LoanScheduleStatus" DEFAULT 'PENDING'::public."LoanScheduleStatus" NOT NULL,
    expected_principal numeric(15,2) NOT NULL,
    expected_interest numeric(15,2) NOT NULL,
    paid_amount numeric(15,2),
    paid_date date,
    transaction_id integer,
    note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: loan_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loan_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loan_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loan_schedules_id_seq OWNED BY public.loan_schedules.id;


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id integer NOT NULL,
    title text NOT NULL,
    principal_amount numeric(15,2) NOT NULL,
    interest_rate numeric(9,6) NOT NULL,
    start_date date NOT NULL,
    status public."LoanStatus" DEFAULT 'ACTIVE'::public."LoanStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    public_id text NOT NULL,
    borrower_name text NOT NULL,
    borrower_type public."LoanBorrowerType" NOT NULL,
    interest_type public."LoanInterestType" DEFAULT 'SIMPLE'::public."LoanInterestType" NOT NULL,
    frequency public."LoanFrequency" NOT NULL,
    total_installments integer NOT NULL,
    notes text
);


--
-- Name: loans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loans_id_seq OWNED BY public.loans.id;


--
-- Name: medical_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_certificates (
    id text NOT NULL,
    patient_name text NOT NULL,
    patient_rut text NOT NULL,
    birth_date date NOT NULL,
    address text NOT NULL,
    diagnosis text NOT NULL,
    symptoms text,
    rest_days integer,
    rest_start_date date,
    rest_end_date date,
    purpose text NOT NULL,
    purpose_detail text,
    issued_by integer NOT NULL,
    issued_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    drive_file_id text NOT NULL,
    pdf_hash text NOT NULL,
    metadata jsonb,
    patient_id integer
);


--
-- Name: passkeys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passkeys (
    id text NOT NULL,
    "userId" integer NOT NULL,
    credential_id text NOT NULL,
    public_key bytea NOT NULL,
    counter bigint DEFAULT 0 NOT NULL,
    transports jsonb,
    webauthn_user_id text NOT NULL,
    device_type text NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at timestamp(3) without time zone
);


--
-- Name: patient_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_attachments (
    id text NOT NULL,
    patient_id integer NOT NULL,
    name text NOT NULL,
    type public."AttachmentType" DEFAULT 'OTHER'::public."AttachmentType" NOT NULL,
    drive_file_id text NOT NULL,
    mime_type text,
    uploaded_by integer NOT NULL,
    uploaded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_dte_sale_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_dte_sale_sources (
    id integer NOT NULL,
    patient_id integer,
    client_rut character varying(20) NOT NULL,
    client_name text NOT NULL,
    document_type integer NOT NULL,
    document_date date,
    folio character varying(20),
    period character varying(6),
    source_updated_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_dte_sale_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_dte_sale_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_dte_sale_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_dte_sale_sources_id_seq OWNED BY public.patient_dte_sale_sources.id;


--
-- Name: patient_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_payments (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    budget_id integer,
    amount numeric(15,2) NOT NULL,
    payment_date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payment_method text NOT NULL,
    reference text,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_payments_id_seq OWNED BY public.patient_payments.id;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id integer NOT NULL,
    person_id integer NOT NULL,
    birth_date date,
    blood_type text,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patients_id_seq OWNED BY public.patients.id;


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id integer NOT NULL,
    rut character varying(20) NOT NULL,
    names text NOT NULL,
    father_name text,
    mother_name text,
    email text,
    phone text,
    address text,
    person_type public."PersonType" DEFAULT 'NATURAL'::public."PersonType" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: people_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.people_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: people_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.people_id_seq OWNED BY public.people.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    action text NOT NULL,
    subject text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    keys jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: release_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_transactions (
    id integer NOT NULL,
    source_id character varying(100) NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    external_reference character varying(255),
    record_type text,
    description character varying(500),
    net_credit_amount numeric(17,2),
    net_debit_amount numeric(17,2),
    gross_amount numeric(17,2) NOT NULL,
    seller_amount numeric(17,2),
    mp_fee_amount numeric(17,2),
    financing_fee_amount numeric(17,2),
    shipping_fee_amount numeric(17,2),
    taxes_amount numeric(17,2),
    coupon_amount numeric(17,2),
    effective_coupon_amount numeric(17,2),
    balance_amount numeric(17,2),
    tax_amount_telco numeric(17,2),
    installments integer,
    payment_method character varying(50),
    payment_method_type character varying(200),
    tax_detail text,
    taxes_disaggregated jsonb,
    transaction_approval_date timestamp(3) without time zone,
    transaction_intent_id text,
    pos_id text,
    pos_name text,
    external_pos_id text,
    store_id text,
    store_name text,
    external_store_id text,
    currency character varying(10),
    shipping_id bigint,
    shipment_mode text,
    shipping_order_id text,
    order_id bigint,
    pack_id bigint,
    poi_id text,
    item_id text,
    metadata jsonb,
    card_initial_number character varying(8),
    operation_tags jsonb,
    last_four_digits character varying(4),
    franchise text,
    issuer_name text,
    poi_bank_name text,
    poi_wallet_name text,
    business_unit text,
    sub_unit text,
    payout_bank_account_number text,
    product_sku text,
    sale_detail text,
    order_mp text,
    purchase_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    identification_number character varying(50)
);


--
-- Name: release_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.release_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: release_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.release_transactions_id_seq OWNED BY public.release_transactions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    conditions jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_system boolean DEFAULT false NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: service_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_schedules (
    id integer NOT NULL,
    service_id integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    due_date date NOT NULL,
    expected_amount numeric(15,2) NOT NULL,
    late_fee_amount numeric(15,2) DEFAULT 0 NOT NULL,
    effective_amount numeric(15,2) NOT NULL,
    status public."ServiceScheduleStatus" DEFAULT 'PENDING'::public."ServiceScheduleStatus" NOT NULL,
    paid_amount numeric(15,2),
    paid_date timestamp(3) without time zone,
    settlement_transaction_id integer,
    release_transaction_id integer,
    withdraw_transaction_id integer,
    note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    financial_transaction_id integer,
    CONSTRAINT service_schedules_amounts_non_negative_chk CHECK (((expected_amount >= (0)::numeric) AND (late_fee_amount >= (0)::numeric) AND (effective_amount >= (0)::numeric) AND ((paid_amount IS NULL) OR (paid_amount >= (0)::numeric)))),
    CONSTRAINT service_schedules_period_order_chk CHECK ((period_end >= period_start)),
    CONSTRAINT service_schedules_single_transaction_link_chk CHECK ((((
CASE
    WHEN (settlement_transaction_id IS NULL) THEN 0
    ELSE 1
END +
CASE
    WHEN (release_transaction_id IS NULL) THEN 0
    ELSE 1
END) +
CASE
    WHEN (withdraw_transaction_id IS NULL) THEN 0
    ELSE 1
END) <= 1))
);


--
-- Name: service_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_schedules_id_seq OWNED BY public.service_schedules.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id integer NOT NULL,
    name text NOT NULL,
    counterpart_id integer,
    type public."ServiceType" DEFAULT 'BUSINESS'::public."ServiceType" NOT NULL,
    frequency public."ServiceFrequency" DEFAULT 'MONTHLY'::public."ServiceFrequency" NOT NULL,
    default_amount numeric(15,2) DEFAULT 0 NOT NULL,
    status public."ServiceStatus" DEFAULT 'ACTIVE'::public."ServiceStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    public_id text NOT NULL,
    detail text,
    category text,
    recurrence_type public."ServiceRecurrenceType" DEFAULT 'RECURRING'::public."ServiceRecurrenceType" NOT NULL,
    start_date date NOT NULL,
    end_date date,
    due_day integer,
    emission_mode public."ServiceEmissionMode" DEFAULT 'FIXED_DAY'::public."ServiceEmissionMode" NOT NULL,
    emission_day integer,
    emission_start_day integer,
    emission_end_day integer,
    emission_exact_date date,
    ownership public."ServiceOwnership" DEFAULT 'COMPANY'::public."ServiceOwnership" NOT NULL,
    obligation_type public."ServiceObligationType" DEFAULT 'SERVICE'::public."ServiceObligationType" NOT NULL,
    amount_indexation public."ServiceAmountIndexation" DEFAULT 'NONE'::public."ServiceAmountIndexation" NOT NULL,
    late_fee_mode public."ServiceLateFeeMode" DEFAULT 'NONE'::public."ServiceLateFeeMode" NOT NULL,
    late_fee_value numeric(15,2),
    late_fee_grace_days integer,
    next_generation_months integer DEFAULT 12 NOT NULL,
    notes text,
    transaction_category_id integer,
    reminder_days_before integer DEFAULT 3 NOT NULL,
    auto_link_transactions boolean DEFAULT true NOT NULL,
    CONSTRAINT services_due_day_between_1_31_chk CHECK (((due_day IS NULL) OR ((due_day >= 1) AND (due_day <= 31)))),
    CONSTRAINT services_emission_day_between_1_31_chk CHECK (((emission_day IS NULL) OR ((emission_day >= 1) AND (emission_day <= 31)))),
    CONSTRAINT services_emission_end_day_between_1_31_chk CHECK (((emission_end_day IS NULL) OR ((emission_end_day >= 1) AND (emission_end_day <= 31)))),
    CONSTRAINT services_emission_start_day_between_1_31_chk CHECK (((emission_start_day IS NULL) OR ((emission_start_day >= 1) AND (emission_start_day <= 31)))),
    CONSTRAINT services_generation_months_positive_chk CHECK ((next_generation_months > 0))
);


--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: settlement_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlement_transactions (
    id integer NOT NULL,
    source_id character varying(100) NOT NULL,
    transaction_date timestamp(3) without time zone NOT NULL,
    settlement_date timestamp(3) without time zone,
    money_release_date timestamp(3) without time zone,
    external_reference character varying(255),
    user_id character varying(19),
    payment_method_type character varying(200),
    payment_method character varying(50),
    site character varying(200),
    transaction_type character varying(200) NOT NULL,
    transaction_amount numeric(17,2) NOT NULL,
    transaction_currency character varying(10) NOT NULL,
    seller_amount numeric(17,2),
    fee_amount numeric(17,2),
    settlement_net_amount numeric(17,2),
    settlement_currency character varying(10),
    real_amount numeric(17,2),
    coupon_amount numeric(17,2),
    metadata jsonb,
    mkp_fee_amount numeric(17,2),
    financing_fee_amount numeric(17,2),
    shipping_fee_amount numeric(17,2),
    taxes_amount numeric(17,2),
    installments integer,
    tax_detail character varying(50),
    taxes_disaggregated jsonb,
    description character varying(50),
    card_initial_number character varying(8),
    operation_tags jsonb,
    business_unit character varying(255),
    sub_unit character varying(255),
    product_sku character varying(200),
    sale_detail character varying(500),
    transaction_intent_id text,
    franchise text,
    issuer_name text,
    last_four_digits character varying(4),
    order_mp text,
    invoicing_period text,
    pay_bank_transfer_id text,
    is_released boolean,
    tip_amount numeric(17,2),
    purchase_id text,
    total_coupon_amount numeric(17,2),
    pos_id character varying(50),
    pos_name character varying(200),
    external_pos_id character varying(100),
    store_id character varying(50),
    store_name character varying(200),
    external_store_id character varying(100),
    poi_id character varying(50),
    order_id bigint,
    shipping_id bigint,
    shipment_mode character varying(10),
    pack_id bigint,
    shipping_order_id text,
    poi_wallet_name character varying(200),
    poi_bank_name character varying(200),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    identification_number character varying(50)
);


--
-- Name: settlement_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settlement_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settlement_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settlement_transactions_id_seq OWNED BY public.settlement_transactions.id;


--
-- Name: supply_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supply_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    supply_name text NOT NULL,
    quantity integer NOT NULL,
    brand text,
    model text,
    notes text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: supply_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supply_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supply_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supply_requests_id_seq OWNED BY public.supply_requests.id;


--
-- Name: sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_logs (
    id bigint NOT NULL,
    trigger_source text NOT NULL,
    trigger_user_id integer,
    trigger_label text,
    status text DEFAULT 'SUCCESS'::text NOT NULL,
    started_at timestamp(3) without time zone NOT NULL,
    finished_at timestamp(3) without time zone,
    fetched_at timestamp(3) without time zone,
    inserted integer DEFAULT 0,
    updated integer DEFAULT 0,
    skipped integer DEFAULT 0,
    excluded integer DEFAULT 0,
    error_message text,
    change_details jsonb
);


--
-- Name: sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_logs_id_seq OWNED BY public.sync_logs.id;


--
-- Name: transaction_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_categories (
    id integer NOT NULL,
    name text NOT NULL,
    type public."TransactionType" NOT NULL,
    color text,
    icon text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: transaction_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_categories_id_seq OWNED BY public.transaction_categories.id;


--
-- Name: user_permission_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permission_versions (
    user_id integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    person_id integer NOT NULL,
    password_hash text,
    status public."UserStatus" DEFAULT 'PENDING_SETUP'::public."UserStatus" NOT NULL,
    mfa_secret text,
    mfa_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    mfa_enforced boolean DEFAULT true NOT NULL,
    session_version integer DEFAULT 1 NOT NULL,
    login_email text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: withdraw_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdraw_transactions (
    id integer NOT NULL,
    withdraw_id character varying(64) NOT NULL,
    date_created timestamp(3) without time zone NOT NULL,
    status character varying(50),
    status_detail character varying(100),
    amount numeric(17,2),
    fee numeric(17,2),
    activity_url character varying(500),
    payout_desc character varying(500),
    bank_account_holder character varying(255),
    identification_type character varying(50),
    identification_number character varying(50),
    bank_id character varying(50),
    bank_name character varying(200),
    bank_branch character varying(200),
    bank_account_type character varying(50),
    bank_account_number character varying(100),
    created_at timestamp(3) without time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT now() NOT NULL
);


--
-- Name: withdraw_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.withdraw_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: withdraw_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.withdraw_transactions_id_seq OWNED BY public.withdraw_transactions.id;


--
-- Name: credit_installments id; Type: DEFAULT; Schema: personal; Owner: -
--

ALTER TABLE ONLY personal.credit_installments ALTER COLUMN id SET DEFAULT nextval('personal.credit_installments_id_seq'::regclass);


--
-- Name: credits id; Type: DEFAULT; Schema: personal; Owner: -
--

ALTER TABLE ONLY personal.credits ALTER COLUMN id SET DEFAULT nextval('personal.credits_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: calendar_sync_log_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_log_entries ALTER COLUMN id SET DEFAULT nextval('public.calendar_sync_log_entries_id_seq'::regclass);


--
-- Name: calendar_sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.calendar_sync_logs_id_seq'::regclass);


--
-- Name: calendar_watch_channels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_watch_channels ALTER COLUMN id SET DEFAULT nextval('public.calendar_watch_channels_id_seq'::regclass);


--
-- Name: calendars id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendars ALTER COLUMN id SET DEFAULT nextval('public.calendars_id_seq'::regclass);


--
-- Name: clinical_series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_series ALTER COLUMN id SET DEFAULT nextval('public.clinical_series_id_seq'::regclass);


--
-- Name: common_supplies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.common_supplies ALTER COLUMN id SET DEFAULT nextval('public.common_supplies_id_seq'::regclass);


--
-- Name: compensation_period_budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_period_budgets ALTER COLUMN id SET DEFAULT nextval('public.compensation_period_budgets_id_seq'::regclass);


--
-- Name: compensation_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles ALTER COLUMN id SET DEFAULT nextval('public.compensation_profiles_id_seq'::regclass);


--
-- Name: consultations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations ALTER COLUMN id SET DEFAULT nextval('public.consultations_id_seq'::regclass);


--
-- Name: counterpart_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counterpart_accounts ALTER COLUMN id SET DEFAULT nextval('public.counterpart_accounts_id_seq'::regclass);


--
-- Name: counterparts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counterparts ALTER COLUMN id SET DEFAULT nextval('public.counterparts_id_seq'::regclass);


--
-- Name: daily_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_balances ALTER COLUMN id SET DEFAULT nextval('public.daily_balances_id_seq'::regclass);


--
-- Name: daily_production_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_balances ALTER COLUMN id SET DEFAULT nextval('public.daily_production_balances_id_seq'::regclass);


--
-- Name: doctoralia_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_addresses ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_addresses_id_seq'::regclass);


--
-- Name: doctoralia_bookings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_bookings ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_bookings_id_seq'::regclass);


--
-- Name: doctoralia_calendar_appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_appointments ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_calendar_appointments_id_seq'::regclass);


--
-- Name: doctoralia_calendar_breaks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_breaks ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_calendar_breaks_id_seq'::regclass);


--
-- Name: doctoralia_calendar_sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_calendar_sync_logs_id_seq'::regclass);


--
-- Name: doctoralia_doctors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_doctors ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_doctors_id_seq'::regclass);


--
-- Name: doctoralia_facilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_facilities ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_facilities_id_seq'::regclass);


--
-- Name: doctoralia_insurance_providers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_insurance_providers ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_insurance_providers_id_seq'::regclass);


--
-- Name: doctoralia_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_schedules ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_schedules_id_seq'::regclass);


--
-- Name: doctoralia_services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_services ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_services_id_seq'::regclass);


--
-- Name: doctoralia_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_slots ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_slots_id_seq'::regclass);


--
-- Name: doctoralia_sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_sync_logs_id_seq'::regclass);


--
-- Name: doctoralia_work_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_work_periods ALTER COLUMN id SET DEFAULT nextval('public.doctoralia_work_periods_id_seq'::regclass);


--
-- Name: employee_timesheets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_timesheets ALTER COLUMN id SET DEFAULT nextval('public.employee_timesheets_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: financial_auto_category_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_auto_category_rules ALTER COLUMN id SET DEFAULT nextval('public.financial_auto_category_rules_id_seq'::regclass);


--
-- Name: financial_transaction_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transaction_allocations ALTER COLUMN id SET DEFAULT nextval('public.financial_transaction_allocations_id_seq'::regclass);


--
-- Name: financial_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions ALTER COLUMN id SET DEFAULT nextval('public.financial_transactions_id_seq'::regclass);


--
-- Name: inventory_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories ALTER COLUMN id SET DEFAULT nextval('public.inventory_categories_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- Name: loan_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedules ALTER COLUMN id SET DEFAULT nextval('public.loan_schedules_id_seq'::regclass);


--
-- Name: loans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans ALTER COLUMN id SET DEFAULT nextval('public.loans_id_seq'::regclass);


--
-- Name: patient_dte_sale_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_dte_sale_sources ALTER COLUMN id SET DEFAULT nextval('public.patient_dte_sale_sources_id_seq'::regclass);


--
-- Name: patient_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_payments ALTER COLUMN id SET DEFAULT nextval('public.patient_payments_id_seq'::regclass);


--
-- Name: patients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients ALTER COLUMN id SET DEFAULT nextval('public.patients_id_seq'::regclass);


--
-- Name: people id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people ALTER COLUMN id SET DEFAULT nextval('public.people_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: release_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_transactions ALTER COLUMN id SET DEFAULT nextval('public.release_transactions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: service_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules ALTER COLUMN id SET DEFAULT nextval('public.service_schedules_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: settlement_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions ALTER COLUMN id SET DEFAULT nextval('public.settlement_transactions_id_seq'::regclass);


--
-- Name: supply_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_requests ALTER COLUMN id SET DEFAULT nextval('public.supply_requests_id_seq'::regclass);


--
-- Name: sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs ALTER COLUMN id SET DEFAULT nextval('public.sync_logs_id_seq'::regclass);


--
-- Name: transaction_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_categories ALTER COLUMN id SET DEFAULT nextval('public.transaction_categories_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: withdraw_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdraw_transactions ALTER COLUMN id SET DEFAULT nextval('public.withdraw_transactions_id_seq'::regclass);


--
-- Name: credit_installments credit_installments_pkey; Type: CONSTRAINT; Schema: personal; Owner: -
--

ALTER TABLE ONLY personal.credit_installments
    ADD CONSTRAINT credit_installments_pkey PRIMARY KEY (id);


--
-- Name: credits credits_pkey; Type: CONSTRAINT; Schema: personal; Owner: -
--

ALTER TABLE ONLY personal.credits
    ADD CONSTRAINT credits_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: calendar_sync_log_entries calendar_sync_log_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_log_entries
    ADD CONSTRAINT calendar_sync_log_entries_pkey PRIMARY KEY (id);


--
-- Name: calendar_sync_logs calendar_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_logs
    ADD CONSTRAINT calendar_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: calendar_watch_channels calendar_watch_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_watch_channels
    ADD CONSTRAINT calendar_watch_channels_pkey PRIMARY KEY (id);


--
-- Name: calendars calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_pkey PRIMARY KEY (id);


--
-- Name: clinical_series clinical_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_series
    ADD CONSTRAINT clinical_series_pkey PRIMARY KEY (id);


--
-- Name: common_supplies common_supplies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.common_supplies
    ADD CONSTRAINT common_supplies_pkey PRIMARY KEY (id);


--
-- Name: compensation_period_budgets compensation_period_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_period_budgets
    ADD CONSTRAINT compensation_period_budgets_pkey PRIMARY KEY (id);


--
-- Name: compensation_profiles compensation_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles
    ADD CONSTRAINT compensation_profiles_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: counterpart_accounts counterpart_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counterpart_accounts
    ADD CONSTRAINT counterpart_accounts_pkey PRIMARY KEY (id);


--
-- Name: counterparts counterparts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counterparts
    ADD CONSTRAINT counterparts_pkey PRIMARY KEY (id);


--
-- Name: daily_balances daily_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_balances
    ADD CONSTRAINT daily_balances_pkey PRIMARY KEY (id);


--
-- Name: daily_production_balances daily_production_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_balances
    ADD CONSTRAINT daily_production_balances_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_addresses doctoralia_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_addresses
    ADD CONSTRAINT doctoralia_addresses_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_bookings doctoralia_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_bookings
    ADD CONSTRAINT doctoralia_bookings_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_calendar_appointments doctoralia_calendar_appointments_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_appointments
    ADD CONSTRAINT doctoralia_calendar_appointments_external_id_key UNIQUE (external_id);


--
-- Name: doctoralia_calendar_appointments doctoralia_calendar_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_appointments
    ADD CONSTRAINT doctoralia_calendar_appointments_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_calendar_breaks doctoralia_calendar_breaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_breaks
    ADD CONSTRAINT doctoralia_calendar_breaks_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_calendar_sync_logs doctoralia_calendar_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_sync_logs
    ADD CONSTRAINT doctoralia_calendar_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_doctors doctoralia_doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_doctors
    ADD CONSTRAINT doctoralia_doctors_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_facilities doctoralia_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_facilities
    ADD CONSTRAINT doctoralia_facilities_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_insurance_providers doctoralia_insurance_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_insurance_providers
    ADD CONSTRAINT doctoralia_insurance_providers_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_schedules doctoralia_schedules_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_schedules
    ADD CONSTRAINT doctoralia_schedules_external_id_key UNIQUE (external_id);


--
-- Name: doctoralia_schedules doctoralia_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_schedules
    ADD CONSTRAINT doctoralia_schedules_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_services doctoralia_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_services
    ADD CONSTRAINT doctoralia_services_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_slots doctoralia_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_slots
    ADD CONSTRAINT doctoralia_slots_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_sync_logs doctoralia_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_sync_logs
    ADD CONSTRAINT doctoralia_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: doctoralia_work_periods doctoralia_work_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_work_periods
    ADD CONSTRAINT doctoralia_work_periods_pkey PRIMARY KEY (id);


--
-- Name: dte_purchase_details dte_purchase_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dte_purchase_details
    ADD CONSTRAINT dte_purchase_details_pkey PRIMARY KEY (id);


--
-- Name: dte_sale_details dte_sale_details_folio_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dte_sale_details
    ADD CONSTRAINT dte_sale_details_folio_document_type_key UNIQUE (folio, document_type);


--
-- Name: dte_sale_details dte_sale_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dte_sale_details
    ADD CONSTRAINT dte_sale_details_pkey PRIMARY KEY (id);


--
-- Name: dte_sync_logs dte_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dte_sync_logs
    ADD CONSTRAINT dte_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: employee_timesheets employee_timesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_timesheets
    ADD CONSTRAINT employee_timesheets_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: financial_auto_category_rules financial_auto_category_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_auto_category_rules
    ADD CONSTRAINT financial_auto_category_rules_pkey PRIMARY KEY (id);


--
-- Name: financial_transaction_allocations financial_transaction_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transaction_allocations
    ADD CONSTRAINT financial_transaction_allocations_pkey PRIMARY KEY (id);


--
-- Name: financial_transactions financial_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_pkey PRIMARY KEY (id);


--
-- Name: haulmer_sync_logs haulmer_sync_logs_period_rut_doc_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.haulmer_sync_logs
    ADD CONSTRAINT haulmer_sync_logs_period_rut_doc_type_key UNIQUE (period, rut, doc_type);


--
-- Name: haulmer_sync_logs haulmer_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.haulmer_sync_logs
    ADD CONSTRAINT haulmer_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: loan_schedules loan_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedules
    ADD CONSTRAINT loan_schedules_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: medical_certificates medical_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_pkey PRIMARY KEY (id);


--
-- Name: passkeys passkeys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passkeys
    ADD CONSTRAINT passkeys_pkey PRIMARY KEY (id);


--
-- Name: patient_attachments patient_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_attachments
    ADD CONSTRAINT patient_attachments_pkey PRIMARY KEY (id);


--
-- Name: patient_dte_sale_sources patient_dte_sale_sources_client_rut_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_dte_sale_sources
    ADD CONSTRAINT patient_dte_sale_sources_client_rut_key UNIQUE (client_rut);


--
-- Name: patient_dte_sale_sources patient_dte_sale_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_dte_sale_sources
    ADD CONSTRAINT patient_dte_sale_sources_pkey PRIMARY KEY (id);


--
-- Name: patient_payments patient_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_payments
    ADD CONSTRAINT patient_payments_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: people people_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_email_key UNIQUE (email);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: release_transactions release_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_transactions
    ADD CONSTRAINT release_transactions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: service_schedules service_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules
    ADD CONSTRAINT service_schedules_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: settlement_transactions settlement_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_pkey PRIMARY KEY (id);


--
-- Name: supply_requests supply_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_requests
    ADD CONSTRAINT supply_requests_pkey PRIMARY KEY (id);


--
-- Name: sync_logs sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs
    ADD CONSTRAINT sync_logs_pkey PRIMARY KEY (id);


--
-- Name: transaction_categories transaction_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_categories
    ADD CONSTRAINT transaction_categories_pkey PRIMARY KEY (id);


--
-- Name: user_permission_versions user_permission_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_versions
    ADD CONSTRAINT user_permission_versions_pkey PRIMARY KEY (user_id);


--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: withdraw_transactions withdraw_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdraw_transactions
    ADD CONSTRAINT withdraw_transactions_pkey PRIMARY KEY (id);


--
-- Name: credit_installments_credit_id_idx; Type: INDEX; Schema: personal; Owner: -
--

CREATE INDEX credit_installments_credit_id_idx ON personal.credit_installments USING btree (credit_id);


--
-- Name: credit_installments_credit_id_installment_number_key; Type: INDEX; Schema: personal; Owner: -
--

CREATE UNIQUE INDEX credit_installments_credit_id_installment_number_key ON personal.credit_installments USING btree (credit_id, installment_number);


--
-- Name: credits_credit_number_key; Type: INDEX; Schema: personal; Owner: -
--

CREATE UNIQUE INDEX credits_credit_number_key ON personal.credits USING btree (credit_number);


--
-- Name: backup_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX backup_logs_timestamp_idx ON public.backup_logs USING btree ("timestamp" DESC);


--
-- Name: budgets_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX budgets_patient_id_idx ON public.budgets USING btree (patient_id);


--
-- Name: calendar_sync_log_entries_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_sync_log_entries_severity_idx ON public.calendar_sync_log_entries USING btree (severity);


--
-- Name: calendar_sync_log_entries_sync_log_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_sync_log_entries_sync_log_id_idx ON public.calendar_sync_log_entries USING btree (sync_log_id);


--
-- Name: calendar_sync_log_entries_timestamp_desc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_sync_log_entries_timestamp_desc_idx ON public.calendar_sync_log_entries USING btree ("timestamp" DESC);


--
-- Name: calendar_sync_log_entries_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_sync_log_entries_timestamp_idx ON public.calendar_sync_log_entries USING btree ("timestamp" DESC);


--
-- Name: calendar_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_sync_logs_started_at_idx ON public.calendar_sync_logs USING btree (started_at DESC);


--
-- Name: calendar_watch_channels_calendar_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_watch_channels_calendar_id_idx ON public.calendar_watch_channels USING btree (calendar_id);


--
-- Name: calendar_watch_channels_channel_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX calendar_watch_channels_channel_id_key ON public.calendar_watch_channels USING btree (channel_id);


--
-- Name: calendars_google_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX calendars_google_id_key ON public.calendars USING btree (google_id);


--
-- Name: clinical_series_kind_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_series_kind_status_idx ON public.clinical_series USING btree (kind, status);


--
-- Name: clinical_series_patient_rut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_series_patient_rut_idx ON public.clinical_series USING btree (patient_rut);


--
-- Name: common_supplies_name_brand_model_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX common_supplies_name_brand_model_key ON public.common_supplies USING btree (name, brand, model);


--
-- Name: compensation_period_budgets_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compensation_period_budgets_period_idx ON public.compensation_period_budgets USING btree (period);


--
-- Name: compensation_period_budgets_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compensation_period_budgets_profile_id_idx ON public.compensation_period_budgets USING btree (profile_id);


--
-- Name: compensation_period_budgets_profile_id_period_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX compensation_period_budgets_profile_id_period_key ON public.compensation_period_budgets USING btree (profile_id, period);


--
-- Name: compensation_profiles_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compensation_profiles_category_id_idx ON public.compensation_profiles USING btree (category_id);


--
-- Name: compensation_profiles_counterpart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compensation_profiles_counterpart_id_idx ON public.compensation_profiles USING btree (counterpart_id);


--
-- Name: compensation_profiles_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compensation_profiles_is_active_idx ON public.compensation_profiles USING btree (is_active);


--
-- Name: consultations_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consultations_date_idx ON public.consultations USING btree (date);


--
-- Name: consultations_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consultations_event_id_idx ON public.consultations USING btree (event_id);


--
-- Name: consultations_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consultations_patient_id_idx ON public.consultations USING btree (patient_id);


--
-- Name: counterpart_accounts_account_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX counterpart_accounts_account_number_key ON public.counterpart_accounts USING btree (account_number);


--
-- Name: counterpart_accounts_counterpart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX counterpart_accounts_counterpart_id_idx ON public.counterpart_accounts USING btree (counterpart_id);


--
-- Name: counterparts_identification_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX counterparts_identification_number_key ON public.counterparts USING btree (identification_number);


--
-- Name: daily_balances_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX daily_balances_date_key ON public.daily_balances USING btree (date);


--
-- Name: daily_production_balances_balance_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX daily_production_balances_balance_date_key ON public.daily_production_balances USING btree (balance_date);


--
-- Name: daily_production_balances_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_production_balances_created_by_idx ON public.daily_production_balances USING btree (created_by);


--
-- Name: doctoralia_addresses_doctor_id_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_addresses_doctor_id_external_id_key ON public.doctoralia_addresses USING btree (doctor_id, external_id);


--
-- Name: doctoralia_addresses_doctor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_addresses_doctor_id_idx ON public.doctoralia_addresses USING btree (doctor_id);


--
-- Name: doctoralia_bookings_address_id_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_bookings_address_id_external_id_key ON public.doctoralia_bookings USING btree (address_id, external_id);


--
-- Name: doctoralia_bookings_address_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_bookings_address_id_idx ON public.doctoralia_bookings USING btree (address_id);


--
-- Name: doctoralia_bookings_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_bookings_start_at_idx ON public.doctoralia_bookings USING btree (start_at);


--
-- Name: doctoralia_calendar_appointments_patient_external_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_calendar_appointments_patient_external_id_idx ON public.doctoralia_calendar_appointments USING btree (patient_external_id);


--
-- Name: doctoralia_calendar_appointments_schedule_id_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_calendar_appointments_schedule_id_external_id_key ON public.doctoralia_calendar_appointments USING btree (schedule_id, external_id);


--
-- Name: doctoralia_calendar_appointments_schedule_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_calendar_appointments_schedule_id_idx ON public.doctoralia_calendar_appointments USING btree (schedule_id);


--
-- Name: doctoralia_calendar_appointments_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_calendar_appointments_start_at_idx ON public.doctoralia_calendar_appointments USING btree (start_at);


--
-- Name: doctoralia_calendar_breaks_address_id_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_calendar_breaks_address_id_external_id_key ON public.doctoralia_calendar_breaks USING btree (address_id, external_id);


--
-- Name: doctoralia_calendar_breaks_address_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_calendar_breaks_address_id_idx ON public.doctoralia_calendar_breaks USING btree (address_id);


--
-- Name: doctoralia_calendar_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_calendar_sync_logs_started_at_idx ON public.doctoralia_calendar_sync_logs USING btree (started_at DESC);


--
-- Name: doctoralia_doctors_facility_id_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_doctors_facility_id_external_id_key ON public.doctoralia_doctors USING btree (facility_id, external_id);


--
-- Name: doctoralia_doctors_facility_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_doctors_facility_id_idx ON public.doctoralia_doctors USING btree (facility_id);


--
-- Name: doctoralia_facilities_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_facilities_external_id_key ON public.doctoralia_facilities USING btree (external_id);


--
-- Name: doctoralia_insurance_providers_address_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_insurance_providers_address_id_idx ON public.doctoralia_insurance_providers USING btree (address_id);


--
-- Name: doctoralia_insurance_providers_address_id_insurance_provide_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_insurance_providers_address_id_insurance_provide_key ON public.doctoralia_insurance_providers USING btree (address_id, insurance_provider_id);


--
-- Name: doctoralia_schedules_external_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_schedules_external_id_idx ON public.doctoralia_schedules USING btree (external_id);


--
-- Name: doctoralia_services_address_id_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctoralia_services_address_id_external_id_key ON public.doctoralia_services USING btree (address_id, external_id);


--
-- Name: doctoralia_services_address_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_services_address_id_idx ON public.doctoralia_services USING btree (address_id);


--
-- Name: doctoralia_slots_address_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_slots_address_id_idx ON public.doctoralia_slots USING btree (address_id);


--
-- Name: doctoralia_slots_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_slots_start_at_idx ON public.doctoralia_slots USING btree (start_at);


--
-- Name: doctoralia_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_sync_logs_started_at_idx ON public.doctoralia_sync_logs USING btree (started_at DESC);


--
-- Name: doctoralia_work_periods_schedule_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_work_periods_schedule_id_idx ON public.doctoralia_work_periods USING btree (schedule_id);


--
-- Name: doctoralia_work_periods_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctoralia_work_periods_start_at_idx ON public.doctoralia_work_periods USING btree (start_at);


--
-- Name: dte_purchase_details_document_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_purchase_details_document_date_idx ON public.dte_purchase_details USING btree (document_date);


--
-- Name: dte_purchase_details_provider_rut_folio_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dte_purchase_details_provider_rut_folio_key ON public.dte_purchase_details USING btree (provider_rut, folio);


--
-- Name: dte_purchase_details_provider_rut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_purchase_details_provider_rut_idx ON public.dte_purchase_details USING btree (provider_rut);


--
-- Name: dte_sale_details_client_rut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_sale_details_client_rut_idx ON public.dte_sale_details USING btree (client_rut);


--
-- Name: dte_sale_details_document_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_sale_details_document_date_idx ON public.dte_sale_details USING btree (document_date);


--
-- Name: dte_sale_details_document_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_sale_details_document_type_idx ON public.dte_sale_details USING btree (document_type);


--
-- Name: dte_sync_logs_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_sync_logs_period_idx ON public.dte_sync_logs USING btree (period);


--
-- Name: dte_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_sync_logs_started_at_idx ON public.dte_sync_logs USING btree (started_at DESC);


--
-- Name: dte_sync_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dte_sync_logs_status_idx ON public.dte_sync_logs USING btree (status);


--
-- Name: employee_timesheets_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_timesheets_employee_id_idx ON public.employee_timesheets USING btree (employee_id);


--
-- Name: employee_timesheets_employee_id_work_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_timesheets_employee_id_work_date_key ON public.employee_timesheets USING btree (employee_id, work_date);


--
-- Name: employees_person_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employees_person_id_key ON public.employees USING btree (person_id);


--
-- Name: events_calendar_id_external_event_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX events_calendar_id_external_event_id_key ON public.events USING btree (calendar_id, external_event_id);


--
-- Name: events_calendar_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_calendar_id_idx ON public.events USING btree (calendar_id);


--
-- Name: events_clinical_series_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_clinical_series_id_idx ON public.events USING btree (clinical_series_id);


--
-- Name: financial_auto_category_rules_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_auto_category_rules_category_id_idx ON public.financial_auto_category_rules USING btree (category_id);


--
-- Name: financial_auto_category_rules_counterpart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_auto_category_rules_counterpart_id_idx ON public.financial_auto_category_rules USING btree (counterpart_id);


--
-- Name: financial_auto_category_rules_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_auto_category_rules_is_active_idx ON public.financial_auto_category_rules USING btree (is_active);


--
-- Name: financial_transaction_allocations_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transaction_allocations_period_idx ON public.financial_transaction_allocations USING btree (period);


--
-- Name: financial_transaction_allocations_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transaction_allocations_profile_id_idx ON public.financial_transaction_allocations USING btree (profile_id);


--
-- Name: financial_transaction_allocations_source_allocation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transaction_allocations_source_allocation_id_idx ON public.financial_transaction_allocations USING btree (source_allocation_id);


--
-- Name: financial_transaction_allocations_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transaction_allocations_transaction_id_idx ON public.financial_transaction_allocations USING btree (transaction_id);


--
-- Name: financial_transactions_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transactions_category_id_idx ON public.financial_transactions USING btree (category_id);


--
-- Name: financial_transactions_counterpart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transactions_counterpart_id_idx ON public.financial_transactions USING btree (counterpart_id);


--
-- Name: financial_transactions_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transactions_date_idx ON public.financial_transactions USING btree (date);


--
-- Name: financial_transactions_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_transactions_type_idx ON public.financial_transactions USING btree (type);


--
-- Name: haulmer_sync_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX haulmer_sync_logs_created_at_idx ON public.haulmer_sync_logs USING btree (created_at DESC);


--
-- Name: haulmer_sync_logs_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX haulmer_sync_logs_period_idx ON public.haulmer_sync_logs USING btree (period);


--
-- Name: haulmer_sync_logs_rut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX haulmer_sync_logs_rut_idx ON public.haulmer_sync_logs USING btree (rut);


--
-- Name: haulmer_sync_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX haulmer_sync_logs_status_idx ON public.haulmer_sync_logs USING btree (status);


--
-- Name: inventory_categories_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_categories_name_key ON public.inventory_categories USING btree (name);


--
-- Name: inventory_items_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_category_id_idx ON public.inventory_items USING btree (category_id);


--
-- Name: inventory_movements_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_item_id_idx ON public.inventory_movements USING btree (item_id);


--
-- Name: loan_schedules_loan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loan_schedules_loan_id_idx ON public.loan_schedules USING btree (loan_id);


--
-- Name: loan_schedules_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loan_schedules_transaction_id_idx ON public.loan_schedules USING btree (transaction_id);


--
-- Name: loans_public_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loans_public_id_key ON public.loans USING btree (public_id);


--
-- Name: medical_certificates_issued_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medical_certificates_issued_at_idx ON public.medical_certificates USING btree (issued_at);


--
-- Name: medical_certificates_patient_rut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medical_certificates_patient_rut_idx ON public.medical_certificates USING btree (patient_rut);


--
-- Name: passkeys_credential_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX passkeys_credential_id_key ON public.passkeys USING btree (credential_id);


--
-- Name: passkeys_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "passkeys_userId_idx" ON public.passkeys USING btree ("userId");


--
-- Name: patient_attachments_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_attachments_patient_id_idx ON public.patient_attachments USING btree (patient_id);


--
-- Name: patient_dte_sale_sources_document_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_dte_sale_sources_document_date_idx ON public.patient_dte_sale_sources USING btree (document_date);


--
-- Name: patient_dte_sale_sources_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_dte_sale_sources_patient_id_idx ON public.patient_dte_sale_sources USING btree (patient_id);


--
-- Name: patient_dte_sale_sources_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_dte_sale_sources_period_idx ON public.patient_dte_sale_sources USING btree (period);


--
-- Name: patient_payments_budget_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_payments_budget_id_idx ON public.patient_payments USING btree (budget_id);


--
-- Name: patient_payments_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_payments_patient_id_idx ON public.patient_payments USING btree (patient_id);


--
-- Name: patients_person_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_person_id_key ON public.patients USING btree (person_id);


--
-- Name: people_rut_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX people_rut_key ON public.people USING btree (rut);


--
-- Name: permissions_action_subject_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_action_subject_key ON public.permissions USING btree (action, subject);


--
-- Name: push_subscriptions_endpoint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions USING btree (endpoint);


--
-- Name: push_subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);


--
-- Name: release_transactions_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_transactions_date_idx ON public.release_transactions USING btree (date);


--
-- Name: release_transactions_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_transactions_source_id_idx ON public.release_transactions USING btree (source_id);


--
-- Name: release_transactions_source_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX release_transactions_source_id_key ON public.release_transactions USING btree (source_id);


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: service_schedules_financial_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_schedules_financial_transaction_id_idx ON public.service_schedules USING btree (financial_transaction_id);


--
-- Name: service_schedules_release_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_schedules_release_transaction_id_idx ON public.service_schedules USING btree (release_transaction_id);


--
-- Name: service_schedules_service_id_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_schedules_service_id_due_date_idx ON public.service_schedules USING btree (service_id, due_date);


--
-- Name: service_schedules_service_id_period_start_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_schedules_service_id_period_start_key ON public.service_schedules USING btree (service_id, period_start);


--
-- Name: service_schedules_settlement_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_schedules_settlement_transaction_id_idx ON public.service_schedules USING btree (settlement_transaction_id);


--
-- Name: service_schedules_status_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_schedules_status_due_date_idx ON public.service_schedules USING btree (status, due_date);


--
-- Name: service_schedules_withdraw_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_schedules_withdraw_transaction_id_idx ON public.service_schedules USING btree (withdraw_transaction_id);


--
-- Name: services_counterpart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_counterpart_id_idx ON public.services USING btree (counterpart_id);


--
-- Name: services_public_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_public_id_key ON public.services USING btree (public_id);


--
-- Name: services_transaction_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_transaction_category_id_idx ON public.services USING btree (transaction_category_id);


--
-- Name: settlement_transactions_external_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settlement_transactions_external_reference_idx ON public.settlement_transactions USING btree (external_reference);


--
-- Name: settlement_transactions_source_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX settlement_transactions_source_id_key ON public.settlement_transactions USING btree (source_id);


--
-- Name: settlement_transactions_transaction_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settlement_transactions_transaction_date_idx ON public.settlement_transactions USING btree (transaction_date);


--
-- Name: settlement_transactions_transaction_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settlement_transactions_transaction_type_idx ON public.settlement_transactions USING btree (transaction_type);


--
-- Name: supply_requests_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supply_requests_user_id_idx ON public.supply_requests USING btree (user_id);


--
-- Name: sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_logs_started_at_idx ON public.sync_logs USING btree (started_at);


--
-- Name: sync_logs_trigger_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_logs_trigger_source_idx ON public.sync_logs USING btree (trigger_source);


--
-- Name: users_login_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_login_email_key ON public.users USING btree (login_email);


--
-- Name: users_login_email_unique_ci_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_login_email_unique_ci_idx ON public.users USING btree (lower(login_email)) WHERE (login_email IS NOT NULL);


--
-- Name: users_person_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_person_id_key ON public.users USING btree (person_id);


--
-- Name: withdraw_transactions_date_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX withdraw_transactions_date_created_idx ON public.withdraw_transactions USING btree (date_created);


--
-- Name: withdraw_transactions_withdraw_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX withdraw_transactions_withdraw_id_idx ON public.withdraw_transactions USING btree (withdraw_id);


--
-- Name: withdraw_transactions_withdraw_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX withdraw_transactions_withdraw_id_key ON public.withdraw_transactions USING btree (withdraw_id);


--
-- Name: credit_installments credit_installments_credit_id_fkey; Type: FK CONSTRAINT; Schema: personal; Owner: -
--

ALTER TABLE ONLY personal.credit_installments
    ADD CONSTRAINT credit_installments_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES personal.credits(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: budgets budgets_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar_sync_log_entries calendar_sync_log_entries_sync_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_log_entries
    ADD CONSTRAINT calendar_sync_log_entries_sync_log_id_fkey FOREIGN KEY (sync_log_id) REFERENCES public.calendar_sync_logs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar_watch_channels calendar_watch_channels_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_watch_channels
    ADD CONSTRAINT calendar_watch_channels_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.calendars(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: compensation_period_budgets compensation_period_budgets_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_period_budgets
    ADD CONSTRAINT compensation_period_budgets_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.compensation_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: compensation_profiles compensation_profiles_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles
    ADD CONSTRAINT compensation_profiles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.transaction_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: compensation_profiles compensation_profiles_counterpart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles
    ADD CONSTRAINT compensation_profiles_counterpart_id_fkey FOREIGN KEY (counterpart_id) REFERENCES public.counterparts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: consultations consultations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: consultations consultations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: counterpart_accounts counterpart_accounts_counterpart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counterpart_accounts
    ADD CONSTRAINT counterpart_accounts_counterpart_id_fkey FOREIGN KEY (counterpart_id) REFERENCES public.counterparts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_production_balances daily_production_balances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_balances
    ADD CONSTRAINT daily_production_balances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: doctoralia_addresses doctoralia_addresses_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_addresses
    ADD CONSTRAINT doctoralia_addresses_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctoralia_doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_bookings doctoralia_bookings_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_bookings
    ADD CONSTRAINT doctoralia_bookings_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.doctoralia_addresses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_calendar_appointments doctoralia_calendar_appointments_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_appointments
    ADD CONSTRAINT doctoralia_calendar_appointments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.doctoralia_schedules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_calendar_breaks doctoralia_calendar_breaks_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_calendar_breaks
    ADD CONSTRAINT doctoralia_calendar_breaks_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.doctoralia_addresses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_doctors doctoralia_doctors_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_doctors
    ADD CONSTRAINT doctoralia_doctors_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.doctoralia_facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_insurance_providers doctoralia_insurance_providers_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_insurance_providers
    ADD CONSTRAINT doctoralia_insurance_providers_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.doctoralia_addresses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_services doctoralia_services_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_services
    ADD CONSTRAINT doctoralia_services_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.doctoralia_addresses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_slots doctoralia_slots_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_slots
    ADD CONSTRAINT doctoralia_slots_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.doctoralia_addresses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: doctoralia_work_periods doctoralia_work_periods_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctoralia_work_periods
    ADD CONSTRAINT doctoralia_work_periods_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.doctoralia_schedules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employee_timesheets employee_timesheets_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_timesheets
    ADD CONSTRAINT employee_timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employees employees_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.calendars(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_clinical_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_clinical_series_id_fkey FOREIGN KEY (clinical_series_id) REFERENCES public.clinical_series(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: financial_auto_category_rules financial_auto_category_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_auto_category_rules
    ADD CONSTRAINT financial_auto_category_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.transaction_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: financial_auto_category_rules financial_auto_category_rules_counterpart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_auto_category_rules
    ADD CONSTRAINT financial_auto_category_rules_counterpart_id_fkey FOREIGN KEY (counterpart_id) REFERENCES public.counterparts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: financial_transaction_allocations financial_transaction_allocations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transaction_allocations
    ADD CONSTRAINT financial_transaction_allocations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.compensation_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: financial_transaction_allocations financial_transaction_allocations_source_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transaction_allocations
    ADD CONSTRAINT financial_transaction_allocations_source_allocation_id_fkey FOREIGN KEY (source_allocation_id) REFERENCES public.financial_transaction_allocations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: financial_transaction_allocations financial_transaction_allocations_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transaction_allocations
    ADD CONSTRAINT financial_transaction_allocations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: financial_transactions financial_transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.transaction_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: financial_transactions financial_transactions_counterpart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_counterpart_id_fkey FOREIGN KEY (counterpart_id) REFERENCES public.counterparts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loan_schedules loan_schedules_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedules
    ADD CONSTRAINT loan_schedules_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loan_schedules loan_schedules_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_schedules
    ADD CONSTRAINT loan_schedules_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: medical_certificates medical_certificates_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: medical_certificates medical_certificates_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: passkeys passkeys_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passkeys
    ADD CONSTRAINT "passkeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_attachments patient_attachments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_attachments
    ADD CONSTRAINT patient_attachments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_attachments patient_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_attachments
    ADD CONSTRAINT patient_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: patient_dte_sale_sources patient_dte_sale_sources_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_dte_sale_sources
    ADD CONSTRAINT patient_dte_sale_sources_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: patient_payments patient_payments_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_payments
    ADD CONSTRAINT patient_payments_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: patient_payments patient_payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_payments
    ADD CONSTRAINT patient_payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patients patients_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: release_transactions release_transactions_identification_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_transactions
    ADD CONSTRAINT release_transactions_identification_number_fkey FOREIGN KEY (identification_number) REFERENCES public.counterparts(identification_number) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_schedules service_schedules_financial_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules
    ADD CONSTRAINT service_schedules_financial_transaction_id_fkey FOREIGN KEY (financial_transaction_id) REFERENCES public.financial_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_schedules service_schedules_release_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules
    ADD CONSTRAINT service_schedules_release_transaction_id_fkey FOREIGN KEY (release_transaction_id) REFERENCES public.release_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_schedules service_schedules_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules
    ADD CONSTRAINT service_schedules_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_schedules service_schedules_settlement_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules
    ADD CONSTRAINT service_schedules_settlement_transaction_id_fkey FOREIGN KEY (settlement_transaction_id) REFERENCES public.settlement_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_schedules service_schedules_withdraw_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_schedules
    ADD CONSTRAINT service_schedules_withdraw_transaction_id_fkey FOREIGN KEY (withdraw_transaction_id) REFERENCES public.withdraw_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: services services_counterpart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_counterpart_id_fkey FOREIGN KEY (counterpart_id) REFERENCES public.counterparts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: services services_transaction_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_transaction_category_id_fkey FOREIGN KEY (transaction_category_id) REFERENCES public.transaction_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: settlement_transactions settlement_transactions_identification_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_identification_number_fkey FOREIGN KEY (identification_number) REFERENCES public.counterparts(identification_number) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supply_requests supply_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supply_requests
    ADD CONSTRAINT supply_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_permission_versions user_permission_versions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_versions
    ADD CONSTRAINT user_permission_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: withdraw_transactions withdraw_transactions_identification_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdraw_transactions
    ADD CONSTRAINT withdraw_transactions_identification_number_fkey FOREIGN KEY (identification_number) REFERENCES public.counterparts(identification_number) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

-- removed psql metacommand: \unrestrict

