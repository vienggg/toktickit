--
-- PostgreSQL database dump
--

\restrict jNR22bfDqG4qbude3ju9lbGU5Ii6XzjPnJEDur1iWSJceoOsTuJEWsOFPNEZMiz

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachment" (
    id integer NOT NULL,
    "ticketId" integer NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text NOT NULL,
    "isRemoved" boolean DEFAULT false NOT NULL,
    "removedReason" text,
    "removedAt" timestamp(3) without time zone,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Attachment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Attachment_id_seq" OWNED BY public."Attachment".id;


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id integer NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Category_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Category_id_seq" OWNED BY public."Category".id;


--
-- Name: RelatedSystem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RelatedSystem" (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RelatedSystem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RelatedSystem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RelatedSystem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RelatedSystem_id_seq" OWNED BY public."RelatedSystem".id;


--
-- Name: RequesterUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RequesterUser" (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    department text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RequesterUser_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RequesterUser_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RequesterUser_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RequesterUser_id_seq" OWNED BY public."RequesterUser".id;


--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Ticket" (
    id integer NOT NULL,
    "ticketNumber" text NOT NULL,
    summary text NOT NULL,
    description text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    status text DEFAULT 'New'::text NOT NULL,
    "categoryId" integer NOT NULL,
    "relatedSystemId" integer,
    "requesterId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Ticket_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Ticket_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Ticket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Ticket_id_seq" OWNED BY public."Ticket".id;


--
-- Name: Attachment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment" ALTER COLUMN id SET DEFAULT nextval('public."Attachment_id_seq"'::regclass);


--
-- Name: Category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category" ALTER COLUMN id SET DEFAULT nextval('public."Category_id_seq"'::regclass);


--
-- Name: RelatedSystem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RelatedSystem" ALTER COLUMN id SET DEFAULT nextval('public."RelatedSystem_id_seq"'::regclass);


--
-- Name: RequesterUser id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RequesterUser" ALTER COLUMN id SET DEFAULT nextval('public."RequesterUser_id_seq"'::regclass);


--
-- Name: Ticket id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket" ALTER COLUMN id SET DEFAULT nextval('public."Ticket_id_seq"'::regclass);


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachment" (id, "ticketId", "fileName", "fileUrl", "fileSize", "mimeType", "isRemoved", "removedReason", "removedAt", "uploadedAt") FROM stdin;
31	114	ledger_audit_error_log.pdf	/uploads/sample_ledger_audit.pdf	245000	application/pdf	f	\N	\N	2026-08-21 19:23:53.898
32	114	confidential_employee_payroll_sample.png	/uploads/sample_payroll.png	180000	image/png	t	Contains confidential employee payroll info; soft-removed per IT security policy compliance.	2026-08-21 19:23:53.897	2026-08-21 19:23:53.898
33	130	test_screenshot.png	/uploads/1787345389244-569160995-test_screenshot.png	23	image/png	f	\N	\N	2026-08-21 20:49:49.257
34	115	audit_log.pdf	/uploads/1787345389508-780456795-audit_log.pdf	19	application/pdf	t	Accidental sensitive screenshot upload	2026-08-21 20:49:49.525	2026-08-21 20:49:49.513
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, name, "createdAt") FROM stdin;
1	Account and Access	2026-08-21 18:04:55.372
2	Hardware	2026-08-21 18:04:55.399
3	Software	2026-08-21 18:04:55.406
4	Network	2026-08-21 18:04:55.413
\.


--
-- Data for Name: RelatedSystem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RelatedSystem" (id, name, description, "isActive", "createdAt") FROM stdin;
1	ERP Core	Enterprise Resource Planning financial & inventory ledger	t	2026-08-21 18:04:55.439
2	HR Portal	Employee benefits, leave requests, and payroll self-service	t	2026-08-21 18:04:55.444
3	Email & Collaboration	Corporate mailbox, calendars, and real-time chat	t	2026-08-21 18:04:55.447
4	VPN & Remote Access	Secure gateway for remote telework	t	2026-08-21 18:04:55.451
5	Finance Central	Invoicing, procurement, and billing subsystem	t	2026-08-21 18:04:55.454
6	CRM Platform	Customer relationship and lead management	t	2026-08-21 18:04:55.457
7	IT Helpdesk	Internal IT asset tracking and issue dispatcher	t	2026-08-21 18:04:55.46
\.


