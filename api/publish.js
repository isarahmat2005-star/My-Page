import { put } from '@vercel/blob';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { html, title } = req.body;
        
        if (!html) {
            return res.status(400).json({ error: 'Kode HTML tidak ditemukan' });
        }

        // Ubah judul kartu menjadi format URL-friendly (slug) bersih tanpa ID
        const slug = (title || 'landing-page')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const filename = `pages/${slug}.html`;
        const blob = await put(filename, html, {
            access: 'public',
            contentType: 'text/html',
            allowOverwrite: true,
        });

        return res.status(200).json({ 
            url: `/p/${slug}`, 
            blobUrl: blob.url 
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
