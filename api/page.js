import { list } from '@vercel/blob';

export default async function handler(req, res) {
    const { slug } = req.query;
    
    if (!slug) {
        return res.status(400).send('Slug halaman tidak ditemukan');
    }

    try {
        // Cari file HTML di Vercel Blob berdasarkan nama slug persis
        const { blobs } = await list({ prefix: `pages/${slug}.html` });
        
        if (blobs.length === 0) {
            return res.status(404).send('Halaman tidak ditemukan');
        }

        const response = await fetch(blobs[0].url);
        const html = await response.text();

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        return res.status(500).send('Gagal memuat halaman: ' + error.message);
    }
}
