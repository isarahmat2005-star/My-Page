import { list } from '@vercel/blob';

export default async function handler(req, res) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).send('ID halaman tidak ditemukan');
    }

    try {
        // Cari file HTML di Vercel Blob berdasarkan ID
        const { blobs } = await list({ prefix: `pages/${id}` });
        
        if (blobs.length === 0) {
            return res.status(404).send('Halaman tidak ditemukan');
        }

        // Ambil isi kode HTML dari file tersebut
        const response = await fetch(blobs[0].url);
        const html = await response.text();

        // Paksa browser menampilkan sebagai halaman web, BUKAN didownload
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        return res.status(500).send('Gagal memuat halaman: ' + error.message);
    }
}
