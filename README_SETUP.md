# Setup (short)
1. Supabase > SQL Editor: run database/1_schema.sql (already done), then database/2_upgrade.sql.
2. Sign up on the website (/signup) with YOUR email. Confirm the email.
3. Supabase > SQL Editor, run (put your email):
   update profiles set role='admin', status='approved' where email='YOUR@EMAIL';
4. Folder: `npm install` then `npm run dev` -> http://localhost:3000
5. Edit lib/config.js (agency name, currency).
