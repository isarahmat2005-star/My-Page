import { put } from '@vercel/blob';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { html, id } = req.body;
        
        if (!html) {
            return res.status(400).json({ error: 'Kode HTML tidak ditemukan' });
        }

        const filename = `pages/${id}.html`;
        const blob = await put(filename, html, {
            access: 'public',
            contentType: 'text/html',
        });

        return res.status(200).json({ url: `/api/page?id=${id}` });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
