ZEECHEI — Discord Music Bot

Deploy di Render:
1. Upload project ini ke GitHub (file .env jangan ikut).
2. Render → New → Web Service (atau Background Worker) → pilih repo.
   Build Command : npm install
   Start Command : npm start
3. Isi Environment Variables (lihat .env.example):
   DISCORD_TOKEN, WEBHOOK_URL, OWNER_ID, LAVALINK_*.
4. Deploy.

Catatan: data bot (JSON + SQLite) disimpan di disk. Di Render tanpa Persistent Disk,
data hilang setiap redeploy/restart. Pasang Disk kalau ingin data awet.
