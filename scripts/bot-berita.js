import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';

const parser = new Parser();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// URL RSS Feed Resmi untuk Tren & Berita Terbesar di Indonesia
const URL_TRENDS_INDONESIA = 'https://google.com';
const URL_GOOGLE_NEWS_ID = 'https://google.com';

function bersihkanSlug(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Hapus karakter spesial
        .replace(/\s+/g, '-')         // Ubah spasi jadi minus
        .replace(/-+/g, '-')          // Hapus minus ganda
        .trim();
}

// 1. Fungsi Mengambil Topik yang Sedang Naik Daun di Google Trends
async function ambilKataKunciTrending() {
    try {
        const feed = await parser.parseURL(URL_TRENDS_INDONESIA);
        // Mengambil 5 tren teratas hari ini
        const daftarTren = feed.items.slice(0, 5).map(item => item.title.toLowerCase());
        console.log("📈 Tren Google Saat Ini:", daftarTren);
        return daftarTren;
    } catch (error) {
        console.error("❌ Gagal memuat Google Trends:", error);
        return [];
    }
}

// 2. Fungsi Mengambil Berita Terbesar dan Menyaring Berdasarkan Tren / Lokal Cileungsi
async function cariBeritaPotensial() {
    try {
        const feed = await parser.parseURL(URL_GOOGLE_NEWS_ID);
        const trenHariIni = await ambilKataKunciTrending();
        
        for (const item of feed.items) {
            const judul = item.title.toLowerCase();
            const ringkasan = item.contentSnippet || "";
            
            // Cek Kriteria A: Apakah ini berita lokal daerah Cileungsi & sekitarnya?
            const isLokal = judul.includes('cileungsi') || judul.includes('jonggol') || judul.includes('gunung putri') || judul.includes('transyogi');
            
            // Cek Kriteria B: Apakah berita nasional ini sedang trending / viral?
            const isTrendingNasional = trenHariIni.some(tren => judul.includes(tren));

            if (isLokal || isTrendingNasional) {
                // Ekstrak nama media asal (contoh: "Detikcom", "Kompas.com")
                const sumberMedia = item.source || "Media Nasional";
                
                return {
                    judulAsli: item.title,
                    sumber: sumberMedia,
                    kontenAsli: `${item.title}. ${ringkasan}`,
                    isTrending: isTrendingNasional
                };
            }
        }
    } catch (error) {
        console.error("❌ Gagal mengambil berita dari Google News:", error);
    }
    return null; // Jika tidak ada berita baru yang cocok
}

// 3. Fungsi Utama Menjalankan Bot & AI
async function jalankanBot() {
    try {
        const berita = await cariBeritaPotensial();
        
        if (!berita) {
            console.log("🗓️ Tidak ada berita krusial atau lokal baru dalam siklus jam ini.");
            return;
        }

        const tanggalSekarang = new Date().toISOString();
        const slug = bersihkanSlug(berita.judulAsli);
        const pathFile = path.join(process.cwd(), 'content', 'berita', `${slug}.md`);

        // Antisipasi agar tidak menulis artikel yang sama berulang kali
        if (fs.existsSync(pathFile)) {
            console.log(`⚠️ Berita sudah pernah diposting: ${slug}.md`);
            return;
        }

        // Modifikasi instruksi AI berdasarkan jenis berita yang didapat
        let promptAI = "";
        if (berita.isTrending) {
            promptAI = `Ubah berita nasional yang sedang TRENDING VIRAL ini menjadi artikel berita bergaya kasual, informatif, berikan analisis singkat mengapa berita ini ramai, optimasi SEO tinggi, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        } else {
            promptAI = `Ubah berita mentah daerah Cileungsi ini menjadi artikel berita lokal yang sangat menarik bagi warga sekitar, sebutkan nama lokasi spesifik di Cileungsi dengan jelas, optimasi SEO lokal, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        }

        // Tulis ulang dengan Gemini API
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptAI,
        });

        const hasilTulisanAI = response.text;

        // Susun struktur berkas markdown untuk Astro SSG
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

        const targetFolder = path.join(process.cwd(), 'content', 'berita');
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        fs.writeFileSync(pathFile, fileContent);
        console.log(`✅ Berita baru berhasil diterbitkan [Kategori: ${berita.isTrending ? 'Nasional' : 'Lokal'}]: ${slug}.md`);

    } catch (error) {
        console.error("❌ Terjadi kesalahan pada sistem otomasi AI:", error);
    }
}

jalankanBot();
