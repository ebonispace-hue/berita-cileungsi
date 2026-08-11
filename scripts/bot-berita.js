import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai'; // Menggunakan SDK resmi Google GenAI terbaru

// Inisialisasi API Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Fungsi simulasi untuk mengambil data tren (bisa diganti RSS Feed / Google News API)
async function dapatkanBeritaMentah() {
    return {
        judulAsli: "Flyover Cileungsi Mengalami Kemacetan Parah Sore Ini Akibat Truk Mogok",
        sumber: "Radar Bogor",
        kontenAsli: "Terjadi kemacetan sepanjang 2 km di kawasan Flyover Cileungsi menuju Jonggol pada pukul 17.00 WIB karena ada truk kontainer mogok di lajur kiri..."
    };
}

function bersihkanSlug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function jalankanBot() {
    try {
        const berita = await dapatkanBeritaMentah();
        const tanggalSkarang = new Date().toISOString();
        
        // Prompt instruksi khusus agar tulisan berkarakter lokal, viral, namun berbobot
        const promptAI = `Ubah berita mentah ini menjadi artikel berita lokal Cileungsi yang menarik, kompleks dengan analisis singkat, santai tapi kredibel, dan optimasi SEO. Jangan gunakan format markdown tebal pada judul. Berita Mentah: ${berita.kontenAsli}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Menggunakan model tercepat dan efisien untuk teks berita
            contents: promptAI,
        });

        const hasilTulisanAI = response.text;
        const slug = bersihkanSlug(berita.judulAsli);

        // Format isi file Markdown yang akan dibaca oleh Astro
        const fileContent = `---
title: "${berita.judulAsli}"
date: "${tanggalSkarang}"
excerpt: "Info terkini mengenai situasi lalu lintas dan kondisi jalan di Flyover Cileungsi hari ini."
image: "/images/default-cileungsi.jpg"
sumber: "${berita.sumber}"
---

${hasilTulisanAI}
`;

        const targetFolder = path.join(process.cwd(), 'content', 'berita');
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        fs.writeFileSync(path.join(targetFolder, `${slug}.md`), fileContent);
        console.log(`✅ Berita berhasil ditulis: ${slug}.md`);

    } catch (error) {
        console.error("❌ Bot Gagal Memproses Berita:", error);
    }
}

jalankanBot();
