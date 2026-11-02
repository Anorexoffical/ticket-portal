# Group Ticket Portal - Project Notes
Last updated: 2026-10-23

## Decisions
- Stack: Next.js + Supabase (free) + Vercel hosting (free). Plain JavaScript.
- Two roles: admin (main agency) and agent (sub-agent/customer). Admin approves agents.
- All booking/payment changes go through database functions, never directly (security).
- Booking flow: on_hold (time set per flight) -> confirmed (fully paid or admin confirms) -> issued (ticket PDF uploaded).
- Passenger editing: agents may edit only while ON HOLD; after confirmation it is locked until admin unlocks (schema v3).
- PNR: entered when adding the flight (private table, schema v5) and copied to every booking on it; admin can override per booking (v4). Agent sees only own bookings' PNR. Printable Booking Confirmation page at /voucher/[id] (browser Print > Save as PDF).
  Unpaid holds become expired; seats are released automatically when a hold lapses.
- Ticket delivery: PDF stored privately; agent downloads in portal; admin sends link by WhatsApp/Email (opens prefilled message).
- Currency + agency name: lib/config.js

## Done
- Database v1 + v2 (tested on local Postgres: security, seats, holds, payments, ledger)
- Signup / login / approval / blocked
- Admin: dashboard, agents, flights, bookings (confirm, cancel, extend hold, payments, issue ticket, edit passengers),
  pending payments (with WhatsApp reminder), ledgers (print)
- Agent: flights, booking (bulk paste), my bookings (edit passengers, cancel, rebook, download ticket), ledger, settings

- Confirmation PDF (own design) available from ON HOLD onwards, shows status banner (hold/confirmed/issued).
- Airline logo via free logo URL by airline code (fallback badge) - logo source NOT verified from the sandbox.
- Left sidebar menu, Activity Log page (all changes), error page, single phone/WhatsApp number at signup.

- Flights grouped by airline + route (agent + admin), same airline = same name/logo (lib/airlines.js, add airlines there). Duplicate-flight warning. Bulk add many flights (paste lines).
- LESSON: user skipped schema_v4 -> PNR errors. Fixed by combined database/4_5_pnr_fix.sql. Always confirm each SQL file was run.

- Database: database/0_ALL_IN_ONE.sql = everything in one file, safe to re-run any time (new project or existing). Future upgrades get appended to it.

## NOT yet tested with the live website
- All pages were compiled but not yet clicked through against the real Supabase project.

## Pending / ideas
- Connecting itineraries (e.g. ISB-MCT-JED, 2 legs per row) - waiting for user's flight-input samples from his other project (not accessible from this project)
- Deploy online (Vercel) + custom domain; set env vars there
- Staff accounts for the main agency (several admins with limited rights) - currently extra admins only via SQL
- Live error monitoring (Sentry free) after deployment
- Agentation visual feedback integration (project request)
- Automatic email + WhatsApp sending (needs Resend / WhatsApp Business API) - currently manual one-click links
- Refund entry (cancelled-but-paid bookings leave a credit in the ledger)
- Admin reports (daily sales, per-flight passenger list export to Excel/PDF)
- Passenger list export per flight (for airline submission)
- Admin 2-step login (MFA), daily backups, custom domain
- Urdu language option, in-app notifications

## Known issues
- Refunds are not recorded yet.
- pg_cron may need enabling in Supabase (Database > Extensions) for expired status label; seats are released regardless.

