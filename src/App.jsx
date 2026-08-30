import React, { useState, useEffect, useRef, useCallback } from 'react';

const fontsList = [
    { id: 'Inter', name: 'Inter' }, { id: 'Poppins', name: 'Poppins' }, { id: 'Montserrat', name: 'Montserrat' }, 
    { id: 'Roboto', name: 'Roboto' }, { id: 'Oswald', name: 'Oswald' }, { id: 'Playfair Display', name: 'Playfair Display' },
    { id: 'Merriweather', name: 'Merriweather' }, { id: 'Lora', name: 'Lora' }, { id: 'Space Grotesk', name: 'Space Grotesk' }, 
    { id: 'Bebas Neue', name: 'Bebas Neue' }, { id: 'Open Sans', name: 'Open Sans' }, { id: 'Lato', name: 'Lato' }, 
    { id: 'Nunito', name: 'Nunito' }, { id: 'Raleway', name: 'Raleway' }, { id: 'Ubuntu', name: 'Ubuntu' }, 
    { id: 'Fira Sans', name: 'Fira Sans' }, { id: 'Quicksand', name: 'Quicksand' }, { id: 'Cinzel', name: 'Cinzel' }, 
    { id: 'Josefin Sans', name: 'Josefin Sans' }, { id: 'Anton', name: 'Anton' }, { id: 'Rubik', name: 'Rubik' }, 
    { id: 'Work Sans', name: 'Work Sans' }, { id: 'Noto Sans', name: 'Noto Sans' }, { id: 'PT Sans', name: 'PT Sans' }, 
    { id: 'Karla', name: 'Karla' }, { id: 'Inconsolata', name: 'Inconsolata' }, { id: 'Mukta', name: 'Mukta' }, 
    { id: 'Teko', name: 'Teko' }, { id: 'Cabin', name: 'Cabin' }, { id: 'Dosis', name: 'Dosis' },
    { id: 'Signika', name: 'Signika' }, { id: 'Pacifico', name: 'Pacifico' }, { id: 'Zilla Slab', name: 'Zilla Slab' }, 
    { id: 'Cairo', name: 'Cairo' }, { id: 'Archivo', name: 'Archivo' }, { id: 'Titillium Web', name: 'Titillium Web' }, 
    { id: 'Varela Round', name: 'Varela Round' }, { id: 'Hind', name: 'Hind' }, { id: 'Abel', name: 'Abel' }, 
    { id: 'Fjalla One', name: 'Fjalla One' }, { id: 'Dancing Script', name: 'Dancing Script' }, 
    { id: 'Indie Flower', name: 'Indie Flower' }, { id: 'Caveat', name: 'Caveat' }, { id: 'Righteous', name: 'Righteous' }, 
    { id: 'Crimson Text', name: 'Crimson Text' }, { id: 'Asap', name: 'Asap' }, { id: 'Exo 2', name: 'Exo 2' }, 
    { id: 'Prompt', name: 'Prompt' }, { id: 'Manrope', name: 'Manrope' }, { id: 'Kanit', name: 'Kanit' }
];

