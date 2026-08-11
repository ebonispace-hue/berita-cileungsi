const fs = require('fs');
const path = require('path');

async function jalankanBot() {
    try {
        const Parser = require('rss-parser');
        const parser = new Parser();

        // Menggunakan endpoint resmi generateContent sesuai dokumentasi REST API Google Gemini
        const GEMINI_API_URL = "https://googleapis.com";
        const URL_TRENDS_INDONESIA = 'https://google.com';
        const URL_GOOGLE_NEWS_ID = 'https://google.com';

        console.log("📥 Memulai pemindaian tren berita...");
        
        let trenHariIni = [];
        try {
            const feedTrends = await parser.parseURL(URL_TRENDS_INDONESIA);
            trenHariIni = feedTrends.items.slice(0, 5).map(item => item.title.toLowerCase());
            console.log("📈 Tren Google Saat Ini:", trenHariIni);
        } catch (errTrends) {
            console.warn("⚠️ Gagal memuat tren, mencari berita berdasarkan kata kunci lokal saja.");
        }

        const feedNews = await parser.parseURL(URL_GOOGLE_NEWS_ID);
        let berita = null;

        for (const item of feedNews.items) {
            const judul = item.title.toLowerCase();
            const ringkasan = item.contentSnippet || "";
            
            const isLokal = judul.includes('cileungsi') || judul.includes('jonggol') || judul.includes('gunung putri') || judul.includes('transyogi');
            const isTrendingNasional = trenHariIni.some(tren => judul.includes(tren));

            if (isLokal || isTrendingNasional) {
                berita = {
                    judulAsli: item.title,
                    sumber: item.source || "Media Nasional",
                    kontenAsli: `${item.title}. ${ringkasan}`,
                    isTrending: isTrendingNasional
                };
                break; 
            }
        }

        if (!berita) {
            console.log("🗓️ Tidak ada berita baru seputar Cileungsi atau tren nasional yang cocok dalam siklus ini.");
            return;
        }

        console.log(`📌 Berita Terpilih: "${berita.judulAsli}"`);

        const tanggalSekarang = new Date().toISOString();
        const slug = berita.judulAsli.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
        
        const targetFolder = path.join(process.cwd(), 'content', 'berita');
        const pathFile = path.join(targetFolder, `${slug}.md`);

        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        if (fs.existsSync(pathFile)) {
            console.log(`⚠️ Artikel ini sudah pernah diterbitkan sebelumnya: ${slug}.md`);
            return;
        }

        let promptAI = "";
        if (berita.isTrending) {
            promptAI = `Ubah berita nasional yang sedang TRENDING VIRAL ini menjadi artikel berita bergaya kasual, informatif, berikan analisis singkat mengapa berita ini ramai, optimasi SEO tinggi, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        } else {
            promptAI = `Ubah berita mentah daerah Cileungsi ini menjadi artikel berita lokal yang sangat menarik bagi warga sekitar, sebutkan nama lokasi spesifik di Cileungsi dengan jelas, optimasi SEO lokal, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        }

        console.log(`🤖 Menghubungi Server Google Gemini AI...`);

        const responseAI = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptAI }] }]
            })
        });

        const jsonRes = await responseAI.json();
        
        if (jsonRes.error) {
            throw new Error(`Google API Error (${jsonRes.error.code}): ${jsonRes.error.message}`);
        }

        // PERBAIKAN UTAMA: Ekstraksi array JSON Google REST API yang sangat presisi dan aman
        let hasilTulisanAI = "";
        if (jsonRes.candidates && jsonRes.candidates[0] && jsonRes.candidates[0].content && jsonRes.candidates[0].content.parts && jsonRes.candidates[0].content.parts[0]) {
            hasilTulisanAI = jsonRes.candidates[0].content.parts[0].text;
        }

        if (!hasilTulisanAI) {
            throw new Error(`Gagal mengekstrak teks dari respons Google: ${JSON.stringify(jsonRes)}`);
        }

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
        console.log(`✅ Berita baru berhasil disimpan ke folder repositori: ${slug}.md`);

    } catch (error) {
        console.error("❌ KESALAHAN UTAMA SISTEM BOT:");
        console.error(error.message);
        process.exit(1); 
    }
}

jalankanBot();
