import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';

const parser = new Parser();

// Inisialisasi Gemini menggunakan Teks API Key baru Anda yang terikat Akun Layanan
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const URL_TRENDS_INDONESIA = 'https://google.com';
const URL_GOOGLE_NEWS_ID = 'https://google.com';

function bersihkanSlug(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

async function ambilKataKunciTrending() {
    try {
        const feed = await parser.parseURL(URL_TRENDS_INDONESIA);
        const daftarTren = feed.items.slice(0, 5).map(item => item.title.toLowerCase());
        console.log("📈 Tren Google Saat Ini:", daftarTren);
        return daftarTren;
    } catch (error) {
        console.error("❌ Gagal memuat Google Trends:", error);
        return [];
    }
}

async function cariBeritaPotensial() {
    try {
        const feed = await parser.parseURL(URL_GOOGLE_NEWS_ID);
        const trenHariIni = await ambilKataKunciTrending();
        
        for (const item of feed.items) {
            const judul = item.title.toLowerCase();
            const ringkasan = item.contentSnippet || "";
            
            const isLokal = judul.includes('cileungsi') || judul.includes('jonggol') || judul.includes('gunung putri') || judul.includes('transyogi');
            const isTrendingNasional = trenHariIni.some(tren => judul.includes(tren));

            if (isLokal || isTrendingNasional) {
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
    return null;
}

async function jalankanBot() {
    try {
        const berita = await cariBeritaPotensial();
        
        if (!berita) {
            console.log("🗓️ Tidak ada berita krusial atau lokal baru dalam siklus jam ini.");
            return;
        }

        const tanggalSekarang = new Date().toISOString();
        const slug = bersihkanSlug(berita.judulAsli);
        const targetFolder = path.join(process.cwd(), 'content', 'berita');
        const pathFile = path.join(targetFolder, `${slug}.md`);

        // Membuat folder otomatis jika belum ada di dalam repositori
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        if (fs.existsSync(pathFile)) {
            console.log(`⚠️ Berita sudah pernah diposting: ${slug}.md`);
            return;
        }

        let promptAI = "";
        if (berita.isTrending) {
            promptAI = `Ubah berita nasional yang sedang TRENDING VIRAL ini menjadi artikel berita bergaya kasual, informatif, berikan analisis singkat mengapa berita ini ramai, optimasi SEO tinggi, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        } else {
            promptAI = `Ubah berita mentah daerah Cileungsi ini menjadi artikel berita lokal yang sangat menarik bagi warga sekitar, sebutkan nama lokasi spesifik di Cileungsi dengan jelas, optimasi SEO lokal, dan jangan gunakan markdown tebal di judul. Berita: ${berita.kontenAsli}`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptAI,
        });

        const hasilTulisanAI = response.text;

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
        console.log(`✅ Berita baru berhasil diterbitkan [Kategori: ${berita.isTrending ? 'Nasional' : 'Lokal'}]: ${slug}.md`);

    } catch (error) {
        console.error("❌ Terjadi kesalahan pada sistem otomasi AI:", error);
    }
}

jalankanBot();