--
-- Data for Name: RequesterUser; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RequesterUser" (id, name, email, department, "isActive", "createdAt", "updatedAt") FROM stdin;
1	Jennifer Anderson	jennifer.anderson@toktick.internal	Finance	t	2026-08-21 18:04:55.421	2026-08-21 19:23:53.852
2	Michael Brown	michael.brown@toktick.internal	Operations	t	2026-08-21 18:04:55.426	2026-08-21 19:23:53.856
3	Emily Davis	emily.davis@toktick.internal	Marketing	t	2026-08-21 18:04:55.429	2026-08-21 19:23:53.858
4	David Wilson	david.wilson@toktick.internal	Engineering	t	2026-08-21 18:04:55.432	2026-08-21 19:23:53.86
5	Alex Taylor	alex.taylor@toktick.internal	Human Resources	f	2026-08-21 18:04:55.434	2026-08-21 19:23:53.862
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Ticket" (id, "ticketNumber", summary, description, priority, status, "categoryId", "relatedSystemId", "requesterId", "createdAt", "updatedAt") FROM stdin;
127	TKT-2026-975912	Cannot connect to campus VPN service	VPN gateway times out after authentication prompt on macOS Sequoia 15.1.	Medium	New	1	\N	1	2026-08-21 20:17:11.676	2026-08-21 20:17:11.676
116	TKT-2026-000103	VPN Disconnects on Financial Close (Re-verified)	Cisco AnyConnect drops authentication token every 15 minutes when connecting from home subnet.	High	In_Progress	4	4	1	2026-08-21 19:23:53.904	2026-08-21 20:28:29.072
128	TKT-2026-949448	Cannot connect to campus VPN service	VPN gateway times out after authentication prompt on macOS Sequoia 15.1.	Medium	New	1	\N	1	2026-08-21 20:28:32.022	2026-08-21 20:28:32.022
117	TKT-2026-000104	VPN Disconnects on Financial Close (Re-verified)	Please provision read-only auditor role in Finance Central for incoming contract auditor.	Medium	Resolved	1	5	1	2026-08-21 19:23:53.907	2026-08-21 20:41:06.547
129	TKT-2026-818864	Cannot connect to campus VPN service	VPN gateway times out after authentication prompt on macOS Sequoia 15.1.	Medium	New	1	\N	1	2026-08-21 20:41:09.455	2026-08-21 20:41:09.455
130	TKT-2026-679844	Automated Test Ticket Submission	Detailed description of the hardware fault for unit test.	High	New	1	\N	1	2026-08-21 20:49:49.257	2026-08-21 20:49:49.257
115	TKT-2026-000102	Updated Summary for In-Place Edit Test	The height adjustment arm for the secondary display is loose and poses an ergonomics hazard.	Urgent	New	2	\N	1	2026-08-21 19:23:53.902	2026-08-21 20:49:49.491
119	TKT-2026-000106	VPN Disconnects on Financial Close (Re-verified)	Motorized desk control panel displays error E08 and fails to elevate.	Low	Closed	2	\N	1	2026-08-21 19:23:53.912	2026-08-21 20:52:15.469
131	TKT-2026-771354	Cannot connect to campus VPN service	VPN gateway times out after authentication prompt on macOS Sequoia 15.1.	Medium	New	1	\N	1	2026-08-21 20:52:18.355	2026-08-21 20:52:18.355
126	TKT-2026-000201	Warehouse Barcode Scanner Battery Replacement	Zebra TC52 handheld scanner battery holds charge for only 30 minutes during inventory scan.	High	New	2	\N	2	2026-08-21 19:23:53.936	2026-08-21 19:23:53.936
114	TKT-2026-000101	ERP Core Ledger Balance Discrepancy on Monthly Close	The reconciliation module displays an unbalanced ledger entry of $4,520 for Q2 closing.	Urgent	In_Progress	3	1	1	2026-08-21 19:23:53.894	2026-08-21 19:23:53.894
118	TKT-2026-000105	Outlook Shared Mailbox Sync Failure on Finance Inbox	Inbound vendor invoice emails fail to sync across team members since Monday morning.	High	New	3	3	1	2026-08-21 19:23:53.91	2026-08-21 19:23:53.91
120	TKT-2026-000107	Annual Tax Report Export Module Timeout	Exporting 10,000 ledger records to Excel returns HTTP 504 gateway timeout after 60 seconds.	Urgent	In_Progress	3	1	1	2026-08-21 19:23:53.914	2026-08-21 19:23:53.914
121	TKT-2026-000108	Floor 3 Finance Department Wi-Fi Signal Degradation	Meeting room 3B has high packet loss and poor signal reception during Zoom conference calls.	Medium	New	4	\N	1	2026-08-21 19:23:53.917	2026-08-21 19:23:53.917
122	TKT-2026-000109	Adobe Acrobat Pro License Renewal Required	PDF digital signature capability is disabled due to expired enterprise license key.	Medium	Resolved	3	\N	1	2026-08-21 19:23:53.919	2026-08-21 19:23:53.919
123	TKT-2026-000110	Finance Shared Drive Read/Write Provisioning	Grant access to folder Z:\\Finance\\Audit_2026 for newly transferred financial analyst.	High	Closed	1	\N	1	2026-08-21 19:23:53.922	2026-08-21 19:23:53.922
124	TKT-2026-000111	Laptop Docking Station Ethernet Port Damaged	Physical RJ-45 jack clip is broken causing frequent network disconnection when desk is bumped.	Low	New	2	\N	1	2026-08-21 19:23:53.926	2026-08-21 19:23:53.926
125	TKT-2026-000112	Expense Report Submission Error in HR Portal	Receipt PDF attachment fails to upload with message "Multipart boundary not found".	Medium	New	3	2	1	2026-08-21 19:23:53.933	2026-08-21 19:23:53.933
\.