## Update 7 (titles, types, nationality, unique PNR, PDF changes)
Done: Title (Mr/Mrs/Ms/Miss/Mstr), Adult/Child/Infant, nationality dropdown, 6-month passport warning;
PNR required + unique (single, edit, bulk - each bulk flight has its own PNR); no "add again" popup when editing;
PDF: agent's agency name top-left, status only (no timing), Terms & Conditions, sharp vector "NO REFUNDS OR EXCHANGE" stamp.
Tested: DB logic locally, build, stamp image. NOT tested: live Supabase, new pages with real data.
Pending: deploy, auto email/WhatsApp, refunds, reports, staff accounts, backups, Agentation, connecting flights (waiting for user's sample).
Decisions to ask: block (not just warn) short passports? Infant/child seat & price rules?

## Update 8
Done: flight tables (Flight, Date w/o day name, Sector column), centred header with full city names; red "SAME PNR" flag on flights sharing a PNR;
staff role (owner = main admin only for Staff, Activity Log, Logo); agent cannot cancel/edit after ANY payment (admin can unlock);
agency logo upload -> browser tab icon. DB tested locally; screenshot checked (admin flights).
Pending: connecting/return flights (need user's sample lines), fix the flynas flights that share one PNR (user must enter each real PNR), live test.

## Update 9 (from the itinerary project)
Done: 185 airports with time zones (lib/airports.js), 91 airlines, line reader lib/itinerary.js (class letter, spaced flight no / airports,
colon times, +1/-1, PNR at end), real arrival date + flight time, auto connecting-flight joining, "ONE return trip" mode,
flight_legs table (schema_v8), legs shown in admin/agent tables, booking page and PDF. Connecting/return trips: route+times locked on edit.
Tested: DB (legs save/keep/clear/permissions), line reader (8 cases), screenshots with mock data. NOT tested on live site.
Run order for DB: schema_ALL.sql once (contains v7 + v8, safe to re-run).
Pending: FARE-line price in bulk add (waiting for approval), fix flynas shared PNRs by hand, live testing, deploy, auto email.

## Update 10
Done: blank-line separated trips (his return pairs now detected, also without blank line); modes Auto / Single / Return; agent-website table paste
(date, sector, flight, time, bag, meal, fare read per row); tables ALL CAPS, one line per flight, sector as codes (ISB DMM); headers keep full city names;
delete flights (tick boxes; refused if a flight has bookings; logged) - schema_v9. Tested: reader (his lines), delete function on local DB, screenshots (mock data).
Not tested on live site.

## Update 11
Agent flight list redesigned like the group-fares sites: header = logo + path (ISB-JED-ISB); one row per trip with stacked lines for connecting / return;
orange Book now. Top button rows (only what is available): type (UAE/KSA/Oman/Bahrain/Qatar/UK One Way, Umrah = return trips), destination, airline.
Tested with mock data (filters clicked: KSA->JED shows only ISB-JED; Umrah shows only return trips). Admin table unchanged.

## Update 13
Agent Available Flights: country/type buttons stay on TOP; LEFT panel "Filters" with "Select Airlines (Multiple)" and "Select Sectors (Multiple)" checkboxes + Select All
(only airlines/sectors that exist for the chosen type; the two lists narrow each other). Destination/airline button rows removed. Nothing else changed.
Tested with mock data (clicks): KSA+Saudia -> ISB-JED & ISB-MED only; Saudia+ISB-JED-ISB -> return only; Umrah -> return only.

## Update 15
Agent portal: TOP menu bar (agency logo left, menu right with line icons, Log out). Logo = main agency logo from Logo / Settings (badge until uploaded).
Admin/staff keep the left menu. LAN access: dev/start use -H 0.0.0.0, allowedDevOrigins for 192.168/10/172.16-31; `npm run office` = build + start for office use.
Tested: screenshots desktop + phone (mock data). Not tested: other PCs on the network (needs Windows firewall Allow).

## Update 16 (agent profile)
Agent Settings: owner/contact person, city, address, licence/NTN (all optional) + agent's own logo (shown on that agent's PDF, bucket branding/agents/<id>.png).
Admin Agents list shows owner, city, address, licence. DB parts 10 + 11 in schema_ALL.sql. Tested locally: agent can edit own new fields only (role/status blocked, length limits),
logo upload only to own file. Settings page screenshot (mock data). Signup form unchanged (nothing extra required).

## Update 17 (checkpoint)
DONE: admin/staff top menu (same as agent); admin Flights page in agent-list design (type chips, left filters, stacked legs; checkbox delete, PNR, seats, Edit/Hide kept); booking row cards for agent and admin (BK#, AGT#, pax counts Requested/Confirm, Total/Paid/Balance, Confirmed by, Send E-Ticket, Print, Manage); DB part 12 (booking_no from 1001, agent_no from 101, confirmed_by auto-set) - tested locally.
PENDING (user): run schema_ALL.sql, install update17.zip, give each flynas flight its own PNR.
LATER: "Assign To" for staff, deploy (Vercel), auto email (Resend), reports, backup, 2-step admin login, credit limit, Agentation.

## Update 18
DONE: new polished look for all pages (CSS only, in app/globals.css). PENDING: LAN access from other PC/phone (Windows firewall), run schema_ALL + install updates 17/18.

## Update 19
DONE: new booking confirmation PDF design (compact, one A4 page, city names, stamp beside terms).

## Update 20
DONE: booking PDF has 2 styles - Detailed (teal/orange, duration, transit, issued by) and Compact. Agent picks in Settings (profiles.voucher_style, DB part 13, tested locally). Both fit one A4 page up to 4 flights (tested with test data). Viewer can also switch style on the PDF page.
- Update 21: PDF Detailed info box shows only filled agent details (issued by = agency name; no issued-at).
- Update 22: Detailed PDF info box is one field per row (like the itinerary builder); still one A4 page with 4 flights + all fields.
- Update 23: Detailed PDF spacing adapts to the number of flights (1-2 flights = roomy, 3 = medium, 4 = tight); always one A4 page.

## Update 24
DONE: real balance shown on every booking card; any payment turns the hold timer off and the booking never auto-expires (DB part 14, tested locally); dashboard 'Payment reminders for today' (WhatsApp, tick per day).
NEXT: put the site online (Vercel + GitHub), practice copy.

## Update 25
DONE: UI UX Pro Max rules applied (sky-blue palette, orange Book button, contrast, 44px touch targets, focus outline, line icons instead of emojis in PDF, phone layout for flight rows).

## Update 26
DONE: Accounts page (money to receive/received today/this month, reminders with bank details, bank accounts manager - owner edits, staff view), agent Pay / Bank details page, pending-balance strip under the top bar (agent: own balance; admin: total from all agents). DB part 15 bank_accounts (tested locally).
TODO user: set SUPPORT_WHATSAPP in lib/config.js to enable the 'I have paid' proof button.

## Update 27 - Agent discount + Excel passenger list
- DB part 16: profiles.discount_per_ticket, bookings.discount_amount, owner_set_agent_discount (owner only). create_booking applies it.
- Agents page: owner types "Discount / ticket" per approved agent and saves. Agent flight list and book page show discounted price.
- Admin Flights: "Excel" button per flight downloads passenger list (all live bookings; needs `npm install` for exceljs).
- Tested: build OK, DB part 16 locally, Excel file generated in node. Not yet tested on live site.
- PENDING: user to run schema_ALL.sql (parts 15-16), install update27, npm install, npx vercel --prod.
- Update 28: buttons restored to bright blue (#1559d6); Book now blue again.
- Update 29: hold time in minutes or hours (DB part 17: flights.hold_minutes). Tested DB locally (15 min, 3 h, 0 rejected); build OK.
- Update 30: smart hold (DB part 18): office hours 10:00-22:00 (hold starts at opening if booked after hours), shorter hold when flight near (24h:30 min, 7d:180 min). Owner edits on Settings page. Tested DB locally.
- Update 31: PNR must be exactly 6 letters/numbers (DB part 19 + screens strip other characters). Old PNRs of other lengths stay but must be fixed when edited. Tested DB locally; build OK.
## Umrah module - shared files (DO NOT overwrite without keeping the Umrah lines)
Files: components/Shell.js (Umrah menu item), app/admin/agents/page.js (Umrah tick box), lib/config.js (MODULES line).
After ANY ticket update that touches these, re-add the Umrah lines or ask the Umrah chat.
Live DB (built in another chat): umrah_hotels (column "area"), umrah_hotel_prices (sar_sharing..sar_quint), umrah_settings (riyal_rate, visa_price_sar). DO NOT run umrah_part20.sql or install update 32 (they clash).
Update 34 = restore + Packages (part 21 already run).
## Update 35 - Umrah Package Builder
DB part 22: umrah_flights (flights tagged Umrah; extra_pp optional, child_discount, infant_fee, allow_agent_discount, nights_override), functions admin_save_umrah_flight, admin_remove_umrah_flight, umrah_stay_info, umrah_quote (PKR only; agents never read SAR).
Rules: stay nights = arrival date to return flight date (Karachi dates) or override; hotels nights must add up to stay; max one hotel per city, hotels optional; child with bed = adult, child without bed = flight+visa only, infant = infant_fee + visa; transport is inside the visa, extra_pp optional; agent discount applies to the ticket only if allowed.
Pages: admin/umrah/flights, agent/umrah/build, agent/umrah (Build button + Ready packages).
Ready packages (update 34) are made by owner/staff only. SQL tested on test DB; pages syntax-checked only, NOT tested live.
PENDING: run part 22, install zip, test. NEXT: Step 3 Booking (passengers, seats, rooms, KSA residents), visa, ledger.
## Update 36 - builder: 3 hotel parts + flight cards
DB part 23 replaces umrah_quote: up to 3 hotel parts (Makkah, Madinah, Makkah), same city/hotel allowed twice, nights of all parts = stay.
UI: nights divided evenly (extra night to Makkah parts first); changing one part re-fills the others (last 2 edits stay locked). Agent + admin flight cards reuse AirlineLogo, LegCols, legsMap, fz* styles from the Flights page.
PENDING: run part 23, install zip, test. Point 1: admin "Add Umrah flight" list must show only flights of the Umrah type from the ticket portal's flight filter (needs lib/useFlightFilter.js).
Update 37: Umrah builder live price, +/- buttons, room suggestion, saved choices, new design (components/UmrahBits.js).
Shared files (don't overwrite from ticket updates): Shell.js, admin/agents/page.js, lib/config.js.
Do NOT run umrah_part20.sql or install update 32.