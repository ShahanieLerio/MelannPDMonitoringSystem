--
-- PostgreSQL database dump
--

\restrict bKxISNSbZvsOMl5uXeowKt2rIK6fW8IQQfNqPDdbiDaWA9vuRaVyeM59LNt5X5C

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    loan_id text,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    type text NOT NULL,
    description text NOT NULL,
    user_name text NOT NULL,
    user_role text NOT NULL,
    module text NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: collectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collectors (
    id text NOT NULL,
    name text NOT NULL,
    nickname text,
    address text,
    branch text NOT NULL
);


ALTER TABLE public.collectors OWNER TO postgres;

--
-- Name: demand_letters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demand_letters (
    id text NOT NULL,
    loan_id text,
    collector_name text NOT NULL,
    borrower_name text NOT NULL,
    type text NOT NULL,
    date_prepared text NOT NULL,
    date_received text,
    follow_up_date text,
    status text DEFAULT 'Pending'::text NOT NULL,
    remarks text,
    branch text NOT NULL
);


ALTER TABLE public.demand_letters OWNER TO postgres;

--
-- Name: loans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loans (
    id text NOT NULL,
    collector text NOT NULL,
    code text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    borrower_name text NOT NULL,
    month_reported text NOT NULL,
    due_date text NOT NULL,
    outstanding_balance numeric(15,2) NOT NULL,
    amount_collected numeric(15,2) DEFAULT 0,
    running_balance numeric(15,2) NOT NULL,
    status text NOT NULL,
    location text NOT NULL,
    area text,
    city text,
    barangay text,
    full_address text,
    branch text NOT NULL,
    ai_priority text DEFAULT 'Lowest Priority'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.loans OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id text NOT NULL,
    loan_id text,
    amount numeric(15,2) NOT NULL,
    or_number text NOT NULL,
    date text NOT NULL,
    balance_after numeric(15,2) NOT NULL,
    recorder text NOT NULL,
    remarks text,
    status text DEFAULT 'GOOD'::text NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: remarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remarks (
    id text NOT NULL,
    loan_id text,
    text text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    collector text NOT NULL
);


ALTER TABLE public.remarks OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    username text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    branch text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text,
    status_history jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, loan_id, "timestamp", type, description, user_name, user_role, module) FROM stdin;
y9lyp8s	zmv1fe1	2026-02-05 15:53:54.912+08	Remark Added	New remark: "Promise to pay every Saturday"	Shan	ORMOC_USER	Field Intelligence
1h6e515	1l6x2ts	2026-02-05 15:54:32.208+08	Remark Added	New remark: "Transfer to Sogod Saouthern Leyte "	Shan	ORMOC_USER	Field Intelligence
bmgt9u7	ue3pzh8	2026-02-05 15:55:08.275+08	Remark Added	New remark: "Adto adtuon lang basin naay ika hatag"	Shan	ORMOC_USER	Field Intelligence
gzodxu5	vvbamdu	2026-02-05 15:58:45.768+08	Remark Added	New remark: "Promise to pay at 5:00 pm on February 5, 2026"	Shan	ORMOC_USER	Field Intelligence
fwo5l1v	7nrgm66	2026-02-05 15:59:39.86+08	Remark Added	New remark: "Promise to pay weekly thru gcash"	Shan	ORMOC_USER	Field Intelligence
iy5fm55	65i58kc	2026-02-05 16:09:32.017+08	Remark Added	New remark: "Promise to pay every Monday, Wednesday and Saturda..."	Shan	ORMOC_USER	Field Intelligence
v9g3c0f	65i58kc	2026-02-06 10:49:28.937+08	Payment Received	Remittance of ₱50 recorded. OR: OR-20260206-K6RY. New balance: ₱831	Shan	ORMOC_USER	Payment Stream
75nt652	65i58kc	2026-02-06 11:13:03.974+08	Payment Received	Remittance of ₱50 recorded. OR: OR-20260206-TOVD. New balance: ₱781	Shan	ORMOC_USER	Payment Stream
b79vnzo	65i58kc	2026-02-06 13:11:42.493+08	Payment Reversed	Payment OR: OR-20260206-K6RY (₱50) reversed. Reason: Wrong payment . New balance: ₱831	Shan	ORMOC_USER	Payment Stream
5pjh150	65i58kc	2026-02-06 13:12:59.801+08	Payment Reversed	Payment OR: OR-20260206-TOVD (₱50) reversed. Reason: Wrong payment . New balance: ₱881	Shan	ORMOC_USER	Payment Stream
5a23o45	65i58kc	2026-02-09 15:30:37.772+08	Remark Edited	Remark edited: "Every Monday "	Shan	ORMOC_USER	Field Intelligence
j0zuj4c	65i58kc	2026-02-09 15:30:42.971+08	Remark Edited	Remark edited: "Every Monday "	Shan	ORMOC_USER	Field Intelligence
44jd1j0	65i58kc	2026-02-09 15:30:44.162+08	Remark Edited	Remark edited: "Every Monday "	Shan	ORMOC_USER	Field Intelligence
nr1k6z9	65i58kc	2026-02-09 15:30:58.339+08	Remark Added	New remark: "Every Wednesday "	Shan	ORMOC_USER	Field Intelligence
ygypc9x	65i58kc	2026-02-09 15:31:06.469+08	Remark Added	New remark: "Every Saturday"	Shan	ORMOC_USER	Field Intelligence
\.


--
-- Data for Name: collectors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.collectors (id, name, nickname, address, branch) FROM stdin;
f3v54ru	Aldie Rosal	ALDIE 	Ormoc 	Ormoc Branch
y2prniu	Eddie Caballes 	EDDIE	Carigara	Ormoc Branch
83854ga	Supervisor Kananga	SUPERVISOR	Kananga	Ormoc Branch
r97i5m0	Noel Jugar 	NOEL	Palompon	Ormoc Branch
fdtynkn	Angelito Torreta 	LITO 	Isabel 	Ormoc Branch
8233qoz	Renato Dominggono	MASOY	Baybay	Ormoc Branch
pebqff6	Reynaldo Laude 	TATA	San Isidro	Ormoc Branch
k15c4uj	Ormoc Pastdue 	PD ORMOC	Ormoc	Ormoc Branch
lx3npcq	Carigara Pastdue 	PD CARIGARA 	Carigara 	Ormoc Branch
5raozfk	Kananga Pastdue 	PD KANANGA 	Kananga	Ormoc Branch
fxl2sy9	Palompon Pastdue 	PD PALOMPON	Palompon	Ormoc Branch
v6q8mm2	Isabel Pastdue 	PD ISABEL 	Isabel 	Ormoc Branch
77jq14f	Baybay Pastdue 	PD BAYBAY	Baybay	Ormoc Branch
\.


--
-- Data for Name: demand_letters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.demand_letters (id, loan_id, collector_name, borrower_name, type, date_prepared, date_received, follow_up_date, status, remarks, branch) FROM stdin;
\.


