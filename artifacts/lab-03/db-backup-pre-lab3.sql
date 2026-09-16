--
-- PostgreSQL database dump
--

\restrict HCJz8bPM7Y4r9VVA3JcfV6Yl2Et0wvHWMuTOTOWRfKoke09aLHh3ft9uDHFJkG1

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

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
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


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
18	23	ledger_audit_error_log.pdf	/uploads/sample_ledger_audit.pdf	245000	application/pdf	f	\N	\N	2026-09-01 18:43:42.671
19	23	confidential_employee_payroll_sample.png	/uploads/sample_payroll.png	180000	image/png	t	Contains confidential employee payroll info; soft-removed per IT security policy compliance.	2026-09-01 18:43:42.668	2026-09-01 18:43:42.671
20	34	sample_system_diagram.png	/uploads/1788288498488-365453219-sample_system_diagram.png	70	image/png	f	\N	\N	2026-09-01 18:48:18.504
21	37	test_screenshot.png	/uploads/1788375878616-703710411-test_screenshot.png	23	image/png	f	\N	\N	2026-09-02 19:04:38.63
22	24	audit_log.pdf	/uploads/1788375878658-265635433-audit_log.pdf	19	application/pdf	t	Accidental sensitive screenshot upload	2026-09-02 19:04:38.676	2026-09-02 19:04:38.665
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Category" (id, name, "createdAt") FROM stdin;
1	Account and Access	2026-09-01 13:36:41.478
2	Hardware	2026-09-01 13:36:41.499
3	Software	2026-09-01 13:36:41.503
4	Network	2026-09-01 13:36:41.507
\.


--
-- Data for Name: RelatedSystem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RelatedSystem" (id, name, description, "isActive", "createdAt") FROM stdin;
1	ERP Core	Enterprise Resource Planning financial & inventory ledger	t	2026-09-01 13:36:41.527
2	HR Portal	Employee benefits, leave requests, and payroll self-service	t	2026-09-01 13:36:41.529
3	Email & Collaboration	Corporate mailbox, calendars, and real-time chat	t	2026-09-01 13:36:41.53
4	VPN & Remote Access	Secure gateway for remote telework	t	2026-09-01 13:36:41.532
5	Finance Central	Invoicing, procurement, and billing subsystem	t	2026-09-01 13:36:41.533
6	CRM Platform	Customer relationship and lead management	t	2026-09-01 13:36:41.534
7	IT Helpdesk	Internal IT asset tracking and issue dispatcher	t	2026-09-01 13:36:41.536
\.


