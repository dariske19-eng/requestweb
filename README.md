# Drizz - Request Addon (Vercel + Supabase + Blob)

| Laman | Fungsi |
|---|---|
| `/` (public/index.html) | Pengguna Login atau Register (Supabase Auth), kemudian hantar permintaan addon. Pengguna hanya nampak permintaan sendiri berserta status terkini. |
| `/admin` (public/admin.html) | Admin login dengan kata laluan, nampak semua permintaan (termasuk e-mel penghantar), tapis, cari, tukar status dan padam. |

Pembahagian tugas: **Supabase** mengurus akaun pengguna, **Vercel Blob (private)** menyimpan permintaan.

## Sediakan Supabase (Login dan Register)

1. Cipta projek di https://supabase.com.
2. **Authentication > Providers**: pastikan **Email** diaktifkan. Jika "Confirm email" hidup, pengguna baharu perlu klik pautan dalam e-mel sebelum boleh login.
3. **Authentication > URL Configuration**: letak **Site URL** dengan alamat Vercel anda dan tambah alamat yang sama di Redirect URLs.
4. **Project Settings > API**: salin **Project URL** dan **anon public key**.
5. Dalam Vercel > Settings > Environment Variables, tambah `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.

Borang **Register** meminta nama pengguna. Nama itu disimpan dalam metadata akaun Supabase dan digunakan pada gambar "Request Of: <nama>" serta mesej WhatsApp. Akaun lama yang tiada nama akan nampak ruang nama dalam borang permintaan.

## Sediakan Vercel Blob (penyimpanan permintaan)

1. Vercel > projek anda > **Storage** > Create > **Blob** > tetapkan akses kepada **Private**. (Mod public/private tidak boleh ditukar selepas store dicipta.)
2. **Connect** store itu ke projek. Vercel menambah `BLOB_STORE_ID` (dan token/OIDC) secara automatik.

## Deploy

1. Naik ke Vercel: import repo GitHub, atau jalankan `vercel` dalam folder ini. Vercel memasang `@vercel/blob` secara automatik daripada `package.json`.
2. Tambah `ADMIN_PASSWORD` (kata laluan panjang dan sukar diteka) di Environment Variables.
3. Redeploy, kemudian buka `https://domain-anda.vercel.app/admin`.

## Notifikasi WhatsApp (bukti siap)

Apabila admin tukar status kepada **Done**, server hantar mesej bukti ke WhatsApp **sekali sahaja** bagi setiap permintaan. Mesej dalam bahasa English dan mengandungi tajuk addon, jenis, versi, nama pemohon dan tarikh siap, tanpa e-mel. Contoh:

```
✅ Request completed!

Addon: Harimau Belang
Type: New mob • Bedrock (latest)
Requested by: Alya
Completed: 10 October 2026
```

**Gambar:** secara lalai server menjana kad **"Request Of: <nama pemohon>"** daripada templat anda (`assets/card-template.png`), dengan nama pemohon di tempat "Nama". Kad dihantar dengan mesej sebagai kapsyen. Nama panjang dikecilkan dan dipotong dengan "..." jika perlu.
- Pautan kad (`/api/card?name=...&sig=...`) bertandatangan, jadi orang lain tidak boleh jana kad sesuka hati. Tandatangan guna `CARD_SECRET`, atau `ADMIN_PASSWORD` jika tidak ditetapkan.
- Kad perlukan alamat awam. Vercel menyediakannya secara automatik, atau tetapkan `PUBLIC_BASE_URL`.
- Untuk tukar templat, ganti `assets/card-template.png` (1672x941, tanpa tulisan "Nama") dan laraskan kedudukan teks di `lib/card.js`. Fon ialah Poppins Bold Italic (lesen OFL) di `assets/card-font.ttf`.
- Guna gambar tetap: tetapkan `NOTIFY_IMAGE_URL`. Matikan gambar: `NOTIFY_IMAGE=off`.
- Jika gambar gagal dihantar, mesej teks tetap dihantar.

Pilih salah satu cara dalam Environment Variables (jika kedua-duanya kosong, ciri ini mati):

1. **Whapi.Cloud (paling mudah, tiada bot sendiri):** daftar di https://whapi.cloud, sambungkan nombor WhatsApp anda, dapatkan token, kemudian cari ID channel (bentuk `120363...@newsletter`) melalui `GET /newsletters` dalam API mereka. Tetapkan `WHAPI_TOKEN` dan `WHATSAPP_CHANNEL_ID`. Semak dokumentasi Whapi untuk had dan harga semasa.
2. **Bot sendiri:** tetapkan `WHATSAPP_WEBHOOK_URL`. Server akan POST JSON `{ event: "request.done", text, imageUrl, request: {...} }`. Jika `WHATSAPP_WEBHOOK_SECRET` ditetapkan, header `x-signature` ialah `sha256=` + HMAC-SHA256 badan permintaan, jadi bot anda boleh sahkan ia datang dari server ini.

Nota penting:
- Menghantar ke Channel WhatsApp tidak disokong oleh API rasmi Meta (WhatsApp Business Cloud API) setakat yang disahkan oleh sumber pihak ketiga. Perkhidmatan pihak ketiga dan pustaka tidak rasmi mungkin melanggar terma WhatsApp, dan nombor anda boleh disekat. Gunakan nombor yang anda sanggup risikokan.
- Jika penghantaran gagal, status tetap disimpan dan admin nampak mesej amaran. Tukar status ke "Dalam proses" kemudian "Siap" semula untuk cuba hantar lagi.

## Cara ia berfungsi

- `GET/POST/DELETE /api/requests`: perlu `Authorization: Bearer <token Supabase>` yang disahkan di pelayan. Had 10 permintaan sejam bagi setiap pengguna.
- `GET /api/config`: beri URL dan anon key Supabase kepada pelayar.
- `GET/PATCH/DELETE /api/admin/requests`: untuk admin sahaja, perlu header `x-admin-password`. Selepas 10 percubaan salah, IP disekat selama 15 minit.
- Setiap permintaan ialah satu fail JSON: `requests/<uid>/<id>.json` dalam Blob store private. Tiada fail boleh dibaca terus dari pelayar kerana store private.

## Had yang perlu anda tahu

- Blob ialah storan fail, bukan pangkalan data. Senarai admin membaca setiap fail satu persatu, jadi sesuai untuk ratusan permintaan, tetapi akan menjadi perlahan pada ribuan.
- Had kadar (10 sejam) dan sekatan kata laluan admin bersifat anggaran kerana Blob tiada operasi atomik.
- Jangan sekali-kali letak `service_role` key Supabase dalam projek ini.

## Uji di komputer sendiri

```
npm i -g vercel
npm install
vercel link
vercel env pull .env.local
vercel dev
```