--
-- Data for Name: loans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, branch, ai_priority, created_at) FROM stdin;
7nrgm66	PD PALOMPON	2374	JEDEN	LARUA	LARUA, JEDEN	2022-06	2022-05-29	4439.00	0.00	4439.00	NM	NL	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zmv1fe1	PD BAYBAY	1374	JOSEFINA	ABADIEZ	ABADIEZ, JOSEFINA	2019-09	2019-08-04	3184.00	0.00	3184.00	NM	NL	BAYBAY	Inopacan 	Cabalisan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1l6x2ts	PD KANANGA 	682	Jinny	Abinio	Abinio, Jinny	2017-10	2017-09-03	2620.00	0.00	2620.00	NM	NL	KANANGA	Kananga	Libongao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ue3pzh8	SUPERVISOR	2538	Betwel	Ablen	Ablen, Betwel	2023-04	2023-05-03	1421.00	0.00	1421.00	M	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vvbamdu	PD PALOMPON	3308	Gemma	Abad	Abad, Gemma	2024-07	2024-03-30	4474.00	0.00	4474.00	NM	L	ORMOC	Albuera	Tagbas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
65i58kc	NOEL	3826	FLORDILIZA	ENERO	ENERO, FLORDILIZA	2026-01	2025-11-09	881.00	0.00	881.00	M	L	PALOMPON	Isabel	Anislag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
test	Test	TEST	Test	User	User, Test	2024-01	2024-02-01	100.00	0.00	100.00	Moving	L	\N	\N	\N	\N	ORMOC	Low	2026-02-05 13:38:29.066778+08
pczk7x2	PD BAYBAY	1312	PERLITA	ABAINZA	ABAINZA, PERLITA	2021-03	2021-10-04	2242.00	0.00	2242.00	NM	NL	BAYBAY	Baybay	Public Market 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ahnrpaa	ALDIE 	873	Arlen	Abaño	Abaño, Arlen	2018-07	2018-06-02	1637.00	0.00	1637.00	M	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1lgqh67	PD BAYBAY	1175	AGNES CORA	ABAPO	ABAPO, AGNES CORA	2019-07	2019-06-09	4866.00	0.00	4866.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a5784ac	PD BAYBAY	1718	ANGELITA	ABAS	ABAS, ANGELITA	2021-07	2021-06-21	4370.00	0.00	4370.00	M	L	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7asfbju	MASOY	3484	CHRISTINE	ABELARDO	ABELARDO, CHRISTINE	2025-10	2025-08-08	3105.00	0.00	3105.00	NMSR	L	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uv0gl4d	PD PALOMPON	2587	Jennifer	Abellana	Abellana, Jennifer	2024-11	2024-09-20	4469.00	0.00	4469.00	NMSR	NL	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gtdgjqi	NOEL	3027	CYNTHIA	ABING	ABING, CYNTHIA	2026-01	2025-10-05	13380.00	0.00	13380.00	NM	L	PALOMPON	Villaba 	Suba 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oyhjy1r	SUPERVISOR	2481	Anna Marie	Ablen	Ablen, Anna Marie	2023-05	2023-04-01	3039.00	0.00	3039.00	M	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3rn1w34	ALDIE 	2381	MARRISA	ABLEN	ABLEN, MARRISA	2025-11	2025-09-13	13855.00	0.00	13855.00	M	L	ORMOC	Ormoc	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p13d9w6	EDDIE	2436	Evelyn	Aborita	Aborita, Evelyn	2022-08	2022-07-14	2515.00	0.00	2515.00	M	L	CARIGARA	Carigara	Ponong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3tz80be	PD PALOMPON	1597	Norie Fe	Abucay	Abucay, Norie Fe	2022-01	2021-12-12	2455.00	0.00	2455.00	NM	L	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gnw6xak	EDDIE	2143	Renita	Abuga	Abuga, Renita	2024-08	2021-11-17	1484.00	0.00	1484.00	NM	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mm5o14j	MASOY	2878	SHIELA	ADARO	ADARO, SHIELA	2025-04	2025-03-14	1755.00	0.00	1755.00	NM	L	BAYBAY	Hindang	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z2w68ws	PD PALOMPON	1492	RACHELLE	ADOGOL	ADOGOL, RACHELLE	2020-05	2020-04-05	900.00	0.00	900.00	NM	NL	PALOMPON	Villaba 	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xeb7did	PD PALOMPON	3106	Helen	Advincula	Advincula, Helen	2025-02	2024-12-03	11335.00	0.00	11335.00	NM	L	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pm0paom	PD PALOMPON	799	Glecy	Agcang	Agcang, Glecy	2024-08	2017-12-31	1730.00	0.00	1730.00	NM	NL	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vaaujmc	PD KANANGA 	14	Jaime	Agcang	Agcang, Jaime	2019-08	2019-07-01	4760.00	0.00	4760.00	M	L	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kbtiag3	PD BAYBAY	1650	PACIANA	AGRAVANTE	AGRAVANTE, PACIANA	2021-05	2021-04-16	6388.00	0.00	6388.00	NM	NL	BAYBAY	Hilongos 	Pa-a		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jetxqe5	PD BAYBAY	1372	MYRNA	AGUILAR	AGUILAR, MYRNA	2019-11	2019-10-28	5790.00	0.00	5790.00	NM	NL	BAYBAY	Inopacan 	Sto. Rosario St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
v248mak	PD PALOMPON	1834	Dionesia	Aguylo	Aguylo, Dionesia	2024-08	2022-11-26	3442.00	0.00	3442.00	NM	NL	ORMOC	Ormoc	Tambulilid		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bh1ejtm	LITO 	91	EMELIE	ALAG	ALAG, EMELIE	2025-02	2024-12-12	3300.00	0.00	3300.00	M	L	ISABEL	Merida 	Can-unzo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
apg7sh4	ALDIE 	2003	CECILIA	ALAO	ALAO, CECILIA	2025-09	2025-08-02	3300.00	0.00	3300.00	M	L	ORMOC	Albuera 	Balugo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jx2hrit	NOEL	3609	IRINE	ALBARACIN	ALBARACIN, IRINE	2026-01	2025-10-13	3725.00	0.00	3725.00	M	L	PALOMPON	Ormoc	Donghol		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z51pvy0	PD ISABEL 	1902	GENEROSA	ALBOTRA	ALBOTRA, GENEROSA	2021-03	2021-02-05	3525.00	0.00	3525.00	NM	NL	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qjxqu0c	PD ISABEL 	2889	MA. JULYLENE	ALCANTARA	ALCANTARA, MA. JULYLENE	2022-06	2022-05-23	10150.00	0.00	10150.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
95spz5m	EDDIE	2092	RUBELYN	ALDAYA	ALDAYA, RUBELYN	2025-11	2025-09-13	2595.00	0.00	2595.00	M	L	CARIGARA 	Barugo 	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xe1ka3p	PD ISABEL 	3434	VANESSA	ALEGADO	ALEGADO, VANESSA	2024-09	2024-07-24	1122.00	0.00	1122.00	NM	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
818uhmh	PD PALOMPON	798	Ana Marie	Alegre	Alegre, Ana Marie	2020-05	2017-09-15	10570.00	0.00	10570.00	NM	NL	ORMOC	Ormoc	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
74vbr6c	LITO 	1512	MARICEL	ALFECHE	ALFECHE, MARICEL	2025-01	2024-11-20	2471.00	0.00	2471.00	NM	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n9g3gll	PD CARIGARA 	2100	Cynthia	Alfonso	Alfonso, Cynthia	2021-09	2021-08-02	5579.00	0.00	5579.00	NM	NL	CARIGARA	Carigara	Parina		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6lvinms	MASOY	2282	ANNALIE	ALGABA	ALGABA, ANNALIE	2025-07	2025-06-04	11582.00	0.00	11582.00	M	L	BAYBAY	Baybay	Palhi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
iwnhqa5	PD BAYBAY	584	ELENA	ALIARTE	ALIARTE, ELENA	2018-11	2018-09-24	14060.00	0.00	14060.00	NM	NL	BAYBAY	Baybay	Quezon St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
214zr2b	PD KANANGA 	528	Ma. Wilma	Alicante	Alicante, Ma. Wilma	2020-05	2020-04-20	2411.00	0.00	2411.00	NM	NL	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hcu8qar	PD ISABEL 	2415	ARGE	ALINGHAWA	ALINGHAWA, ARGE	2022-04	2022-02-28	4640.00	0.00	4640.00	NM	NL	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rfvvrj7	PD BAYBAY	1376	DIOGRACIA	ALINSOB	ALINSOB, DIOGRACIA	2020-03	2020-02-05	2925.00	0.00	2925.00	NM	NL	BAYBAY	Hilongos 	Pontod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fge35vz	TATA	3491	LISLEY	ALINTON	ALINTON, LISLEY	2026-01	2025-10-10	8120.00	0.00	8120.00	M	L	SAN ISIDRO 	San Isidro 	Bawod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
aq9g35o	LITO 	448	CLEMENS	ALKUINO	ALKUINO, CLEMENS	2025-01	2024-11-25	2395.00	0.00	2395.00	M	L	ISABEL	Isabel	Mahayag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2opq04w	LITO 	1103	JIED	ALKUINO	ALKUINO, JIED	2019-03	2019-02-09	421.00	0.00	421.00	M	L	ISABEL	Isabel	Mahayag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8it3ymi	PD BAYBAY	2932	GREQUE	ALMACIN	ALMACIN, GREQUE	2023-08	2023-07-02	4448.00	0.00	4448.00	NM	NL	BAYBAY	Baybay	Punta 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nxf4glm	PD PALOMPON	2163	MARIZALYN	ALMERINO	ALMERINO, MARIZALYN	2020-04	2021-07-25	4586.00	0.00	4586.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1gwcnbo	PD PALOMPON	2392	RALPH	ALTERADO	ALTERADO, RALPH	2022-09	2021-12-19	5784.00	0.00	5784.00	NM	NL	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ci8u4pi	PD BAYBAY	590	ALEJANRA	ALUDO	ALUDO, ALEJANRA	2018-12	2018-11-15	2416.00	0.00	2416.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2tt3kkd	PD CARIGARA 	2132	Echevarria	Alva	Alva, Echevarria	2021-10	2021-09-09	250.00	0.00	250.00	NM	NL	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zu0p0et	PD BAYBAY	1593	ENECITA	ALVARADO	ALVARADO, ENECITA	2020-04	2020-03-02	3270.00	0.00	3270.00	NM	NL	BAYBAY	Baybay	Veloso St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
84hxnxb	NOEL	1102	JOANN	ALVAREZ	ALVAREZ, JOANN	2025-11	2025-09-22	1700.00	0.00	1700.00	M	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jjpe1dp	EDDIE	3374	Noel	Alvarez	Alvarez, Noel	2024-08	2024-07-13	1864.00	0.00	1864.00	NM	L	CARIGARA	Carigara	Pangna Balilit 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gpgppcr	PD PALOMPON	3620	Richard Jr.	Alvarez	Alvarez, Richard Jr.	2025-07	2025-05-16	2180.00	0.00	2180.00	NMSR	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o35gsgy	TATA	3538	IRENE	AMABAO	AMABAO, IRENE	2025-10	2025-08-02	2850.00	0.00	2850.00	NM	L	SAN ISIDRO 	Tabango 	Campokpok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
31r6m25	PD ISABEL 	434	EDELYN	AMANTE	AMANTE, EDELYN	2017-09	2017-08-24	3625.00	0.00	3625.00	NM	NL	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bbd5mpo	PD PALOMPON	1344	CLARISSA	AMBOS	AMBOS, CLARISSA	2020-02	2020-01-22	5414.00	0.00	5414.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h11s9g4	PD PALOMPON	1343	MARJORIE	AMBOS	AMBOS, MARJORIE	2020-02	2020-01-30	10836.00	0.00	10836.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nv810dl	TATA	3548	CLARITA	AMIL	AMIL, CLARITA	2025-08	2025-05-27	1175.00	0.00	1175.00	NM	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w9tsteu	PD PALOMPON	1072	ERLINDA	AMOSCO	AMOSCO, ERLINDA	2020-03	2020-02-06	4820.00	0.00	4820.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
opzjteo	SUPERVISOR	2133	Jorin	Amoyen	Amoyen, Jorin	2024-09	2024-08-30	1750.00	0.00	1750.00	M	L	KANANGA	Kananga	Hermitage		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rp5hrnz	PD BAYBAY	1687	JEAN	ANADON	ANADON, JEAN	2022-09	2022-08-06	7376.00	0.00	7376.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fdh21pa	PD PALOMPON	630	Marilou	Añasco	Añasco, Marilou	2018-10	2018-08-11	1460.00	0.00	1460.00	NM	L	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nutvdmg	SUPERVISOR	3683	ALICIA	ANDALES	ANDALES, ALICIA	2026-01	2025-10-20	2670.00	0.00	2670.00	NM	L	KANANGA	Villaba	Tagbubunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wkml03x	SUPERVISOR	1432	Janeth	Andales	Andales, Janeth	2023-07	2020-04-13	3440.00	0.00	3440.00	M	L	KANANGA	Matag-ob	Sta. Rosa		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vjifxl4	NOEL	3224	MARY JEAN	ANDALES	ANDALES, MARY JEAN	2025-02	2024-12-17	16365.00	0.00	16365.00	M	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gju21sb	PD BAYBAY	599	VIVENCIA	ANDALES	ANDALES, VIVENCIA	2017-08	2017-07-24	8720.00	0.00	8720.00	NMSR	L	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
htc4hra	LITO 	3104	MARIBEL	ANDO	ANDO, MARIBEL	2025-11	2025-09-27	4450.00	0.00	4450.00	M	L	ISABEL	Merida 	Libas 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3942z7e	EDDIE	3320	MARVIN	ANDO	ANDO, MARVIN	2026-01	2025-10-16	12916.00	0.00	12916.00	M	L	CARIGARA	Capoocan	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qj12rl1	MASOY	3165	MARILYN	ANICETO	ANICETO, MARILYN	2025-01	2024-11-19	6900.00	0.00	6900.00	M	L	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5lxzhn0	PD PALOMPON	3201	Aileen	Anonat	Anonat, Aileen	2023-10	2023-10-02	5911.00	0.00	5911.00	NM	L	ORMOC	Albuera	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
097zk8g	MASOY	1365	ABRAHAM	ANSULA	ANSULA, ABRAHAM	2025-01	2024-11-02	5280.00	0.00	5280.00	NM	NL	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
307xqm3	PD PALOMPON	1415	Hermogina	Antigua	Antigua, Hermogina	2019-09	2019-08-15	4840.00	0.00	4840.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
aot9tjs	PD CARIGARA 	2437	Alex	Antoc	Antoc, Alex	2022-02	2022-01-03	4440.00	0.00	4440.00	NM	NL	CARIGARA	Carigara	Ponong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k6yq8qw	PD BAYBAY	2088	MELISSA	APIPI	APIPI, MELISSA	2025-03	2025-01-05	1510.00	0.00	1510.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
aq703sn	PD PALOMPON	766	Rowena	Apolinar	Apolinar, Rowena	2016-11	2018-01-12	345.00	0.00	345.00	NM	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oiqf3pg	PD PALOMPON	323	Tomas	Apolinar	Apolinar, Tomas	2018-06	2018-05-27	1400.00	0.00	1400.00	NM	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tegl6nh	PD PALOMPON	2252	ANECITO	APUYA	APUYA, ANECITO	2021-10	2021-09-19	1570.00	0.00	1570.00	NM	L	PALOMPON	Ormoc	Juaton		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zoxhn30	ALDIE 	3521	Nida	Arandia	Arandia, Nida	2024-12	2024-11-29	1948.00	0.00	1948.00	M	L	ORMOC	Albuera 	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uozf1to	SUPERVISOR	2770	Mary Jane	Araneta	Araneta, Mary Jane	2022-03	2023-02-06	1866.00	0.00	1866.00	M	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ze3zttu	ALDIE 	828	MA. TAMARA	ARBILON	ARBILON, MA. TAMARA	2025-11	2025-09-22	53500.00	0.00	53500.00	M	L	ORMOC 	Ormoc 	Larrazabal 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0y645l0	MASOY	3183	MITSELDA	ARCENA	ARCENA, MITSELDA	2023-08	2023-07-29	2570.00	0.00	2570.00	NM	L	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lgj2vrr	SUPERVISOR	3090	Juliet	Arcilla	Arcilla, Juliet	2023-07	2023-06-18	4120.00	0.00	4120.00	M	L	KANANGA	Ormoc	San Pablo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8837lvg	TATA	3505	MARGIELINE	ARCIPE	ARCIPE, MARGIELINE	2025-03	2025-01-12	2450.00	0.00	2450.00	M	L	SAN ISIDRO 	San Isidro 	GK Crossing		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5zaa656	EDDIE	2378	Jennifer	Arcosiba	Arcosiba, Jennifer	2022-08	2022-07-09	1888.00	0.00	1888.00	NM	L	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w5iwddt	SUPERVISOR	1144	Editha	Arejola	Arejola, Editha	2022-04	2022-03-11	4100.00	0.00	4100.00	M	L	KANANGA	Matag-ob	Sta. Rosa		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1kpefba	PD KANANGA 	2539	Arther	Arenas	Arenas, Arther	2022-01	2021-12-27	4928.00	0.00	4928.00	NM	L	KANANGA	Ormoc	Sabang Bao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
epivdaa	PD PALOMPON	86	Lenie	Arguilles	Arguilles, Lenie	2017-05	2017-04-16	1049.00	0.00	1049.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p83a9wg	LITO 	1965	FELISA	ARGUMIDO	ARGUMIDO, FELISA	2021-07	2021-06-10	1646.00	0.00	1646.00	M	L	ISABEL	Merida 	Mahalit 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ap8mbc7	ALDIE 	285	Jessa	Ariño	Ariño, Jessa	2017-05	2017-04-28	3823.00	0.00	3823.00	M	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pqup16l	PD PALOMPON	807	Jovita	Ariño	Ariño, Jovita	2017-05	2017-05-12	3508.00	0.00	3508.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3xb74dk	MASOY	1622	RUTH	ARRADAZA	ARRADAZA, RUTH	2020-08	2020-07-22	4900.00	0.00	4900.00	NM	NL	BAYBAY	Baybay	Bonifacio St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7v6hwdd	MASOY	1424	ALMA	ARRANCHADO	ARRANCHADO, ALMA	2022-05	2022-04-04	785.00	0.00	785.00	NM	NL	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wxr6zoi	PD PALOMPON	1090	MELINDA	ARROFO	ARROFO, MELINDA	2019-06	2019-05-17	2233.00	0.00	2233.00	NM	NL	PALOMPON	Villaba	Suba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
npfk9zv	PD PALOMPON	3076	RAQUELLYN	ASAYAS	ASAYAS, RAQUELLYN	2023-10	2023-09-29	29980.00	0.00	29980.00	NM	NL	PALOMPON	Palompon	Mix Palompon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f9yl092	PD PALOMPON	1830	GENICA	ASIS	ASIS, GENICA	2022-05	2022-04-01	1426.00	0.00	1426.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
d31cmdy	NOEL	2687	Nenette	Asmolo	Asmolo, Nenette	2025-06	2025-04-11	9060.00	0.00	9060.00	NM	L	PALOMPON	Villaba	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xcj11hp	PD ISABEL 	3455	RUBEN	ATIZON	ATIZON, RUBEN	2024-10	2024-08-04	1700.00	0.00	1700.00	NM	L	ISABEL	Ormoc	Bagong Buhay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8u8fa72	PD BAYBAY	1683	JUIETA	AUDITOR	AUDITOR, JUIETA	2021-03	2021-02-05	3114.00	0.00	3114.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kni7up9	PD PALOMPON	608	Susan	Aurora	Aurora, Susan	2018-02	2018-01-14	2705.00	0.00	2705.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q8c0n1y	PD PALOMPON	1058	Regina	Autida	Autida, Regina	2019-08	2019-07-25	5810.00	0.00	5810.00	NM	NL	ORMOC	Albuera	Mahayag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ht8gubh	TATA	3544	MELANIE	AVESTRUZ	AVESTRUZ, MELANIE	2026-01	2025-10-11	9950.00	0.00	9950.00	M	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6a1kj3e	PD ISABEL 	1024	GRACE	AWIT	AWIT, GRACE	2019-10	2019-09-26	9400.00	0.00	9400.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1ocznjs	PD CARIGARA 	721	Jeffrey	Ayento	Ayento, Jeffrey	2018-02	2018-01-28	2905.00	0.00	2905.00	NM	L	CARIGARA	Capoocan	Marag-ing		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oh882vg	SUPERVISOR	2582	LIEZEL	BACANG	BACANG, LIEZEL	2025-03	2025-01-31	650.00	0.00	650.00	M	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tznhldg	EDDIE	2069	Jocelyn	Bacarisas	Bacarisas, Jocelyn	2022-07	2022-10-09	2144.00	0.00	2144.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lxmoice	EDDIE	2166	Leny	Bacarisas	Bacarisas, Leny	2022-05	2022-04-21	2110.00	0.00	2110.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l5zte4g	EDDIE	2067	Marilyn	Bacarisas	Bacarisas, Marilyn	2021-07	2021-06-12	1755.00	0.00	1755.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z5gdr1m	TATA	3539	BONIFACIO	BACASON	BACASON, BONIFACIO	2025-08	2025-06-14	2747.00	0.00	2747.00	NM	L	SAN ISIDRO 	Calubian	Espinosa 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e4fkl83	EDDIE	2137	Analyn	Bacatan	Bacatan, Analyn	2021-12	2021-11-13	3200.00	0.00	3200.00	M	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
an80jgp	PD PALOMPON	1083	Felicisima	Baco	Baco, Felicisima	2020-04	2020-03-04	3750.00	0.00	3750.00	NM	L	ORMOC	Ormoc	Can-untog		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t6b27hf	PD PALOMPON	1206	RENO	BACOR	BACOR, RENO	2019-07	2019-06-08	9702.00	0.00	9702.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ti9ymgr	PD BAYBAY	2844	ANABELLA	BACULIO	BACULIO, ANABELLA	2022-11	2022-10-12	1103.00	0.00	1103.00	NM	NL	BAYBAY	Hindang	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lgs4aw8	PD BAYBAY	213	LEA	BACUSMO	BACUSMO, LEA	2020-05	2020-04-12	6020.00	0.00	6020.00	M	L	BAYBAY	Baybay	Sto. Rosario 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2jomry3	EDDIE	2735	Evelyn	Badiable	Badiable, Evelyn	2023-04	2023-03-08	1770.00	0.00	1770.00	M	L	CARIGARA	Carigara	Sawang		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dbwxiu7	EDDIE	2154	Myla	Bagayas	Bagayas, Myla	2022-07	2022-06-10	390.00	0.00	390.00	NM	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9z5lfti	NOEL	2589	MARITES	BAGONG	BAGONG, MARITES	2022-06	2022-05-30	1693.00	0.00	1693.00	M	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
y5091uo	PD BAYBAY	3043	RYAN	BAGUIO	BAGUIO, RYAN	2023-08	2023-07-06	3048.00	0.00	3048.00	NM	NL	BAYBAY	Baybay	San Lucas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
978zaw3	PD PALOMPON	801	JULIET	BAHIAN	BAHIAN, JULIET	2025-01	2024-12-12	3420.00	0.00	3420.00	NM	L	ORMOC	Ormoc	Naungan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l886qii	MASOY	3503	MARIA GEMMA	BALANE	BALANE, MARIA GEMMA	2025-11	2025-09-21	7315.00	0.00	7315.00	M	L	BAYBAY	Hilongos 	Naval		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
we7s01p	PD ISABEL 	1127	NAHEDA	BALDOZA	BALDOZA, NAHEDA	2025-01	2024-11-25	4246.00	0.00	4246.00	NM	L	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wxf4lor	LITO 	2967	MA. KATHLEEN	BALEJON	BALEJON, MA. KATHLEEN	2023-12	2023-11-08	3891.00	0.00	3891.00	M	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7muliqg	PD BAYBAY	2792	DAYMA	BALERIO	BALERIO, DAYMA	2022-07	2022-06-09	3790.00	0.00	3790.00	NM	NL	BAYBAY	Baybay	Sabang		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ohuqcqq	ALDIE 	94	Armida	Balesteros	Balesteros, Armida	2017-11	2017-10-22	4256.00	0.00	4256.00	M	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c3hv04c	TATA	3555	LORENA	BALIDIO	BALIDIO, LORENA	2025-07	2025-04-05	4170.00	0.00	4170.00	NM	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r5r5frv	PD BAYBAY	622	ERA	BALITE	BALITE, ERA	2017-10	2017-09-07	3975.00	0.00	3975.00	NM	NL	BAYBAY	Baybay	Gaas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6wmemfj	NOEL	1797	ZOSIMA	BALMORES	BALMORES, ZOSIMA	2025-07	2025-06-21	3895.00	0.00	3895.00	M	L	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l9vxkop	PD PALOMPON	1498	AMELISA	BALORO	BALORO, AMELISA	2020-05	2020-04-10	4110.00	0.00	4110.00	NM	NL	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zlhrwy6	PD ISABEL 	1887	MARY JOY	BALORO	BALORO, MARY JOY	2021-01	2020-12-25	1290.00	0.00	1290.00	NM	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w2xub3f	SUPERVISOR	2564	Vilma	Baloro	Baloro, Vilma	2022-09	2022-08-23	1960.00	0.00	1960.00	NM	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bxnoww4	PD BAYBAY	378	EMELIA	BALTAZAR	BALTAZAR, EMELIA	2020-03	2020-02-26	9200.00	0.00	9200.00	NM	L	BAYBAY	Baybay	Kilim		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
po0j40z	PD KANANGA 	20	Cristina	Baltonado	Baltonado, Cristina	2024-12	2024-09-30	7092.00	0.00	7092.00	NM	L	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lo97r74	LITO 	3442	ALEXANDER	BAÑEZ	BAÑEZ, ALEXANDER	2025-02	2024-12-20	1609.00	0.00	1609.00	NM	L	ISABEL	Ormoc	San Isidro 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o7xz7c1	LITO 	473	VIRGINIA	BAÑEZ	BAÑEZ, VIRGINIA	2017-11	2017-10-29	2950.00	0.00	2950.00	M	L	ISABEL	Ormoc	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
12ng381	PD ISABEL 	381	NILDA	BANILIDES	BANILIDES, NILDA	2017-07	2017-06-16	4771.00	0.00	4771.00	NM	NL	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ovlj3b0	LITO 	457	DIANE	BAÑO	BAÑO, DIANE	2018-04	2018-03-02	1380.00	0.00	1380.00	M	L	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wqbhmsa	PD PALOMPON	647	Emma	Bantasan	Bantasan, Emma	2017-10	2017-09-01	2950.00	0.00	2950.00	NM	L	ORMOC	Albuera	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f191h22	ALDIE 	3291	Evangeline	Bantes	Bantes, Evangeline	2024-06	2024-05-26	10450.00	0.00	10450.00	M	L	ORMOC	Albuera 	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7r8bdjo	SUPERVISOR	2743	Marylin	Banzon	Banzon, Marylin	2023-05	2023-04-14	7284.00	0.00	7284.00	M	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
naarqgu	LITO 	3565	NINA JEAN	BARCO	BARCO, NINA JEAN	2025-11	2025-08-30	5895.00	0.00	5895.00	NM	L	ISABEL	Isabel 	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c2lv27i	PD BAYBAY	571	MA. VICTORIA	BARCOS	BARCOS, MA. VICTORIA	2018-01	2017-11-18	2304.00	0.00	2304.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lz1vrj9	PD CARIGARA 	2475	Bazel	Bardiago	Bardiago, Bazel	2022-08	2022-07-14	3932.00	0.00	3932.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ntt3ebd	PD PALOMPON	1777	Lilibeth	Barite	Barite, Lilibeth	2023-07	2020-11-30	1908.00	0.00	1908.00	NM	NL	ORMOC	Albuera	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
etkudio	SUPERVISOR	896	Marilyn	Barnaja	Barnaja, Marilyn	2017-07	2017-06-01	4107.00	0.00	4107.00	M	L	KANANGA	Matag-ob	Balagtas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e0kb63p	MASOY	3207	ZENAIDA	BARON	BARON, ZENAIDA	2025-11	2025-09-05	10755.00	0.00	10755.00	NM	L	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1b1cpuq	SUPERVISOR	2963	Rowena	Baronda	Baronda, Rowena	2025-06	2025-05-08	5105.00	0.00	5105.00	NM	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1yu6n1q	NOEL	3594	JANICO	BARILLO	BARILLO, JANICO	2026-01	2025-10-04	2090.00	0.00	2090.00	M	L	PALOMPON	Palompon	Cantuhaon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ujeet41	NOEL	2784	LAARNI	BARILLO	BARILLO, LAARNI	2026-01	2025-09-30	6025.00	0.00	6025.00	M	L	PALOMPON	Palompon	Cantuhaon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lautbnl	PD PALOMPON	1196	CINDY	BARRERA	BARRERA, CINDY	2020-05	2020-04-20	14060.00	0.00	14060.00	NM	NL	PALOMPON	Palompon	Mix Palompon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0qdamli	PD PALOMPON	1242	LILIA	BARRO	BARRO, LILIA	2019-08	2019-07-06	5167.00	0.00	5167.00	NM	NL	PALOMPON	Palompon	Tinubdan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o73c5mt	PD PALOMPON	1012	NAZARIA	BASAN	BASAN, NAZARIA	2019-05	2019-04-24	1480.00	0.00	1480.00	NM	NL	PALOMPON	Palompon	Lomonon 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q1r5t4j	PD CARIGARA 	2146	Juvelyn	Basiento	Basiento, Juvelyn	2021-08	2021-07-22	4900.00	0.00	4900.00	NM	NL	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hkah4k1	PD BAYBAY	1771	CARMELITA	BASMAYOR	BASMAYOR, CARMELITA	2025-02	2024-12-02	2688.00	0.00	2688.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xbaatax	LITO 	1949	ROSE ANN	BASTASA	BASTASA, ROSE ANN	2025-11	2025-09-01	2940.00	0.00	2940.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4gipecr	PD PALOMPON	354	Donavil	Batulan	Batulan, Donavil	2019-04	2019-03-22	2855.00	0.00	2855.00	NM	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
14p1rpx	NOEL	3086	BETTY	BAUTISTA	BAUTISTA, BETTY	2024-12	2024-10-05	4045.00	0.00	4045.00	NM	L	PALOMPON	Palompon	Cantandoy 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qe68crp	PD PALOMPON	1006	AMY	BAYLON	BAYLON, AMY	2019-06	2019-05-09	4413.00	0.00	4413.00	NM	NL	PALOMPON	Palompon	San Miguel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i793c8o	PD CARIGARA 	2109	Geraldine	Baylon	Baylon, Geraldine	2023-07	2021-07-02	1155.00	0.00	1155.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dgafdry	PD BAYBAY	2675	MARISA	BAYO	BAYO, MARISA	2023-01	2022-12-02	845.00	0.00	845.00	NM	L	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ncspymk	PD BAYBAY	3085	MELANIE	BELARMINO	BELARMINO, MELANIE	2024-03	2024-01-16	2516.00	0.00	2516.00	NM	NL	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cgnimi4	PD BAYBAY	1335	ARLENE	BELMORES	BELMORES, ARLENE	2020-05	2020-04-23	3450.00	0.00	3450.00	M	L	BAYBAY	Baybay	Hipusngo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dma9kwb	LITO 	471	IRENE	BELTRAN	BELTRAN, IRENE	2025-03	2025-01-30	16620.00	0.00	16620.00	M	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vrqyfl8	PD CARIGARA 	2302	Jessa	Benis	Benis, Jessa	2022-03	2022-02-06	4136.00	0.00	4136.00	NM	NL	CARIGARA	Carigara	Ponong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
26j4xhv	PD ISABEL 	2191	ERNESTO	BENTOY	BENTOY, ERNESTO	2025-03	2025-02-06	16795.00	0.00	16795.00	NM	L	ISABEL	Isabel	Public Market 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n4c4mrk	MASOY	1653	BELINDA	BENTULAN	BENTULAN, BELINDA	2024-04	2024-01-31	236.00	0.00	236.00	M	L	BAYBAY	Hilongos 	Western Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
u5a9554	PD PALOMPON	1974	Aidene	Benzal	Benzal, Aidene	2021-09	2021-08-01	3150.00	0.00	3150.00	NM	L	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ylke8md	PD BAYBAY	566	ANA ROBERTA	BERMAS	BERMAS, ANA ROBERTA	2018-04	2018-03-19	5170.00	0.00	5170.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ovm69ff	PD PALOMPON	3152	Nenita	Bernal	Bernal, Nenita	2024-12	2024-11-12	6340.00	0.00	6340.00	NM	L	ORMOC	Albuera	Cambalading		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g120fgn	PD BAYBAY	2259	MELANIE	BETONIO	BETONIO, MELANIE	2025-02	2024-12-08	1731.00	0.00	1731.00	NM	NL	BAYBAY	Hindang	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6e06ae5	LITO 	120	JELEN	BETOY	BETOY, JELEN	2024-08	2024-06-25	7196.00	0.00	7196.00	M	L	ISABEL	Isabel	Tubod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4hrdx7j	MASOY	1708	GEMMARIE	BIBERA	BIBERA, GEMMARIE	2025-03	2025-01-06	2000.00	0.00	2000.00	M	L	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i5cjb0r	PD PALOMPON	1045	JENNIFER	BIÑAS	BIÑAS, JENNIFER	2018-11	2018-09-22	2190.00	0.00	2190.00	NM	L	PALOMPON	Palompon	Lomonon 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lgu9u6w	NOEL	3228	JONALYN	BIORE	BIORE, JONALYN	2024-10	2024-08-20	4314.00	0.00	4314.00	M	L	PALOMPON	Villaba 	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4i43dd5	PD ISABEL 	1544	ALAN	BOHOL	BOHOL, ALAN	2020-05	2020-04-09	9810.00	0.00	9810.00	NM	L	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
98cb1pr	MASOY	3470	NOREEN	BOKERON	BOKERON, NOREEN	2025-10	2025-07-12	3910.00	0.00	3910.00	NMSR	L	BAYBAY	Baybay	Gaas 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
d3ptrpq	LITO 	3575	Marissa	Boiser	Boiser, Marissa	2025-04	2025-03-23	2000.00	0.00	2000.00	M	L	ISABEL	Merida	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x79o71w	PD BAYBAY	3273	GRACE	BOLIAS	BOLIAS, GRACE	2024-12	2024-10-10	2758.00	0.00	2758.00	M	L	BAYBAY	Baybay	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
edzdbh6	NOEL	1098	DIOSDADA	BOLOY	BOLOY, DIOSDADA	2019-07	2019-06-27	5290.00	0.00	5290.00	NM	L	PALOMPON	Kananga	Montebello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9zdcxti	PD PALOMPON	3204	JANICE	BONCALES	BONCALES, JANICE	2025-07	2025-05-17	5585.00	0.00	5585.00	NM	L	PALOMPON	Villaba 	Casilion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mq7ykfz	MASOY	3493	ALEJANDRO	BONGCO	BONGCO, ALEJANDRO	2025-11	2025-09-23	2080.00	0.00	2080.00	M	L	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8zyqj28	PD BAYBAY	624	JUVELYN	BORLASA	BORLASA, JUVELYN	2017-06	2017-05-10	5123.00	0.00	5123.00	NMSR	L	BAYBAY	Baybay	Kilim		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cqa9uaw	EDDIE	2916	Wilson	Borromeo	Borromeo, Wilson	2023-01	2022-11-14	3086.00	0.00	3086.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
urdjj7r	TATA	3576	ELVIE	BOYO	BOYO, ELVIE	2026-01	2025-09-30	1610.00	0.00	1610.00	M	L	SAN ISIDRO 	Tabango	Inangatan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
21a805g	PD ISABEL 	462	NELSA	BREGILDA	BREGILDA, NELSA	2017-11	2017-10-20	2089.00	0.00	2089.00	NM	NL	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5039fis	PD PALOMPON	2324	HERMINIGILDA	BRIONES	BRIONES, HERMINIGILDA	2022-11	2022-10-08	2925.00	0.00	2925.00	NM	NL	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ec41cqq	MASOY	1936	FRIDAY LUZ	BRUFAL	BRUFAL, FRIDAY LUZ	2021-02	2021-01-20	1530.00	0.00	1530.00	NM	NL	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
s02af1d	PD CARIGARA 	2152	Jessica	Buena	Buena, Jessica	2021-10	2021-09-11	2388.00	0.00	2388.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tt0odem	PD PALOMPON	1789	Susie	Buenaflor	Buenaflor, Susie	2021-04	2021-03-19	2265.00	0.00	2265.00	NM	L	ORMOC	Albuera	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hnga1ka	PD PALOMPON	3411	RETCHEL	BURDIOS	BURDIOS, RETCHEL	2025-01	2024-11-17	2265.00	0.00	2265.00	NM	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
atziby5	PD KANANGA 	2014	Annaliza	Burla	Burla, Annaliza	2021-09	2021-07-31	3460.00	0.00	3460.00	NM	NL	KANANGA	Ormoc	Salvacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t59lqqq	MASOY	3122	Rodelina	Cabahit	Cabahit, Rodelina	2025-06	2025-04-13	1321.00	0.00	1321.00	M	L	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
et3s74y	PD ISABEL 	324	ELSA	CABALLERO	CABALLERO, ELSA	2019-03	2019-02-23	3903.00	0.00	3903.00	NM	NL	ISABEL	Ormoc	Naungan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nnu86k6	PD ISABEL 	3403	MARY-AN	CABALLERO	CABALLERO, MARY-AN	2024-05	2024-04-27	4470.00	0.00	4470.00	NM	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
76mycs8	PD CARIGARA 	2111	Nida	Caballes	Caballes, Nida	2021-10	2021-09-12	8240.00	0.00	8240.00	NM	L	CARIGARA	Carigara	Ponong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7yppmu2	PD PALOMPON	2689	Felisa	Cabaltera	Cabaltera, Felisa	2023-07	2022-03-25	1950.00	0.00	1950.00	NM	NL	ORMOC	Albuera	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1laqy7a	PD PALOMPON	3185	Alvin	Cabaluna	Cabaluna, Alvin	2024-04	2024-03-18	1589.00	0.00	1589.00	NMSR	NL	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bc1jjjr	PD PALOMPON	1185	IRENE	CABANA	CABANA, IRENE	2019-11	2019-10-18	7270.00	0.00	7270.00	NM	L	PALOMPON	Palompon	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
onpqd16	MASOY	3119	ESTILA	CABILOGAN	CABILOGAN, ESTILA	2025-11	2025-09-22	8525.00	0.00	8525.00	M	L	BAYBAY	Inopacan 	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
08hiz5j	ALDIE 	3264	Julia	Cabingas	Cabingas, Julia	2024-12	2024-11-26	21467.00	0.00	21467.00	M	L	ORMOC	Albuera 	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pzwdy5i	ALDIE 	3132	IRENE	CABINTOY	CABINTOY, IRENE	2025-11	2025-08-30	8135.00	0.00	8135.00	M	L	ORMOC	Albuera 	Talisayan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rsl3rw2	PD BAYBAY	1697	CORTESA	CABRADILLA	CABRADILLA, CORTESA	2022-11	2022-09-03	4448.00	0.00	4448.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wn31tpz	PD CARIGARA 	2096	Fel-am	Cabuting	Cabuting, Fel-am	2021-07	2021-06-20	3675.00	0.00	3675.00	NM	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b9403o8	PD BAYBAY	1709	LEONILA	CAGADAS	CAGADAS, LEONILA	2022-11	2022-10-12	2181.00	0.00	2181.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yzfand0	PD PALOMPON	1950	MARIBEL	CAGALITAN	CAGALITAN, MARIBEL	2022-06	2022-05-09	158700.00	0.00	158700.00	NM	L	PALOMPON	Palompon	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yr6v036	PD CARIGARA 	2427	Melanie S.	Cagampang	Cagampang, Melanie S.	2021-11	2021-10-09	3870.00	0.00	3870.00	NM	L	CARIGARA	Capoocan	Balud		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ath0lr3	MASOY	3154	MERLITA	CAILING	CAILING, MERLITA	2023-08	2023-07-15	2028.00	0.00	2028.00	NM	L	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sz40uhu	PD BAYBAY	3137	ERNITA	CAJARA	CAJARA, ERNITA	2023-04	2023-03-06	1038.00	0.00	1038.00	NM	NL	BAYBAY	Inopacan 	Tao-Taon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
24tbhqo	MASOY	3356	LOUIE JAY	CALA	CALA, LOUIE JAY	2025-01	2024-11-24	68340.00	0.00	68340.00	M	L	BAYBAY	Baybay	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2iouq7r	PD ISABEL 	1105	MARIBETH	CALABRIA	CALABRIA, MARIBETH	2020-03	2020-02-21	2164.00	0.00	2164.00	NM	NL	ISABEL	Isabel	Sto. Rosario 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qs05uzt	TATA	3499	ESIEL	CALAMINOS	CALAMINOS, ESIEL	2026-01	2025-10-26	6670.00	0.00	6670.00	M	L	SAN ISIDRO 	San Isidro	Bawod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ogj63g3	PD BAYBAY	1729	MARIA CORAZON	CALAPE	CALAPE, MARIA CORAZON	2020-05	2020-04-20	3728.00	0.00	3728.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wx9wq6v	MASOY	3490	ANNALIE	CALAYUGAN	CALAYUGAN, ANNALIE	2025-10	2025-07-28	7190.00	0.00	7190.00	NM	L	BAYBAY 	Baybay	Patag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
535nvrq	PD KANANGA 	2020	Rustico	Caliwan	Caliwan, Rustico	2021-12	2021-11-07	3105.00	0.00	3105.00	NM	NL	KANANGA	Kananga	Natubgan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pzmvchh	PD PALOMPON	1276	ROSEMARIE	CALO	CALO, ROSEMARIE	2020-04	2020-03-13	1883.00	0.00	1883.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bxhrcqm	PD PALOMPON	327	Julito	Calumpag	Calumpag, Julito	2018-11	2018-10-23	20850.00	0.00	20850.00	NM	NL	ORMOC	Ormoc	Cogon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ngix1p5	LITO 	218	ERWIN	CALVEZ	CALVEZ, ERWIN	2018-03	2018-02-10	680.00	0.00	680.00	M	L	ISABEL	Ormoc	San Juan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c1zmryy	PD BAYBAY	3473	LUZFEL	CAMINGAO	CAMINGAO, LUZFEL	2024-12	2024-10-15	2755.00	0.00	2755.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m0lc42e	PD ISABEL 	444	ANALIE	CAMPEHIOS	CAMPEHIOS, ANALIE	2018-01	2017-12-25	1240.00	0.00	1240.00	NM	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l7zm6k7	PD CARIGARA 	744	Jerry	Campita	Campita, Jerry	2022-06	2022-05-20	17820.00	0.00	17820.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i1qq7de	PD CARIGARA 	2103	Jennifer	Cañamaque	Cañamaque, Jennifer	2021-11	2021-10-17	2146.00	0.00	2146.00	NM	L	CARIGARA	Carigara	San Mateo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rlsvhmn	TATA	3637	JENNIFER	CAÑETE	CAÑETE, JENNIFER	2026-01	2025-10-17	5150.00	0.00	5150.00	M	L	SAN ISIDRO 	Leyte-Leyte 	Burabod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xgkphkt	MASOY	3482	MARIA ESTHER	CAÑETE	CAÑETE, MARIA ESTHER	2025-10	2025-07-12	3810.00	0.00	3810.00	NM	L	BAYBAY	Baybay	Gaas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j65bqg8	PD PALOMPON	3451	NAUME	CAÑETE	CAÑETE, NAUME	2025-01	2024-11-20	10050.00	0.00	10050.00	NM	NL	PALOMPON	Isabel 	Puting Bato		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uvhhtse	LITO 	437	CRISTITA	CANONEO	CANONEO, CRISTITA	2018-01	2017-12-04	1875.00	0.00	1875.00	NM	L	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pe24a5p	LITO 	165	MA. MARISSA	CANONEO	CANONEO, MA. MARISSA	2020-05	2020-04-16	531.00	0.00	531.00	M	L	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qreo2g5	PD ISABEL 	1347	JEMMAR	CANTAGO	CANTAGO, JEMMAR	2020-04	2020-03-19	4580.00	0.00	4580.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jxyenag	PD PALOMPON	1435	Francisco	Cantiga	Cantiga, Francisco	2019-10	2019-09-04	3440.00	0.00	3440.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kaiar4v	PD PALOMPON	1416	Jocelyn	Cantiga	Cantiga, Jocelyn	2019-10	2019-08-31	1198.00	0.00	1198.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
33kzwvu	PD BAYBAY	2007	MA. ELMA	CANTONES	CANTONES, MA. ELMA	2021-07	2021-06-28	1756.00	0.00	1756.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bxj786z	PD PALOMPON	1007	LANMAR	CAOBAT	CAOBAT, LANMAR	2022-06	2022-03-19	1115.00	0.00	1115.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9f7l8hn	PD CARIGARA 	2616	Estrellita	Caones	Caones, Estrellita	2023-07	2023-06-09	3360.00	0.00	3360.00	M	L	CARIGARA	Capoocan	Daraupay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
db9f9ge	PD PALOMPON	1785	MICHELLE	CAPENDIT	CAPENDIT, MICHELLE	2023-01	2022-12-17	759.00	0.00	759.00	NM	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oyjk619	PD CARIGARA 	2048	Gina	Capones	Capones, Gina	2022-11	2022-10-13	9315.00	0.00	9315.00	NM	NL	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1w55yo1	SUPERVISOR	3544	Cresilda	Capuyan	Capuyan, Cresilda	2024-11	2024-10-10	11350.00	0.00	11350.00	NMSR	L	KANANGA	Kananga	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kibmgst	PD PALOMPON	2440	Argie	Carba	Carba, Argie	2025-04	2025-03-09	4510.00	0.00	4510.00	NM	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b98iwpw	EDDIE	2140	Jenefer	Cardines	Cardines, Jenefer	2021-08	2021-07-16	74.00	0.00	74.00	NM	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vjpm835	PD CARIGARA 	2384	Marilyn	Cardines	Cardines, Marilyn	2021-12	2021-11-01	786.00	0.00	786.00	NM	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
834z6kz	PD ISABEL 	2512	FRICEVILL	CARILLAS	CARILLAS, FRICEVILL	2022-03	2023-02-16	1946.00	0.00	1946.00	NM	NL	ISABEL	Isabel	Monte Alegre 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o62thle	ALDIE 	145	Jelbie	Carnetes	Carnetes, Jelbie	2024-08	2024-07-08	5941.00	0.00	5941.00	M	L	ORMOC	Albuera	Benolho		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x2hhug9	PD PALOMPON	3263	Anna Marie	Casane	Casane, Anna Marie	2023-09	2023-08-22	8070.00	0.00	8070.00	NM	L	ORMOC	Albuera	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pwpbn16	PD BAYBAY	1408	NONITA	CASANE	CASANE, NONITA	2019-12	2019-11-15	6240.00	0.00	6240.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
y216cz5	PD BAYBAY	1831	JOSEPH	CASINILLO	CASINILLO, JOSEPH	2021-04	2021-03-27	4430.00	0.00	4430.00	NM	NL	BAYBAY	Hindang	Public Market 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n9vk8dv	EDDIE	2419	Ginalin S.	Castañeda	Castañeda, Ginalin S.	2022-08	2022-07-04	1390.00	0.00	1390.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9s94t1p	PD CARIGARA 	719	Charlita	Castillos	Castillos, Charlita	2017-08	2017-07-27	8590.00	0.00	8590.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ut9fvqi	PD PALOMPON	1099	MARIANNE	CASTRO	CASTRO, MARIANNE	2019-08	2019-07-15	11589.00	0.00	11589.00	NM	NL	PALOMPON	Kananga	Montebello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
70bxd0x	NOEL	2320	DANIELA	CATAAG	CATAAG, DANIELA	2022-07	2022-06-05	402.00	0.00	402.00	M	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k53tcwh	NOEL	3688	LEONARDO	CATAAG	CATAAG, LEONARDO	2026-01	2025-10-31	4010.00	0.00	4010.00	M	L	PALOMPON	Ormoc	Coob		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6oln1y6	PD PALOMPON	2424	Jovelyn	Catagcatag	Catagcatag, Jovelyn	2022-11	2022-09-29	2270.00	0.00	2270.00	NMSR	L	ORMOC	Ormoc	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hjc1o16	EDDIE	3096	ALVIN	CAUBALEJO	CAUBALEJO, ALVIN	2025-11	2025-09-21	3380.00	0.00	3380.00	NM	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
46ejagh	MASOY	3481	FELLY	CAVENTOY	CAVENTOY, FELLY	2025-11	2025-09-22	4910.00	0.00	4910.00	M	L	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gx9xrz3	MASOY	3255	LETECIA	CAYA	CAYA, LETECIA	2024-07	2024-04-30	560.00	0.00	560.00	M	L	BAYBAY	Baybay	Recto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8kx2s5a	MASOY	2979	DINO	CAYANONG	CAYANONG, DINO	2023-01	2022-12-24	2622.00	0.00	2622.00	M	L	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wt8jwxx	PD BAYBAY	3125	JONNA	CAYUNDA	CAYUNDA, JONNA	2023-10	2023-09-27	7480.00	0.00	7480.00	NM	L	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
924pthf	EDDIE	2124	Rona	Cedillo	Cedillo, Rona	2022-07	2022-06-29	1012.00	0.00	1012.00	M	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r1137nx	PD BAYBAY	3190	EMILY	CERRO	CERRO, EMILY	2023-09	2023-07-31	1731.00	0.00	1731.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oe33zfx	PD ISABEL 	254	CECILIA	CILLADO	CILLADO, CECILIA	2018-06	2018-05-17	9460.00	0.00	9460.00	NM	NL	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
u1clfge	PD BAYBAY	3479	ERMA	CINCO	CINCO, ERMA	2024-12	2024-10-16	4841.00	0.00	4841.00	NM	NL	BAYBAY	Hilongos 	Talisay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4pzook3	PD BAYBAY	2000	CRISTINA	CLEMENTE	CLEMENTE, CRISTINA	2025-03	2025-01-11	1515.00	0.00	1515.00	NM	NL	BAYBAY	Inopacan 	Tao-Taon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gruncm8	PD PALOMPON	113	Lilibeth	Colandog	Colandog, Lilibeth	2021-12	2021-11-23	8178.00	0.00	8178.00	NM	L	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
s5fnv3t	PD CARIGARA 	2117	Aster	Colanta	Colanta, Aster	2021-09	2021-08-01	4519.00	0.00	4519.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cspel9w	EDDIE	3828	MARVIN	COLATA	COLATA, MARVIN	2026-01	2025-11-13	452.00	0.00	452.00	M	L	CARIGARA	Barugo	Bukid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6gmmdhf	PD PALOMPON	47	Aiza	Colo	Colo, Aiza	2017-07	2017-06-24	1426.00	0.00	1426.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sys49lh	SUPERVISOR	3395	Niecy Ada	Commendador	Commendador, Niecy Ada	2024-11	2024-09-01	4540.00	0.00	4540.00	M	L	KANANGA	Ormoc	Danhug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ip6qonj	NOEL	3425	JESEL	CONCILLADO	CONCILLADO, JESEL	2025-01	2024-11-07	8445.00	0.00	8445.00	M	L	PALOMPON	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pn3w4tp	PD BAYBAY	3089	ADELINA	CONCILLO	CONCILLO, ADELINA	2024-02	2023-12-04	1762.00	0.00	1762.00	M	L	BAYBAY	Baybay	Recto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gy8ejul	ALDIE 	3524	Esterlita	Concillo	Concillo, Esterlita	2025-04	2025-03-05	2914.00	0.00	2914.00	M	L	ORMOC	Albuera	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r7aggfm	TATA	3523	CHARLYN	CONEJOS	CONEJOS, CHARLYN	2025-11	2025-09-01	3795.00	0.00	3795.00	NMSR	L	SAN ISIDRO 	Tabango	Campokpok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xsjbwxz	PD PALOMPON	1011	Elsa	Conejos	Conejos, Elsa	2023-07	2018-07-27	2550.00	0.00	2550.00	NM	NL	ORMOC	Ormoc	Ormoc Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ehgxtvb	PD ISABEL 	333	Yvone Faith	Contridas	Contridas, Yvone Faith	2019-06	2024-11-07	4440.00	0.00	4440.00	NM	NL	ISABEL	Ormoc	Lilo-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
57jzx9l	PD CARIGARA 	2182	Debie	Corbe	Corbe, Debie	2021-09	2021-08-01	450.00	0.00	450.00	NM	L	CARIGARA	Carigara	Parag-um		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
brzwvq8	LITO 	3340	ARACELI	CORCELLES	CORCELLES, ARACELI	2025-11	2025-09-20	5300.00	0.00	5300.00	M	L	 ISABEL	Isabel	Alipasa 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kmleckw	PD PALOMPON	1048	RAILYN	CORDILLO	CORDILLO, RAILYN	2018-11	2018-09-06	4460.00	0.00	4460.00	NM	NL	PALOMPON	Villaba	Abijao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7jnt31u	LITO 	3731	ANA CIELO	COROT	COROT, ANA CIELO	2025-11	2025-09-29	2850.00	0.00	2850.00	NM	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6nt0agb	MASOY	3471	NECIFORA	CORPEZ	CORPEZ, NECIFORA	2025-07	2025-06-20	5880.00	0.00	5880.00	NM	L	BAYBAY	Inopacan 	Esperanza 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yq4sybl	PD CARIGARA 	2300	Dally	Corpin	Corpin, Dally	2022-04	2022-03-20	1212.00	0.00	1212.00	NM	NL	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g13dmwc	SUPERVISOR	2544	Hershe Mary	Corpin	Corpin, Hershe Mary	2022-07	2022-06-25	960.00	0.00	960.00	NM	L	KANANGA	Ormoc	Sabang Bao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h1fz3c6	LITO 	225	MARIBEL	CORZON	CORZON, MARIBEL	2024-05	2019-05-10	4961.00	0.00	4961.00	M	L	ISABEL	Isabel	Isabel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yeb29fn	PD PALOMPON	1030	NORELIE	COSTELO	COSTELO, NORELIE	2019-01	2018-12-10	4778.00	0.00	4778.00	NM	NL	PALOMPON	Palompon	San Miguel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2np90a6	NOEL	2389	PERLITA	COSTORIO	COSTORIO, PERLITA	2022-04	2022-03-29	1480.00	0.00	1480.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
grvwhf8	PD PALOMPON	813	Martiniana	Covero	Covero, Martiniana	2017-04	2017-03-22	1185.00	0.00	1185.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bxsjxcm	PD BAYBAY	1752	MARIA CRISANTA	CROOC	CROOC, MARIA CRISANTA	2020-06	2020-05-03	4673.00	0.00	4673.00	NM	NL	BAYBAY	Hilongos 	Vilbar St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0gjv9fn	PD BAYBAY	583	NENITA	CRUZA	CRUZA, NENITA	2018-10	2018-08-20	3750.00	0.00	3750.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dep7u6z	PD KANANGA 	1140	Nenita	Cuizon	Cuizon, Nenita	2024-08	2020-04-13	1000.00	0.00	1000.00	NM	L	KANANGA	Matag-ob	Mansalip		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
13lw0f2	TATA	3688	LIGAYA	CUNAG	CUNAG, LIGAYA	2026-01	2025-11-14	950.00	0.00	950.00	M	L	SAN ISIDRO 	San Isidro 	Biasong 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oh47k88	PD PALOMPON	2213	Janet	Dabalos	Dabalos, Janet	2022-01	2021-12-27	1832.00	0.00	1832.00	M	L	ORMOC	Albuera	Tagbas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g0tvfmv	PD KANANGA 	2251	Samuel	Dabucol	Dabucol, Samuel	2021-08	2021-07-29	1812.00	0.00	1812.00	NM	L	KANANGA	Kananga	Natubgan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1v8t5cx	PD CARIGARA 	3272	Allen	Dacara	Dacara, Allen	2024-08	2024-06-10	3916.00	0.00	3916.00	NM	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cyy2e1m	PD CARIGARA 	3375	Emiliano	Dacara	Dacara, Emiliano	2025-02	2024-12-28	6076.00	0.00	6076.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mini3a8	EDDIE	344	Michelle	Dadis	Dadis, Michelle	2020-05	2020-04-10	3380.00	0.00	3380.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
y0hgz8t	PD BAYBAY	1574	JOSE JOSELITO	DADULA	DADULA, JOSE JOSELITO	2025-02	2024-12-27	2251.00	0.00	2251.00	M	L	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hx8cafe	LITO 	2941	MIRIAM	DAGPIN	DAGPIN, MIRIAM	2025-02	2024-12-05	3682.00	0.00	3682.00	M	L	ISABEL	Ormoc	Bagong Buhay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bpx0kni	SUPERVISOR	2832	Cristy	Dahoya	Dahoya, Cristy	2024-12	2024-11-05	4326.00	0.00	4326.00	NM	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hd4whx2	SUPERVISOR	2957	Beverly	Dajoya	Dajoya, Beverly	2024-11	2024-10-29	635.00	0.00	635.00	M	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
owzgej7	EDDIE	331	Rosita	Dalde	Dalde, Rosita	2024-08	2019-07-20	3300.00	0.00	3300.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yjyxp36	EDDIE	2054	Emalyn	Dandan	Dandan, Emalyn	2022-07	2022-06-09	13085.00	0.00	13085.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cabmcju	MASOY	631	ROMAN JR .	DANGCOLIS	DANGCOLIS, ROMAN JR .	2018-05	2018-04-13	1014.00	0.00	1014.00	M	L	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
apxtqw6	PD BAYBAY	1322	MALOU	DANIEL	DANIEL, MALOU	2020-01	2019-12-13	6640.00	0.00	6640.00	NM	NL	BAYBAY	Baybay	Taytayan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cfg4q61	LITO 	401	TARCELA	DAÑOLA	DAÑOLA, TARCELA	2020-05	2020-04-17	3165.00	0.00	3165.00	M	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tw3icdr	PD CARIGARA 	2883	Ritchell	Darantinao	Darantinao, Ritchell	2024-01	2023-12-07	5266.00	0.00	5266.00	NM	NL	CARIGARA	Barugo	Abango		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zagss0g	PD BAYBAY	594	MARILYN	DARASIN	DARASIN, MARILYN	2017-04	2017-03-11	1937.00	0.00	1937.00	NM	NL	BAYBAY	Baybay	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jlo3evj	EDDIE	2640	Irish	David	David, Irish	2023-09	2023-08-27	7175.00	0.00	7175.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jli999r	PD PALOMPON	2460	MARYROSE	DAVIDON	DAVIDON, MARYROSE	2021-12	2021-11-07	974.00	0.00	974.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0jmrvz1	PD PALOMPON	335	Amy	Dawatan	Dawatan, Amy	2018-06	2018-05-07	3980.00	0.00	3980.00	NM	NL	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
d6etv2y	PD KANANGA 	1393	Jonavel	Dayanan	Dayanan, Jonavel	2019-07	2019-06-16	2240.00	0.00	2240.00	NM	NL	KANANGA	Matag-ob	Mansalip		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
70u5g9g	EDDIE	2078	Eddie	De Antonio	De Antonio, Eddie	2022-09	2022-08-25	894.00	0.00	894.00	M	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dr53cfv	NOEL	3510	JUVELYN	DE ASER	DE ASER, JUVELYN	2025-07	2025-06-06	2375.00	0.00	2375.00	M	L	PALOMPON	Palompon	Baguinbin		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
woelmmx	TATA	3638	MARIAFE	DE QUINTOS	DE QUINTOS, MARIAFE	2024-01	2023-12-27	609.00	0.00	609.00	M	L	SAN ISIDRO 	Leyte-Leyte 	Belen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
82icak7	PD PALOMPON	1022	GILBERT	DECLAROS	DECLAROS, GILBERT	2019-06	2019-05-25	35612.00	0.00	35612.00	NM	L	PALOMPON	Palompon	Zamora 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m38md4o	NOEL	3709	SUSANA	DEGAMO	DEGAMO, SUSANA	2026-01	2025-11-11	2072.00	0.00	2072.00	M	L	PALOMPON	Villaba 	Tagbubunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yz9w24c	LITO 	3032	MADEL	DEJAÑO	DEJAÑO, MADEL	2024-12	2024-10-20	5400.00	0.00	5400.00	M	L	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0yuqmxi	LITO 	1139	ROSALIE	DEJAÑO	DEJAÑO, ROSALIE	2021-03	2021-02-14	810.00	0.00	810.00	NM	L	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
87ijxfr	PD ISABEL 	3334	ELISA	DEJON	DEJON, ELISA	2024-06	2024-05-11	4794.00	0.00	4794.00	NM	L	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fppoz8r	PD PALOMPON	980	MARYLIA	DELA CERNA	DELA CERNA, MARYLIA	2020-04	2020-03-15	2697.00	0.00	2697.00	NM	NL	PALOMPON	Villaba	Cabungahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m07nbff	NOEL	3827	ELMA	DELA CRUZ	DELA CRUZ, ELMA	2026-01	2025-11-09	507.00	0.00	507.00	M	L	PALOMPON	Isabel	Anislag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yopcfdd	PD BAYBAY	1268	MARILYN	DELA CRUZ	DELA CRUZ, MARILYN	2019-01	2018-12-28	1400.00	0.00	1400.00	NM	NL	BAYBAY	Baybay	Bonifacio St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sarafqt	PD BAYBAY	1470	RAUL	DELA CRUZ	DELA CRUZ, RAUL	2021-10	2021-09-26	4356.00	0.00	4356.00	NM	NL	BAYBAY	Baybay	Palhi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xcuhq00	PD KANANGA 	2573	Shayne Marie France	Dela Cruz	Dela Cruz, Shayne Marie France	2022-02	2022-01-23	728.00	0.00	728.00	NM	NL	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
eujn3ow	PD PALOMPON	1266	Charisma	Dela Rosa	Dela Rosa, Charisma	2023-07	2023-05-24	1182.00	0.00	1182.00	NM	NL	ORMOC	Ormoc	Lilo-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
83dik30	PD CARIGARA 	2948	Iluminada	Delantar	Delantar, Iluminada	2024-08	2022-10-24	2587.00	0.00	2587.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jb2nr1h	PD CARIGARA 	220	Janeth	Delarama	Delarama, Janeth	2024-08	2020-04-10	1520.00	0.00	1520.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
iiz5apn	PD PALOMPON	1413	Maria Brenda	Deleon	Deleon, Maria Brenda	2019-09	2019-08-26	1940.00	0.00	1940.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lpuvqlg	SUPERVISOR	546	Rosemarie	Delfin	Delfin, Rosemarie	2020-01	2019-12-06	5862.00	0.00	5862.00	M	L	KANANGA	Ormoc	Catmon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ljbymov	PD KANANGA 	34	Elsa	Delima	Delima, Elsa	2018-03	2018-02-02	2230.00	0.00	2230.00	NM	L	KANANGA	Kananga	Libongao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c0q1skn	PD PALOMPON	1931	Gary	Dellosa	Dellosa, Gary	2021-11	2021-10-01	4460.00	0.00	4460.00	NM	L	ORMOC	Ormoc	Patag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5zfg0fa	PD BAYBAY	2004	NORA	DELOVIO	DELOVIO, NORA	2023-07	2021-03-10	2700.00	0.00	2700.00	NM	L	BAYBAY	Baybay	Juanbaquerfo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c24wafo	MASOY	3698	MERLE	DEMANDANTE	DEMANDANTE, MERLE	2025-11	2025-09-15	1111.00	0.00	1111.00	NM	L	BAYBAY	Albuera	Damulaan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
96455lw	SUPERVISOR	3357	Glenn	Demetrio	Demetrio, Glenn	2025-02	2024-12-13	13367.00	0.00	13367.00	NM	L	KANANGA	Matag-ob	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4schs2j	ALDIE 	361	Emma	Denzo	Denzo, Emma	2024-09	2024-08-24	3506.00	0.00	3506.00	M	L	ORMOC	Ormoc	Naungan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
skr7j4y	PD PALOMPON	3022	Marieta O.	Deveyra	Deveyra, Marieta O.	2024-06	2024-03-14	4641.00	0.00	4641.00	M	L	ORMOC	Ormoc	Bantigue		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
s4r9nj1	PD PALOMPON	2548	Thelma	Diango	Diango, Thelma	2022-11	2022-09-29	4480.00	0.00	4480.00	NM	NL	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1ubk13o	MASOY	3069	ANGELIE	DIANO	DIANO, ANGELIE	2024-03	2023-12-31	1658.00	0.00	1658.00	NM	NL	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
syuig8p	PD PALOMPON	2167	RONNA MAE	DIGNOS	DIGNOS, RONNA MAE	2023-07	2022-04-21	3017.00	0.00	3017.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
krrre0f	EDDIE	2127	Richel	Dimatangal	Dimatangal, Richel	2022-09	2022-08-05	4499.00	0.00	4499.00	M	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
voxiwbg	EDDIE	2185	Vincent	Dimatangal	Dimatangal, Vincent	2022-01	2021-12-29	2772.00	0.00	2772.00	NM	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0ykwhyt	PD CARIGARA 	2026	Joel	Distora	Distora, Joel	2021-12	2021-11-14	3265.00	0.00	3265.00	NM	NL	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1z1vvmh	PD CARIGARA 	686	Nimfa	Divinagracia	Divinagracia, Nimfa	2023-07	2018-04-19	340.00	0.00	340.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ng4urrl	PD PALOMPON	3133	Evangeline	Dominguito	Dominguito, Evangeline	2023-09	2023-08-02	2862.00	0.00	2862.00	NM	L	ORMOC	Albuera	Wangag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7wsz16b	PD BAYBAY	569	NELFA	DOTAROT	DOTAROT, NELFA	2020-12	2020-11-26	4000.00	0.00	4000.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
smc8xo9	PD PALOMPON	2513	Ranilo Y.	Doyola	Doyola, Ranilo Y.	2024-04	2024-03-10	11150.00	0.00	11150.00	NM	NL	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ckmrdc8	PD CARIGARA 	2937	Joebert	Dublin	Dublin, Joebert	2022-11	2022-09-17	4650.00	0.00	4650.00	NM	NL	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dpjesi6	PD PALOMPON	979	MARISSA	DUJA	DUJA, MARISSA	2019-05	2019-04-08	15600.00	0.00	15600.00	NM	NL	PALOMPON	Villaba	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2bsj9y1	PD BAYBAY	3153	JEANNIE MARIE	DUMAGUING	DUMAGUING, JEANNIE MARIE	2025-11	2025-08-30	10825.00	0.00	10825.00	M	L	BAYBAY	Baybay	Recto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wzqf2of	MASOY	1926	ANGELYN	DUMAGUIT	DUMAGUIT, ANGELYN	2021-03	2021-02-27	1230.00	0.00	1230.00	M	L	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
re8qvji	LITO 	3445	DUMANDAN.	KIETH	KIETH, DUMANDAN.	2025-10	2025-08-10	17800.00	0.00	17800.00	M	L	ISABEL 	Ormoc 	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kl0w4vw	PD BAYBAY	1549	MA. FE	DUPAL	DUPAL, MA. FE	2021-08	2021-07-22	3034.00	0.00	3034.00	NM	NL	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
camzie6	NOEL	2966	JHARLERIE	DURAN	DURAN, JHARLERIE	2025-02	2024-12-21	6590.00	0.00	6590.00	M	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ao2fb51	LITO 	452	RODULFO	DURANO	DURANO, RODULFO	2024-03	2024-02-17	20110.00	0.00	20110.00	M	L	ISABEL	Merida 	Benabaye 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
abj0xsg	SUPERVISOR	1168	Darell Jim	Duyan	Duyan, Darell Jim	2024-08	2024-07-12	36150.00	0.00	36150.00	M	L	KANANGA	Ormoc	Salvacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
njvvghb	TATA	3512	MONTGOMER	EAMIGUEL	EAMIGUEL, MONTGOMER	2025-10	2025-07-25	400.00	0.00	400.00	NM	L	SAN ISIDRO 	San Isidro 	Crossing		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vvb1qpp	PD CARIGARA 	2628	Mercedes	Ebojo	Ebojo, Mercedes	2022-07	2022-06-09	3570.00	0.00	3570.00	NM	NL	CARIGARA	Carigara	San Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fo8xsbs	EDDIE	942	Riza	Egano	Egano, Riza	2020-05	2020-04-13	3745.00	0.00	3745.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2j4kwer	EDDIE	2310	Salvacion	Egarta	Egarta, Salvacion	2024-08	2022-10-14	1760.00	0.00	1760.00	M	L	CARIGARA	Carigara	Candigahub		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1di8wra	PD PALOMPON	2708	FELECIANA	EGOT	EGOT, FELECIANA	2023-01	2022-12-11	2450.00	0.00	2450.00	NM	L	PALOMPON	Palompon	Magsaysay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tk2jgab	PD CARIGARA 	147	Shiela Mae	Ejera	Ejera, Shiela Mae	2019-10	2019-09-08	9761.00	0.00	9761.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a3ncni0	PD CARIGARA 	1314	Amorucie	Elarcosa	Elarcosa, Amorucie	2019-09	2019-08-08	1585.00	0.00	1585.00	NM	L	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8z64ihr	PD CARIGARA 	2041	Lina B.	Elizondo	Elizondo, Lina B.	2022-05	2022-04-09	2165.00	0.00	2165.00	NM	L	CARIGARA	Barugo	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oj052ap	PD PALOMPON	2730	HELEN	ENORASA	ENORASA, HELEN	2024-05	2024-04-25	11028.00	0.00	11028.00	NM	L	PALOMPON	Palompon	Cantandoy 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
70ksxo0	MASOY	3064	EMILY	ENRIQUEZ	ENRIQUEZ, EMILY	2024-10	2024-08-21	2376.00	0.00	2376.00	M	L	BAYBAY	Baybay	Emelio St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ohlwaxw	SUPERVISOR	3054	Irene	Ensoy	Ensoy, Irene	2020-05	2024-11-10	2808.00	0.00	2808.00	M	L	KANANGA	Matag-ob	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fecoamk	SUPERVISOR	1289	Djona	Escanuela	Escanuela, Djona	2021-05	2020-04-05	4100.00	0.00	4100.00	M	L	KANANGA	Kananga	Kananga Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f1d0ypk	NOEL	3578	BERNARDITA	ESPINOSA	ESPINOSA, BERNARDITA	2025-11	2025-08-16	4800.00	0.00	4800.00	M	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xr6e91u	PD KANANGA 	934	Maryn	Estoconing	Estoconing, Maryn	2021-06	2018-10-06	4300.00	0.00	4300.00	NM	NL	KANANGA	Kananga	Libongao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
08q5238	TATA	3552	CHRISLY	ETANG	ETANG, CHRISLY	2025-11	2025-09-21	1506.00	0.00	1506.00	M	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lwrn991	MASOY	1783	MONALIZA	ESTOQUE	ESTOQUE, MONALIZA	2023-10	2021-05-10	29.00	0.00	29.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ta4udj0	PD PALOMPON	618	Amorlina	Estreller	Estreller, Amorlina	2018-11	2023-11-05	11588.00	0.00	11588.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qchjwfy	PD PALOMPON	615	Jhoanna M.	Estreller	Estreller, Jhoanna M.	2021-12	2021-09-27	2862.00	0.00	2862.00	NM	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0iv2cq0	PD CARIGARA 	2108	Ledgie	Estremos	Estremos, Ledgie	2017-11	2021-11-13	2217.00	0.00	2217.00	NM	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zf8mw7c	NOEL	2817	NELFA	ESTRERA	ESTRERA, NELFA	2025-11	2025-08-31	6300.00	0.00	6300.00	M	L	PALOMPON	Palompon	Buenavista 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
20n8d44	PD ISABEL 	403	MELCHORA	ESTRERA	ESTRERA, MELCHORA	2023-07	2017-10-14	1867.00	0.00	1867.00	NM	NL	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a8if0od	PD PALOMPON	1996	Felisa	Estupa	Estupa, Felisa	2017-02	2021-04-18	2110.00	0.00	2110.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xz6cjmx	PD PALOMPON	842	MARI-MAR	ETANG	ETANG, MARI-MAR	2021-05	2017-02-10	2368.00	0.00	2368.00	NM	NL	ORMOC	Ormoc	Linao 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7wrgyiv	PD ISABEL 	1479	LOLITA	FABIAN	FABIAN, LOLITA	2023-04	2021-04-01	1650.00	0.00	1650.00	NM	NL	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sh8f478	PD BAYBAY	2986	Charity	Fabroa	Fabroa, Charity	2022-05	2023-03-28	2596.00	0.00	2596.00	NM	NL	BAYBAY	Albuera	Mahayag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vf2gr4x	PD CARIGARA 	2346	Alfredo	Falguera	Falguera, Alfredo	2022-08	2022-04-10	2985.00	0.00	2985.00	NM	NL	CARIGARA	Carigara	Candigahub		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k2n3ylo	MASOY	3202	NORILYN	FALLER	FALLER, NORILYN	2025-03	2025-01-07	16785.00	0.00	16785.00	M	L	BAYBAY	Hilongos 	Lamak		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4pjsxbg	PD CARIGARA 	2881	Rechell	Famor	Famor, Rechell	2020-05	2022-07-29	3150.00	0.00	3150.00	NM	NL	CARIGARA	Carigara	West Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ogqc7v2	LITO 	1514	LUCIA	FENIX	FENIX, LUCIA	2023-12	2020-04-19	2580.00	0.00	2580.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
y1dhaht	PD BAYBAY	1723	MARITES	FERNANDEZ	FERNANDEZ, MARITES	2020-05	2020-04-18	398.00	0.00	398.00	NM	NL	BAYBAY	Baybay	Pilar 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z61zotx	PD BAYBAY	1629	RODRIGO JR.	FERNANDEZ	FERNANDEZ, RODRIGO JR.	2020-04	2020-03-21	1280.00	0.00	1280.00	NM	NL	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2pbnuoj	LITO 	3319	VIRGILIO	FERNANDEZ	FERNANDEZ, VIRGILIO	2024-11	2024-09-09	12779.00	0.00	12779.00	M	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xzzowu3	MASOY	1939	AILYN	FLANDEZ	FLANDEZ, AILYN	2021-02	2021-01-20	1790.00	0.00	1790.00	NM	NL	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tf1cezf	MASOY	1917	MARICHELL	FLANDEZ	FLANDEZ, MARICHELL	2021-03	2021-02-27	3290.00	0.00	3290.00	M	L	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
v9al9ut	PD BAYBAY	3	CECILLE	FLORES	FLORES, CECILLE	2018-04	2018-03-08	2540.00	0.00	2540.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wun2of5	PD BAYBAY	362	ELVIRA	FLORES	FLORES, ELVIRA	2018-05	2018-04-09	6455.00	0.00	6455.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0ktgmui	PD BAYBAY	610	LEAH	FLORES	FLORES, LEAH	2018-04	2018-10-15	4980.00	0.00	4980.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p3uzoy4	EDDIE	2383	Ma. Salome	Flores	Flores, Ma. Salome	2026-01	2025-11-08	11890.00	0.00	11890.00	M	L	CARIGARA	Carigara	San Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cp8xluj	PD BAYBAY	247	MARIFE	FLORES	FLORES, MARIFE	2018-11	2018-10-15	5254.00	0.00	5254.00	NM	L	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ugcgrih	LITO 	2684	RITCHEL	FLORITO	FLORITO, RITCHEL	2025-02	2024-12-24	6262.00	0.00	6262.00	M	L	ISABEL	Isabel	Tolingon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0fiq6e4	TATA	3578	GINA	FLORO	FLORO, GINA	2026-01	2025-10-23	1935.00	0.00	1935.00	M	L	SAN ISIDRO 	Tabango	Gimarco		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bfmouhp	PD BAYBAY	578	MARIA ALONA	FORNES	FORNES, MARIA ALONA	2017-05	2017-04-29	7882.00	0.00	7882.00	NMSR	NL	BAYBAY	Baybay	Tres Martires 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
aeuapwl	PD BAYBAY	2509	MARY JEAN	FORNIS	FORNIS, MARY JEAN	2026-01	2025-10-01	1855.00	0.00	1855.00	M	L	BAYBAY	Hindang	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mb3nyah	PD BAYBAY	1218	ROCHELLE	FORTALIZA	FORTALIZA, ROCHELLE	2019-03	2019-02-17	2860.00	0.00	2860.00	NM	NL	BAYBAY	Baybay	Quezon St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b1uhya8	PD PALOMPON	576	Fe	Fortunato	Fortunato, Fe	2018-11	2018-09-21	2820.00	0.00	2820.00	NM	L	ORMOC	Albuera	Gungab		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ba34kab	MASOY	3468	MARY GRACE	GABAS	GABAS, MARY GRACE	2025-02	2024-12-04	3611.00	0.00	3611.00	M	L	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rf9svf0	LITO 	2741	ROSELYN	GABAS	GABAS, ROSELYN	2025-02	2024-12-11	5094.00	0.00	5094.00	M	L	ISABEL	Merida 	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8yt8zz9	EDDIE	2802	Amor	Gabi	Gabi, Amor	2023-07	2023-06-20	1967.00	0.00	1967.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bjybjwf	PD PALOMPON	272	Madelyn	Gabi	Gabi, Madelyn	2023-12	2023-11-23	16442.00	0.00	16442.00	NM	L	ORMOC	Ormoc	Naungan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
90mlkbd	SUPERVISOR	2405	Wilma	Gadon	Gadon, Wilma	2023-09	2023-08-07	1282.00	0.00	1282.00	NM	L	KANANGA	Kananga	Kananga Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vcwmymt	PD ISABEL 	257	TERESITA	GALAN	GALAN, TERESITA	2020-03	2020-02-02	4986.00	0.00	4986.00	NM	NL	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tm8y6bc	PD PALOMPON	423	Emily	Galang	Galang, Emily	2020-12	2020-11-05	14430.00	0.00	14430.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
559zv5p	MASOY	3465	OLIVIA	GALANO	GALANO, OLIVIA	2025-02	2024-12-29	7980.00	0.00	7980.00	M	L	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2pgsbom	PD KANANGA 	554	Anarose	Galdiano	Galdiano, Anarose	2019-04	2019-02-28	4478.00	0.00	4478.00	NM	L	KANANGA	Ormoc	Dayhagan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bamvd5v	PD BAYBAY	2855	MARILYN	GALVEZ	GALVEZ, MARILYN	2022-07	2022-06-29	1318.00	0.00	1318.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6hw1vci	SUPERVISOR	895	Anita	Gamao	Gamao, Anita	2018-05	2018-04-07	6340.00	0.00	6340.00	M	L	KANANGA	Matag-ob	Balagtas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7mfjrxr	LITO 	297	ANNIE	GAMUTAN	GAMUTAN, ANNIE	2018-09	2018-07-14	2385.00	0.00	2385.00	M	L	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
br8v4ln	PD CARIGARA 	487	Mercy	Gandia	Gandia, Mercy	2018-08	2018-06-30	10900.00	0.00	10900.00	NMSR	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rsfvbeb	MASOY	2274	ROSALIA	GARCIA	GARCIA, ROSALIA	2022-08	2022-07-04	2610.00	0.00	2610.00	M	L	BAYBAY	Baybay	Hilapnitan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3w16k5s	PD CARIGARA 	184	RAUL	GARCIANO	GARCIANO, RAUL	2021-03	2021-02-20	23500.00	0.00	23500.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t9zvxer	NOEL	3012	RICARDO	GARCISO	GARCISO, RICARDO	2026-01	2025-10-03	1015.00	0.00	1015.00	M	L	PALOMPON	Palompon	Buenavista 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gcb8i4p	PD BAYBAY	623	ZAIDE	GARDUCE	GARDUCE, ZAIDE	2017-10	2017-09-03	8907.00	0.00	8907.00	NM	NL	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
38kplca	PD BAYBAY	2524	ROGELIA	GARGOLES	GARGOLES, ROGELIA	2024-03	2024-01-20	14130.00	0.00	14130.00	M	NL	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zewoqld	PD PALOMPON	864	Joel	Garrido	Garrido, Joel	2019-04	2019-02-28	2181.00	0.00	2181.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
iqt6bc6	SUPERVISOR	2558	Elmer	Gasal	Gasal, Elmer	2022-05	2022-04-24	2036.00	0.00	2036.00	NM	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nucau5n	EDDIE	2070	Joan	Gayo	Gayo, Joan	2021-12	2021-11-14	447.00	0.00	447.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
duffcxu	PD ISABEL 	3276	JOESIT	GAYO	GAYO, JOESIT	2024-05	2024-04-09	2230.00	0.00	2230.00	NM	NL	ISABEL	Leyte Leyte 	Kawayan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
y3hci57	PD BAYBAY	1496	Raquel	Gayondato	Gayondato, Raquel	2023-08	2023-07-27	9323.00	0.00	9323.00	NM	NL	BAYBAY	Baybay	Maybog		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vdacdhg	PD ISABEL 	958	MANUEL	GAZO	GAZO, MANUEL	2018-12	2018-11-06	4340.00	0.00	4340.00	NM	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9s27g76	PD ISABEL 	389	SHERLITA	GAZO	GAZO, SHERLITA	2019-08	2019-07-25	15824.00	0.00	15824.00	NM	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
eabcl8i	MASOY	3467	Ronavel	Genita	Genita, Ronavel	2025-06	2025-05-01	2050.00	0.00	2050.00	NM	NL	BAYBAY	Bato 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fztxw3o	SUPERVISOR	3515	Clifford	Geraldez	Geraldez, Clifford	2025-04	2025-02-18	3922.00	0.00	3922.00	NM	L	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ibind63	TATA	3541	CHERRY ANN	GERBUELA	GERBUELA, CHERRY ANN	2026-01	2025-09-30	3410.00	0.00	3410.00	M	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
olkwydm	PD BAYBAY	1744	RICHARD	GERMANO	GERMANO, RICHARD	2021-05	2021-04-19	7860.00	0.00	7860.00	NM	NL	BAYBAY	Bato 	Dolho		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wohl25n	SUPERVISOR	725	Arturo	Gimenez	Gimenez, Arturo	2024-08	2018-06-22	25900.00	0.00	25900.00	NM	L	KANANGA	Kananga	Libongao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pcou6zq	PD PALOMPON	2344	GRACE	GIVA	GIVA, GRACE	2023-10	2023-09-29	2828.00	0.00	2828.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r70p28r	PD ISABEL 	1114	JEMREY	GIVA	GIVA, JEMREY	2025-02	2024-12-02	17025.00	0.00	17025.00	NMSR	L	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vrqq68m	MASOY	2908	LINDSY	GLORIA	GLORIA, LINDSY	2023-01	2022-12-09	2002.00	0.00	2002.00	NM	L	BAYBAY	Baybay	Villa Soledad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1g6k8td	PD BAYBAY	2661	MARIVEL	GLORIA	GLORIA, MARIVEL	2022-11	2022-09-09	816.00	0.00	816.00	NM	NL	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p0npsv6	MASOY	1655	PERLA	GLORIA	GLORIA, PERLA	2020-05	2020-04-26	12027.00	0.00	12027.00	M	L	BAYBAY	Baybay	Hipusngo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h0t2itr	PD BAYBAY	2906	ANTONETTE	GODOY	GODOY, ANTONETTE	2022-11	2022-09-14	200.00	0.00	200.00	NM	NL	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h2ovkpk	PD BAYBAY	2704	EVELYN	GODOY	GODOY, EVELYN	2023-11	2023-10-01	1750.00	0.00	1750.00	NM	NL	BAYBAY	Baybay	Mabini St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p6g8fyp	PD BAYBAY	2790	JEREMY	GODOY	GODOY, JEREMY	2023-11	2023-10-01	2150.00	0.00	2150.00	NM	NL	BAYBAY	Baybay	Mabini St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
juf9f58	PD BAYBAY	2971	MARCELINA	GOFREDO	GOFREDO, MARCELINA	2025-02	2024-12-03	5150.00	0.00	5150.00	M	NL	BAYBAY	Baybay	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sonafs1	PD BAYBAY	3446	Maria Edna	Gofredo	Gofredo, Maria Edna	2025-04	2025-02-17	2573.00	0.00	2573.00	M	L	BAYBAY	Baybay	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pxdou1v	SUPERVISOR	6	Elena	Gojoco	Gojoco, Elena	2024-08	2020-01-09	4670.00	0.00	4670.00	NM	L	KANANGA	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hlou98u	SUPERVISOR	29	Elijia	Gomez	Gomez, Elijia	2019-03	2019-02-25	2153.00	0.00	2153.00	M	L	KANANGA	Kananga	Masarayao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bjxt2xm	PD KANANGA 	1296	Gerin	Gomez	Gomez, Gerin	2024-04	2024-02-25	177000.00	0.00	177000.00	NMSR	L	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b8xrtyk	PD KANANGA 	540	Ma. Loranita	Gomez	Gomez, Ma. Loranita	2020-02	2020-01-02	1550.00	0.00	1550.00	NM	L	KANANGA	Ormoc	San Pablo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
80qd02e	ALDIE 	5	Nery	Gomez	Gomez, Nery	2017-09	2017-08-21	3270.00	0.00	3270.00	M	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rw05lyu	PD PALOMPON	1417	Anastacia	Gontinas	Gontinas, Anastacia	2019-09	2019-08-15	2955.00	0.00	2955.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sstjlme	PD PALOMPON	975	MATEO	GONZAGA JR	GONZAGA JR, MATEO	2020-03	2020-02-15	10900.00	0.00	10900.00	NMSR	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b2cliub	PD ISABEL 	1909	JOEMAR	GONZAGA	GONZAGA, JOEMAR	2021-11	2021-10-27	1773.00	0.00	1773.00	NM	L	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
39n59sx	PD PALOMPON	3112	Jomar	Gonzales	Gonzales, Jomar	2023-08	2023-07-14	2906.00	0.00	2906.00	NM	NL	ORMOC	Ormoc	Cogon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wajcw5n	LITO 	3727	LUZVIMINDA	GONZALES	GONZALES, LUZVIMINDA	2025-11	2025-09-28	1500.00	0.00	1500.00	M	L	ISABEL	Merida 	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9hdw2v4	EDDIE	2047	Ma. Lorelie	Gonzales	Gonzales, Ma. Lorelie	2021-07	2021-06-15	4508.00	0.00	4508.00	M	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e9yint7	PD PALOMPON	1922	JESUSA	GRACIANO	GRACIANO, JESUSA	2021-08	2021-07-10	9732.00	0.00	9732.00	NM 	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a3dxsc7	PD CARIGARA 	2447	Jocelyn	Grama	Grama, Jocelyn	2022-05	2022-04-24	4419.00	0.00	4419.00	NM	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7g0qep5	EDDIE	3048	Evangeline	Grapani	Grapani, Evangeline	2023-11	2023-10-05	1769.00	0.00	1769.00	M	L	CARIGARA	Carigara	San Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
80u1k1v	EDDIE	696	Mirasol	Gruyal	Gruyal, Mirasol	2020-05	2020-04-15	2374.00	0.00	2374.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
891lfvp	PD PALOMPON	2393	ROSEMIL	GUARIN	GUARIN, ROSEMIL	2022-04	2022-03-29	5410.00	0.00	5410.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cs5fs61	NOEL	3080	JONALYN	GUBALANE	GUBALANE, JONALYN	2026-01	2025-11-09	6085.00	0.00	6085.00	M	L	PALOMPON	Palompon	Buenavista 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hzmzao9	PD ISABEL 	1968	REYNALDA	GUCELA	GUCELA, REYNALDA	2021-10	2021-09-25	1608.00	0.00	1608.00	NM	L	ISABEL	Merida 	Mahalit 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9ay0kpu	PD PALOMPON	1611	NORMELITO	GUIÑARES	GUIÑARES, NORMELITO	2020-05	2020-04-16	2894.00	0.00	2894.00	NM	L	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
esycysu	PD BAYBAY	2821	LUCIA	GULAYAN	GULAYAN, LUCIA	2023-08	2023-07-23	2940.00	0.00	2940.00	NM	NL	BAYBAY	Baybay	Makinhas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7ha7s46	LITO 	2256	LIZA	GUMBA	GUMBA, LIZA	2022-08	2022-07-01	933.00	0.00	933.00	M	L	ISABEL	Merida 	Libjo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k25m3r4	PD BAYBAY	3486	JOCELYN	GUNDAN	GUNDAN, JOCELYN	2025-02	2024-12-19	2291.00	0.00	2291.00	NM	NL	BAYBAY	Hindang	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
86kqd1n	MASOY	2655	FERMIN	GUNDEMARO	GUNDEMARO, FERMIN	2026-01	2025-10-10	3350.00	0.00	3350.00	M	L	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sw2lhdh	EDDIE	2412	Hamtig.	Wenifreda	Wenifreda, Hamtig.	2022-04	2022-03-26	1835.00	0.00	1835.00	M	L	CARIGARA	Carigara	Upper Sogod		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
16tc3ee	PD BAYBAY	1720	JANET	HATUD	HATUD, JANET	2020-05	2020-04-17	1824.00	0.00	1824.00	NM	NL	BAYBAY	Bato 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2hd63hf	PD PALOMPON	1456	Jennifer	Helig	Helig, Jennifer	2019-11	2019-10-16	2570.00	0.00	2570.00	NM	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cgi55g8	PD BAYBAY	1980	SUSAN	HERNANDEZ	HERNANDEZ, SUSAN	2025-03	2025-01-23	4602.00	0.00	4602.00	NM	NL	BAYBAY	Hindang	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h1x0t08	MASOY	1645	MARIA	HINAMPAS	HINAMPAS, MARIA	2020-10	2020-09-17	2634.00	0.00	2634.00	NM	NL	BAYBAY	Hilongos 	Atabay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r89b9md	EDDIE	2139	Fe	Horca	Horca, Fe	2022-05	2022-04-28	1732.00	0.00	1732.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pxg89i9	PD KANANGA 	2467	Emilia	Huete	Huete, Emilia	2022-09	2022-08-21	2485.00	0.00	2485.00	NM	L	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
66h2xwe	NOEL	3740	CHRISTIAN	HUKDONG	HUKDONG, CHRISTIAN	2026-01	2025-10-03	2650.00	0.00	2650.00	M	L	PALOMPON	Villaba 	Tagbubunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x5utvhs	EDDIE	738	Leonita	Imus	Imus, Leonita	2020-03	2020-02-17	1955.00	0.00	1955.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e028ptx	PD CARIGARA 	2295	Erlinda	Infante	Infante, Erlinda	2022-08	2022-07-07	2529.00	0.00	2529.00	NM	L	CARIGARA	Carigara	Caghalo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sxho1ov	PD CARIGARA 	3419	Regine	Infante	Infante, Regine	2024-11	2024-09-03	9168.00	0.00	9168.00	NM	L	CARIGARA	Carigara	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b5txqr3	MASOY	1546	MIRASOL	INOT	INOT, MIRASOL	2020-12	2020-11-18	4860.00	0.00	4860.00	NM	L	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
74kcrki	TATA	3536	VIRGINIA	INOT	INOT, VIRGINIA	2025-10	2025-07-25	1912.00	0.00	1912.00	M	L	SAN ISIDRO 	Tabango	Tabing 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n0brc74	NOEL	1355	ANGELYN	INSO	INSO, ANGELYN	2019-07	2019-06-17	1165.00	0.00	1165.00	M	L	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6w72y1w	PD ISABEL 	1903	CATHERINE	INTAN	INTAN, CATHERINE	2021-02	2020-12-31	2732.00	0.00	2732.00	NM	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5xtm2r1	MASOY	3447	ETELIETA	ISRAEL	ISRAEL, ETELIETA	2025-11	2025-09-19	4820.00	0.00	4820.00	M	L	BAYBAY	Baybay 	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5wa0j2v	TATA	3488	JOCELYN	ITABLE	ITABLE, JOCELYN	2025-07	2025-04-03	5100.00	0.00	5100.00	NM	L	SAN ISIDRO 	Tabango	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ef44olr	ALDIE 	2742	JIMMY	JACA	JACA, JIMMY	2026-01	2025-10-17	1990.00	0.00	1990.00	M	L	ORMOC	Ormoc	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o9g8mv1	PD BAYBAY	364	REGILEN	JACA	JACA, REGILEN	2018-03	2018-02-19	11161.00	0.00	11161.00	NM	NL	BAYBAY	Baybay	Hipusngo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b1yfbmn	PD PALOMPON	1947	RACHEL	JACOBA	JACOBA, RACHEL	2022-01	2021-12-24	3095.00	0.00	3095.00	NM	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c4z53e2	SUPERVISOR	2554	Jocelyn	Jamalol	Jamalol, Jocelyn	2022-11	2022-10-06	3590.00	0.00	3590.00	M	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t45y36p	PD BAYBAY	633	ANABEL	JAVIER	JAVIER, ANABEL	2017-08	2017-07-07	1714.00	0.00	1714.00	NM	NL	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fqls125	LITO 	783	MARINA	JIMINEA	JIMINEA, MARINA	2026-01	2025-11-01	23000.00	0.00	23000.00	M	L	ISABEL	Ormoc 	San Isidro 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tuu9vvf	PD PALOMPON	649	Dominador	Jomoc	Jomoc, Dominador	2017-11	2017-10-28	2507.00	0.00	2507.00	NMSR	NL	ORMOC	Albuera	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r2mm7wn	PD PALOMPON	985	LANIE	JORDA	JORDA, LANIE	2018-12	2018-11-17	3710.00	0.00	3710.00	NM	NL	PALOMPON	Palompon	San Miguel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3krh1vi	MASOY	3689	MARY GRACE	JORDA	JORDA, MARY GRACE	2026-01	1020/25	4000.00	0.00	4000.00	M	L	BAYBAY 	Baybay 	Hipusngo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wkkiv7a	PD BAYBAY	1851	MARITES	JOVITA	JOVITA, MARITES	2021-07	2021-06-05	877.00	0.00	877.00	NM	NL	BAYBAY	Hilongos 	Western Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ddnszcv	PD PALOMPON	983	LILIBETH	JUABLAR	JUABLAR, LILIBETH	2020-02	2020-01-30	2069.00	0.00	2069.00	NM	NL	PALOMPON	Villaba	Sta. Cruz		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jgzmhqz	LITO 	1005	ELIZABETH	JUGAR	JUGAR, ELIZABETH	2019-10	2019-09-29	46100.00	0.00	46100.00	M	L	ISABEL	Ormoc	R.M Tan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w4wo0n3	ALDIE 	2049	VIRGINIA	JUMAO-AS	JUMAO-AS, VIRGINIA	2025-08	2025-06-17	5550.00	0.00	5550.00	M	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hrgbylc	PD PALOMPON	1213	LORNA	JUSAY	JUSAY, LORNA	2018-12	2018-11-29	1480.00	0.00	1480.00	NM	NL	PALOMPON	Kananga	Montebello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dfd3l4c	LITO 	1203	ANECITA	JUSTO	JUSTO, ANECITA	2025-01	2024-11-06	14598.00	0.00	14598.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mw2kmb5	LITO 	1309	AZENITH	JUSTO	JUSTO, AZENITH	2020-02	2020-01-25	6030.00	0.00	6030.00	NM	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pa4n9vp	MASOY	3462	MA. ISABEL	KIRONG	KIRONG, MA. ISABEL	2025-01	2024-11-28	975.00	0.00	975.00	NM	NL	BAYBAY	Hindang	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8oa6yhr	PD PALOMPON	1437	Maria Ligaya	Kobayashi	Kobayashi, Maria Ligaya	2020-04	2020-03-27	27700.00	0.00	27700.00	NM	NL	ORMOC	Ormoc	Ormoc Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f7t3dg4	PD KANANGA 	123	Vivien Espera	Lagahit	Lagahit, Vivien Espera	2018-03	2018-02-25	4595.00	0.00	4595.00	NM	NL	KANANGA	Kananga	Daculang St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r8fgu6b	PD CARIGARA 	2507	Edward	Lagera	Lagera, Edward	2022-05	2022-04-21	3980.00	0.00	3980.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
99sk4q1	EDDIE	3532	Jestoni	Lagera	Lagera, Jestoni	2025-04	2025-02-21	5091.00	0.00	5091.00	M	L	CARIGARA	Capoocan	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vp5akkk	EDDIE	3536	ROGELIO	LAGERA	LAGERA, ROGELIO	2025-10	2025-07-05	2400.00	0.00	2400.00	M	L	CARIGARA	Capoocan	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sgw8vtp	PD BAYBAY	215	MARICRIS	LAGUNA	LAGUNA, MARICRIS	2018-11	2018-10-19	7000.00	0.00	7000.00	NM	NL	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dts4wxf	PD BAYBAY	609	ANGELES ALFER JOSE	LAO	LAO, ANGELES ALFER JOSE	2017-08	2017-07-26	7521.00	0.00	7521.00	NMSR	NL	BAYBAY	Baybay	Moraza St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k00kvf5	PD CARIGARA 	2121	Maricel	Lao	Lao, Maricel	2021-12	2021-11-13	3606.00	0.00	3606.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ncjryfe	PD BAYBAY	3392	NORMALYN	LAO	LAO, NORMALYN	2024-12	2024-10-15	4452.00	0.00	4452.00	NM	NL	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j6hklcd	PD PALOMPON	2713	MAYCEL	LAPARAN	LAPARAN, MAYCEL	2023-10	2023-09-28	22420.00	0.00	22420.00	NMSR	NL	PALOMPON	Villaba	Cabunga-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
asz0pqs	PD BAYBAY	2867	EVELYN	LAPASTORA	LAPASTORA, EVELYN	2023-09	2023-08-02	1868.00	0.00	1868.00	M	NL	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w29m00g	PD BAYBAY	2774	NESTOR	LARITA	LARITA, NESTOR	2022-08	2022-07-07	3281.00	0.00	3281.00	NM	NL	BAYBAY	Baybay	Sta. Cruz		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
iqox7rd	SUPERVISOR	2561	Angeline	Lasdose	Lasdose, Angeline	2022-04	2022-03-24	1705.00	0.00	1705.00	NM	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9lm2m6w	PD BAYBAY	72	LILANIE	LATORENO	LATORENO, LILANIE	2023-07	2023-06-08	1192.00	0.00	1192.00	NM	NL	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sgpwo6j	LITO 	1849	ANABELLE	LAURENTE	LAURENTE, ANABELLE	2025-11	2025-09-17	5318.00	0.00	5318.00	M	L	ISABEL	Isabel	Marvel		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xoryrhf	LITO 	1025	EDITHA	LAURENTE	LAURENTE, EDITHA	2020-04	2020-03-18	2850.00	0.00	2850.00	M	L	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j76l6yo	ALDIE 	2363	Josephine	Laurente	Laurente, Josephine	2024-12	2024-11-23	5120.00	0.00	5120.00	NM	L	ORMOC	Ormoc	Owak		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x8pdf7u	PD BAYBAY	643	EMELITA	LAURIÑO	LAURIÑO, EMELITA	2017-10	2017-09-25	4282.00	0.00	4282.00	NM	NL	BAYBAY	Baybay	Pangasugan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2483ykk	NOEL	1013	MERIAM	LAURON	LAURON, MERIAM	2020-04	2020-03-16	34940.00	0.00	34940.00	NM	L	PALOMPON	Kananga	Montebello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
v8a28t7	LITO 	122	DIOMEDES	LAWAS	LAWAS, DIOMEDES	2017-12	2017-11-17	391.00	0.00	391.00	NM	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dz0k7b3	PD CARIGARA 	2265	Lea	Layosa	Layosa, Lea	2021-12	2021-11-15	666.00	0.00	666.00	NM	NL	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7rh278f	LITO 	1843	ANGELITA	LAZO	LAZO, ANGELITA	2025-02	2024-12-22	1686.00	0.00	1686.00	NM	L	ISABEL	Isabel	Marvel		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z4cj6w7	PD PALOMPON	1606	FILADELFA	LETRONDO	LETRONDO, FILADELFA	2020-05	2020-04-16	3554.00	0.00	3554.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1rdiz6h	EDDIE	3129	Leonida	Lianza	Lianza, Leonida	2023-09	2023-08-17	300.00	0.00	300.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pgkybe2	EDDIE	2277	Roxan	Lianza	Lianza, Roxan	2021-12	2021-11-15	643.00	0.00	643.00	M	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2ja2i61	MASOY	1627	RACELLE	LIBO-ON	LIBO-ON, RACELLE	2020-05	2020-04-05	10768.00	0.00	10768.00	NM	NL	BAYBAY	Hilongos 	Hilongos 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8iv3q29	PD ISABEL 	521	MARITES	LIBRE	LIBRE, MARITES	2017-05	2017-04-28	1044.00	0.00	1044.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hbmit2k	ALDIE 	3622	ALMA	LICAÑA	LICAÑA, ALMA	2025-11	2025-09-22	16560.00	0.00	16560.00	M	L	ORMOC	Ormoc	Dayhagan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
anz3927	PD PALOMPON	1066	RICOLITO	LICARDO	LICARDO, RICOLITO	2020-03	2020-02-23	1786.00	0.00	1786.00	NM	NL	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
34cs32h	PD PALOMPON	2642	WILMA	LIM	LIM, WILMA	2022-06	2022-05-19	3762.00	0.00	3762.00	NM	NL	PALOMPON	Palompon	San Miguel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hxs6lkg	NOEL	194	NENITA	LIMOSNERO	LIMOSNERO, NENITA	2024-10	2024-09-01	1336.00	0.00	1336.00	M	L	PALOMPON	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sbup2m5	NOEL	3424	RAFFY	LIMOSNERO	LIMOSNERO, RAFFY	2025-02	2024-12-22	3604.00	0.00	3604.00	M	L	PALOMPON	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ay3f21e	NOEL	2720	MARICEL	LIMPANGOG	LIMPANGOG, MARICEL	2025-02	2024-11-30	7145.00	0.00	7145.00	M	L	PALOMPON	Palompon	Magsaysay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a26mg5a	LITO 	2365	Marilyn	Linganay	Linganay, Marilyn	2025-04	2025-03-21	5205.00	0.00	5205.00	M	L	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n84ek17	PD PALOMPON	1681	Jacqueline	Lingo	Lingo, Jacqueline	2023-12	2023-11-03	16000.00	0.00	16000.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
69xk979	MASOY	2636	NOEL	LIPOMANO	LIPOMANO, NOEL	2023-04	2023-03-28	13138.00	0.00	13138.00	M	L	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
notvmuk	LITO 	1510	ROSELIEN	LISTON	LISTON, ROSELIEN	2025-02	2024-12-16	10910.00	0.00	10910.00	M	L	ISABEL	Isabel	Marvel		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9z28jzp	PD PALOMPON	2584	JESSICA	LLADOC	LLADOC, JESSICA	2022-01	2021-12-25	3756.00	0.00	3756.00	NM	NL	PALOMPON	Palompon	Mix Palompon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9zqzsbi	PD CARIGARA 	2257	Armie C.	Llaneta	Llaneta, Armie C.	2021-12	2021-11-13	3669.00	0.00	3669.00	NM	NL	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bqdoh4i	PD CARIGARA 	2266	Melanie	Llaneta	Llaneta, Melanie	2021-09	2021-08-04	2765.00	0.00	2765.00	NM	L	CARIGARA	Carigara	Ponong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i48qpuc	MASOY	3477	ELVA	LOBRIO	LOBRIO, ELVA	2025-10	2025-07-08	5325.00	0.00	5325.00	M	L	BAYBAY	Hilongos	Naval		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m6zz17d	ALDIE 	1511	Zorayda	Lolo	Lolo, Zorayda	2022-01	2021-12-30	938.00	0.00	938.00	NM	L	ORMOC	Albuera	Kayang-ang		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ydbileo	PD CARIGARA 	2650	Ryan	Lomot	Lomot, Ryan	2022-07	2022-06-06	1380.00	0.00	1380.00	NM	L	CARIGARA	Carigara	West Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q4xy4ph	PD ISABEL 	294	TEOFILO	LONGAKIT	LONGAKIT, TEOFILO	2020-04	2020-03-20	4310.00	0.00	4310.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
d6eb17o	PD BAYBAY	2879	EN-EN	LONGHENO	LONGHENO, EN-EN	2022-09	2022-08-17	3270.00	0.00	3270.00	NM	NL	BAYBAY	Baybay	Sta. Cruz		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
emxpvvc	MASOY	1743	IRISH	LOPEZ	LOPEZ, IRISH	2021-04	2021-03-20	9800.00	0.00	9800.00	M	L	BAYBAY	Inopacan 	Tao-Taon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t2zrgsm	ALDIE 	761	MA. WILMA	LORETO	LORETO, MA. WILMA	2026-01	2025-10-25	1350.00	0.00	1350.00	M	L	ORMOC	Ormoc	Alegria 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g3yy8rg	SUPERVISOR	2898	Ritchel	Luag	Luag, Ritchel	2023-04	2023-03-20	4300.00	0.00	4300.00	M	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w1yzxxy	PD BAYBAY	587	MA. LUZ	LUBAY	LUBAY, MA. LUZ	2019-08	2019-07-24	2740.00	0.00	2740.00	NM	NL	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nefg54i	PD BAYBAY	1269	MARIFE	LUBAY	LUBAY, MARIFE	2019-11	2019-10-09	3124.00	0.00	3124.00	NM	NL	BAYBAY	Baybay	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nlkjmk6	PD ISABEL 	3257	MARIBEL	LUGAS	LUGAS, MARIBEL	2024-08	2024-07-08	17348.00	0.00	17348.00	NM	L	ISABEL	Ormoc	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
oxsq9vt	PD BAYBAY	2871	SHIRLEY	LUMACAD	LUMACAD, SHIRLEY	2022-02	2023-01-01	2538.00	0.00	2538.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
09czoto	EDDIE	3323	Wilson	Lumen	Lumen, Wilson	2024-11	2024-10-26	4192.00	0.00	4192.00	M	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qs9sf54	PD PALOMPON	325	Henry	Luna	Luna, Henry	2019-06	2019-05-08	23850.00	0.00	23850.00	NM	L	ORMOC	Ormoc	Alta Vista		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
94vjtxf	PD PALOMPON	54	Henryly	Luna	Luna, Henryly	2019-06	2019-05-29	18300.00	0.00	18300.00	NM	L	ORMOC	Ormoc	Alta Vista		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
terfv1l	PD PALOMPON	2375	MARITES	MABUTE	MABUTE, MARITES	2022-03	2022-02-04	1490.00	0.00	1490.00	NM	NL	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8fkq33g	PD PALOMPON	1119	GEMMA	MACABUGWAS	MACABUGWAS, GEMMA	2022-02	2023-01-27	16980.00	0.00	16980.00	NM	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
609393a	PD CARIGARA 	2311	Teofila	Macalalag	Macalalag, Teofila	2022-11	2022-09-30	4400.00	0.00	4400.00	NM	NL	CARIGARA	Carigara	Candigahub		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jackus6	MASOY	512	LOWELITA	MACARAYA	MACARAYA, LOWELITA	2026-01	2025-11-04	22000.00	0.00	22000.00	M	L	BAYBAY 	Baybay 	Sto. Rosarion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2mvoqb4	PD PALOMPON	877	Arlene	Macasero	Macasero, Arlene	2020-04	2020-03-23	2160.00	0.00	2160.00	NM	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o0lqzm6	PD ISABEL 	1952	MARITES	MACEDA	MACEDA, MARITES	2021-08	2021-07-25	7051.00	0.00	7051.00	NM	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vutjleo	EDDIE	717	Jovelyn	Macinas	Macinas, Jovelyn	2017-12	2017-11-12	3390.00	0.00	3390.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pjqwx3t	MASOY	1682	MYLEEN	MACUTO	MACUTO, MYLEEN	2025-02	2024-11-30	3396.00	0.00	3396.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j7dw08x	PD BAYBAY	1400	ALAN	MADRAZO	MADRAZO, ALAN	2019-08	2019-07-24	5424.00	0.00	5424.00	NM	NL	BAYBAY	Inopacan 	Esperanza 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6s3gqa5	PD PALOMPON	1285	Rhoda	Magale	Magale, Rhoda	2019-05	2019-04-12	18638.00	0.00	18638.00	NM	L	ORMOC	Albuera	Benolho		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7x0oqed	ALDIE 	2236	Madelin	Magallanes	Magallanes, Madelin	2022-07	2022-06-03	2160.00	0.00	2160.00	M	L	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vugqrgo	PD PALOMPON	1765	Irvin	Maglasang	Maglasang, Irvin	2024-08	2020-09-28	5350.00	0.00	5350.00	NM	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vf5ghtu	TATA	3560	RACHELL	MAGLASANG	MAGLASANG, RACHELL	2025-07	2025-04-18	3445.00	0.00	3445.00	NM	L	SAN ISIDRO 	Tabango	Campokpok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lah9bfz	PD PALOMPON	2528	REYMOND	MAGLASANG	MAGLASANG, REYMOND	2023-11	2023-10-02	35400.00	0.00	35400.00	NMSR	L	PALOMPON	Ormoc	Donghol		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mfc9sky	MASOY	3485	REINA	MAGNO	MAGNO, REINA	2025-10	2025-07-12	2729.00	0.00	2729.00	NM	L	BAYBAY	Baybay	San Agustin		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j2i1z7v	PD PALOMPON	1044	JUNDY	MAJADA	MAJADA, JUNDY	2019-10	2019-09-12	2180.00	0.00	2180.00	NM	NL	PALOMPON	Villaba	Tagbubunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9bwniwu	SUPERVISOR	2560	Marvie	Majadas	Majadas, Marvie	2022-09	2022-08-14	1785.00	0.00	1785.00	M	L	KANANGA	Ormoc	San Jose		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8xucjjw	ALDIE 	1373	Hermila	Malazarte	Malazarte, Hermila	2025-02	2024-12-07	14350.00	0.00	14350.00	NM	L	ORMOC	Albuera 	Katipunan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xw2p10f	PD BAYBAY	1776	JESSA	MALUPA	MALUPA, JESSA	2025-02	2024-12-19	3372.00	0.00	3372.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
obu08fh	PD PALOMPON	572	Agnes	Manatad	Manatad, Agnes	2017-10	2017-09-17	5025.00	0.00	5025.00	M	L	ORMOC	Albuera	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2gzwk6i	PD PALOMPON	2283	Arcelina	Manatad	Manatad, Arcelina	2022-01	2021-12-10	4783.00	0.00	4783.00	NM	L	ORMOC	Albuera	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dlrlijt	PD PALOMPON	1786	Jemily	Manatad	Manatad, Jemily	2020-12	2017-09-17	280.00	0.00	280.00	NM	L	ORMOC	Ormoc	Naungan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vhbyb81	PD PALOMPON	1257	Jessica	Manatad	Manatad, Jessica	2019-03	2019-02-02	5135.00	0.00	5135.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w2z3qbe	MASOY	3287	JOCELYN	MANATAD	MANATAD, JOCELYN	2025-09	2025-08-17	1490.00	0.00	1490.00	M	L	BAYBAY	Hilongos	Alcuino		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
be7vbgf	PD ISABEL 	538	JAIME	MANCERA	MANCERA, JAIME	2017-11	2017-10-04	1842.00	0.00	1842.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o8gj5av	PD BAYBAY	2954	MELANIE	MANDABON	MANDABON, MELANIE	2023-08	2023-07-17	3642.00	0.00	3642.00	NM	L	BAYBAY	Baybay	Villa Soledad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
03ocn7u	PD ISABEL 	3047	ROSELYN	MANGGALAO	MANGGALAO, ROSELYN	2022-02	2023-01-16	3923.00	0.00	3923.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
osum8dz	PD BAYBAY	3158	Vilma	Mangle	Mangle, Vilma	2025-06	2025-04-15	6190.00	0.00	6190.00	M	L	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hxtwzpq	ALDIE 	3780	PATRICK	MANGMANG	MANGMANG, PATRICK	2026-01	2025-10-20	4700.00	0.00	4700.00	M	L	ORMOC	Ormoc	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yceluz8	NOEL	2765	HELEN	MANIPES	MANIPES, HELEN	2025-01	2024-10-31	20150.00	0.00	20150.00	M	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gr4uf5h	MASOY	2160	ELIANOR	MANTUA	MANTUA, ELIANOR	2025-02	2024-12-08	4240.00	0.00	4240.00	NM	NL	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qduj5uw	MASOY	1383	LIZA	MANTUA	MANTUA, LIZA	2019-10	2019-09-08	3011.00	0.00	3011.00	NM	NL	BAYBAY	Baybay	Maslug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e32os31	MASOY	2768	MARISSA	MANUEL	MANUEL, MARISSA	2024-02	2023-12-03	1073.00	0.00	1073.00	M	NL	BAYBAY	Baybay	Bitanhuan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
le48iji	SUPERVISOR	1539	Niña	Manzanes	Manzanes, Niña	2025-06	2025-05-13	7168.00	0.00	7168.00	M	L	KANANGA	Ormoc	Salvacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
az0mg7f	PD PALOMPON	1487	LYN	MARA	MARA, LYN	2019-11	2019-10-02	1680.00	0.00	1680.00	NM	NL	PALOMPON	Villaba	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r14894k	MASOY	3168	LELITH	MARIBAO	MARIBAO, LELITH	2025-07	2025-05-26	26459.00	0.00	26459.00	M	L	BAYBAY	Hilongos	Matapay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
57p8xf8	PD CARIGARA 	2122	Edna	Marientes	Marientes, Edna	2021-08	2021-07-30	735.00	0.00	735.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ex8h3gc	PD PALOMPON	3248	FRANCIS	MARILAO	MARILAO, FRANCIS	2023-05	2023-04-23	5407.00	0.00	5407.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uyjpzhm	PD PALOMPON	780	Evelyn	Marquez	Marquez, Evelyn	2020-02	2020-01-25	2580.00	0.00	2580.00	NM	NL	ORMOC	Ormoc	Sabang Beach		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mkv5av5	PD PALOMPON	1017	LESLY	MARQUEZ	MARQUEZ, LESLY	2018-11	2018-09-13	1770.00	0.00	1770.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7zmvplk	PD KANANGA 	2270	Marianida	Marquez	Marquez, Marianida	2023-04	2023-03-26	7124.00	0.00	7124.00	NM	L	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
th61dtg	ALDIE 	997	Juanita	Marson	Marson, Juanita	2020-03	2020-02-27	2456.00	0.00	2456.00	NM	L	ORMOC	Ormoc	San Vicente 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7uoq9tb	PD BAYBAY	1993	AMELIA	MARTINEZ	MARTINEZ, AMELIA	2021-08	2021-07-12	13410.00	0.00	13410.00	NM	L	BAYBAY	Baybay	Palhi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hqwetup	NOEL	3710	ZYRA JOY	MASCARINAS	MASCARINAS, ZYRA JOY	2025-11	2025-09-21	4110.00	0.00	4110.00	NM	L	PALOMPON	Villaba	Tagbubunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5e71hi4	PD PALOMPON	1020	MARY ANN	MASONG	MASONG, MARY ANN	2018-11	2018-09-14	3030.00	0.00	3030.00	NM	NL	PALOMPON	Palompon	Zamora 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3horzg7	PD ISABEL 	395	LORELIE	MATUGUINA	MATUGUINA, LORELIE	2018-03	2018-02-02	2734.00	0.00	2734.00	NM	NL	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nku27oy	PD BAYBAY	1381	ERVIN	MATURAN	MATURAN, ERVIN	2019-10	2019-09-29	690.00	0.00	690.00	NM	NL	BAYBAY	Baybay	Hipusngo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yv1ptk2	PD KANANGA 	2695	Michelle	Mauro	Mauro, Michelle	2023-07	2022-05-05	2511.00	0.00	2511.00	NM	NL	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fby0rrl	ALDIE 	659	SHIELA MAY	MAUSISA	MAUSISA, SHIELA MAY	2025-11	2025-08-21	8395.00	0.00	8395.00	M	L	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xt5mu2w	PD PALOMPON	1297	JENNEFER	MAYDO	MAYDO, JENNEFER	2022-06	2022-05-09	1613.00	0.00	1613.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ryrwdmw	NOEL	1116	MERLIE	MECA	MECA, MERLIE	2025-02	2024-12-07	5430.00	0.00	5430.00	M	L	PALOMPON	Villaba	Silad 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bkfj7fg	PD ISABEL 	1895	RETHEL	MENDOLA	MENDOLA, RETHEL	2021-03	2021-02-11	1433.00	0.00	1433.00	NM	NL	ISABEL	Merida 	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3g0yds6	PD KANANGA 	541	Arnold	Mendoza	Mendoza, Arnold	2017-10	2024-12-07	485.00	0.00	485.00	NM	NL	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
byr1xwl	PD ISABEL 	3311	CONRAD	MERAMONTE JR	MERAMONTE JR, CONRAD	2025-01	2024-11-12	3640.00	0.00	3640.00	NM	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
26yh60h	LITO 	1848	ROZEL	MERAMONTE	MERAMONTE, ROZEL	2025-02	2024-12-10	2370.00	0.00	2370.00	M	L	ISABEL	Isabel	Marvel		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
no088ok	PD BAYBAY	1501	HAZEL	MERANO	MERANO, HAZEL	2021-10	2021-09-26	690.00	0.00	690.00	NM	NL	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ajcpy8d	PD ISABEL 	559	ROSA	MERCEDES	MERCEDES, ROSA	2017-04	2017-03-06	4469.00	0.00	4469.00	NMSR	NL	ISABEL	Albuera 	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sxccjlj	PD CARIGARA 	2249	Angeline	Mercolita	Mercolita, Angeline	2023-05	2023-04-07	2010.00	0.00	2010.00	NM	L	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4hhnbst	EDDIE	3412	Charita	Mercolita	Mercolita, Charita	2024-12	2024-11-03	1936.00	0.00	1936.00	M	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gr1f018	PD ISABEL 	3448	CARIN	MESIAS	MESIAS, CARIN	2025-01	2024-10-31	1853.00	0.00	1853.00	NMSR	L	ISABEL	Ormoc	Curva 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sq1ds2b	PD BAYBAY	2665	ROSA MARIA	MESICULA	MESICULA, ROSA MARIA	2022-02	2022-12-31	2901.00	0.00	2901.00	NM	NL	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vo29yk7	TATA	3508	AMORLINA	MILADO	MILADO, AMORLINA	2026-01	2025-10-05	5085.00	0.00	5085.00	M	L	SAN ISIDRO 	Leyte-Leyte	Burabod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3320c35	TATA	3520	CATHERINE	MILADO	MILADO, CATHERINE	2026-01	2025-10-30	3505.00	0.00	3505.00	M	L	SAN ISIDRO 	Leyte-Leyte	Burabod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3m49l9t	MASOY	3480	JULES	MILANO	MILANO, JULES	2025-02	2024-12-18	1301.00	0.00	1301.00	NM	NL	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2rtpayw	LITO 	3358	Japeth	Mirafuentes	Mirafuentes, Japeth	2025-04	2025-03-10	10500.00	0.00	10500.00	NM	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n4q4iux	SUPERVISOR	8	Linel	Misa	Misa, Linel	2020-04	2020-03-17	27780.00	0.00	27780.00	NM	L	KANANGA	Matag-ob	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6j46spn	PD BAYBAY	3099	RAMILA	MODINA	MODINA, RAMILA	2023-07	2023-06-12	3346.00	0.00	3346.00	NM	NL	BAYBAY	Baybay	Bunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7bi93ws	PD KANANGA 	238	Ramonbrillo	Molina	Molina, Ramonbrillo	2019-02	2019-01-17	4988.00	0.00	4988.00	NM	NL	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gwaxcyr	SUPERVISOR	31	Merlinda	Monares	Monares, Merlinda	2017-09	2017-08-10	320.00	0.00	320.00	M	L	KANANGA	Ormoc	Matica-a		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ahlf5cs	PD PALOMPON	1937	Lolita	Mondiego	Mondiego, Lolita	2021-02	2019-01-17	2400.00	0.00	2400.00	NM	L	ORMOC	Albuera	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uo1e0dg	PD PALOMPON	1493	LOURDES	MONDIGO	MONDIGO, LOURDES	2020-04	2020-03-01	8200.00	0.00	8200.00	NM	NL	PALOMPON	Palompon	San Miguel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k6h5wtm	PD KANANGA 	30	Rovelyn	Mondin	Mondin, Rovelyn	2017-11	2021-01-20	150.00	0.00	150.00	NM	L	KANANGA	Kananga	Naghalin		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ghgktte	PD BAYBAY	1366	EULALIA	MONES	MONES, EULALIA	2020-04	2020-03-06	9350.00	0.00	9350.00	NM	NL	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
riz56hn	LITO 	366	RIZA	MONTAJES	MONTAJES, RIZA	2018-10	2018-08-16	2020.00	0.00	2020.00	M	L	ISABEL	Merida 	Calunangan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
slym0py	PD CARIGARA 	2134	Renalyn	Montebon	Montebon, Renalyn	2021-11	2021-10-07	3415.00	0.00	3415.00	NM	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lvh35pk	PD KANANGA 	2076	Mary Grace	Monterde	Monterde, Mary Grace	2021-12	2021-11-05	456.00	0.00	456.00	NM	NL	KANANGA	Kananga	Natubgan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k6i36xm	PD PALOMPON	1353	ELIZABETH	MONTERO	MONTERO, ELIZABETH	2020-04	2020-03-01	3086.00	0.00	3086.00	NM	NL	PALOMPON	Villaba	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l2z4hqt	LITO 	459	RENATO	MONTES	MONTES, RENATO	2020-01	2019-12-18	6173.00	0.00	6173.00	M	L	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6hjs3rt	MASOY	3500	RAMEL	MONTESCLAROS	MONTESCLAROS, RAMEL	2026-01	2025-10-27	13705.00	0.00	13705.00	M	L	BAYBAY 	Baybay 	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p9dyflu	MASOY	3497	NENITA	MORALES	MORALES, NENITA	2025-03	2025-01-05	1493.00	0.00	1493.00	M	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ics1vj2	MASOY	3456	RUFINA	MORALES	MORALES, RUFINA	2025-12	2025-10-03	5525.00	0.00	5525.00	M	L	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q2zlka3	PD BAYBAY	957	RECHELLE	MORATA	MORATA, RECHELLE	2019-07	2019-06-08	660.00	0.00	660.00	M	L	BAYBAY	Baybay	Maslug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gdoe7at	MASOY	1712	ROSITA	MORATA	MORATA, ROSITA	2025-02	2024-12-05	1553.00	0.00	1553.00	M	L	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7z7qbqt	PD BAYBAY	2826	EVA	MORENO	MORENO, EVA	2025-01	2024-11-02	1745.00	0.00	1745.00	M	L	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jkbsv93	PD ISABEL 	397	ELSA	MORERA	MORERA, ELSA	2017-06	2017-05-25	2170.00	0.00	2170.00	NM	NL	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pn0whpz	TATA	3684	GRACE	MORITCHO	MORITCHO, GRACE	2026-01	2025-11-04	3410.00	0.00	3410.00	M	L	SAN ISIDRO 	San Isidro	Biasong 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p99jkv4	MASOY	3476	MELBA	MOSOT	MOSOT, MELBA	2025-03	2025-01-14	3335.00	0.00	3335.00	NM	NL	BAYBAY	Bato 	Bagong Bayan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o6j8g1z	PD ISABEL 	2401	DOMINGO	MOSTASISA JR	MOSTASISA JR, DOMINGO	2021-12	2021-11-09	3762.00	0.00	3762.00	NM	NL	ISABEL	Isabel	Can-andan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i1rqwnm	PD ISABEL 	1969	ADILA	MUAÑA	MUAÑA, ADILA	2021-07	2021-06-10	1901.00	0.00	1901.00	NM	NL	ISABEL	Merida 	Mahalit 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l78paq6	LITO 	422	JESSECA	MUEGO	MUEGO, JESSECA	2019-05	2019-04-05	5260.00	0.00	5260.00	M	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hvwavrl	LITO 	1126	MELVIN	MUEGO	MUEGO, MELVIN	2019-04	2019-03-29	30000.00	0.00	30000.00	M	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hmjaefp	MASOY	2019	CLAVITA	MUERTIGUE	MUERTIGUE, CLAVITA	2025-11	2025-09-22	6080.00	0.00	6080.00	M	L	BAYBAY	Baybay	Sta. Cruz		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vm1u3in	PD CARIGARA 	2170	Marlon	Naadat	Naadat, Marlon	2022-05	2022-04-21	1082.00	0.00	1082.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wm9x61b	NOEL	1026	ESTRELLA	NAILON	NAILON, ESTRELLA	2020-02	2020-01-26	17099.00	0.00	17099.00	M	L	PALOMPON	Kananga	Masarayao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hrmhp9r	PD PALOMPON	1063	JOSEFINA	NAILON	NAILON, JOSEFINA	2019-04	2019-03-15	9130.00	0.00	9130.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q3exqrg	EDDIE	3564	Rogelio	Naldo	Naldo, Rogelio	2025-02	2024-12-13	3852.00	0.00	3852.00	M	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fx7n5bn	LITO 	3577	MARCOSA	NAPOLES	NAPOLES, MARCOSA	2026-01	2025-10-26	1635.00	0.00	1635.00	M	L	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e7s1yzh	PD PALOMPON	887	Ma. Cristina	Narido	Narido, Ma. Cristina	2018-06	2018-05-03	2045.00	0.00	2045.00	NM	NL	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gqr100y	PD CARIGARA 	2728	Louie	Nartea	Nartea, Louie	2022-08	2022-07-04	5396.00	0.00	5396.00	NM	NL	CARIGARA	Carigara	West Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0jtse86	SUPERVISOR	3583	PERLITA	NATIVIDAD	NATIVIDAD, PERLITA	2025-11	2025-09-06	965.00	0.00	965.00	M	L	KANANGA	Kananga 	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a2ofs81	SUPERVISOR	3582	VIRGINIA	PALIMA	PALIMA, VIRGINIA	2025-11	2025-09-08	2875.00	0.00	2875.00	NMSR	L	KANANGA	Kananga 	Riverside 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
il1alko	EDDIE	2073	Jennifer	Navarro	Navarro, Jennifer	2022-09	2022-07-31	656.00	0.00	656.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5ooee6l	PD BAYBAY	957	ROSELA	NAYGA	NAYGA, ROSELA	2020-10	2020-09-19	11710.00	0.00	11710.00	NM	NL	BAYBAY	Baybay	Hilapnitan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2vwilag	PD CARIGARA 	2071	Merlita	Nidea	Nidea, Merlita	2023-12	2023-11-08	4994.00	0.00	4994.00	NMSR	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j76og4e	EDDIE	2106	Lourdes	Nidera	Nidera, Lourdes	2021-12	2021-11-13	617.00	0.00	617.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0rnw4go	PD KANANGA 	244	Divina	Niegas	Niegas, Divina	2018-04	2022-10-14	2110.00	0.00	2110.00	NM	NL	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i3zfz3z	PD CARIGARA 	2053	John Patrick	Niegas	Niegas, John Patrick	2021-08	2021-07-15	2190.00	0.00	2190.00	NM	NL	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5dcgsll	PD CARIGARA 	2421	Ronnel	Niegas	Niegas, Ronnel	2022-11	2022-10-14	2574.00	0.00	2574.00	NM	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b6e1o1g	LITO 	106	GILDA	NIERVES	NIERVES, GILDA	2018-11	2018-10-19	1295.00	0.00	1295.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2hgz6dw	EDDIE	2896	Herminigilda	Nierves	Nierves, Herminigilda	2024-11	2024-10-24	1734.00	0.00	1734.00	M	L	CARIGARA	Carigara	San Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e4ab0t4	PD ISABEL 	2332	JINKIE LYN	NIERVES	NIERVES, JINKIE LYN	2021-10	2021-09-01	3120.00	0.00	3120.00	NM	NL	ISABEL	Merida 	Macario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
745q27i	PD CARIGARA 	2633	Miriam	Nimer	Nimer, Miriam	2023-07	2023-05-17	6798.00	0.00	6798.00	NM	NL	CARIGARA	Capoocan	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ycnq444	LITO 	3222	MAILYNE	NIÑO	NIÑO, MAILYNE	2024-11	2024-09-09	4008.00	0.00	4008.00	M	L	ISABEL	Isabel	Tolingon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4684ieb	PD PALOMPON	558	Lucelyn	Nodalo	Nodalo, Lucelyn	2019-06	2019-05-12	2981.00	0.00	2981.00	M	L	ORMOC	Albuera	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8lwg0r8	PD BAYBAY	373	REGINA	NOGALADA	NOGALADA, REGINA	2018-03	2018-02-26	16830.00	0.00	16830.00	NM	NL	BAYBAY	Baybay	Quezon St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zrmgkx7	PD BAYBAY	2791	JOSEPHINE	NOTARTE	NOTARTE, JOSEPHINE	2022-09	2022-06-21	696.00	0.00	696.00	NM	NL	BAYBAY	Baybay	Kilim		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0us1bzo	ALDIE 	208	Rosemelita	Noval	Noval, Rosemelita	2026-01	2025-10-19	4800.00	0.00	4800.00	M	L	ORMOC	Ormoc	Milagro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lhgzamk	NOEL	3717	RONILO	NOYA	NOYA, RONILO	2025-11	2025-09-23	1541.00	0.00	1541.00	NM	NL	PALOMPON 	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jwam83x	PD PALOMPON	1252	MYRNA	NUEVO	NUEVO, MYRNA	2024-06	2023-02-01	23075.00	0.00	23075.00	NM	NL	PALOMPON	Kananga	Montebello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mu0atb4	ALDIE 	595	Rosario	Nuevo	Nuevo, Rosario	2021-11	2021-10-08	3850.00	0.00	3850.00	M	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hsy9kg5	PD CARIGARA 	2193	Consuelo	Nuñez	Nuñez, Consuelo	2022-01	2021-12-06	2672.00	0.00	2672.00	NM	L	CARIGARA	Carigara	Sawang		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qcetr9i	PD BAYBAY	601	DORISA M.	NUÑEZ	NUÑEZ, DORISA M.	2017-04	2017-03-20	7194.00	0.00	7194.00	NMSR	NL	BAYBAY	Baybay	Santos St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
s630qb8	LITO 	474	JOSEFA	NUÑEZ	NUÑEZ, JOSEFA	2022-03	2022-02-11	2050.00	0.00	2050.00	M	L	ISABEL	Isabel	Sta. Cruz 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nczzt1l	PD ISABEL 	253	LEOFILLA	NUÑEZ	NUÑEZ, LEOFILLA	2018-02	2018-01-01	8770.00	0.00	8770.00	NM	NL	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
v6ueakd	NOEL	3511	LILIBETH	NUÑEZ	NUÑEZ, LILIBETH	2025-07	2025-05-24	2440.00	0.00	2440.00	NM	L	PALOMPON	Palompon	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xkm9btc	PD ISABEL 	413	MARICRIS	NUÑEZ	NUÑEZ, MARICRIS	2017-10	2017-09-01	4028.00	0.00	4028.00	NM	NL	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kn221ng	NOEL	1480	MARLYN	NUÑEZ	NUÑEZ, MARLYN	2023-08	2023-07-15	15168.00	0.00	15168.00	NM	L	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8ouzjgn	PD PALOMPON	1585	CATHELINE	OBANDO	OBANDO, CATHELINE	2020-04	2020-03-01	1010.00	0.00	1010.00	NM	NL	PALOMPON	Kananga	Kawayan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
clxfom4	PD CARIGARA 	2056	Joan	Oblino	Oblino, Joan	2021-06	2021-05-05	4170.00	0.00	4170.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j95dia3	PD CARIGARA 	2036	Judith	Odtohan	Odtohan, Judith	2022-03	2023-02-09	2278.00	0.00	2278.00	NM	L	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3jqw440	LITO 	256	LUCIA	OFREDO	OFREDO, LUCIA	2020-04	2020-03-01	2629.00	0.00	2629.00	M	L	ISABEL	Merida 	Puertobello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ljmgs7t	LITO 	1074	PHILIP	OLACAO	OLACAO, PHILIP	2018-08	2018-07-04	733.00	0.00	733.00	M	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gehcq6q	EDDIE	1615	Marlon F.	Olan-Olan	Olan-Olan, Marlon F.	2021-10	2021-09-11	20610.00	0.00	20610.00	M	L	CARIGARA	Kananga 	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lsah9q4	PD PALOMPON	2451	NANCY	OLASIMAN	OLASIMAN, NANCY	2022-04	2022-03-04	4440.00	0.00	4440.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cyjki2q	LITO 	301	LUISA	OLIMPUS	OLIMPUS, LUISA	2018-03	2018-02-16	1395.00	0.00	1395.00	M	L	ISABEL	Isabel	Matlang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
px6b8lj	PD PALOMPON	2706	VINCENT	OLORVIDA	OLORVIDA, VINCENT	2023-05	2023-04-20	3973.00	0.00	3973.00	NMSR	L	PALOMPON	Palompon	Buenavista 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1tcso4u	PD ISABEL 	391	ELVIRA	OMAMALIN	OMAMALIN, ELVIRA	2018-08	2018-07-27	5330.00	0.00	5330.00	NM	NL	ISABEL	Isabel	Alipasa		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bf2yoc9	PD KANANGA 	822	Rowena	Onde	Onde, Rowena	2020-05	2020-04-06	3479.00	0.00	3479.00	NM	NL	KANANGA	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nl5o3xc	EDDIE	3301	Dionesio	Oquias	Oquias, Dionesio	2024-01	2023-12-02	1010.00	0.00	1010.00	NM	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vdxqsi6	TATA	3557	ANALOU	ORAYLE	ORAYLE, ANALOU	2025-10	2025-06-30	733.00	0.00	733.00	M	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lwn18zl	TATA	3550	CHERLYN MAE	ORBISO	ORBISO, CHERLYN MAE	2026-01	2025-10-14	2261.00	0.00	2261.00	M	L	SAN ISIDRO 	Tabango 	Tabing		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5xke1gn	PD KANANGA 	1166	Precila	Orillo	Orillo, Precila	2023-07	2020-02-23	5989.00	0.00	5989.00	NM	NL	KANANGA	Matag-ob	Sta. Rosa		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pvsguvi	PD BAYBAY	2756	JYN	ORITO	ORITO, JYN	2023-07	2022-08-17	4990.00	0.00	4990.00	NM	NL	BAYBAY	Baybay	Sta. Cruz		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zpubgpn	LITO 	442	JOCELYN	ORONG	ORONG, JOCELYN	2018-05	2018-04-22	1920.00	0.00	1920.00	M	L	ISABEL	Merida 	Libas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7afd09s	PD BAYBAY	1784	VIVIAN LEE	ORTIZ	ORTIZ, VIVIAN LEE	2021-01	2020-12-03	7820.00	0.00	7820.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
trcocg3	TATA	3540	MICHAEL	PABILAR	PABILAR, MICHAEL	2025-08	2025-05-16	1026.00	0.00	1026.00	NM	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9dpb7aq	LITO 	11	FE	PACALDO	PACALDO, FE	2021-10	2021-09-24	10270.00	0.00	10270.00	M	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ciz4m95	NOEL	2583	REYNALDO	PACALDO	PACALDO, REYNALDO	2026-01	2025-10-09	3365.00	0.00	3365.00	M	L	PALOMPON	Ormoc	Donghol		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xhuzong	PD BAYBAY	648	JEHADE	PACATE	PACATE, JEHADE	2019-09	2019-08-23	7588.00	0.00	7588.00	NM	NL	BAYBAY	Baybay 	Maybog		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5lz51pf	PD BAYBAY	2909	EMILY	PACHECO	PACHECO, EMILY	2023-09	2023-08-18	1085.00	0.00	1085.00	NM	NL	BAYBAY	Baybay	Punta 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qsol6rr	PD ISABEL 	2348	LORENA	PACOT	PACOT, LORENA	2022-08	2022-07-04	5842.00	0.00	5842.00	NM	NL	ISABEL	Merida 	Casilda		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
62pwll7	PD BAYBAY	3243	ANABELLE	PADILLA	PADILLA, ANABELLE	2023-09	2023-08-18	1002.00	0.00	1002.00	NM	NL	BAYBAY	Hilongos 	Central Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
03wixeg	PD PALOMPON	1078	GULA	PAJARON	PAJARON, GULA	2019-12	2019-11-14	1070.00	0.00	1070.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ss21u9r	PD PALOMPON	1128	MERCY CHRISTINE H.	PAJARON	PAJARON, MERCY CHRISTINE H.	2018-09	2018-08-10	3745.00	0.00	3745.00	NM	NL	PALOMPON	Palompon	Zamora 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f5w0gss	PD CARIGARA 	2448	Ronalyn	Palacio	Palacio, Ronalyn	2022-07	2022-06-05	1956.00	0.00	1956.00	NM	NL	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
10bm7nl	PD PALOMPON	1840	MARY JANE	PALAD	PALAD, MARY JANE	2021-05	2021-04-17	2480.00	0.00	2480.00	NM	L	PALOMPON	Palompon	Lomonon 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ijelklm	PD BAYBAY	1631	BENDITHA	PALE	PALE, BENDITHA	2020-05	2020-04-25	4888.00	0.00	4888.00	NM	NL	BAYBAY	Hilongos 	Atabay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mtiv7r2	NOEL	2268	ALAMED ALI	PALOMA	PALOMA, ALAMED ALI	2026-01	2025-10-24	23500.00	0.00	23500.00	M	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tklqdku	MASOY	3135	CYNTHIA LEILA	PALUGOD	PALUGOD, CYNTHIA LEILA	2023-07	2023-06-24	972.00	0.00	972.00	M	L	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r2untxf	PD CARIGARA 	2205	Emelie	Panal	Panal, Emelie	2022-05	2022-04-21	1768.00	0.00	1768.00	NM	NL	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f8cw1vm	LITO 	410	ANITA	PAÑARES	PAÑARES, ANITA	2017-06	2017-05-01	1633.00	0.00	1633.00	NM	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hlbr7wq	PD PALOMPON	821	Emery	Pancho	Pancho, Emery	2017-06	2017-06-01	2106.00	0.00	2106.00	NM	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p8ysqmd	PD PALOMPON	1232	VILMA	PANDAC	PANDAC, VILMA	2019-09	2019-08-23	2647.00	0.00	2647.00	NM	NL	PALOMPON	Palompon	Mix Palompon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
79icno8	PD KANANGA 	35	Gina	Pandoy	Pandoy, Gina	2017-11	2017-06-01	4410.00	0.00	4410.00	NM	NL	KANANGA	Kananga	Libongao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mguncgj	PD PALOMPON	203	Estrellita	Panilag	Panilag, Estrellita	2024-12	2024-11-18	1330.00	0.00	1330.00	NM	L	ORMOC	Ormoc	Cantalib		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uifjdgo	EDDIE	3241	Lilibeth	Panilawon	Panilawon, Lilibeth	2024-09	2024-08-11	2012.00	0.00	2012.00	M	L	CARIGARA	Carigara	Manloy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
aag5hdq	ALDIE 	2552	Diosdado	Panta Jr	Panta Jr, Diosdado	2024-11	2024-10-12	4476.00	0.00	4476.00	M	L	ORMOC	Ormoc	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sa1rbwg	MASOY	638	ALBERTO	PARAISO	PARAISO, ALBERTO	2017-12	2017-11-27	3268.00	0.00	3268.00	M	L	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a24yi6u	PD BAYBAY	2316	ESMAILA	PARAISO	PARAISO, ESMAILA	2022-08	2022-07-08	1000.00	0.00	1000.00	NM	NL	BAYBAY	Baybay	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2wrfpga	PD BAYBAY	2289	RONNIE	PARAISO	PARAISO, RONNIE	2021-09	2021-08-27	380.00	0.00	380.00	NM	NL	BAYBAY	Baybay	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4c21i88	ALDIE 	309	Maria Theresa	Paras	Paras, Maria Theresa	2024-11	2024-09-28	15152.00	0.00	15152.00	M	L	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g0xgz17	PD BAYBAY	269	CELERINA	PARDILLO	PARDILLO, CELERINA	2018-04	2018-08-22	2270.00	0.00	2270.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lflmn67	PD ISABEL 	1963	LOLITA	PARILLA	PARILLA, LOLITA	2021-07	2021-06-10	3128.00	0.00	3128.00	NM	NL	ISABEL	Merida 	Mahalit 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4jkt4ha	MASOY	3194	Jocelyn	Paring	Paring, Jocelyn	2025-04	2025-02-17	3500.00	0.00	3500.00	NM	L	BAYBAY	Baybay	Hicgop 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xv2fnwt	PD PALOMPON	988	ARSENIA	PASTOR	PASTOR, ARSENIA	2020-03	2020-02-01	1325.00	0.00	1325.00	NM	NL	PALOMPON	Villaba	Cagnocot		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hl9mydb	PD PALOMPON	2850	MARINA	PASTOR	PASTOR, MARINA	2023-07	2023-05-12	1326.00	0.00	1326.00	NM	NL	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5ju1zjz	PD PALOMPON	1211	Maria Blanca	Pasturan	Pasturan, Maria Blanca	2018-11	2018-10-27	2650.00	0.00	2650.00	NM	NL	ORMOC	Ormoc	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0a9k2pf	PD PALOMPON	1325	LILEBETH	PATILLAS	PATILLAS, LILEBETH	2019-10	2019-09-11	2777.00	0.00	2777.00	NM	NL	PALOMPON	Villaba	Suba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
epo5x5z	PD KANANGA 	1867	Azor	Patombon	Patombon, Azor	2021-11	2021-10-10	203320.00	0.00	203320.00	NM	NL	KANANGA	Kananga	Natubgan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0kiobhi	PD CARIGARA 	2028	Maribel	Patricio	Patricio, Maribel	2021-12	2021-11-13	2761.00	0.00	2761.00	NM	NL	CARIGARA	Carigara	Sugaban		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cp8tmah	PD CARIGARA 	2682	Leonila	Pavillon	Pavillon, Leonila	2023-04	2023-03-06	7156.00	0.00	7156.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
iy7rmko	LITO 	1857	MA. LITA	PAYOD	PAYOD, MA. LITA	2025-07	2025-06-17	5671.00	0.00	5671.00	M	L	ISABEL	Isabel	Ormoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dgmdby5	LITO 	814	Thelma	Payod	Payod, Thelma	2018-04	2018-03-22	630.00	0.00	630.00	NM	L	ISABEL	Ormoc	Ormoc Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9z0bvyv	EDDIE	2478	Rubylie	Peañar	Peañar, Rubylie	2022-06	2022-05-18	1119.00	0.00	1119.00	M	L	CARIGARA	Carigara	East Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o40wgot	NOEL	3206	HONEY GRACE	PELAYO	PELAYO, HONEY GRACE	2025-02	2024-12-29	12711.00	0.00	12711.00	M	L	PALOMPON	Villaba	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zkjkrua	SUPERVISOR	2126	Jesse	Pelayo	Pelayo, Jesse	2021-11	2021-10-10	2317.00	0.00	2317.00	M	L	KANANGA	Ormoc	Luna		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
42bkprb	TATA	3543	MARILYN	PELAYO	PELAYO, MARILYN	2026-01	2025-10-20	3390.00	0.00	3390.00	M	L	SAN ISIDRO 	Tabango 	Tabing 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g7zc40u	TATA	3561	RENALYN	PELAYO	PELAYO, RENALYN	2025-10	2025-07-12	4100.00	0.00	4100.00	NM	L	SAN ISIDRO 	Tabango 	Campokpok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
hnbw9ui	NOEL	1447	RIZALINA	PELAYO	PELAYO, RIZALINA	2025-01	2024-11-11	24550.00	0.00	24550.00	M	L	PALOMPON	Villaba 	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
y0v6n2a	EDDIE	2214	Analyn G.	Peñaranda	Peñaranda, Analyn G.	2022-06	2022-05-01	10858.00	0.00	10858.00	M	L	CARIGARA	Carigara	Tagak		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
md3n0rt	PD CARIGARA 	2165	Jay Ann Rose	Peñaranda	Peñaranda, Jay Ann Rose	2022-01	2021-12-10	9180.00	0.00	9180.00	NM	NL	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ib1zql3	EDDIE	2299	Ma. Thelma	Peñaranda	Peñaranda, Ma. Thelma	2021-12	2021-10-31	1222.00	0.00	1222.00	M	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p4qkbh7	EDDIE	2129	Susan	Peñaranda	Peñaranda, Susan	2023-04	2023-03-17	824.00	0.00	824.00	M	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9bsvv5s	PD PALOMPON	2555	ALEJANDRO	PEPITO JR	PEPITO JR, ALEJANDRO	2022-05	2022-04-02	1610.00	0.00	1610.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
e6fmy3d	PD ISABEL 	543	JONIE	PEPITO	PEPITO, JONIE	2021-06	2021-05-13	2290.00	0.00	2290.00	NM	NL	ISABEL	Ormoc	Libertad 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ttculb0	PD PALOMPON	2390	MARIABETH	PEPITO	PEPITO, MARIABETH	2022-04	2022-03-29	6328.00	0.00	6328.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
doz6ykb	PD PALOMPON	2413	RACHEL	PEPITO	PEPITO, RACHEL	2022-04	2022-03-29	2634.00	0.00	2634.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pclr3kh	ALDIE 	3527	TRICIA MAE	PEPITO	PEPITO, TRICIA MAE	2025-09	2025-07-03	4150.00	0.00	4150.00	NM	L	ORMOC	Albuera 	Talisay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2npmnko	ALDIE 	3401	VILMA	PEPITO	PEPITO, VILMA	2026-01	2025-10-30	1885.00	0.00	1885.00	NM	L	ORMOC	Ormoc	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lp2mi19	EDDIE	2335	Judy Ann	Peralta	Peralta, Judy Ann	2023-01	2022-12-19	956.00	0.00	956.00	M	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ckf7zeg	PD BAYBAY	1541	MARIVIC	PERERO	PERERO, MARIVIC	2020-04	2020-03-28	3331.00	0.00	3331.00	NM	NL	BAYBAY	Baybay	Palhi 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
um4lfew	PD ISABEL 	2643	LEVITA	PEREZ	PEREZ, LEVITA	2025-02	2024-12-13	8968.00	0.00	8968.00	NMSR	L	ISABEL	Ormoc	Bagong Buhay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2s9lo6h	LITO 	2857	MARRYLOE	PEREZ	PEREZ, MARRYLOE	2022-06	2022-05-06	984.00	0.00	984.00	M	L	ISABEL	Ormoc	San Juan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gynhcp2	ALDIE 	859	Thelma	Perina	Perina, Thelma	2020-01	2019-12-26	1686.00	0.00	1686.00	M	L	ORMOC	Ormoc	San Isidro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jn4ot9b	PD PALOMPON	2990	Wilson	Pernia	Pernia, Wilson	2023-07	2023-06-25	2645.00	0.00	2645.00	NM	NL	ORMOC	Ormoc	Cogon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l7cl424	PD BAYBAY	2645	FELY	PERNITES	PERNITES, FELY	2023-08	2023-07-09	12502.00	0.00	12502.00	NM	NL	BAYBAY	Baybay	Hipusngo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ujx5r36	PD BAYBAY	600	MAGDALENA	PERNITES	PERNITES, MAGDALENA	2017-08	2017-07-29	6175.00	0.00	6175.00	NM	NL	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
we5q8pw	PD BAYBAY	2726	MARY ANN	PERNITES	PERNITES, MARY ANN	2023-07	2023-06-21	3800.00	0.00	3800.00	NM	NL	BAYBAY	Baybay	Hipusngo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fip5c8t	PD BAYBAY	645	RAFFY	PERNITES	PERNITES, RAFFY	2018-11	2018-09-10	1650.00	0.00	1650.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vyx06nx	MASOY	3495	JENNIFER	PERO	PERO, JENNIFER	2025-03	2025-01-14	4775.00	0.00	4775.00	NM	NL	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6h3iqdh	PD KANANGA 	158	Florenda	Peroso	Peroso, Florenda	2017-10	2017-09-02	9330.00	0.00	9330.00	NM	NL	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gev0hio	PD PALOMPON	1569	Ernesto	Piastro	Piastro, Ernesto	2024-12	2024-11-29	56000.00	0.00	56000.00	NM	L	ORMOC	Albuera 	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
idzedgs	PD BAYBAY	2292	EVANGELINE	PIGAO	PIGAO, EVANGELINE	2021-10	2021-09-23	1670.00	0.00	1670.00	NM	NL	BAYBAY	Baybay	San Agustin		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ids2nld	EDDIE	2673	MARIO	PILANDE	PILANDE, MARIO	2025-10	2025-07-17	2700.00	0.00	2700.00	NM	L	CARIGARA	Carigara 	San Juan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w1j0df8	PD ISABEL 	1338	MARICEL	PILAPIL	PILAPIL, MARICEL	2020-12	2020-11-20	4590.00	0.00	4590.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cpz9gbe	PD PALOMPON	2425	Jacky Lyn	Pilo	Pilo, Jacky Lyn	2023-09	2023-08-18	9970.00	0.00	9970.00	NM	NL	ORMOC	Ormoc	San Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bxyto2k	NOEL	3416	CHERRIE JANE	PIRAMIDE	PIRAMIDE, CHERRIE JANE	2026-01	2025-10-09	27600.00	0.00	27600.00	M	L	PALOMPON	Palompon	Guiwan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sw3qikb	PD CARIGARA 	2228	Lota	Platilla	Platilla, Lota	2021-08	2021-07-11	2065.00	0.00	2065.00	NM	L	CARIGARA	Carigara	Ponong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a9zyllp	LITO 	1287	LEZLE	POBLETE	POBLETE, LEZLE	2022-06	2022-05-19	12805.00	0.00	12805.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ighzpp3	LITO 	3345	MARIA LOLITA	POJEDA	POJEDA, MARIA LOLITA	2024-06	2024-05-08	2806.00	0.00	2806.00	M	L	ISABEL	Ormoc	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
u8su0cr	PD BAYBAY	598	AGNES	POLECIOS	POLECIOS, AGNES	2017-06	2017-05-10	5014.00	0.00	5014.00	NMSR	NL	BAYBAY	Baybay	Biasong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f4qrqy9	SUPERVISOR	370	Raffi Jake	Polinio	Polinio, Raffi Jake	2020-03	2020-02-28	3300.00	0.00	3300.00	M	L	KANANGA	Matag-ob	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k0c488l	PD BAYBAY	641	ALFREDO	POLO	POLO, ALFREDO	2017-09	2017-08-07	2449.00	0.00	2449.00	NM	NL	BAYBAY	Baybay	Pilar 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mkmaqa9	PD PALOMPON	82	Dalla	Porcadilla	Porcadilla, Dalla	2018-07	2018-06-25	1855.00	0.00	1855.00	NM	NL	ORMOC	Ormoc	Macabug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qul3p35	LITO 	2349	SHIELA	PORCARE	PORCARE, SHIELA	2023-12	2023-11-21	1983.00	0.00	1983.00	M	L	ISABEL	Isabel	Tubod		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fakumug	PD CARIGARA 	3011	Magdalena	Portillo	Portillo, Magdalena	2023-09	2023-08-09	3319.00	0.00	3319.00	NM	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jokb7hj	PD PALOMPON	3014	Anenito	Potane	Potane, Anenito	2023-09	2023-08-09	7980.00	0.00	7980.00	NM	NL	ORMOC	Baybay	Maybog		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mt6cn2g	PD CARIGARA 	2153	Ruth	Profetana	Profetana, Ruth	2021-08	2021-07-19	3160.00	0.00	3160.00	NM	NL	CARIGARA	Carigara	Sawang		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n2gtlqj	PD BAYBAY	579	DOROTHY	PUGOSA	PUGOSA, DOROTHY	2017-05	2017-04-29	5804.00	0.00	5804.00	NM	NL	BAYBAY	Baybay	Magsaysay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f1g1svk	PD CARIGARA 	2186	Guada May	Quitoriano	Quitoriano, Guada May	2021-08	2021-09-05	3765.00	0.00	3765.00	NM	NL	CARIGARA	Carigara	Canal		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tssz5qt	PD CARIGARA 	692	Gina	Quizon	Quizon, Gina	2019-07	2019-06-07	3200.00	0.00	3200.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
d8jl553	PD CARIGARA 	2090	Rosalie	Raagas	Raagas, Rosalie	2024-06	2024-05-25	2775.00	0.00	2775.00	NM	L	CARIGARA	Carigara	Norte 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q8ytwas	PD BAYBAY	1379	MARITA	RABUSQUEZ	RABUSQUEZ, MARITA	2019-10	2019-09-08	6305.00	0.00	6305.00	NM	NL	BAYBAY	Baybay	Maslug		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h6p97ba	TATA	3573	JOAN	RALIA	RALIA, JOAN	2025-11	2025-09-04	690.00	0.00	690.00	M	L	SAN ISIDRO 	Leyte-Leyte	Tinocdugan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ynt1bcz	SUPERVISOR	3265	Ma. Lorena	Rallos	Rallos, Ma. Lorena	2023-08	2023-07-05	6206.00	0.00	6206.00	M	L	KANANGA	Ormoc	Kadaohan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dk1iihv	PD ISABEL 	429	JEANELYN	RAMOS	RAMOS, JEANELYN	2017-06	2017-05-14	3479.00	0.00	3479.00	NM	NL	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5g6viwc	PD ISABEL 	2676	MARGELINA	RAÑOLAS	RAÑOLAS, MARGELINA	2023-01	2022-12-09	11161.00	0.00	11161.00	NM	L	ISABEL	Ormoc	Libertad 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
u2101jo	PD CARIGARA 	2081	Cherry Ann	Reamillo	Reamillo, Cherry Ann	2021-08	2021-07-01	1695.00	0.00	1695.00	NM	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
51f893w	PD PALOMPON	1419	Flordelis	Reando	Reando, Flordelis	2019-10	2019-09-23	4890.00	0.00	4890.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
poyoent	EDDIE	3078	MYRNA	REBUCAN	REBUCAN, MYRNA	2025-10	2025-07-24	2245.00	0.00	2245.00	M	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1uy9rbq	PD BAYBAY	575	WILSON	REBUCAS	REBUCAS, WILSON	2019-07	2019-06-21	4662.00	0.00	4662.00	NM	L	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5qglgci	MASOY	2062	ROSANNA	RECTO	RECTO, ROSANNA	2025-02	2024-12-05	4075.00	0.00	4075.00	NM	NL	BAYBAY	Baybay	Plaridel		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
b8eak9w	MASOY	591	ANNABELLE	REFUGIO	REFUGIO, ANNABELLE	2019-10	2019-08-31	7460.00	0.00	7460.00	M	L	BAYBAY	Baybay	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
svf75bd	TATA	3510	ROCELA	REGALA	REGALA, ROCELA	2025-11	2025-08-16	2825.00	0.00	2825.00	M	L	SAN ISIDRO 	San Isidro	Matungao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cumiv26	PD CARIGARA 	2395	Brian T.	Remedio	Remedio, Brian T.	2022-06	2022-05-29	10788.00	0.00	10788.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qsseh66	ALDIE 	3138	MARIBETH	REMOROZA	REMOROZA, MARIBETH	2025-09	2025-07-11	650.00	0.00	650.00	M	L	ORMOC 	Albuera 	Talisay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jl279yn	PD BAYBAY	1726	CONCEPCION	REOMA	REOMA, CONCEPCION	2021-04	2021-03-12	4695.00	0.00	4695.00	NM	NL	BAYBAY	Hilongos 	Lamak		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t26lfml	PD BAYBAY	1669	GLORIA	REOMA	REOMA, GLORIA	2022-01	2021-12-23	2398.00	0.00	2398.00	NM	NL	BAYBAY	Hilongos 	Alcuino St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pzeelc4	PD BAYBAY	1719	MERIAM	REPULLEDO	REPULLEDO, MERIAM	2021-04	2021-03-04	3340.00	0.00	3340.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z0uym06	ALDIE 	1759	EVELYN	RESERVA	RESERVA, EVELYN	2026-01	2025-11-12	27866.00	0.00	27866.00	M	L	ORMOC	Albuera 	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vvr4kry	PD BAYBAY	2949	LUCIA	RETAZA	RETAZA, LUCIA	2023-09	2023-08-23	6175.00	0.00	6175.00	NM	L	BAYBAY	Baybay	Hipusngo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sgdabnk	NOEL	2394	MARICEL	RETURBAR	RETURBAR, MARICEL	2025-02	2024-12-28	6665.00	0.00	6665.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i1tv55x	LITO 	259	LILIBETH	RETUYA	RETUYA, LILIBETH	2025-10	2025-07-03	2875.00	0.00	2875.00	NMSR	L	ISABEL	Merida 	Casilda		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1yov9f8	TATA	3579	ELSA	REUBAL	REUBAL, ELSA	2026-01	2025-11-04	4255.00	0.00	4255.00	M	L	SAN ISIDRO 	San Isidro	Linao 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ndwbfil	NOEL	3711	JAY ANN	REUBAL	REUBAL, JAY ANN	2025-11	2025-09-21	1770.00	0.00	1770.00	NM	L	PALOMPON	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
z6rxl8g	PD CARIGARA 	2296	Jerson	Reyes	Reyes, Jerson	2021-10	2021-09-20	4360.00	0.00	4360.00	NM	NL	CARIGARA	Capoocan	Balud		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x84zb6t	MASOY	1652	ARLENE	RIEGO	RIEGO, ARLENE	2025-11	2025-09-20	7780.00	0.00	7780.00	NM	NL	BAYBAY	Hilongos	Himo-aw		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2xcz6c9	PD BAYBAY	1665	ELENITA	RIVERA	RIVERA, ELENITA	2020-04	2020-03-26	2822.00	0.00	2822.00	NM	L	BAYBAY	Hilongos 	Naval		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m1x8zpt	MASOY	2131	ROBLE	JR. REMOLINO	JR. REMOLINO, ROBLE	2024-08	2024-06-12	2560.00	0.00	2560.00	NM	NL	BAYBAY	Albuera 	Tinag-an		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ar534xo	PD BAYBAY	1732	ANGELITA	ROCALES	ROCALES, ANGELITA	2021-06	2021-05-06	2271.00	0.00	2271.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i4wihb5	PD KANANGA 	2466	Analie	Rodrigo	Rodrigo, Analie	2023-08	2023-07-30	2385.00	0.00	2385.00	M	L	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7wn52fj	LITO 	3427	CHRISME ANN	ROJAS	ROJAS, CHRISME ANN	2024-10	2024-08-19	1195.00	0.00	1195.00	M	L	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
st1anrm	PD PALOMPON	1230	EVELYN	ROJAS	ROJAS, EVELYN	2019-04	2019-03-16	7220.00	0.00	7220.00	NM	NL	PALOMPON	Palompon	Tinubdan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vs3c636	PD PALOMPON	2818	LYCA MAE	ROJAS	ROJAS, LYCA MAE	2024-10	2024-08-20	2951.00	0.00	2951.00	NMSR	L	PALOMPON	Palompon	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c07n862	PD PALOMPON	2644	MARICRIS	ROJAS	ROJAS, MARICRIS	2023-07	2023-05-18	27439.00	0.00	27439.00	NM	NL	PALOMPON	Villaba	Conquiason		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
va6z9dz	PD KANANGA 	549	Jemma	Roldan	Roldan, Jemma	2019-01	2018-12-01	3930.00	0.00	3930.00	NM	NL	KANANGA	Matag-ob	Mansalip		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
apk2xja	SUPERVISOR	2927	Michael James	Rom	Rom, Michael James	2023-01	2022-12-09	4560.00	0.00	4560.00	M	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h2is9ty	PD PALOMPON	806	Mary Grace	Romero	Romero, Mary Grace	2018-11	2018-09-23	3765.00	0.00	3765.00	NM	NL	ORMOC	Ormoc	Ormoc Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9kc1c9j	PD PALOMPON	1824	ARCELY	RONDINA	RONDINA, ARCELY	2022-01	2021-12-24	1550.00	0.00	1550.00	NM	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lkty97i	PD ISABEL 	415	NENITA	RONQUILLO	RONQUILLO, NENITA	2017-07	2017-06-12	1962.00	0.00	1962.00	NMSR	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
1624or3	PD BAYBAY	1927	JACQUELINE	ROSAL	ROSAL, JACQUELINE	2021-04	2021-03-04	1760.00	0.00	1760.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ywyle2y	TATA	3675	ROLLY	ROSAL	ROSAL, ROLLY	2025-03	2025-03-11	3023.00	0.00	3023.00	NM	L	SAN ISIDRO 	San Isidro	Biasong 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m8id6xf	NOEL	3623	ALGERICO	ROSALES	ROSALES, ALGERICO	2025-11	2025-09-23	725.00	0.00	725.00	M	L	PALOMPON	Merida 	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wlih3xg	PD PALOMPON	1561	EDITA	ROSALES	ROSALES, EDITA	2020-09	2020-08-06	9520.00	0.00	9520.00	NM	NL	PALOMPON	Palompon	Mix Palompon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4y91c1t	PD CARIGARA 	2063	Dennis	Rosalita	Rosalita, Dennis	2021-08	2021-07-28	4175.00	0.00	4175.00	NM	L	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m55v0jn	PD ISABEL 	1933	ANALOU	ROTA	ROTA, ANALOU	2021-05	2021-04-16	5525.00	0.00	5525.00	NM	NL	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5fjl3hi	PD KANANGA 	101	Cristina	Rotao	Rotao, Cristina	2022-04	2022-03-10	12460.00	0.00	12460.00	M	L	KANANGA	Kananga	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
txcmgju	TATA	3678	SALDY	ROYLO	ROYLO, SALDY	2023-10	2023-09-22	1140.00	0.00	1140.00	M	L	SAN ISIDRO 	Leyte-Leyte	Belen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mt4qoqj	PD BAYBAY	1442	VICTORIA	RUEDAS	RUEDAS, VICTORIA	2020-03	2020-02-21	1400.00	0.00	1400.00	NM	NL	BAYBAY	Baybay	Palhi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
26z9qq3	MASOY	1794	MA. LINDA	RUIZ	RUIZ, MA. LINDA	2025-03	2025-01-14	2875.00	0.00	2875.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
apwr9tw	PD ISABEL 	2442	ISABELITA	SABARES	SABARES, ISABELITA	2025-01	2024-11-19	2942.00	0.00	2942.00	NM	NL	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q7lacuy	PD CARIGARA 	614	Celestina	Sabas	Sabas, Celestina	2019-10	2019-09-12	3230.00	0.00	3230.00	NM	NL	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g50i572	PD BAYBAY	928	MAYBELLE	SABELLANO	SABELLANO, MAYBELLE	2018-11	2018-10-21	8190.00	0.00	8190.00	NM	NL	BAYBAY	Baybay	Candadam 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cycuyjr	PD ISABEL 	2042	MELANIE	SABIATE	SABIATE, MELANIE	2023-10	2023-09-06	32170.00	0.00	32170.00	NM	NL	ISABEL	Ormoc	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
50abvv0	EDDIE	3091	Richel	Sabillo	Sabillo, Richel	2025-06	2025-05-07	2001.00	0.00	2001.00	M	L	CARIGARA	Carigara	Canal		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7u07q99	MASOY	1439	ARLENE	SAJOL	SAJOL, ARLENE	2021-04	2021-03-06	740.00	0.00	740.00	M	L	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
pb4cl4k	PD PALOMPON	2619	JOEL	SALES	SALES, JOEL	2022-05	2022-04-01	1024.00	0.00	1024.00	NM	NL	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
n35v7bl	PD ISABEL 	3422	CHERRYL	SALIALAM	SALIALAM, CHERRYL	2025-02	2024-12-26	9494.00	0.00	9494.00	NM	L	ISABEL	Ormoc	Margen		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6bkkp73	PD PALOMPON	3167	Carolina	Salsado	Salsado, Carolina	2024-08	2024-06-06	9047.00	0.00	9047.00	NMSR	L	ORMOC	Ormoc	Islaverdi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f78ah8v	MASOY	1825	CRESILDA	SAMBAYON	SAMBAYON, CRESILDA	2025-03	2025-01-05	2685.00	0.00	2685.00	NM	NL	BAYBAY	Hilongos 	Villaflores St.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
anqai7f	NOEL	3629	SANICO	JENNIFER	JENNIFER, SANICO	2026-01	2025-10-18	1735.00	0.00	1735.00	M	L	PALOMPON 	Palompon	Buenavista 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
amqy6u2	PD PALOMPON	3387	LYCA	SANICO	SANICO, LYCA	2024-10	2024-08-21	4220.00	0.00	4220.00	NM	L	PALOMPON	Palompon	Cantandoy 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j90o40z	PD PALOMPON	2398	NIÑO	SANICO	SANICO, NIÑO	2022-08	2022-07-01	5880.00	0.00	5880.00	NM	L	ORMOC	Ormoc	Bagong Buhay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tblpw45	PD KANANGA 	1295	Romeo JR.	Santos	Santos, Romeo JR.	2019-07	2019-06-07	1916.00	0.00	1916.00	NM	NL	KANANGA	Matag-ob	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vf7k87t	PD CARIGARA 	2060	Marlin	Sarcilla	Sarcilla, Marlin	2021-06	2021-05-06	5500.00	0.00	5500.00	NM	NL	CARIGARA	Carigara	Binibihan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
esjlwx2	SUPERVISOR	3566	ARLINE	SARDILLO	SARDILLO, ARLINE	2026-01	2025-10-07	560.00	0.00	560.00	M	L	KANANGA	Kananga	Cacao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qwg11nb	PD ISABEL 	2457	MELINDA	SARMIENTO	SARMIENTO, MELINDA	2021-12	2021-11-26	17080.00	0.00	17080.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wci9hbh	ALDIE 	760	Lia	Sebidos	Sebidos, Lia	2017-02	2018-02-02	1951.00	0.00	1951.00	M	L	ORMOC	Ormoc	Alegria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3t1pmi4	TATA	3558	MERLINDA	SECUYA	SECUYA, MERLINDA	2025-11	2025-08-18	1501.00	0.00	1501.00	M	L	SAN ISIDRO 	Ormoc	Concepcion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
393tpps	PD PALOMPON	2600	CARINA	SEGARINO	SEGARINO, CARINA	2023-01	2022-11-17	574.00	0.00	574.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3p8t6uv	PD PALOMPON	2590	RHIEZA	SEGARINO	SEGARINO, RHIEZA	2022-07	2022-06-04	2740.00	0.00	2740.00	NM	L	PALOMPON	Ormoc	Cagbuhangin 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7y5300j	TATA	3569	MA. LUZ	SERAT	SERAT, MA. LUZ	2025-11	2025-09-27	3880.00	0.00	3880.00	NM	L	SAN ISIDRO 	Tabango	Campokpok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wqz7wfp	ALDIE 	3528	ALBERT REY	SERATO	SERATO, ALBERT REY	2025-07	2025-05-24	13575.00	0.00	13575.00	M	L	ORMOC	Ormoc 	Dist. 28		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
o2rrsts	PD PALOMPON	765	Annielyn	Serida	Serida, Annielyn	2017-12	2017-12-20	1338.00	0.00	1338.00	NM	NL	ORMOC	Ormoc	Naungan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5jj0c1t	LITO 	2588	CELERINA	SEVILLA	SEVILLA, CELERINA	2025-02	2024-12-03	7222.00	0.00	7222.00	M	L	ISABEL	Ormoc	Bagong Buhay 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5ba2xhw	SUPERVISOR	515	Jojie	Sevilla	Sevilla, Jojie	2017-07	2017-06-02	3415.00	0.00	3415.00	M	L	KANANGA	Kananga	Kananga Proper		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m8x41vv	PD BAYBAY	1624	MA. SOCORRO	SIBONGA	SIBONGA, MA. SOCORRO	2020-04	2020-03-20	2080.00	0.00	2080.00	NM	NL	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jun6lk9	EDDIE	2869	Claros	Sicsic	Sicsic, Claros	2023-07	2023-05-31	762.00	0.00	762.00	M	L	CARIGARA	Carigara	San Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
939evu8	PD PALOMPON	777	Merlita	Sicsic	Sicsic, Merlita	2017-08	2017-07-31	1670.00	0.00	1670.00	M	L	ORMOC	Ormoc	Ipil		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jp94yus	MASOY	2279	RUBENCIO	SIEGO JR.	SIEGO JR., RUBENCIO	2025-02	2024-12-12	2034.00	0.00	2034.00	NM	NL	BAYBAY	Baybay	Hibunawan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f1xylfp	PD PALOMPON	1938	Emma	Silvano	Silvano, Emma	2022-01	2021-12-13	4634.00	0.00	4634.00	NM	NL	ORMOC	Albuera	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xfizlba	LITO 	3576	JOCELYN	SIMBLANTE	SIMBLANTE, JOCELYN	2025-11	2025-09-29	2080.00	0.00	2080.00	NM	L	ISABEL	Merida	Libas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h83xfqi	PD PALOMPON	3415	ANABELLA	SIMBORIO	SIMBORIO, ANABELLA	2025-03	2025-01-27	15655.00	0.00	15655.00	NM	L	ORMOC	Ormoc	Boroc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
amoftk6	LITO 	1695	HELEN	SINANGOTE	SINANGOTE, HELEN	2021-12	2021-11-28	4030.00	0.00	4030.00	M	L	ISABEL	Merida 	Mahalit 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
52ilhtn	SUPERVISOR	1497	Jocelyn	Singson	Singson, Jocelyn	2020-04	2020-03-13	12285.00	0.00	12285.00	M	L	KANANGA	Kananga	Tugbong		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r88utc8	LITO 	3372	SANDRO	SINGSON	SINGSON, SANDRO	2024-08	2024-06-12	522.00	0.00	522.00	NM	L	ISABEL	Isabel	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4wptf1b	ALDIE 	3529	JENNIFER	SODE	SODE, JENNIFER	2026-01	2025-11-03	6700.00	0.00	6700.00	M	L	ORMOC	Ormoc	Boroc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
v67ro6n	PD BAYBAY	3426	JORNALIZA	SODE	SODE, JORNALIZA	2024-12	2024-10-10	1262.00	0.00	1262.00	NM	NL	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bznl31z	PD PALOMPON	2620	MERLYN	SOLAMO	SOLAMO, MERLYN	2022-05	2022-04-17	3450.00	0.00	3450.00	NM	NL	PALOMPON	Palompon	Mazawalo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lel1t8x	MASOY	1826	GERALDINE	SOLIVA	SOLIVA, GERALDINE	2025-02	2024-12-08	1922.00	0.00	1922.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dmq6jff	NOEL	3079	Chereyl	Son	Son, Chereyl	2025-06	2025-04-13	2590.00	0.00	2590.00	M	L	PALOMPON	Palompon	Cantandoy 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
owcrnan	SUPERVISOR	2922	CHRISTAL	SORIÑO	SORIÑO, CHRISTAL	2025-11	2025-08-25	1500.00	0.00	1500.00	M	L	KANANGA	Ormoc	San Jose 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uedbe1x	NOEL	3592	OLIVIA	SOTCHESA	SOTCHESA, OLIVIA	2026-01	2025-10-07	2261.00	0.00	2261.00	M	L	PALOMPON	Villaba 	Tagbubunga 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t65udse	PD ISABEL 	1349	CHERRY	SOTTO	SOTTO, CHERRY	2019-07	2019-06-19	3033.00	0.00	3033.00	NM	L	ISABEL	Ormoc	Jica Lao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t1xrb30	PD PALOMPON	81	Marites	Sotto	Sotto, Marites	2018-12	2018-11-29	310.00	0.00	310.00	NM	L	ORMOC	Albuera	Seguinon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jui1pub	PD BAYBAY	3184	DAISY	SUAREZ	SUAREZ, DAISY	2024-07	2024-05-16	2664.00	0.00	2664.00	NM	NL	BAYBAY	Hilongos 	Western Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qrq53t2	PD BAYBAY	3483	MARY CRIS	SUAREZ	SUAREZ, MARY CRIS	2025-03	2025-01-04	2136.00	0.00	2136.00	NM	NL	BAYBAY	Inopacan 	Tinago 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kcmbez1	PD ISABEL 	229	GEMMA	SUBRADO	SUBRADO, GEMMA	2017-08	2017-07-12	3586.00	0.00	3586.00	NM	NL	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p2pd30n	PD KANANGA 	2559	Marife	Suerte	Suerte, Marife	2023-04	2023-03-20	4264.00	0.00	4264.00	NM	L	KANANGA	Kananga	Hermitage		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
u64crx3	PD KANANGA 	100	Anabella	Suganob	Suganob, Anabella	2018-03	2018-02-04	2638.00	0.00	2638.00	NM	NL	KANANGA	Matag-ob	Talisay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
a4gws76	PD BAYBAY	1798	BEVERLY	SULLANO	SULLANO, BEVERLY	2020-12	2020-11-20	1560.00	0.00	1560.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
w998xt2	LITO 	2359	JOCELYN	SULLANO	SULLANO, JOCELYN	2022-03	2022-02-24	890.00	0.00	890.00	M	L	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x7q5zp0	PD KANANGA 	99	Enrico	Sumaljag	Sumaljag, Enrico	2021-12	2021-11-03	2894.00	0.00	2894.00	NM	L	KANANGA	Ormoc	San Pablo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9blii6w	PD CARIGARA 	2218	Joernel	Sumayan	Sumayan, Joernel	2021-12	2021-11-01	8560.00	0.00	8560.00	NM	NL	CARIGARA	Carigara	West Visoria		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f17crx6	PD CARIGARA 	2083	Napoleon	Sumayan	Sumayan, Napoleon	2021-10	2021-09-08	19057.00	0.00	19057.00	NM	NL	CARIGARA	Carigara	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rir84y9	LITO 	417	TERESITA	SUMAYAN	SUMAYAN, TERESITA	2017-09	2017-08-12	1968.00	0.00	1968.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gwh0zvy	PD PALOMPON	1165	LETECIA	SUMILE	SUMILE, LETECIA	2020-01	2019-12-25	2153.00	0.00	2153.00	NM	NL	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5ypfqkj	PD PALOMPON	3212	Jonathan	Suralta	Suralta, Jonathan	2023-08	2023-07-05	3129.00	0.00	3129.00	NM	NL	ORMOC	Albuera	Tagbas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
id4an09	PD KANANGA 	494	Roberto	Surillo	Surillo, Roberto	2018-11	2018-09-03	1840.00	0.00	1840.00	NM	NL	KANANGA	Matag-ob	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3f31d5x	PD ISABEL 	440	MARIA CRISTINA	SURIMA	SURIMA, MARIA CRISTINA	2017-04	2017-03-09	6150.00	0.00	6150.00	NM	NL	ISABEL	Ormoc	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p4xr007	PD ISABEL 	475	MERCY	SURIMA	SURIMA, MERCY	2017-04	2017-03-03	2970.00	0.00	2970.00	NM	NL	ISABEL	Ormoc	Tambulilid 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lmabub3	EDDIE	3725	Rogelio M.	Surio	Surio, Rogelio M.	2024-01	2023-12-09	15828.00	0.00	15828.00	M	L	CARIGARA	Ugbon 	Ugbon 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zagze6m	PD PALOMPON	2	Anselma	Tabulao	Tabulao, Anselma	2021-05	2021-04-01	8610.00	0.00	8610.00	NM	NL	ORMOC	Albuera	Tagbas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0qxn1rk	PD KANANGA 	2877	Maricel	Tabuso	Tabuso, Maricel	2023-07	2022-10-09	4005.00	0.00	4005.00	NM	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
m0ade5i	PD CARIGARA 	2187	Juliet	Taculog	Taculog, Juliet	2023-01	2022-11-18	6998.00	0.00	6998.00	NM	NL	CARIGARA	Capoocan	Pinamopoan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9u7rmnb	PD KANANGA 	552	Antonette	Tacurda	Tacurda, Antonette	2021-04	2021-03-14	2585.00	0.00	2585.00	NM	L	KANANGA	Kananga	Naghalin		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bb6sxjm	PD BAYBAY	109	JAYME	TADDEO	TADDEO, JAYME	2019-08	2019-07-27	12153.00	0.00	12153.00	NM	L	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
5cgmjyy	EDDIE	2860	SENECIA	TADEFA	TADEFA, SENECIA	2025-11	2025-09-06	1455.00	0.00	1455.00	M	L	CARIGARA	Carigara	Sab Juan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
p2k1kb5	LITO 	3312	METHUSILA	TAGHOY	TAGHOY, METHUSILA	2025-02	2024-12-01	1357.00	0.00	1357.00	NM	L	ISABEL	Isabel	Tubod 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g5wro2m	ALDIE 	3765	JONABEL	TAGSIP	TAGSIP, JONABEL	2026-01	2025-10-14	1755.00	0.00	1755.00	M	L	ORMOC	Ormoc	Naungan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
v61rrd1	PD CARIGARA 	2417	Gracel	Talisic	Talisic, Gracel	2022-02	2022-01-02	3108.00	0.00	3108.00	NM	L	CARIGARA	Capoocan	Lemon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mjcqlcn	EDDIE	2371	Joy Marie	Tamayo	Tamayo, Joy Marie	2022-07	2022-06-25	1905.00	0.00	1905.00	M	L	CARIGARA	Capoocan	Balucanad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
249ntog	SUPERVISOR	796	Susan	Tangil	Tangil, Susan	2019-05	2019-04-04	4088.00	0.00	4088.00	NM	L	KANANGA	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
j35yfj5	PD PALOMPON	2885	Rosita	Tantiado	Tantiado, Rosita	2025-02	2024-12-12	2722.00	0.00	2722.00	NM	NL	PALOMPON	Albuera 	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
sm2pv34	PD PALOMPON	1080	ARGA	TAPIC	TAPIC, ARGA	2019-12	2019-11-11	308.00	0.00	308.00	NM	L	PALOMPON	Palompon	Ipil 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
7j5hzrv	LITO 	3612	ALMA	TARIPE	TARIPE, ALMA	2026-01	2025-10-05	4582.00	0.00	4582.00	M	L	ISABEL	Isabel	Pasil		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jm63njw	PD KANANGA 	22	Gretchena	Tasan	Tasan, Gretchena	2019-04	2019-03-11	6044.00	0.00	6044.00	NM	NL	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
6661e6x	MASOY	1751	ANGELICA	TATOY	TATOY, ANGELICA	2025-01	2024-11-27	3295.00	0.00	3295.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
it4x689	MASOY	3250	MARIA LEA	TECHO	TECHO, MARIA LEA	2025-06	2025-04-06	5280.00	0.00	5280.00	NM	L	BAYBAY	Hilongos 	Himo-aw		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
t6agr1a	PD PALOMPON	651	Aiza	Tecson	Tecson, Aiza	2020-03	2020-02-20	11439.00	0.00	11439.00	NM	NL	ORMOC	Albuera	Tagbas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
85zsmlm	PD KANANGA 	18	Enriquita	Tenchavez	Tenchavez, Enriquita	2023-07	2020-01-11	2693.00	0.00	2693.00	NM	L	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zuy47hr	MASOY	1756	CELESTE	TERO	TERO, CELESTE	2025-03	2025-01-21	4366.00	0.00	4366.00	NM	NL	BAYBAY	Bato 	Kalanggaman		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r6q632o	PD PALOMPON	274	Perla	Teves	Teves, Perla	2019-09	2019-08-29	1530.00	0.00	1530.00	NM	L	ORMOC	Ormoc	Luna		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kxf6kxj	EDDIE	2757	Belen	Tiengo	Tiengo, Belen	2023-05	2023-04-06	5680.00	0.00	5680.00	M	L	CARIGARA	Carigara	Libo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2yr8stz	MASOY	3217	GRACE	TIMON	TIMON, GRACE	2025-03	2025-01-02	920.00	0.00	920.00	NM	L	BAYBAY	Inopacan 	Taotaon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ogpcp68	MASOY	1398	THELMA	TIMON	TIMON, THELMA	2020-05	2020-04-02	12440.00	0.00	12440.00	NM	NL	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gt2yzq5	SUPERVISOR	3339	Ponciano	Timosa	Timosa, Ponciano	2023-10	2023-09-16	4798.00	0.00	4798.00	NM	L	KANANGA	Matag-ob	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wo9l5oi	PD PALOMPON	1233	MIRASOL	TINGZON	TINGZON, MIRASOL	2023-07	2019-06-07	1530.00	0.00	1530.00	NM	NL	PALOMPON	Villaba	Suba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
33la8u8	PD PALOMPON	1037	MARIETTA	TIPONTIPON	TIPONTIPON, MARIETTA	2019-01	2018-12-09	7440.00	0.00	7440.00	NM	NL	PALOMPON	Villaba	Abijao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
d3522e1	MASOY	3791	CAROLINA	TOBESE	TOBESE, CAROLINA	2026-01	2025-10-27	1630.00	0.00	1630.00	M	L	BAYBAY	Albuera 	Damulaan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
u475wzi	NOEL	1173	CHRISTIN L.	TOLERO	TOLERO, CHRISTIN L.	2025-11	2025-09-16	6845.00	0.00	6845.00	M	L	PALOMPON	Isabel	Tabunok		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fvj8241	SUPERVISOR	2125	Richard	Toliao	Toliao, Richard	2021-11	2021-10-27	2550.00	0.00	2550.00	M	L	KANANGA	Ormoc	Luna		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jsq23en	PD ISABEL 	3361	MARY JANE	TOLIBAO	TOLIBAO, MARY JANE	2024-04	2024-02-26	3178.00	0.00	3178.00	NM	L	ISABEL	Merida 	Benabaye 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
f2zrgyj	EDDIE	3046	Edmar	Tolod	Tolod, Edmar	2024-08	2024-06-22	3175.00	0.00	3175.00	M	L	CARIGARA	Capoocan	Culasian		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
twunnb6	ALDIE 	3555	EDERLINA	TOMADA	TOMADA, EDERLINA	2025-10	2025-07-18	5105.00	0.00	5105.00	NM	L	ORMOC	Ormoc 	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
h744e1t	PD BAYBAY	1928	BARTOLOME	TOMIRAS	TOMIRAS, BARTOLOME	2021-05	2021-04-05	4760.00	0.00	4760.00	NM	NL	BAYBAY	Baybay	Tres Martires 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
auvwp9a	PD BAYBAY	3121	GELMA	TONIACAO	TONIACAO, GELMA	2022-03	2023-02-27	4835.00	0.00	4835.00	NM	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
25kn9hl	PD BAYBAY	1318	DESERIE	TOONG	TOONG, DESERIE	2019-08	2019-07-27	7477.00	0.00	7477.00	M	L	BAYBAY	Baybay	Recto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
9f1ea7f	PD PALOMPON	3388	ROWENA	TORILLAS	TORILLAS, ROWENA	2025-02	2024-12-07	4575.00	0.00	4575.00	NM	L	PALOMPON	Palompon	Cantandoy 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
san3v3s	MASOY	1581	MA. LINA	TORTOSA	TORTOSA, MA. LINA	2024-09	2024-07-21	29130.00	0.00	29130.00	M	NL	BAYBAY	Baybay	Hipusngo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
4cqb7tl	ALDIE 	2678	Teresita	Toyong	Toyong, Teresita	2023-10	2023-09-05	10000.00	0.00	10000.00	M	L	ORMOC	Albuera	Katipunan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nm2skil	PD BAYBAY	1671	JACQUELEN	TRIMONIA	TRIMONIA, JACQUELEN	2020-04	2020-03-28	1790.00	0.00	1790.00	NM	NL	BAYBAY	Hilongos 	Atabay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q8lfwiv	PD BAYBAY	562	JOSELITO	TRIPOLI	TRIPOLI, JOSELITO	2017-11	2017-10-18	1785.00	0.00	1785.00	NM	NL	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8typd85	PD ISABEL 	282	CHARICE	TROYO	TROYO, CHARICE	2017-12	2017-11-09	3950.00	0.00	3950.00	NM	NL	ISABEL	Ormoc	Lilo-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
cvhdtek	PD PALOMPON	43	Cirila Rowena	Tudio	Tudio, Cirila Rowena	2017-04	2017-03-23	3158.00	0.00	3158.00	NM	L	ORMOC	Albuera	Seguinon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
i6041ez	NOEL	2712	MARIA LIZA	TUDIO	TUDIO, MARIA LIZA	2024-11	2024-09-07	6830.00	0.00	6830.00	NM	L	PALOMPON	Palompon	Buenavista 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
271cc75	ALDIE 	1428	Rosita T.	Tudio	Tudio, Rosita T.	2023-11	2023-10-01	14090.00	0.00	14090.00	M	L	ORMOC	Albuera	Gungab		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tf9mwqc	PD PALOMPON	1086	CRISSA	TUMAMAK	TUMAMAK, CRISSA	2019-09	2019-08-14	8700.00	0.00	8700.00	NM	NL	PALOMPON	Villaba	Suba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yk7pl5u	PD BAYBAY	2907	VIRGIE	TUMAMAK	TUMAMAK, VIRGIE	2022-02	2023-01-03	4720.00	0.00	4720.00	NM	L	BAYBAY	Baybay	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8pvgthv	ALDIE 	3145	RHEA	TUMAMPO	TUMAMPO, RHEA	2026-01	2025-10-28	1505.00	0.00	1505.00	NM	L	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
12n88m5	ALDIE 	202	PRINCESS MAE	TUANDO	TUANDO, PRINCESS MAE	2026-01	2025-11-06	4955.00	0.00	4955.00	M	L	ORMOC 	Ormoc 	Larrazabal 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
13sc3y7	SUPERVISOR	3439	Grace	Tundag	Tundag, Grace	2025-02	2024-12-10	2486.00	0.00	2486.00	NM	L	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k5bzr4a	PD BAYBAY	2865	MARIE JEAN	TUTANES	TUTANES, MARIE JEAN	2023-11	2023-10-01	1880.00	0.00	1880.00	NM	NL	BAYBAY	Baybay	Hipusngo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
uruk4ul	PD CARIGARA 	2181	Imelda	Urmeneta	Urmeneta, Imelda	2021-10	2021-09-15	4757.00	0.00	4757.00	NM	NL	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ml8j74q	TATA	3531	ELIZABETH	USA	USA, ELIZABETH	2026-01	2025-10-20	10050.00	0.00	10050.00	M	L	SAN ISIDRO 	Tabango 	Tabing		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
l47ji8d	MASOY	2009	WILMA	VALDAZO	VALDAZO, WILMA	2025-02	2024-11-30	3270.00	0.00	3270.00	NMSR	NL	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3h4oxg3	MASOY	336	MIRA	VALENZONA	VALENZONA, MIRA	2018-11	2018-09-03	2890.00	0.00	2890.00	M	L	BAYBAY	Baybay	Caridad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
063utp3	TATA	3498	MA. MAGDALENA	VALIENTE	VALIENTE, MA. MAGDALENA	2025-11	2025-09-05	3740.00	0.00	3740.00	M	L	SAN ISIDRO 	Tabango 	Tugas		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xdeix00	PD CARIGARA 	2304	Ma. Jasmin	Valenzuela	Valenzuela, Ma. Jasmin	2022-02	2021-12-31	1497.00	0.00	1497.00	NM	L	CARIGARA	Carigara	Sagkahan		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fppj7k0	MASOY	2863	LEA JANE	VARRON	VARRON, LEA JANE	2024-02	2023-01-08	3774.00	0.00	3774.00	M	L	BAYBAY	Baybay	Jacinto St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mbdmo9c	EDDIE	2223	JENETTE	VASQUEZ	VASQUEZ, JENETTE	2026-01	2025-10-21	925.00	0.00	925.00	M	L	CARIGARA	Capoocan	Visares		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lo1dhjz	PD BAYBAY	1426	CLEOFE	VELARDE	VELARDE, CLEOFE	2019-08	2019-07-18	1482.00	0.00	1482.00	NM	NL	BAYBAY	Baybay	Quezon St. 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k010lkl	PD BAYBAY	637	DANIEL	VESTRA	VESTRA, DANIEL	2017-10	2017-09-04	1635.00	0.00	1635.00	NMSR	NL	BAYBAY	Baybay	Guadalupe 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
zm1qecw	PD PALOMPON	1717	Vanessa	Villa	Villa, Vanessa	2022-07	2022-06-26	2100.00	0.00	2100.00	M	L	ORMOC	Ormoc	Camp Downes		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
nvanswt	PD BAYBAY	2897	MARILYN	VILLACARTA	VILLACARTA, MARILYN	2022-11	2022-10-27	3793.00	0.00	3793.00	NM	NL	BAYBAY	Baybay	Villa Soledad		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
rc93u8g	SUPERVISOR	3561	Rosalyn	Villacorta	Villacorta, Rosalyn	2025-02	2024-12-01	2410.00	0.00	2410.00	NM	L	KANANGA	Ormoc	San Pablo 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
vpw1w22	PD BAYBAY	3157	MARLYN	VILLACRUSIS	VILLACRUSIS, MARLYN	2023-08	2023-07-09	2144.00	0.00	2144.00	NM	L	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yf3wpwc	PD CARIGARA 	2091	Nora	Villagracia	Villagracia, Nora	2021-06	2021-05-13	386.00	0.00	386.00	NM	L	CARIGARA	Barugo	Hilaba		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
xi1lj3e	MASOY	1693	MYRA	VILLAHERMOSA	VILLAHERMOSA, MYRA	2025-06	2025-05-01	5320.00	0.00	5320.00	NM	L	BAYBAY	Hilongos 	Matapay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fksleuy	PD KANANGA 	1706	Orlando	Villamiel	Villamiel, Orlando	2020-05	2020-04-12	3870.00	0.00	3870.00	NM	L	KANANGA	Ormoc	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
lpkz8kf	ALDIE 	3355	ROSALINDA	VILLAMOR	VILLAMOR, ROSALINDA	2025-12	2025-10-01	3869.00	0.00	3869.00	M	L	ORMOC	Albuera 	Tinang-an 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0ibrdrk	LITO 	51	TEODORA	VILLAMOR	VILLAMOR, TEODORA	2025-02	2024-12-14	5717.00	0.00	5717.00	M	L	ISABEL	Merida 	Lamanoc		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0orxwgi	NOEL	3757	FLOCERFIN	VILLANUEVA	VILLANUEVA, FLOCERFIN	2026-01	2025-10-12	1720.00	0.00	1720.00	M	L	PALOMPON	Isabel	Mahayag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
r6ndrpj	NOEL	3746	REYNAFLOR	VILLANUEVA	VILLANUEVA, REYNAFLOR	2026-01	2025-10-06	1820.00	0.00	1820.00	M	L	PALOMPON	Isabel	Mahayag		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
3rduf71	PD CARIGARA 	2130	Gregoria	Villarba	Villarba, Gregoria	2021-09	2021-08-14	5320.00	0.00	5320.00	NM	L	CARIGARA	Carigara	Parina		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
820kp68	PD BAYBAY	2824	JHONA	VILLAROSA	VILLAROSA, JHONA	2023-01	2022-12-09	6056.00	0.00	6056.00	NM	NL	BAYBAY	Baybay	Palhi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
g67s5wo	PD BAYBAY	1385	ROLANDO	VILLASANA	VILLASANA, ROLANDO	2024-07	2024-05-14	2128.00	0.00	2128.00	NM	NL	BAYBAY	Baybay	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
s055c80	NOEL	1065	NELLYBETH	VILLASIN	VILLASIN, NELLYBETH	2019-03	2019-01-31	15150.00	0.00	15150.00	M	L	PALOMPON	Kananga	Montebello		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
wangyuf	PD KANANGA 	17	Ellen	Viovicente	Viovicente, Ellen	2018-02	2018-01-01	2220.00	0.00	2220.00	NM	NL	KANANGA	Ormoc	Valencia		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
038spfo	PD CARIGARA 	3377	Brigs Bryan	Virtudes	Virtudes, Brigs Bryan	2023-11	2023-10-25	2645.00	0.00	2645.00	NM	L	CARIGARA	Capoocan	Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
x5sp8q7	PD PALOMPON	1411	Ritchel	Wasawas	Wasawas, Ritchel	2019-08	2019-07-13	2620.00	0.00	2620.00	NM	NL	ORMOC	Albuera	San Pedro		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
fzjhsbb	ALDIE 	846	Perlita	Wenceslao	Wenceslao, Perlita	2025-11	2025-09-02	20424.00	0.00	20424.00	M	L	ORMOC	Ormoc	Linao		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
tz5adri	PD PALOMPON	1476	RAMON JR.	WENCESLAO	WENCESLAO, RAMON JR.	2023-07	2020-02-01	1500.00	0.00	1500.00	NM	NL	PALOMPON	Merida	Poblacion 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
afwjppa	PD BAYBAY	603	REGINE	WENCESLAO	WENCESLAO, REGINE	2017-10	2017-09-10	8343.00	0.00	8343.00	NM	NL	BAYBAY	Baybay	Sangi		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yhez42t	PD PALOMPON	83	Rey	Wenceslao	Wenceslao, Rey	2022-05	2022-04-11	7630.00	0.00	7630.00	NMSR	NL	ORMOC	Ormoc	Can-untog		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
kmpffvl	PD ISABEL 	1879	JENELIZA	YADAO	YADAO, JENELIZA	2021-07	2021-06-21	1550.00	0.00	1550.00	NM	NL	ISABEL	Isabel	Sto. Niño		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dhuczex	MASOY	2891	JAY LOWIE	YAGONG	YAGONG, JAY LOWIE	2024-12	2024-10-26	9391.00	0.00	9391.00	M	NL	BAYBAY	Baybay	Baybay		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qf46mp5	PD BAYBAY	606	ROZAN CORINNE	YAMASHITA	YAMASHITA, ROZAN CORINNE	2019-07	2019-06-07	9440.00	0.00	9440.00	NM	NL	BAYBAY	Baybay	Sto. Rosario		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
jxxdvit	PD PALOMPON	927	Emiy	Yangao	Yangao, Emiy	2020-04	2020-03-27	28410.00	0.00	28410.00	NM	NL	ORMOC	Ormoc	Mejia Subd.		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
98qg1z5	TATA	3535	NENITA	YA-ON	YA-ON, NENITA	2026-01	2025-10-24	6340.00	0.00	6340.00	M	L	SAN ISIDRO 	Tabango 	Tabing		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
do7kxxi	PD PALOMPON	830	Analyn	Yap	Yap, Analyn	2018-05	2018-04-08	3220.00	0.00	3220.00	NM	L	ORMOC	Ormoc	Can-adieng		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
mintgpy	NOEL	3508	Jessa	Ybañez	Ybañez, Jessa	2025-06	2025-05-04	1550.00	0.00	1550.00	M	L	PALOMPON	Palompon	Baguinbin		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
slodg65	PD KANANGA 	1320	Rosalie	Ybañez	Ybañez, Rosalie	2019-10	2019-09-06	4700.00	0.00	4700.00	NM	L	KANANGA	Ormoc	Salvacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
dv8m7m9	ALDIE 	2291	Rosalie	Ygaña	Ygaña, Rosalie	2023-05	2023-04-26	1906.00	0.00	1906.00	NM	L	ORMOC	Albuera	Balugo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q6eo4f4	PD ISABEL 	468	MERCEDES	YLAYA	YLAYA, MERCEDES	2018-05	2018-04-12	3522.00	0.00	3522.00	NM	NL	ISABEL	Isabel	Marvel 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
qbtxl63	SUPERVISOR	2725	Lane	Ymas	Ymas, Lane	2022-12	2022-11-17	3820.00	0.00	3820.00	M	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
q2c8ycq	SUPERVISOR	1389	BONIFACIO	YONGCO	YONGCO, BONIFACIO	2026-01	2025-11-02	1000.00	0.00	1000.00	M	L	KANANGA	Matag-ob	San Guillermo		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
0hqsqoq	MASOY	3472	ANABEL	YUSON	YUSON, ANABEL	2025-10	2025-08-03	2990.00	0.00	2990.00	NM	L	BAYBAY	Inopacan 	Conalum		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
bemomf0	ALDIE 	1460	Margie	Zacarias	Zacarias, Margie	2020-04	2020-03-27	630.00	0.00	630.00	NM	L	ORMOC	Ormoc	Punta		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
k37ea3l	PD BAYBAY	1808	EMELDA	ZAMORA	ZAMORA, EMELDA	2021-04	2021-03-04	1850.00	0.00	1850.00	NM	NL	BAYBAY	Hilongos 	Western Poblacion		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
2cmtvcg	PD PALOMPON	1637	MAUREEN KLOUIE	ZARAGOZA	ZARAGOZA, MAUREEN KLOUIE	2020-08	2020-07-09	2600.00	0.00	2600.00	NM	NL	PALOMPON	Palompon	Sabang 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
8rllgw9	PD ISABEL 	2856	NICASIO	ZARAGOZA	ZARAGOZA, NICASIO	2022-07	2021-06-10	4362.00	0.00	4362.00	NM	NL	ISABEL	Ormoc	San Juan 		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
yeqng0g	SUPERVISOR	2947	Carlo	Zarate	Zarate, Carlo	2023-01	2022-12-08	4753.00	0.00	4753.00	NM	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
ybcc6e0	SUPERVISOR	2778	Jessica	Zarate	Zarate, Jessica	2022-11	2022-10-03	5307.00	0.00	5307.00	NM	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
gc6vnqf	PD PALOMPON	1120	LIEZLE	ZARATE	ZARATE, LIEZLE	2019-10	2019-08-31	11758.00	0.00	11758.00	NM	NL	PALOMPON	Palompon	Mix Palompon		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
c7k7h54	SUPERVISOR	2873	Merlita	Zarate	Zarate, Merlita	2023-01	2022-12-01	5060.00	0.00	5060.00	NM	L	KANANGA	Kananga	Lonoy		Ormoc Branch	Lowest Priority	2026-02-05 13:55:51.829616+08
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status) FROM stdin;
3vejozw	65i58kc	50.00	OR-20260206-K6RY	2026-02-06	831.00	Shan	 (REVERSED: Wrong payment )	REVERSED
s11uzov	65i58kc	50.00	OR-20260206-TOVD	2026-02-06	781.00	Shan	 (REVERSED: Wrong payment )	REVERSED
\.


