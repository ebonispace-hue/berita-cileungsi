const fs = require('fs');
const path = require('path');

async function jalankanBot() {
    try {
        // Mengimpor rss-parser secara lokal agar aman dari siklus build
        const Parser = require('rss-parser');
        const parser = new Parser();

        // Menggunakan endpoint REST API resmi Google AI Studio (Sangat Ringan & Bebas Modul)
        const GEMINI_API_URL = "https://googleapis.com";
        const URL_TRENDS_INDONESIA = 'https://google.com';
        const URL_GOOGLE_NEWS_ID = 'https://google.com';

        console.log("📥 Memulai pemindaian tren berita...");
        
        // 1. Mengambil Data Tren Google Indonesia
        let trenHariIni = [];
        try {
            const feedTrends = await parser.parseURL(URL_TRENDS_INDONESIA);
            trenHariIni = feedTrends.items.slice(0, 5).map(item => item.title.toLowerCase());
            console.log("📈 Tren Google Saat Ini:", trenHariIni);
        } catch (errTrends) {
            console.warn("⚠️ Gagal memuat tren Google, pencarian dilanjutkan berdasarkan kata kunci wilayah.");
        }

        // 2. Mengambil Data Berita Terbesar di Google News
        const feedNews = await parser.parseURL(URL_GOOGLE_NEWS_ID);
        let berita = null;

        for (const item of feedNews.items) {
            const judul = item.title.toLowerCase();
            const ringkasan = item.contentSnippet || "";
            
            // Filter wilayah Cileungsi dan sekitarnya
            const isLokal = judul.includes('cileungsi') || judul.includes('jonggol') || judul.includes('gunung putri') || judul.includes('transyogi');
            const isTrendingNasional = trenHariIni.some(tren => judul.includes(tren));

            if (isLokal || isTrendingNasional) {
                berita = {
                    judulAsli: item.title,
                    sumber: item.source || "Media Nasional",
                    kontenAsli: `${item.title}. ${ringkasan}`,
                    isTrending: isTrendingNasional
                };
                break; // Ambil satu berita potensial untuk siklus 2 jam ini
            }
        }

        if (!berita) {
            console.log("🗓️ Tidak ada berita krusial atau lokal baru di Cileungsi untuk siklus jam ini.");
            return;
        }

        console.log(`📌 Berita Terpilih: "${berita.judulAsli}" [Kategori: ${berita.isTrending ? 'Nasional' : 'Lokal'}]`);

        const tanggalSekarang = new Date().toISOString();
        // Pembuatan slug nama file artikel secara bersih
        const slug = berita.judulAsli.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
        
        const targetFolder = path.join(process.cwd(), 'content', 'berita');
        const pathFile = path.join(targetFolder, `${slug}.md`);

        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        if (fs.existsSync(pathFile)) {
            console.log(`⚠️ Berita sudah pernah diposting sebelumnya: ${slug}.md`);
            return;
        }

        let promptAI = "";
        if (berita.isTrending) {
            promptAI = `Ubah berita nasional yang sedang TRENDING VIRAL ini menjadi artikel berita bergaya kasual, informatif, berikan analisis singkat mengapa berita ini ramai, optimasi SEO tinggi, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        } else {
            promptAI = `Ubah berita mentah daerah Cileungsi ini menjadi artikel berita lokal yang sangat menarik bagi warga sekitar, sebutkan nama lokasi spesifik di Cileungsi dengan jelas, optimasi SEO lokal, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        }

        console.log(`🤖 Mengirim konten ke Google Gemini API...`);

        // Panggilan REST API menggunakan metode native fetch Node.js v24
        const responseAI = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptAI }] }]
            })
        });

        const jsonRes = await responseAI.json();
        
        if (jsonRes.error) {
            throw new Error(`Google API Menolak Permintaan (${jsonRes.error.code}): ${jsonRes.error.message}`);
        }

        // Pembacaan objek respon JSON bertingkat secara aman sesuai standar Google
        if (!jsonRes.candidates || jsonRes.candidates.length === 0 || !jsonRes.candidates[0].content?.parts?.[0]?.text) {
            throw new Error(`Format balasan dari server Google tidak dikenal: ${JSON.stringify(jsonRes)}`);
        }

        const hasilTulisanAI = jsonRes.candidates[0].content.parts[0].text;

        const fileContent = `---
title: "${berita.judulAsli.replace(/"/g, '\\"')}"
date: "${tanggalSekarang}"
excerpt: "Pembaruan informasi terkini dari portal berita otomatis daerah Cileungsi mengenai topik yang sedang hangat diperbincangkan."
image: "/images/default-news.jpg"
sumber: "${berita.sumber}"
category: "${berita.isTrending ? 'Nasional' : 'Lokal'}"
---

${hasilTulisanAI}
`;

        fs.writeFileSync(pathFile, fileContent);
        console.log(`✅ Berita baru berhasil diterbitkan: ${slug}.md`);

    } catch (error) {
        console.error("❌ Terjadi kesalahan fatal pada sistem otomasi AI:");
        console.error(error.message);
        process.exit(1);
    }
}

jalankanBot();