--
-- Data for Name: RequesterUser; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RequesterUser" (id, name, email, department, "isActive", "createdAt", "updatedAt") FROM stdin;
1	Jennifer Anderson	jennifer.anderson@toktick.internal	Finance	t	2026-09-01 13:36:41.513	2026-09-01 18:43:42.621
2	Michael Brown	michael.brown@toktick.internal	Operations	t	2026-09-01 13:36:41.517	2026-09-01 18:43:42.632
3	Emily Davis	emily.davis@toktick.internal	Marketing	t	2026-09-01 13:36:41.519	2026-09-01 18:43:42.635
4	David Wilson	david.wilson@toktick.internal	Engineering	t	2026-09-01 13:36:41.521	2026-09-01 18:43:42.637
5	Alex Taylor	alex.taylor@toktick.internal	Human Resources	f	2026-09-01 13:36:41.523	2026-09-01 18:43:42.639
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Ticket" (id, "ticketNumber", summary, description, priority, status, "categoryId", "relatedSystemId", "requesterId", "createdAt", "updatedAt") FROM stdin;
25	TKT-2026-000103	VPN Connection Dropping Intermittently During Remote Audit	Cisco AnyConnect drops authentication token every 15 minutes when connecting from home subnet.	High	In_Progress	4	4	1	2026-09-01 18:43:42.677	2026-09-01 18:43:42.677
26	TKT-2026-000104	Billing Portal Access Permission for Junior Accountant	Please provision read-only auditor role in Finance Central for incoming contract auditor.	Medium	Resolved	1	5	1	2026-09-01 18:43:42.679	2026-09-01 18:43:42.679
27	TKT-2026-000105	Outlook Shared Mailbox Sync Failure on Finance Inbox	Inbound vendor invoice emails fail to sync across team members since Monday morning.	High	New	3	3	1	2026-09-01 18:43:42.681	2026-09-01 18:43:42.681
28	TKT-2026-000106	Standing Desk Power Converter Replacement	Motorized desk control panel displays error E08 and fails to elevate.	Low	Closed	2	\N	1	2026-09-01 18:43:42.683	2026-09-01 18:43:42.683
29	TKT-2026-000107	Annual Tax Report Export Module Timeout	Exporting 10,000 ledger records to Excel returns HTTP 504 gateway timeout after 60 seconds.	Urgent	In_Progress	3	1	1	2026-09-01 18:43:42.685	2026-09-01 18:43:42.685
30	TKT-2026-000108	Floor 3 Finance Department Wi-Fi Signal Degradation	Meeting room 3B has high packet loss and poor signal reception during Zoom conference calls.	Medium	New	4	\N	1	2026-09-01 18:43:42.687	2026-09-01 18:43:42.687
31	TKT-2026-000109	Adobe Acrobat Pro License Renewal Required	PDF digital signature capability is disabled due to expired enterprise license key.	Medium	Resolved	3	\N	1	2026-09-01 18:43:42.689	2026-09-01 18:43:42.689
32	TKT-2026-000110	Finance Shared Drive Read/Write Provisioning	Grant access to folder Z:\\Finance\\Audit_2026 for newly transferred financial analyst.	High	Closed	1	\N	1	2026-09-01 18:43:42.69	2026-09-01 18:43:42.69
33	TKT-2026-000111	Laptop Docking Station Ethernet Port Damaged	Physical RJ-45 jack clip is broken causing frequent network disconnection when desk is bumped.	Low	New	2	\N	1	2026-09-01 18:43:42.692	2026-09-01 18:43:42.692
34	TKT-2026-000112	Expense Report Submission Error in HR Portal	Receipt PDF attachment fails to upload with message "Multipart boundary not found".	Medium	New	3	2	1	2026-09-01 18:43:42.694	2026-09-01 18:43:42.694
23	TKT-2026-000101	ERP Core Ledger Balance Discrepancy on Monthly Close	The reconciliation module displays an unbalanced ledger entry of $4,520 for Q2 closing.	Urgent	In_Progress	3	1	1	2026-09-01 18:43:42.666	2026-09-01 18:43:42.666
35	TKT-2026-000201	Warehouse Barcode Scanner Battery Replacement	Zebra TC52 handheld scanner battery holds charge for only 30 minutes during inventory scan.	High	New	2	\N	2	2026-09-01 18:43:42.695	2026-09-01 18:43:42.695
36	TKT-2026-241647	Updated Summary - 1788365676760	Detailed explanation of the issue submitted during automated full-stack verification.	High	New	1	\N	1	2026-09-02 16:14:36.283	2026-09-02 16:14:37.473
37	TKT-2026-000115	Automated Test Ticket Submission	Detailed description of the hardware fault for unit test.	High	New	1	\N	1	2026-09-02 19:04:38.63	2026-09-02 19:04:38.63
24	TKT-2026-000102	Updated Summary for In-Place Edit Test	The height adjustment arm for the secondary display is loose and poses an ergonomics hazard.	Urgent	New	2	\N	1	2026-09-01 18:43:42.675	2026-09-02 19:04:38.639
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
42c65870-f8d4-4fb9-84a2-777af0990b75	4652d974e172f942bc1f974cc5022d0f05026292e922f76a13421742e57aa772	2026-09-16 16:56:40.159448+07	0_init		\N	2026-09-16 16:56:40.159448+07	0
\.


--
-- Name: Attachment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Attachment_id_seq"', 22, true);


--
-- Name: Category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Category_id_seq"', 4, true);


--
-- Name: RelatedSystem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RelatedSystem_id_seq"', 14, true);


--
-- Name: RequesterUser_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RequesterUser_id_seq"', 10, true);


--
-- Name: Ticket_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Ticket_id_seq"', 37, true);


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
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


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
-- Name: Ticket_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_categoryId_idx" ON public."Ticket" USING btree ("categoryId");


--
-- Name: Ticket_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_createdAt_idx" ON public."Ticket" USING btree ("createdAt");


--
-- Name: Ticket_requesterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_requesterId_idx" ON public."Ticket" USING btree ("requesterId");


--
-- Name: Ticket_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Ticket_status_idx" ON public."Ticket" USING btree (status);


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

\unrestrict HCJz8bPM7Y4r9VVA3JcfV6Yl2Et0wvHWMuTOTOWRfKoke09aLHh3ft9uDHFJkG1