--
-- Data for Name: remarks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remarks (id, loan_id, text, "timestamp", collector) FROM stdin;
0rl4cps	zmv1fe1	Promise to pay every Saturday	2026-02-05 15:53:54.912+08	Shan
varhe0h	1l6x2ts	Transfer to Sogod Saouthern Leyte 	2026-02-05 15:54:32.208+08	Shan
aemozbq	ue3pzh8	Adto adtuon lang basin naay ika hatag	2026-02-05 15:55:08.275+08	Shan
tpcpvza	vvbamdu	Promise to pay at 5:00 pm on February 5, 2026	2026-02-05 15:58:45.768+08	Shan
cxsi3tf	7nrgm66	Promise to pay weekly thru gcash	2026-02-05 15:59:39.86+08	Shan
r3vaqhz	65i58kc	Promise to pay every Monday, Wednesday and Saturday	2026-02-05 16:09:32.017+08	Shan
um84i7o	65i58kc	Every Wednesday 	2026-02-09 15:30:58.339+08	Shan
69fwar4	65i58kc	Every Saturday	2026-02-09 15:31:06.469+08	Shan
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, full_name, role, status, branch, created_at, created_by, status_history) FROM stdin;
1	admin	System Administrator	SUPER_ADMIN	ACTIVE	All Branches	2026-02-04 10:10:22.723+08	System	[{"status": "ACTIVE", "updatedAt": "2026-02-04T02:10:22.723Z", "updatedBy": "System"}]
fc508g3	Shan	Shahanie Mae Lerio	ORMOC_USER	ACTIVE	Ormoc Branch	2026-02-04 10:23:47.959+08	\N	[{"status": "PENDING", "updatedAt": "2026-02-04T02:23:47.959Z", "updatedBy": "Self-Registration"}, {"status": "ACTIVE", "updatedAt": "2026-02-04T02:24:06.782Z", "updatedBy": "admin"}]
\.


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: collectors collectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collectors
    ADD CONSTRAINT collectors_pkey PRIMARY KEY (id);


--
-- Name: demand_letters demand_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_letters
    ADD CONSTRAINT demand_letters_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: payments payments_or_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_or_number_key UNIQUE (or_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: remarks remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: activity_logs activity_logs_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: demand_letters demand_letters_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_letters
    ADD CONSTRAINT demand_letters_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: payments payments_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: remarks remarks_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict bKxISNSbZvsOMl5uXeowKt2rIK6fW8IQQfNqPDdbiDaWA9vuRaVyeM59LNt5X5C