export default function App() {
    const [time, setTime] = useState(new Date());
    const [promptInput, setPromptInput] = useState('');
    const [extraInstructions, setExtraInstructions] = useState('');
    
    // State Pengaturan (Fonts, Colors, Inputs)
    const [activeAccordion, setActiveAccordion] = useState('');
    const [currentFonts, setCurrentFonts] = useState({ all: 'Inter', judul: 'None', subjudul: 'None', isi: 'None', tombol: 'None' });
    const [openFontDropdown, setOpenFontDropdown] = useState('');
    const [colors, setColors] = useState([
        { id: 1, hex: '#C8D100', role: 'Warna Utama (Primary/Tombol)' },
        { id: 2, hex: '#898F00', role: 'Warna Sekunder (Hover/Aksen)' }
    ]);
    
    const [imgInt, setImgInt] = useState({ qty: 0, ratio: 'auto' });
    const [extImages, setExtImages] = useState([{ id: 1, url: '', desc: '' }]);
    const [medsos, setMedsos] = useState([{ id: 1, type: 'Instagram', url: '', desc: '' }]);
    const [checkouts, setCheckouts] = useState([{ id: 1, url: '', text: '' }]);
    
    const [settings, setSettings] = useState({
        bioLink: false, darkMode: false, responsive: true, copyright: false, copyrightName: ''
    });
    const [params, setParams] = useState({ qty: 5, worker: 5, delay: 3, zipName: '' });

    const [cards, setCards] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Modals
    const [previewModal, setPreviewModal] = useState({ isOpen: false, code: '', mode: 'desktop', id: null });
    const [editModal, setEditModal] = useState({ isOpen: false, code: '', id: null, instruction: '', tab: 'code', history: [], historyIndex: -1, isRevising: false });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', desc: '', onConfirm: null });
    const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', desc: '' });

    // Refs for safe access in loops
    const isGeneratingRef = useRef(false);
    const isPausedRef = useRef(false);
    const abortCtrlRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        
        const handleClickOutside = (e) => {
            if (!e.target.closest('.font-dropdown-container')) setOpenFontDropdown('');
        };
        document.addEventListener('click', handleClickOutside);
        
        // Dynamically load JSZip
        const loadJSZip = async () => {
             if (window.JSZip) return;
             const script = document.createElement('script');
             script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
             script.async = true;
             document.body.appendChild(script);
        };
        loadJSZip();

        return () => {
            clearInterval(timer);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        isGeneratingRef.current = isGenerating;
        isPausedRef.current = isPaused;
    }, [isGenerating, isPaused]);

    const callGeminiAPI = (promptText, isRevision = false, oldCode = "", signal) => {
        return new Promise((resolve, reject) => {
            const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            let systemInstruction = "";
            
            if (isRevision) {
                systemInstruction = "LAPIS 1: ASISTEN BEDAH KODE\nAnda adalah asisten editor kode. Saya beri kode HTML asli dan instruksi perbaikan.\nATURAN MUTLAK: DILARANG merancang ulang dari nol. Modifikasi bagian spesifik saja. Pertahankan 90% struktur asli.\nKembalikan 1 file HTML utuh murni tanpa markdown (```html) dan tanpa penjelasan.\nTETAP pertahankan atau tambahkan komentar HTML pada bagian yang Anda ubah agar pengguna paham.";
            } else {
                systemInstruction = "LAPIS 1: ELITE FRONT-END ARCHITECT\nAnda adalah Elite Web Architect. Rancang Landing Page murni dalam 1 file HTML memakai Tailwind CSS via CDN.\nLAPIS 2: ESTETIKA & KUALITAS UI (MUTLAK)\n- Gunakan banyak ruang kosong (padding/margin besar p-6, p-10).\n- SEMUA tombol WAJIB transisi hover. Pastikan rasio kontras teks WCAG.\nLAPIS 3: ATURAN FORMAT (WAJIB)\n1. DILARANG Keras menggunakan tag markdown (```html). Output HTML murni dari awal sampai akhir.\n2. KOMENTAR KODE: WAJIB sisipkan komentar HTML (<!-- penjelasan -->) yang sangat jelas di SETIAP blok kode utama (misal: <!-- HEADER START -->, <!-- BAGIAN HERO -->, <!-- FITUR -->, dll) agar pengguna tau kode itu untuk apa.\n3. ANTI-COPYRIGHT: DILARANG MENGGUNAKAN NAMA BRAND ASLI/TERKENAL di dunia nyata. Gunakan nama yang UMUM dan GENERIK (misalnya: 'Perusahaan Kita', 'Toko Anda', 'Layanan Terbaik') agar aman dari pelanggaran hak cipta.";
            }

            const finalPrompt = isRevision ? `Berikut kode HTML:\n\n${oldCode}\n\nInstruksi Revisi: "${promptText}"` : promptText;
            
            const payload = {
                contents: [{ parts: [{ text: finalPrompt }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] }
            };

            const handleMessage = (event) => {
                const data = event.data;
                if (data && data.type === 'GEMINI_RESPONSE' && data.id === reqId) {
                    window.removeEventListener('message', handleMessage);
                    if (data.success) {
                        let text = data.data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) return reject(new Error("Format respons tidak valid."));
                        let cleanCode = text.trim();
                        const match = cleanCode.match(/```(?:html)?\s*([\s\S]*?)```/i);
                        if (match) cleanCode = match[1].trim();
                        resolve(cleanCode);
                    } else {
                        reject(new Error(data.error));
                    }
                }
            };

            window.addEventListener('message', handleMessage);

            if (signal) {
                signal.addEventListener('abort', () => {
                    window.removeEventListener('message', handleMessage);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            }

            // Kirim pesan instruksi ke HTML Gateway Induk
            window.parent.postMessage({
                type: 'CALL_GEMINI',
                id: reqId,
                endpointPath: "gemini-2.5-flash-preview-09-2025:generateContent", // Endpoint khusus Vercel
                payload: payload
            }, '*');
        });
    };

    const buildPromptStr = () => {
        let aiPrompt = `Topik Utama/Deskripsi: "${promptInput}".\n`;
        if (extraInstructions) aiPrompt += `INSTRUKSI KHUSUS PENGGUNA (WAJIB DIIKUTI): ${extraInstructions}\n`;
        
        // Fonts
        let fontImports = new Set();
        let fontRules = [];
        if(currentFonts.all !== 'None') {
            fontImports.add(currentFonts.all.replace(/ /g, '+'));
            fontRules.push(`- Aturan Dasar: Terapkan 'font-family: ${currentFonts.all}, sans-serif;' di body/elemen induk.`);
        } else {
            if(currentFonts.judul !== 'None') { fontImports.add(currentFonts.judul.replace(/ /g, '+')); fontRules.push(`- KHUSUS TAG HEADING: 'font-family: ${currentFonts.judul}, sans-serif;'`); }
            if(currentFonts.subjudul !== 'None') { fontImports.add(currentFonts.subjudul.replace(/ /g, '+')); fontRules.push(`- KHUSUS SUB-JUDUL: 'font-family: ${currentFonts.subjudul}, sans-serif;'`); }
            if(currentFonts.isi !== 'None') { fontImports.add(currentFonts.isi.replace(/ /g, '+')); fontRules.push(`- KHUSUS PARAGRAF TEKS: 'font-family: ${currentFonts.isi}, sans-serif;'`); }
            if(currentFonts.tombol !== 'None') { fontImports.add(currentFonts.tombol.replace(/ /g, '+')); fontRules.push(`- KHUSUS TOMBOL: 'font-family: ${currentFonts.tombol}, sans-serif;'`); }
        }
        if(fontRules.length > 0) {
            aiPrompt += `\nTIPOGRAFI MUTLAK:\n`;
            fontImports.forEach(imp => aiPrompt += `- Import dari Google Fonts: <link href="https://fonts.googleapis.com/css2?family=${imp}&display=swap" rel="stylesheet">\n`);
            aiPrompt += fontRules.join("\n") + "\n";
        }

        // Colors
        let colorRules = colors.map(c => c.role ? `- [Wajib untuk: ${c.role}]: ${c.hex}` : `- [Kombinasi Bebas]: ${c.hex}`);
        if(colorRules.length > 0) aiPrompt += `\nPALET WARNA MUTLAK (Gunakan utility Tailwind arbitrary bg-[${colors[0].hex}] dsb):\n${colorRules.join("\n")}\n`;

        // Images
        if (imgInt.qty > 0) {
            let pSize = '800/800';
            if(imgInt.ratio === '16:9') pSize = '1280/720'; else if(imgInt.ratio === '9:16') pSize = '720/1280';
            else if(imgInt.ratio === '4:3') pSize = '1024/768'; else if(imgInt.ratio === '3:4') pSize = '768/1024';
            aiPrompt += `\nGAMBAR INTERNAL (AUTO): Sisipkan tepat ${imgInt.qty} gambar <img src="https://picsum.photos/${pSize}?random=\${Math.random()}" class="w-full object-cover"> di bagian relevan.\n`;
        }

        // Settings
        if (settings.darkMode) aiPrompt += `\nDARK MODE: Sediakan tombol toggle Dark/Light fungsional. Pakai class 'dark:' Tailwind.\n`;
        if (settings.bioLink) aiPrompt += `\nSTRUKTUR MINI PAGE: Rancang layout gaya Biolink (max-w-md mx-auto) berpusat.\n`;
        if (settings.responsive) aiPrompt += `\nRESPONSIF MUTLAK: Gunakan class (sm:, md:, lg:) agar layout sempurna di PC dan Mobile.\n`;
        if (settings.copyright) aiPrompt += `\nFOOTER: Sisipkan Teks Hak Cipta di bagian paling bawah: "© ${new Date().getFullYear()} ${settings.copyrightName || 'Nama Perusahaan'}"\n`;

        // Checkouts
        if(checkouts.length > 0 && checkouts[0].url) {
            let rules = checkouts.map(c => `- Tombol CTA "${c.text || 'Checkout'}" arahkan ke URL: ${c.url || '#'}`);
            aiPrompt += `\nLINK CHECKOUT UTAMA:\n${rules.join("\n")}\n`;
        }
        
        // Medsos
        if(medsos.length > 0 && medsos[0].url) {
            let rules = medsos.map(m => `- Tautan ${m.type === 'Lainnya' ? (m.desc || 'Eksternal') : 'Icon ' + m.type}: ${m.url || '#'}`);
            aiPrompt += `\nTAUTAN MEDSOS/EKSTERNAL:\n${rules.join("\n")}\n`;
        }

        // Ext Images
        if(extImages.length > 0 && extImages[0].url) {
            let rules = extImages.filter(e => e.url).map(e => `- MASUKKAN GAMBAR INI: <img src="${e.url}"> (Penempatan: ${e.desc || 'Ilustrasi'})`);
            if(rules.length > 0) aiPrompt += `\nGAMBAR EKSTERNAL WAJIB:\n${rules.join("\n")}\n`;
        }

        return aiPrompt;
    };

    const updateCardState = (id, updates) => {
        setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleStartGeneration = async () => {
        if (isGeneratingRef.current) return;
        if (!promptInput.trim() && cards.filter(c => c.status === 'pending').length === 0) return;

        let finalZipName = params.zipName.trim();
        if(!finalZipName) {
            finalZipName = promptInput.split(' ').slice(0, 4).join('-').replace(/[^a-zA-Z0-9-]/g, '') || 'Hasil-Landing-Page';
            setParams(p => ({...p, zipName: finalZipName}));
        }

        // Susun Queue Kartu Jika Belum Ada
        let currentCards = [...cards];
        if (currentCards.filter(c => c.status === 'pending').length === 0) {
            const compiledPrompt = buildPromptStr();
            const newCards = [];
            for(let i=0; i<params.qty; i++) {
                newCards.push({ id: 'card_' + Date.now() + Math.random().toString(36).substr(2, 5), title: `Variasi Page ${i+1}`, prompt: compiledPrompt, code: '', status: 'pending', error: null });
            }
            currentCards = [...currentCards, ...newCards];
            setCards(currentCards);
            setCurrentPage(1);
        }

        setIsGenerating(true);
        setIsPaused(false);
        abortCtrlRef.current = new AbortController();
        const signal = abortCtrlRef.current.signal;
        const delayMs = params.delay * 1000;
        
        // Baca status terbaru dari ref untuk queue concurrency
        const getNextPendingTask = () => {
            let latestCards;
            setCards(prev => { latestCards = prev; return prev; });
            return latestCards.find(c => c.status === 'pending');
        };

        const concurrency = Math.min(params.worker, currentCards.filter(c => c.status === 'pending').length);
        const workers = [];

        for (let w = 0; w < concurrency; w++) {
            workers.push((async () => {
                if (w > 0 && delayMs > 0 && !isPausedRef.current) await new Promise(r => setTimeout(r, delayMs * w));
                while (!isPausedRef.current) {
                    let task = getNextPendingTask();
                    if (!task) break;
                    
                    updateCardState(task.id, { status: 'processing' });
                    try {
                        const resultHTML = await callGeminiAPI(task.prompt, false, "", signal);
                        updateCardState(task.id, { code: resultHTML, status: 'done' });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            updateCardState(task.id, { status: 'failed', error: err.message });
                        } else {
                            updateCardState(task.id, { status: 'pending' });
                        }
                    }
                    if (delayMs > 0 && !isPausedRef.current) await new Promise(r => setTimeout(r, delayMs));
                }
            })());
        }

        await Promise.all(workers);
        if (!isPausedRef.current) {
            setIsGenerating(false);
        }
    };

    const handleTogglePause = () => {
        if (isGeneratingRef.current && !isPausedRef.current) {
            setIsPaused(true); setIsGenerating(false);
            if(abortCtrlRef.current) abortCtrlRef.current.abort();
            setCards(prev => prev.map(c => c.status === 'processing' ? { ...c, status: 'pending' } : c));
        } else if (isPausedRef.current) {
            handleStartGeneration();
        }
    };

    const confirmClearAll = () => {
        if (cards.length === 0) return;
        setConfirmModal({
            isOpen: true, title: 'Hapus Semua?', desc: 'Anda akan menghapus <b>seluruh antrean</b> secara permanen.<br><i>(Input deskripsi tetap aman)</i>',
            onConfirm: () => {
                if(abortCtrlRef.current) abortCtrlRef.current.abort();
                setCards([]); setIsGenerating(false); setIsPaused(false); setCurrentPage(1);
            }
        });
    };

    const copyCode = (code) => {
        const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        setAlertModal({ isOpen: true, title: 'Sukses!', desc: 'Kode HTML berhasil disalin ke Clipboard.' });
    };

    const handleExportZip = async () => {
        const doneCards = cards.filter(c => c.status === 'done' && c.code);
        if (doneCards.length === 0) return;
        
        try {
            if (!window.JSZip) {
                 setAlertModal({ isOpen: true, title: 'Menunggu JSZip', desc: 'Modul kompresi sedang dimuat. Coba lagi dalam beberapa detik.'});
                 return;
            }
            const zip = new window.JSZip();
            doneCards.forEach((c, idx) => {
                let docTitle = `Variasi_${idx+1}`;
                const titleMatch = c.code.match(/<title>(.*?)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    docTitle = titleMatch[1].trim().replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, '-');
                }
                zip.file(`${docTitle}_${idx+1}.html`, c.code);
            });
            const content = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(content);
            const link = document.createElement('a'); 
            link.href = zipUrl; link.download = `${params.zipName || 'Hasil-Landing-Page'}.zip`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(zipUrl);
        } catch (err) {
            setAlertModal({ isOpen: true, title: 'Error ZIP', desc: "Gagal menyusun ZIP: " + err.message });
        }
    };

    const handleRevisiAI = async () => {
        if (!editModal.instruction || !editModal.code) return;
        setEditModal(prev => ({...prev, isRevising: true}));
        try {
            const revisedCode = await callGeminiAPI(editModal.instruction, true, editModal.code);
            
            let newHistory = editModal.history.slice(0, editModal.historyIndex + 1);
            newHistory.push(revisedCode);
            
            setEditModal(prev => ({
                ...prev, code: revisedCode, instruction: '',
                history: newHistory, historyIndex: newHistory.length - 1, isRevising: false
            }));
        } catch (err) {
            setEditModal(prev => ({...prev, isRevising: false}));
            setAlertModal({ isOpen: true, title: 'Error AI', desc: err.message });
        }
    };

    const handleEditSave = () => {
        if(editModal.id) updateCardState(editModal.id, { code: editModal.code });
        setEditModal(prev => ({...prev, isOpen: false}));
    };

    const toggleAccordion = (id) => {
        setActiveAccordion(prev => prev === id ? '' : id);
    };

    // Calculate Stats
    const pendingCount = cards.filter(c => c.status === 'pending' || c.status === 'processing').length;
    const successCount = cards.filter(c => c.status === 'done').length;
    const failedCount = cards.filter(c => c.status === 'failed').length;
    const displaySelected = (!isGeneratingRef.current && pendingCount === 0) ? parseInt(params.qty) || 0 : pendingCount;

    // Pagination
    const totalPages = Math.ceil(cards.length / itemsPerPage) || 1;
    const paginatedCards = cards.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col text-slate-900 bg-slate-100 font-sans">
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #898F00; }
                .dot-anim::after { content: ''; animation: dots 1.5s steps(4, end) infinite; }
                @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } 100% { content: ''; } }
                input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type="number"] { -moz-appearance: textfield; }
                input[type="checkbox"] { accent-color: #898F00; }
            `}</style>

            {/* HEADER */}
            <header className="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-30 shadow-md h-14 flex items-center shrink-0">
                <div className="w-full px-4 sm:px-6 flex justify-between items-center">
                    <div className="text-[28px] leading-none font-bold text-[#C8D100] tracking-widest flex items-center gap-2">PAGE AI</div>
                    <div className="text-right flex flex-col justify-center items-end text-slate-100">
                        <div className="text-[16px] leading-none font-bold tracking-[0.1em]">{time.toLocaleTimeString('id-ID', { hour12: false })}</div>
                        <div className="text-[11px] leading-tight text-slate-400 tracking-wider mt-0.5">{time.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                    </div>
                </div>
            </header>

            <main className="w-full flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative min-h-0 bg-slate-100">
                
                {/* SIDEBAR PENGATURAN */}
                <aside className="w-full lg:w-[380px] bg-slate-50 lg:border-r border-slate-200 flex flex-col z-20 shrink-0 lg:h-full lg:overflow-hidden relative">
                    <div className="flex-1 flex flex-col overflow-y-visible lg:overflow-y-auto overflow-x-hidden custom-scroll lg:pb-6 pb-0">
                        <div className="p-3 lg:p-4 flex flex-col gap-3 lg:gap-4 mb-1">
                            
                            {/* Tombol Panduan & Bantuan */}
                            <div className="flex gap-2 w-full">
                                <a href="#" className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-lg transition shadow-sm text-[11px] tracking-wide hover:-translate-y-0.5 duration-200">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> Panduan
                                </a>
                                <a href="#" className="flex-1 flex items-center justify-center gap-2 bg-[#C8D100] hover:bg-[#898F00] text-slate-900 font-semibold py-3 rounded-lg transition shadow-sm text-[11px] tracking-wide hover:-translate-y-0.5 duration-200">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> Bantuan
                                </a>
                            </div>

                            <div className="bg-white p-3 rounded-lg shadow-sm border border-[#C8D100]/30 flex flex-col text-left">
                                {/* Prompt Utama */}
                                <div className="mb-3">
                                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Deskripsi Produk/Halaman <span className="text-red-500">*</span></label>
                                    <textarea rows="2" value={promptInput} onChange={e => setPromptInput(e.target.value)} placeholder="Tuliskan deskripsi utama landing page Anda..." className="w-full text-xs p-2 border border-gray-300 rounded bg-slate-50 focus:ring-2 focus:ring-[#C8D100] outline-none h-16 resize-none custom-scroll transition-all"></textarea>
                                </div>
                                {/* Instruksi Khusus */}
                                <div className="mb-4">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Instruksi Khusus (Opsional)</label>
                                    <textarea rows="2" value={extraInstructions} onChange={e => setExtraInstructions(e.target.value)} placeholder="Misal: 'Wajib ada form testimoni' atau 'Tombol melayang'..." className="w-full text-xs p-2 border border-gray-300 rounded bg-slate-50 focus:ring-2 focus:ring-[#C8D100] outline-none h-12 resize-none custom-scroll transition-all"></textarea>
                                </div>

                                {/* Accordion: Font */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md font-dropdown-container">
                                    <button onClick={() => toggleAccordion('font')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-[#898F00] transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 group-hover:text-[#898F00]"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg> Pilihan Font</span>
                                        <svg className={`w-4 h-4 transition-transform duration-300 ${activeAccordion === 'font' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                    </button>
                                    {activeAccordion === 'font' && (
                                        <div className="border-t border-slate-200 pb-2 flex flex-col gap-2 p-2">
                                            {['all', 'judul', 'subjudul', 'isi', 'tombol'].map(target => {
                                                const isLocked = target !== 'all' && currentFonts.all !== 'None';
                                                return (
                                                    <div key={target} className="flex items-center justify-between gap-2 relative">
                                                        <span className="text-[10px] font-bold text-slate-500 w-16 shrink-0 uppercase">{target}</span>
                                                        <button disabled={isLocked} onClick={() => setOpenFontDropdown(prev => prev === target ? '' : target)} className={`flex-1 flex justify-between items-center bg-white border border-slate-200 rounded p-1.5 hover:bg-slate-50 transition shadow-sm text-left outline-none ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            <span className={isLocked || currentFonts[target] === 'None' ? 'text-[11px] truncate text-slate-400 italic' : 'text-[11px] truncate font-bold text-slate-800'}>{isLocked ? 'Terkunci (Ikut All)' : currentFonts[target]}</span>
                                                            <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                                        </button>
                                                        {openFontDropdown === target && (
                                                            <div className="absolute top-full right-0 w-[calc(100%-4rem)] max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded shadow-xl z-50 custom-scroll mt-1">
                                                                <div onClick={() => { setCurrentFonts({...currentFonts, [target]: 'None'}); setOpenFontDropdown(''); }} className="p-2 border-b border-slate-100 hover:bg-red-50 cursor-pointer text-red-500 font-bold text-[10px] uppercase">NONE</div>
                                                                {fontsList.map(f => (
                                                                    <div key={f.id} onClick={() => { setCurrentFonts({...currentFonts, [target]: f.id}); setOpenFontDropdown(''); }} className="p-2 border-b border-slate-100 hover:bg-[#C8D100]/10 cursor-pointer text-slate-800 text-[14px]" style={{fontFamily: `'${f.id}', sans-serif`}}>{f.name}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Accordion: Colors */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('color')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-[#898F00] transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-400 group-hover:text-[#898F00]"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> Palet Warna</span>
                                        <svg className={`w-4 h-4 transition-transform duration-300 ${activeAccordion === 'color' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                    </button>
                                    {activeAccordion === 'color' && (
                                        <div className="border-t border-slate-200 flex flex-col">
                                            <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scroll p-2 pb-1 bg-slate-50">
                                                {colors.map(c => (
                                                    <div key={c.id} className="relative bg-white border border-slate-200 p-2 rounded-sm flex flex-col gap-1.5 shadow-sm">
                                                        <div className="flex gap-2 items-center">
                                                            <input type="color" value={c.hex} onChange={e => setColors(colors.map(x => x.id === c.id ? {...x, hex: e.target.value.toUpperCase()} : x))} className="w-6 h-6 p-0 border-0 rounded-sm cursor-pointer shrink-0" />
                                                            <input type="text" value={c.hex} onChange={e => { let val = e.target.value; if(!val.startsWith('#')) val = '#'+val; setColors(colors.map(x => x.id === c.id ? {...x, hex: val} : x)); }} className="w-20 text-[10px] font-mono font-bold p-1 border border-slate-200 rounded-sm bg-slate-50 outline-none focus:border-[#C8D100] uppercase text-center" />
                                                        </div>
                                                        <input type="text" value={c.role} onChange={e => setColors(colors.map(x => x.id === c.id ? {...x, role: e.target.value} : x))} placeholder="Peran (Kosong = Bebas AI)" className="w-full text-[9px] p-1 border-none bg-slate-50 outline-none text-slate-700 font-medium rounded-sm shadow-inner placeholder:text-slate-400" />
                                                        <button onClick={() => setColors(colors.filter(x => x.id !== c.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center shadow-md hover:bg-red-600 hover:scale-110 transition-transform"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-2 bg-slate-50 pt-1 shrink-0 border-t border-slate-100">
                                                <button onClick={() => setColors([...colors, {id: Date.now(), hex: '#FFFFFF', role: ''}])} className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 bg-white hover:bg-slate-100 text-[9px] font-bold rounded-sm flex items-center justify-center gap-1 shadow-sm uppercase"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah Warna</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Accordion: Parameter Eksekusi Cepat Bawah Sidebar */}
                                <div className="grid grid-cols-3 gap-2 shrink-0 border-t border-slate-200/60 pt-3 mt-1">
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Quantity</label>
                                        <input type="number" min="1" max="50" value={params.qty} onChange={e => setParams({...params, qty: e.target.value})} className="w-full text-xs py-1.5 px-2 border border-gray-300 rounded bg-white text-center font-bold focus:ring-2 focus:ring-[#C8D100] outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Worker</label>
                                        <input type="number" min="1" max="10" value={params.worker} onChange={e => setParams({...params, worker: e.target.value})} className="w-full text-xs py-1.5 px-2 border border-gray-300 rounded bg-white text-center font-bold focus:ring-2 focus:ring-[#C8D100] outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Delay</label>
                                        <input type="number" min="0" max="10" value={params.delay} onChange={e => setParams({...params, delay: e.target.value})} className="w-full text-xs py-1.5 px-2 border border-gray-300 rounded bg-white text-center font-bold focus:ring-2 focus:ring-[#C8D100] outline-none transition-all shadow-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PANEL STATS BAWAH */}
                    <div className="shrink-0 p-3 lg:p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3 lg:gap-4 z-10">
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm transition-all overflow-hidden">
                            <div className="grid grid-cols-3 gap-0 border-b border-gray-100 p-2 bg-gray-50">
                                <div className="flex flex-col items-center justify-center border border-[#C8D100]/20 rounded-lg bg-[#C8D100]/5 py-1.5 shadow-sm transition-all">
                                    <div className="flex items-center gap-1 mb-1 text-[#898F00]"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <span className="text-xs font-medium uppercase leading-none">Selected</span></div>
                                    <span className="text-xs font-black text-[#898F00] tabular-nums">{displaySelected}</span>
                                </div>
                                <div className="mx-1.5 flex flex-col items-center justify-center border border-green-200 rounded-lg bg-green-50 py-1.5 shadow-sm transition-all">
                                    <div className="flex items-center gap-1 mb-1 text-green-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> <span className="text-xs font-medium uppercase leading-none">Completed</span></div>
                                    <span className="text-xs font-black text-green-700 tabular-nums">{successCount}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center border border-red-200 rounded-lg bg-red-50 py-1.5 shadow-sm transition-all">
                                    <div className="flex items-center gap-1 mb-1 text-red-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> <span className="text-xs font-medium uppercase leading-none">Failed</span></div>
                                    <span className="text-xs font-black text-red-700 tabular-nums">{failedCount}</span>
                                </div>
                            </div>
                            <div className="p-2 bg-white flex items-center justify-between gap-3">
                                <button onClick={confirmClearAll} disabled={cards.length === 0 || isGenerating} className="flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold uppercase tracking-wide rounded border transition-colors bg-red-50 text-red-600 border-red-200 hover:bg-red-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> CLEAR ALL KARTU
                                </button>
                            </div>
                        </div>

                        {/* Tombol Eksekusi Aksi */}
                        <div className="flex gap-1.5 h-10">
                            <button onClick={handleStartGeneration} disabled={!promptInput.trim() && cards.length === 0} className={`flex-1 text-xs font-bold rounded-lg border-none flex items-center justify-center gap-2 uppercase tracking-wide truncate transition-all ${isGenerating ? 'bg-[#C8D100]/10 border-transparent shadow-none cursor-default' : promptInput.trim() || cards.length > 0 ? 'bg-[#C8D100] hover:bg-[#898F00] text-slate-900 shadow hover:-translate-y-0.5' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                {isGenerating ? (
                                    <><svg className="animate-spin w-4 h-4 text-[#C8D100]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg> <span className="text-[#C8D100]">Memproses...</span></>
                                ) : (
                                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg> <span className="text-slate-900">GENERATE</span></>
                                )}
                            </button>
                            
                            <button onClick={handleTogglePause} disabled={!isGenerating && !isPaused} className={`w-10 flex items-center justify-center rounded-lg border shadow-sm transition-all active:scale-95 shrink-0 ${isGenerating && !isPaused ? 'bg-amber-100 border-amber-300 text-amber-600 hover:bg-amber-200 hover:-translate-y-0.5' : isPaused ? 'bg-green-600 text-white border-green-700 hover:bg-green-700 hover:-translate-y-0.5' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                {isPaused ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>}
                            </button>
                            
                            <button onClick={handleExportZip} disabled={successCount === 0 || isGenerating} className={`flex-1 text-xs font-bold rounded-lg border shadow transition-colors flex items-center justify-center gap-2 uppercase tracking-wide truncate ${successCount > 0 && !isGenerating ? 'bg-green-600 text-white border-green-700 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-80'}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> <span className="truncate">EKSPOR ZIP</span>
                            </button>
                        </div>
                    </div>
                </aside>

                {/* KANAN: PANEL HASIL */}
                <section className="flex-1 flex flex-col lg:overflow-hidden relative min-h-0 bg-slate-100">
                    <div className="bg-white border-b border-slate-200 p-3 flex justify-between items-center shrink-0 shadow-sm z-10">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {[50, 100, 150, 200, 250].map(sz => (
                                <button key={sz} onClick={() => {setItemsPerPage(sz); setCurrentPage(1);}} className={`px-2 py-1 rounded border transition ${itemsPerPage === sz ? 'bg-[#C8D100]/10 text-[#898F00] border-[#C8D100]/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200'}`}>{sz}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500">Hal {currentPage} / {totalPages}</span>
                            <div className="flex gap-1">
                                <button onClick={() => setCurrentPage(p => p-1)} disabled={currentPage === 1} className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                                <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-4 lg:overflow-y-auto custom-scroll pb-20 lg:pb-4">
                        <div className="grid gap-4 items-start" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'}}>
                            {cards.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center text-center w-full h-full min-h-[50vh]">
                                    <div className="w-20 h-20 bg-[#C8D100]/5 border border-[#C8D100]/20 text-[#C8D100]/60 rounded-full flex items-center justify-center mb-4">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">Belum Ada Antrean</h3>
                                    <p className="text-slate-500 text-sm max-w-md">Masukkan prompt di panel pengaturan, atur kuantitas, dan tekan GENERATE.</p>
                                </div>
                            ) : (
                                paginatedCards.map((card) => {
                                    const isDone = card.status === 'done';
                                    const statusColor = card.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                    card.status === 'processing' ? 'bg-[#C8D100]/10 text-[#898F00] border-[#C8D100]/20' : 
                                                    card.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200';
                                    
                                    return (
                                        <div key={card.id} className={`bg-white hover:shadow-md rounded-lg shadow-sm border flex flex-col transition-all duration-300 ${card.status === 'processing' ? 'border-[#C8D100] ring-2 ring-[#C8D100]/20' : card.status === 'failed' ? 'border-red-300' : 'border-slate-200'}`}>
                                            <div className="grid grid-cols-4 gap-1.5 p-2 bg-[#C8D100]/5 border-b border-[#C8D100]/10 rounded-t-lg shrink-0">
                                                <button onClick={() => setPreviewModal({isOpen: true, code: card.code, mode: 'desktop', id: card.id})} disabled={!isDone} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-white border-[#C8D100]/20 text-[#898F00] hover:bg-[#C8D100]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> <span className="text-[10px] font-bold uppercase tracking-tight truncate">PREV</span>
                                                </button>
                                                <button onClick={() => copyCode(card.code)} disabled={!isDone} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-white border-[#C8D100]/20 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span className="text-[10px] font-bold uppercase tracking-tight truncate">COPY</span>
                                                </button>
                                                <button onClick={() => setEditModal({isOpen: true, id: card.id, code: card.code, history: [card.code], historyIndex: 0, tab: 'code', instruction: '', isRevising: false})} disabled={!isDone} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-amber-50 border-amber-200 text-amber-600 hover:brightness-95 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> <span className="text-[10px] font-bold uppercase tracking-tight truncate">EDIT</span>
                                                </button>
                                                <button onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))} disabled={card.status === 'processing'} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-white border-[#C8D100]/20 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> <span className="text-[10px] font-bold uppercase tracking-tight truncate">DEL</span>
                                                </button>
                                            </div>
                                            
                                            <div className="p-2 border-b border-slate-100 flex justify-between items-center gap-2 shrink-0 bg-white">
                                                <p className="text-[11px] font-bold text-slate-800 truncate" title={card.title}>{card.title}</p>
                                                <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded border whitespace-nowrap ${statusColor}`}>{card.status.toUpperCase()}</span>
                                            </div>

                                            <div className="p-2 flex gap-2 h-[150px] bg-white rounded-b-lg relative">
                                                <div className="flex-1 rounded-lg overflow-hidden bg-slate-50 relative flex items-center justify-center border border-slate-200 cursor-pointer group" onClick={() => isDone && setPreviewModal({isOpen: true, code: card.code, mode: 'desktop', id: card.id})}>
                                                    {isDone ? (
                                                        <>
                                                            <div className="absolute inset-0 w-full h-full bg-transparent"><iframe srcDoc={card.code} className="absolute inset-0 w-full h-full border-none pointer-events-none scale-[0.35] origin-top-left" style={{width: '285%', height: '285%'}} scrolling="no"></iframe></div>
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-all flex items-center justify-center"><svg className="text-white w-8 h-8 drop-shadow-lg opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>
                                                        </>
                                                    ) : card.status === 'failed' ? (
                                                        <div className="p-2 text-center text-red-500"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><div className="text-[8px] font-bold break-words px-2 leading-tight">{card.error || 'Gagal'}</div></div>
                                                    ) : card.status === 'processing' ? (
                                                        <div className="flex flex-col items-center text-[#C8D100]"><svg className="animate-spin w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg></div>
                                                    ) : (
                                                        <div className="text-slate-400"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 flex flex-col overflow-hidden">
                                                    <div className="p-1 border-b border-slate-200 bg-slate-100 sticky top-0 shrink-0">
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-center">HTML Code</span>
                                                    </div>
                                                    <div className="p-1.5 overflow-y-auto custom-scroll flex-1 bg-white">
                                                        {card.status === 'processing' || (!card.code && card.status !== 'failed') ? (
                                                            <p className="text-[12px] text-slate-500 font-bold tracking-wide text-center h-full flex items-center justify-center">Memproses<span className="dot-anim inline-block w-4 text-left"></span></p>
                                                        ) : card.code ? (
                                                            <pre className="text-[7px] text-slate-700 font-mono leading-tight whitespace-pre-wrap break-words"><code>{card.code.substring(0, 300)}...</code></pre>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* Modal Preview Full Layar */}
            {previewModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 p-2 sm:p-4 md:p-8 backdrop-blur-sm transition-opacity" onClick={() => setPreviewModal(prev => ({...prev, isOpen: false}))}>
                    <div className="relative flex flex-col w-full h-full max-w-5xl mx-auto transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewModal(prev => ({...prev, isOpen: false}))} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 hover:scale-110 transition-transform z-[110]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        </button>
                        <div className="bg-white shadow-2xl flex flex-col rounded-xl overflow-hidden w-full h-full relative">
                            <div className="bg-white p-3 border-b border-slate-200 shrink-0">
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full h-[40px] border border-slate-200">
                                    <button onClick={() => setPreviewModal(prev => ({...prev, mode: 'desktop'}))} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${previewModal.mode === 'desktop' ? 'bg-white text-[#898F00] shadow-sm border border-[#C8D100]/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> PC
                                    </button>
                                    <button onClick={() => setPreviewModal(prev => ({...prev, mode: 'mobile'}))} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${previewModal.mode === 'mobile' ? 'bg-white text-[#898F00] shadow-sm border border-[#C8D100]/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> HP
                                    </button>
                                    <button onClick={() => { const blob = new Blob([previewModal.code], { type: 'text/html' }); window.open(URL.createObjectURL(blob), '_blank'); }} className="flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> BUKA TAB BARU
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 w-full bg-slate-200 p-4 flex items-center justify-center overflow-hidden">
                                <iframe srcDoc={previewModal.code} className="bg-white shadow-lg h-full border-none rounded-md transition-all duration-300" style={{width: previewModal.mode === 'mobile' ? '375px' : '100%'}} sandbox="allow-scripts allow-same-origin"></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit & Revisi AI */}
            {editModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 p-2 sm:p-4 md:p-8 backdrop-blur-sm transition-opacity" onClick={() => setEditModal(prev => ({...prev, isOpen: false}))}>
                    <div className="relative flex flex-col w-full h-full max-w-4xl mx-auto transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-end mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <button onClick={() => { if(editModal.historyIndex > 0) setEditModal(p => ({...p, historyIndex: p.historyIndex - 1, code: p.history[p.historyIndex - 1]})); }} disabled={editModal.historyIndex <= 0} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
                                <button onClick={() => { if(editModal.historyIndex < editModal.history.length - 1) setEditModal(p => ({...p, historyIndex: p.historyIndex + 1, code: p.history[p.historyIndex + 1]})); }} disabled={editModal.historyIndex >= editModal.history.length - 1} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg></button>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditModal(prev => ({...prev, isOpen: false}))} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition shadow-md">Batal</button>
                                <button onClick={handleEditSave} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-900 bg-[#C8D100] hover:bg-[#898F00] shadow-md transition">Simpan Edit</button>
                            </div>
                        </div>
                        <div className="bg-white shadow-2xl flex flex-col rounded-xl overflow-hidden w-full h-full relative">
                            {editModal.isRevising && (
                                <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
                                    <svg className="animate-spin w-10 h-10 text-[#C8D100] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                                    <p className="text-sm font-bold text-slate-700 tracking-wider">AI sedang merevisi kode...</p>
                                </div>
                            )}
                            <div className="bg-white p-3 border-b border-slate-200 shrink-0">
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full h-[40px] border border-slate-200">
                                    <button onClick={() => setEditModal(prev => ({...prev, tab: 'code'}))} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${editModal.tab === 'code' ? 'bg-white text-[#898F00] shadow-sm border border-[#C8D100]/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><span>Kode</span>
                                    </button>
                                    <button onClick={() => setEditModal(prev => ({...prev, tab: 'preview'}))} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${editModal.tab === 'preview' ? 'bg-white text-[#898F00] shadow-sm border border-[#C8D100]/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Preview</span>
                                    </button>
                                </div>
                            </div>
                            <div className="p-3 w-full bg-white flex-1 flex flex-col min-h-0 relative">
                                {editModal.tab === 'code' ? (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="flex-1 w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg overflow-hidden relative">
                                            <textarea spellCheck="false" value={editModal.code} onChange={e => {
                                                const val = e.target.value;
                                                let newHist = editModal.history.slice(0, editModal.historyIndex + 1);
                                                newHist.push(val);
                                                setEditModal(p => ({...p, code: val, history: newHist, historyIndex: newHist.length - 1}));
                                            }} className="absolute inset-0 w-full h-full bg-transparent text-slate-700 font-mono text-[10px] sm:text-[11px] p-4 outline-none resize-none custom-scroll leading-relaxed"></textarea>
                                        </div>
                                        <div className="mt-[12px] h-[44px] w-full bg-white border border-[#C8D100] rounded-lg px-2 flex items-center gap-2 shrink-0 shadow-sm relative z-10 box-border">
                                            <input type="text" value={editModal.instruction} onChange={e => setEditModal(p => ({...p, instruction: e.target.value}))} onKeyDown={e => e.key === 'Enter' && handleRevisiAI()} placeholder="Instruksi revisi ke AI (Misal: 'Ubah warna tombol jadi merah')..." className="flex-1 bg-transparent text-xs text-slate-700 outline-none px-2 placeholder:text-slate-400 h-full" />
                                            <button onClick={handleRevisiAI} className="w-[28px] h-[28px] shrink-0 flex items-center justify-center rounded-md bg-[#C8D100] text-slate-900 hover:bg-[#898F00] transition-colors shadow-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full bg-slate-200 border border-slate-300 rounded-lg p-2 overflow-y-auto custom-scroll">
                                        <iframe srcDoc={editModal.code} className="w-full min-h-full bg-white shadow-sm border-none rounded block" sandbox="allow-scripts allow-same-origin"></iframe>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirm Dialog */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm flex flex-col items-center text-center">
                        <div className="bg-red-100 text-red-600 p-3 rounded-full mb-3"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                        <h3 className="text-lg font-bold text-slate-800">{confirmModal.title}</h3>
                        <p className="text-sm text-slate-600 mt-2 mb-6" dangerouslySetInnerHTML={{__html: confirmModal.desc}}></p>
                        <div className="flex w-full gap-3">
                            <button onClick={() => setConfirmModal({isOpen: false})} className="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded hover:bg-slate-300 transition text-xs shadow-sm">Batal</button>
                            <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({isOpen: false}); }} className="flex-1 bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 transition shadow-sm text-xs">Ya</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Alert Box */}
            {alertModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm flex flex-col items-center text-center">
                        <div className="bg-amber-100 text-amber-600 p-3 rounded-full mb-3"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                        <h3 className="text-lg font-bold text-slate-800">{alertModal.title}</h3>
                        <p className="text-sm text-slate-600 mt-2 mb-6">{alertModal.desc}</p>
                        <button onClick={() => setAlertModal({isOpen: false})} className="w-full bg-[#C8D100] text-slate-900 font-bold py-2 rounded-lg hover:bg-[#898F00] transition shadow-sm">Tutup</button>
                    </div>
                </div>
            )}

        </div>
    );
}