--
-- Name: Attachment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Attachment_id_seq"', 34, true);


--
-- Name: Category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Category_id_seq"', 4, true);


--
-- Name: RelatedSystem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RelatedSystem_id_seq"', 63, true);


--
-- Name: RequesterUser_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RequesterUser_id_seq"', 45, true);


--
-- Name: Ticket_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Ticket_id_seq"', 131, true);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: RelatedSystem RelatedSystem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RelatedSystem"
    ADD CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY (id);


--
-- Name: RequesterUser RequesterUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RequesterUser"
    ADD CONSTRAINT "RequesterUser_pkey" PRIMARY KEY (id);


--
-- Name: Ticket Ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_pkey" PRIMARY KEY (id);


--
-- Name: Category_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_name_key" ON public."Category" USING btree (name);


--
-- Name: RelatedSystem_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RelatedSystem_name_key" ON public."RelatedSystem" USING btree (name);


--
-- Name: RequesterUser_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RequesterUser_email_key" ON public."RequesterUser" USING btree (email);


--
-- Name: Ticket_ticketNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON public."Ticket" USING btree ("ticketNumber");


--
-- Name: Attachment Attachment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Ticket Ticket_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_relatedSystemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_relatedSystemId_fkey" FOREIGN KEY ("relatedSystemId") REFERENCES public."RelatedSystem"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public."RequesterUser"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict jNR22bfDqG4qbude3ju9lbGU5Ii6XzjPnJEDur1iWSJceoOsTuJEWsOFPNEZMiz

