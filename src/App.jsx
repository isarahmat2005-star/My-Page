import React, { useState, useEffect, useRef } from 'react';
import { FONTS, ASPECT_RATIOS } from './constants.js';
import { 
    CustomSpinner, CheckCircleIcon, XCircleIcon, TrashIcon, 
    SparklesIcon, PlayIcon, PauseIcon, DownloadIcon, 
    EyeIcon, CopyIcon, AlertTriangleIcon, ChevronDownIcon, 
    SettingsIcon, UndoIcon, RedoIcon, SendIcon, ImageIcon,
    ExternalLinkIcon, SmartphoneIcon, MonitorIcon, PlusIcon,
    PaletteIcon, LinkIcon, ShoppingCartIcon, CopyrightIcon,
    CodeIcon, TypeIcon, EditIcon, FileTextIcon, ClockIcon,
    UserIcon, LogOutIcon
} from './icons.jsx';
import { callGeminiApiViaProxy, downloadZipFiles, copyToClipboard } from './utils.js';

// =====================================================================
// === KONFIGURASI GOOGLE APPS SCRIPT (SATPAM LOGIN) ===
// Ganti dengan URL Deployment Web App GAS Anda sendiri.
// =====================================================================
const GAS_AUTH_URL = "https://script.google.com/macros/s/AKfycbwSrRoGVoqdgSEHWWvtYHSiiYhr1KRRTiXAOKo5vMHTl1N7W8-0S5FXqMUt2t3VkQ2L-w/exec";

// --- INDEXED DB: UNTUK DEVICE ID & AUTO-SAVE KARTU HASIL GENERATE ---
const META_STORE_NAME = 'meta_store';
const CARDS_STORE_NAME = 'cards_store';

const initMetaDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PageAiMetaDB', 1);
        request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(META_STORE_NAME)) {
                db.createObjectStore(META_STORE_NAME, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(CARDS_STORE_NAME)) {
                db.createObjectStore(CARDS_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// --- HELPER CRUD: DEVICE ID ---
const saveDeviceIdToDB = async (id) => {
    try {
        const db = await initMetaDB();
        const tx = db.transaction(META_STORE_NAME, 'readwrite');
        tx.objectStore(META_STORE_NAME).put({ key: 'device_id', value: id });
    } catch (err) { console.error('Gagal simpan device id ke IndexedDB:', err); }
};
const loadDeviceIdFromDB = () => {
    return new Promise(async (resolve) => {
        try {
            const db = await initMetaDB();
            const tx = db.transaction(META_STORE_NAME, 'readonly');
            const req = tx.objectStore(META_STORE_NAME).get('device_id');
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => resolve(null);
        } catch (err) { resolve(null); }
    });
};

// --- HELPER CRUD: KARTU HASIL GENERATE (kode HTML) ---
const saveCardToDB = async (card) => {
    try {
        const db = await initMetaDB();
        const tx = db.transaction(CARDS_STORE_NAME, 'readwrite');
        tx.objectStore(CARDS_STORE_NAME).put(card);
    } catch (err) { console.error('Gagal simpan card:', err); }
};
const loadCardsFromDB = () => {
    return new Promise(async (resolve) => {
        try {
            const db = await initMetaDB();
            const tx = db.transaction(CARDS_STORE_NAME, 'readonly');
            const req = tx.objectStore(CARDS_STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        } catch (err) { resolve([]); }
    });
};
const deleteCardFromDB = async (id) => {
    try {
        const db = await initMetaDB();
        const tx = db.transaction(CARDS_STORE_NAME, 'readwrite');
        tx.objectStore(CARDS_STORE_NAME).delete(id);
    } catch (err) { console.error('Gagal hapus card:', err); }
};
const clearCardsFromDB = async () => {
    try {
        const db = await initMetaDB();
        const tx = db.transaction(CARDS_STORE_NAME, 'readwrite');
        tx.objectStore(CARDS_STORE_NAME).clear();
    } catch (err) { console.error('Gagal clear cards:', err); }
};

// --- LABEL PERANGKAT (dikirim ke GAS supaya user bisa lihat device mana saja yang login) ---
const getDeviceLabel = () => {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('OPR')) browser = 'Opera';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

    let os = 'Unknown OS';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'Mac';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} - ${os}`;
};

export default function App() {
    const [currentTime, setCurrentTime] = useState(new Date());

    // --- AUTH STATE ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginState, setLoginState] = useState('idle'); // idle | loading | success | failed
    const [deviceId, setDeviceId] = useState('');
    const [showFullEmail, setShowFullEmail] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    // --- TOAST STATE ---
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const getMaskedEmail = (email) => {
        if (!email) return '';
        const [name, domain] = email.split('@');
        if (!domain) return email;
        return '*'.repeat(name.length) + '@' + domain;
    };

    // UI Panels State
    const [openPanel, setOpenPanel] = useState(null); // 'fontPanel', 'colorPanel', etc.
    const [openFontDropdown, setOpenFontDropdown] = useState(null);
    
    // Form Inputs State
    const [promptInput, setPromptInput] = useState('');
    const [extraInstructions, setExtraInstructions] = useState('');
    
    // Fonts State
    const [currentFonts, setCurrentFonts] = useState({ all: 'Inter', judul: 'None', subjudul: 'None', isi: 'None', tombol: 'None' });
    
    // Colors State
    const [colorRows, setColorRows] = useState([
        { id: 1, hex: '#C8D100', label: 'Warna Utama (Primary/Tombol)' },
        { id: 2, hex: '#898F00', label: 'Warna Sekunder (Hover/Aksen)' }
    ]);
    
    // Internal Images State
    const [imgIntQty, setImgIntQty] = useState(0);
    const [imgIntRatio, setImgIntRatio] = useState('auto');
    
    // External Images State
    const [imgExtRows, setImgExtRows] = useState([]);
    
    // Social Media State
    const [medsosRows, setMedsosRows] = useState([]);
    
    // Checkout Links State
    const [checkoutRows, setCheckoutRows] = useState([]);
    
    // Footer Copyright State
    const [hasCopyright, setHasCopyright] = useState(false);
    const [copyrightName, setCopyrightName] = useState('');
    
    // Other Settings State
    const [chkBioLink, setChkBioLink] = useState(false);
    const [chkDarkMode, setChkDarkMode] = useState(false);
    const [chkResponsive, setChkResponsive] = useState(true);
    
    // Generation Settings State
    const [qty, setQty] = useState(5);
    const [workerCount, setWorkerCount] = useState(5);
    const [delaySec, setDelaySec] = useState(3);
    const [zipName, setZipName] = useState('');

    // Queue and Cards State
    const [cardsState, setCardsState] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    
    // Pagination
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Modals and Global UI
    const [previewCard, setPreviewCard] = useState(null);
    const [previewDevice, setPreviewDevice] = useState('desktop');
    
    const [editCardId, setEditCardId] = useState(null);
    const [editCodeArea, setEditCodeArea] = useState('');
    const [editChatInput, setEditChatInput] = useState('');
    const [editHistoryStack, setEditHistoryStack] = useState([]);
    const [editHistoryIndex, setEditHistoryIndex] = useState(-1);
    const [editTab, setEditTab] = useState('code');
    const [isEditingRevising, setIsEditingRevising] = useState(false);

    const [alertData, setAlertData] = useState(null);
    const [confirmData, setConfirmData] = useState(null);

    // Refs
    const cardsStateRef = useRef([]);
    const isPausedRef = useRef(false);
    const isGeneratingRef = useRef(false);
    const abortControllerRef = useRef(null);
    const cardsSyncTimeout = useRef(null);

    useEffect(() => { cardsStateRef.current = cardsState; }, [cardsState]);
    
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- AUTO-SIMPAN cardsState KE INDEXEDDB (debounce 800ms, hanya kalau sudah login) ---
    useEffect(() => {
        if (!isAuthenticated) return;
        clearTimeout(cardsSyncTimeout.current);
        cardsSyncTimeout.current = setTimeout(() => {
            cardsState.forEach(c => saveCardToDB(c));
        }, 800);
    }, [cardsState, isAuthenticated]);

    const loadInitialData = async () => {
        const savedCards = await loadCardsFromDB();
        if (savedCards.length > 0) {
            const cleaned = savedCards.map(c => c.status === 'processing' ? { ...c, status: 'pending' } : c);
            setCardsState(cleaned);
        }
    };

    // --- INIT AUTH & DEVICE ID (dijalankan sekali saat app dibuka) ---
    useEffect(() => {
        const initAuth = async () => {
            let currentDeviceId = localStorage.getItem('pageai_device_id');
            const dbDeviceId = await loadDeviceIdFromDB();

            if (!currentDeviceId && dbDeviceId) {
                currentDeviceId = dbDeviceId;
                localStorage.setItem('pageai_device_id', currentDeviceId);
            } else if (!currentDeviceId) {
                currentDeviceId = 'dev_' + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('pageai_device_id', currentDeviceId);
            }
            saveDeviceIdToDB(currentDeviceId);
            setDeviceId(currentDeviceId);

            if (navigator.storage && navigator.storage.persist) {
                navigator.storage.persist().catch(() => {});
            }

            const session = localStorage.getItem('pageai_session');
            if (session) {
                const parsedSession = JSON.parse(session);
                setIsAuthenticated(true);
                setAuthEmail(parsedSession.email);
                loadInitialData();
            }
        };
        initAuth();
    }, []);

    const handleLogin = async () => {
        if (!loginEmail.trim() || !loginPassword.trim()) {
            showToast("Masukkan email dan password terlebih dahulu", "error");
            return;
        }

        setLoginState('loading');

        try {
            const res = await fetch(GAS_AUTH_URL, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'login',
                    email: loginEmail,
                    password: loginPassword,
                    deviceId: deviceId,
                    deviceLabel: getDeviceLabel()
                })
            });

            const data = await res.json();
            if (data.success) {
                setLoginState('success');
                showToast("Selamat Datang Kembali", "success");
                localStorage.setItem('pageai_session', JSON.stringify({ email: loginEmail }));
                setAuthEmail(loginEmail);
                setTimeout(() => {
                    setIsAuthenticated(true);
                    loadInitialData();
                }, 800);
            } else {
                setLoginState('failed');
                showToast(data.message || "Gagal Login", "error");
                setTimeout(() => setLoginState('idle'), 1500);
            }
        } catch (err) {
            setLoginState('failed');
            showToast("Koneksi gagal. Cek internet atau URL Satpam.", "error");
            setTimeout(() => setLoginState('idle'), 1500);
        }
    };

    const handleLogout = () => {
        fetch(GAS_AUTH_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'logout', email: authEmail, deviceId })
        }).catch(err => console.error("Gagal mengirim sinyal logout ke GAS:", err));

        localStorage.removeItem('pageai_session');
        setIsAuthenticated(false);
        setAuthEmail('');
        setCardsState([]);
        window.location.reload();
    };

    const forceLogoutFromRemote = () => {
        localStorage.removeItem('pageai_session');
        setIsAuthenticated(false);
        setAuthEmail('');
        setCardsState([]);
        showToast("Device ini telah dihapus dari akun. Anda logout otomatis.", "error");
        setTimeout(() => window.location.reload(), 1500);
    };

    // --- CEK SESI TIAP 20 DETIK: kalau device di-hapus dari akun, auto logout ---
    useEffect(() => {
        if (!isAuthenticated || !authEmail || !deviceId) return;

        const SESSION_CHECK_INTERVAL_MS = 20000;

        const intervalId = setInterval(async () => {
            try {
                const res = await fetch(GAS_AUTH_URL, {
                    method: 'POST',
                    mode: 'cors',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'check_session', email: authEmail, deviceId })
                });
                const data = await res.json();
                if (data.success && data.active === false) {
                    forceLogoutFromRemote();
                }
            } catch (err) {
                console.error('Gagal cek status sesi:', err);
            }
        }, SESSION_CHECK_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [isAuthenticated, authEmail, deviceId]);

    const timeString = currentTime.toLocaleTimeString('id-ID', { hour12: false });
    const dateString = currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const toggleAccordion = (panelName) => {
        setOpenPanel(openPanel === panelName ? null : panelName);
    };

    const handleFontSelect = (target, fontId) => {
        setCurrentFonts(prev => {
            const newFonts = { ...prev, [target]: fontId };
            if (target === 'all') {
                if (fontId !== 'None') {
                    newFonts.judul = 'None'; newFonts.subjudul = 'None'; newFonts.isi = 'None'; newFonts.tombol = 'None';
                }
            }
            return newFonts;
        });
        setOpenFontDropdown(null);
    };

    const handleColorChange = (id, newHex, newLabel) => {
        setColorRows(prev => prev.map(row => {
            if (row.id === id) {
                let validHex = newHex;
                if (!validHex.startsWith('#')) validHex = '#' + validHex;
                return { ...row, hex: validHex, label: newLabel !== undefined ? newLabel : row.label };
            }
            return row;
        }));
    };

    const getActiveFontsStr = () => {
        let imports = new Set();
        let rules = [];
        
        if(currentFonts.all !== 'None') {
            imports.add(currentFonts.all.replace(/ /g, '+'));
            rules.push(`- Aturan Dasar: Terapkan 'font-family: ${currentFonts.all}, sans-serif;' di body/elemen induk.`);
        } else {
            if(currentFonts.judul !== 'None') { imports.add(currentFonts.judul.replace(/ /g, '+')); rules.push(`- KHUSUS UNTUK SEMUA TAG HEADING (h1, h2, h3): Wajib gunakan 'font-family: ${currentFonts.judul}, sans-serif;'`); }
            if(currentFonts.subjudul !== 'None') { imports.add(currentFonts.subjudul.replace(/ /g, '+')); rules.push(`- KHUSUS UNTUK SUB-JUDUL: Wajib gunakan 'font-family: ${currentFonts.subjudul}, sans-serif;'`); }
            if(currentFonts.isi !== 'None') { imports.add(currentFonts.isi.replace(/ /g, '+')); rules.push(`- KHUSUS UNTUK PARAGRAF TEKS (<p>): Wajib gunakan 'font-family: ${currentFonts.isi}, sans-serif;'`); }
            if(currentFonts.tombol !== 'None') { imports.add(currentFonts.tombol.replace(/ /g, '+')); rules.push(`- KHUSUS UNTUK TOMBOL (CTA): Wajib gunakan 'font-family: ${currentFonts.tombol}, sans-serif;'`); }
        }

        if(rules.length === 0) return "";
        let r = `\nTIPOGRAFI MUTLAK:\n`;
        imports.forEach(imp => r += `- Import dari Google Fonts: <link href="https://fonts.googleapis.com/css2?family=${imp}&display=swap" rel="stylesheet">\n`);
        return r + rules.join("\n") + "\n";
    };

    const getActiveColorsStr = () => {
        let rules = [];
        colorRows.forEach(row => {
            const role = row.label.trim();
            if(role) rules.push(`- [Wajib untuk: ${role}]: ${row.hex}`);
            else rules.push(`- [Kombinasi Bebas (Terapkan di area manapun yang cocok)]: ${row.hex}`);
        });
        if(rules.length === 0) return "";
        return `\nPALET WARNA MUTLAK (Gunakan utility Tailwind arbitrary seperti bg-[${rules[0].split(']: ')[1]}] dsb):\n${rules.join("\n")}\n`;
    };

    const startGeneration = async () => {
        if (isGeneratingRef.current) return;
        
        let newCards = [];
        if (!isPausedRef.current && cardsState.filter(c => c.status === 'pending').length === 0) {
            if(!promptInput.trim()) return;

            let currentZipName = zipName;
            if(!currentZipName.trim()) {
                currentZipName = promptInput.split(' ').slice(0, 4).join('-').replace(/[^a-zA-Z0-9-]/g, '') || 'Hasil-Landing-Page';
                setZipName(currentZipName);
            }

            let aiPrompt = `Topik Utama/Deskripsi: "${promptInput.trim()}".\n`;
            if (extraInstructions.trim()) aiPrompt += `INSTRUKSI KHUSUS PENGGUNA (WAJIB DIIKUTI): ${extraInstructions.trim()}\n`;
            
            aiPrompt += getActiveFontsStr();
            aiPrompt += getActiveColorsStr();

            const intQty = parseInt(imgIntQty) || 0;
            if (intQty > 0) {
                let pSize = '800/800';
                if(imgIntRatio === '16:9') pSize = '1280/720'; else if(imgIntRatio === '9:16') pSize = '720/1280';
                else if(imgIntRatio === '4:3') pSize = '1024/768'; else if(imgIntRatio === '3:4') pSize = '768/1024';
                aiPrompt += `\nGAMBAR INTERNAL (AUTO): Sisipkan tepat ${intQty} elemen gambar <img src="https://picsum.photos/${pSize}?random=\${Math.random()}" class="w-full object-cover"> di bagian yang relevan.\n`;
            }

            if (chkDarkMode) aiPrompt += `\nDARK MODE: Sediakan tombol toggle Dark/Light mode fungsional. Gunakan class 'dark:' Tailwind.\n`;
            if (chkBioLink) aiPrompt += `\nSTRUKTUR MINI PAGE: Rancang layout gaya Biolink (max-w-md mx-auto) berpusat.\n`;
            if (chkResponsive) aiPrompt += `\nRESPONSIF MUTLAK: Gunakan class (sm:, md:, lg:) agar layout sempurna di PC dan Mobile.\n`;
            
            if(checkoutRows.length > 0) {
                let rules = checkoutRows.map(row => `- Tombol CTA "${row.text || 'Checkout'}" arahkan ke URL: ${row.url || '#'}`);
                aiPrompt += `\nLINK CHECKOUT UTAMA:\n${rules.join("\n")}\n`;
            }

            if (hasCopyright) {
                aiPrompt += `\nFOOTER: Sisipkan Teks Hak Cipta di bagian paling bawah: "© ${new Date().getFullYear()} ${copyrightName || 'Perusahaan Anda'}"\n`;
            }

            if(medsosRows.length > 0) {
                let rules = medsosRows.map(row => {
                    if(row.type === 'Lainnya') return `- Tautan untuk ${row.desc || 'Link Lainnya'}: ${row.url || '#'}`;
                    return `- Tautan Icon ${row.type}: ${row.url || '#'}`;
                });
                aiPrompt += `\nTAUTAN MEDSOS/EKSTERNAL:\n${rules.join("\n")}\n`;
            }

            if(imgExtRows.length > 0) {
                let rules = imgExtRows.map(row => {
                    if(row.url) return `- MASUKKAN GAMBAR INI: <img src="${row.url}"> (Penempatan: ${row.desc || 'Gambar illustrasi'})`;
                    return null;
                }).filter(Boolean);
                if(rules.length > 0) aiPrompt += `\nGAMBAR EKSTERNAL WAJIB:\n${rules.join("\n")}\n`;
            }

            const targetQty = parseInt(qty) || 5;
            for(let i=0; i<targetQty; i++) {
                newCards.push({ id: 'card_' + Date.now() + Math.random().toString(36).substr(2, 5), title: `Variasi Landing Page ${i+1}`, prompt: aiPrompt, code: '', status: 'pending', error: null });
            }
            
            setCardsState(prev => [...newCards, ...prev]);
            setCurrentPage(1);
        }

        setIsGenerating(true);
        setIsPaused(false);
        isGeneratingRef.current = true;
        isPausedRef.current = false;
        abortControllerRef.current = new AbortController();

        const delayMs = (parseInt(delaySec) || 0) * 1000;
        const workers = [];
        const signal = abortControllerRef.current.signal;
        const pendingCount = newCards.length > 0 ? newCards.length : cardsState.filter(c => c.status === 'pending').length;
        const wCount = parseInt(workerCount) || 5;
        const concurrency = Math.min(wCount, pendingCount);

        for (let w = 0; w < concurrency; w++) {
            workers.push((async () => {
                if (w > 0 && delayMs > 0 && !isPausedRef.current) await new Promise(r => setTimeout(r, delayMs * w));
                
                while (!isPausedRef.current) {
                    let taskIndex = -1;
                    let task = null;
                    
                    for(let i=0; i < cardsStateRef.current.length; i++) {
                        if(cardsStateRef.current[i].status === 'pending') {
                            taskIndex = i;
                            task = cardsStateRef.current[i];
                            break;
                        }
                    }

                    if (!task || taskIndex === -1) break; 
                    
                    setCardsState(prev => prev.map(c => c.id === task.id ? { ...c, status: 'processing' } : c));
                    
                    try {
                        let systemInstruction = `LAPIS 1: ELITE FRONT-END ARCHITECT\nAnda adalah Elite Web Architect. Rancang Landing Page murni dalam 1 file HTML memakai Tailwind CSS via CDN.\nDILARANG menggunakan desain template yang membosankan.\nLAPIS 2: ESTETIKA & KUALITAS UI (MUTLAK)\n- Gunakan banyak ruang kosong (padding/margin besar p-6, p-10).\n- SEMUA tombol WAJIB transisi hover. Pastikan rasio kontras teks WCAG.\nLAPIS 3: ATURAN FORMAT & KONTEN (WAJIB DIIKUTI)\n1. DILARANG keras membungkus dengan tag markdown (\`\`\`html). Output murni dari <html> sampai </html> saja.\n2. WAJIB buat tag <title> di dalam <head> yang spesifik, unik, dan relevan.\n3. KOMENTAR KODE: WAJIB sisipkan komentar HTML (<!-- penjelasan -->) yang sangat jelas di setiap blok kode utama (misal: <!-- HEADER START -->, <!-- BAGIAN HERO -->, <!-- FITUR -->, dll) agar pengguna awam mengerti fungsi kode tersebut.\n4. ANTI-COPYRIGHT: DILARANG MENGGUNAKAN NAMA BRAND ASLI/TERKENAL di dunia nyata. Gunakan nama yang UMUM dan GENERIK (misalnya: "Perusahaan Kita", "Produk Anda", "Layanan Terbaik") kecuali pengguna menyebutkan nama spesifik di prompt.`;
                        const payload = { contents: [{ parts: [{ text: task.prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } };
                        
                        const resultHTML = await callGeminiApiViaProxy('gemini-2.5-flash:generateContent', payload);
                        
                        if (!isPausedRef.current) {
                            setCardsState(prev => prev.map(c => c.id === task.id ? { ...c, code: resultHTML, status: 'done' } : c));
                        } else {
                             setCardsState(prev => prev.map(c => c.id === task.id ? { ...c, status: 'pending' } : c));
                        }
                    } catch (err) {
                        if (!isPausedRef.current) {
                            setCardsState(prev => prev.map(c => c.id === task.id ? { ...c, status: 'failed', error: err.message } : c));
                        } else {
                             setCardsState(prev => prev.map(c => c.id === task.id ? { ...c, status: 'pending' } : c));
                        }
                    }
                    if (delayMs > 0 && !isPausedRef.current) await new Promise(r => setTimeout(r, delayMs));
                }
            })());
        }
        await Promise.all(workers);

        if (!isPausedRef.current) {
            setIsGenerating(false);
            isGeneratingRef.current = false;
        }
    };

    const handleTogglePause = () => {
        if (isGenerating && !isPaused) {
            setIsPaused(true);
            isPausedRef.current = true;
            setIsGenerating(false);
            isGeneratingRef.current = false;
            if(abortControllerRef.current) abortControllerRef.current.abort();
            setCardsState(prev => prev.map(c => c.status === 'processing' ? { ...c, status: 'pending' } : c));
        } else if (isPaused) {
            startGeneration();
        }
    };

    const handleClearAll = () => {
        setConfirmData({
            title: "Hapus Semua?",
            desc: "Anda akan menghapus <b>seluruh antrean</b> secara permanen.<br><i>(Input deskripsi akan tetap aman)</i>",
            action: () => {
                if(abortControllerRef.current) abortControllerRef.current.abort();
                setCardsState([]); setIsGenerating(false); setIsPaused(false); setCurrentPage(1);
                isGeneratingRef.current = false; isPausedRef.current = false;
            }
        });
    };

    const handleDownloadZip = async () => {
        const doneCards = cardsState.filter(c => c.status === 'done' && c.code); 
        if(doneCards.length === 0) return;
        setIsZipping(true);
        try {
            await downloadZipFiles(doneCards, zipName);
        } catch (err) {
            setAlertData({ title: "Error ZIP", desc: "Gagal menyusun ZIP: " + err.message });
        } finally {
            setIsZipping(false);
        }
    };

    const handlePublishToVercel = async (card) => {
        setIsPublishing(true);
        try {
            const response = await fetch('/api/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: card.code, id: card.id })
            });
            
            const data = await response.json();
            
            if (response.ok && data.url) {
                window.open(data.url, '_blank');
                showToast("Berhasil di-publish!", "success");
            } else {
                throw new Error(data.error || "Gagal publish");
            }
        } catch (err) {
            setAlertData({ title: "Error Publish", desc: err.message });
        } finally {
            setIsPublishing(false);
        }
    };

    const handleOpenEdit = (card) => {
        setEditCardId(card.id);
        setEditCodeArea(card.code);
        setEditHistoryStack([card.code]);
        setEditHistoryIndex(0);
        setEditChatInput('');
        setEditTab('code');
    };

        const handleEditInput = (e) => {
        const val = e.target.value;
        setEditCodeArea(val);
        const newStack = editHistoryStack.slice(0, editHistoryIndex + 1);
        newStack.push(val);
        setEditHistoryStack(newStack);
        setEditHistoryIndex(newStack.length - 1);
    };

    const undoEdit = () => {
        if (editHistoryIndex > 0) {
            const newIndex = editHistoryIndex - 1;
            setEditHistoryIndex(newIndex);
            setEditCodeArea(editHistoryStack[newIndex]);
        }
    };

    const redoEdit = () => {
        if (editHistoryIndex < editHistoryStack.length - 1) {
            const newIndex = editHistoryIndex + 1;
            setEditHistoryIndex(newIndex);
            setEditCodeArea(editHistoryStack[newIndex]);
        }
    };

    const handleRequestRevisi = async () => {
        if(!editChatInput.trim() || !editCodeArea) return;
        setIsEditingRevising(true);
        try {
            let systemInstruction = `LAPIS 1: ASISTEN BEDAH KODE\nAnda adalah asisten editor kode. Saya beri kode HTML asli dan instruksi perbaikan.\nATURAN MUTLAK: DILARANG merancang ulang dari nol. Modifikasi bagian spesifik saja. Pertahankan 90% struktur asli.\nKembalikan 1 file HTML utuh murni tanpa markdown (\`\`\`html) dan tanpa penjelasan.\nTETAP pertahankan atau tambahkan komentar HTML pada bagian yang Anda ubah agar pengguna paham.`;
            let finalPrompt = `Berikut kode HTML:\n\n${editCodeArea}\n\nInstruksi Revisi: "${editChatInput}"`;
            const payload = { contents: [{ parts: [{ text: finalPrompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } };
            
            const revisedCode = await callGeminiApiViaProxy('gemini-2.5-flash:generateContent', payload);
            
            setEditCodeArea(revisedCode);
            setEditChatInput('');
            const newStack = editHistoryStack.slice(0, editHistoryIndex + 1);
            newStack.push(revisedCode);
            setEditHistoryStack(newStack);
            setEditHistoryIndex(newStack.length - 1);
        } catch (err) {
            setAlertData({ title: "Error AI", desc: "Gagal merevisi kode: " + err.message });
        } finally {
            setIsEditingRevising(false);
        }
    };

    const countPending = cardsState.filter(c => c.status === 'pending' || c.status === 'processing').length;
    const countSuccess = cardsState.filter(c => c.status === 'done').length;
    const countFailed = cardsState.filter(c => c.status === 'failed').length;
    
    let displaySelected = countPending;
    if (!isGenerating && countPending === 0) displaySelected = parseInt(qty) || 0;

    const totalPages = Math.ceil(cardsState.length / itemsPerPage) || 1;
    const paginatedCards = cardsState.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const inputClass = "w-full text-xs p-2 border border-gray-300 rounded bg-slate-50 focus:ring-2 focus:ring-primary outline-none transition-all";

    // --- GATE LOGIN: kalau belum login, tampilkan layar ini saja ---
    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-slate-100 overflow-hidden font-sans" style={{ backgroundImage: 'linear-gradient(rgba(137, 143, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(137, 143, 0, 0.08) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                <style>{`
                    .dot-anim::after { content: ''; animation: dots 1.5s steps(4, end) infinite; }
                    @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } 100% { content: ''; } }
                `}</style>

                {/* TOAST NOTIFICATION LOGIN */}
                <div className={`fixed top-4 right-4 z-[9999] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                    <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        {toast.type === 'error' ? <AlertTriangleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                    </div>
                </div>

                <div className={`flex flex-col items-center justify-center w-full max-w-sm px-4 z-10 transition-all duration-500 ${loginState === 'success' ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}>
                    <div className="w-full bg-white p-6 rounded-lg border border-primary/30 shadow-md flex flex-col gap-4 relative z-10">
                        <div className="text-center mb-2">
                            <h1 className="text-2xl font-bold text-primaryDark tracking-widest">PAGE AI LOGIN</h1>
                        </div>
                        <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && document.getElementById('loginPwd').focus()} className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-center outline-none transition-all h-12 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:bg-slate-100" placeholder="MASUKKAN EMAIL" disabled={loginState === 'loading' || loginState === 'success'} />
                        <input type="password" id="loginPwd" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-center outline-none transition-all h-12 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:bg-slate-100" placeholder="MASUKKAN PASSWORD" disabled={loginState === 'loading' || loginState === 'success'} />
                        <button onClick={handleLogin} disabled={loginState === 'loading' || loginState === 'success'} className="bg-primary hover:bg-primaryDark text-slate-900 p-3 text-base font-bold rounded-lg cursor-pointer shadow-sm transition disabled:opacity-50">
                            {loginState === 'loading' ? <>MEMPROSES<span className="dot-anim inline-block w-3 text-left"></span></> : 'LOGIN'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col text-slate-900 bg-slate-100 font-sans">
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #898F00; }
                .dot-anim::after { content: ''; animation: dots 1.5s steps(4, end) infinite; }
                @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } 100% { content: ''; } }
            `}</style>

            {/* TOAST NOTIFICATION */}
            <div className={`fixed top-4 right-4 z-[9999] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                    {toast.type === 'error' ? <AlertTriangleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            </div>

            <header className="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-30 shadow-md h-14 flex items-center shrink-0">
                <div className="w-full px-4 sm:px-6 flex justify-between items-center">
                    <div className="text-[28px] leading-none font-bold text-primary tracking-widest flex items-center gap-2">PAGE AI</div>
                    <div className="text-right flex flex-col justify-center items-end text-slate-100">
                        <div className="text-[16px] leading-none font-bold tracking-[0.1em]">{timeString}</div>
                        <div className="text-[11px] leading-tight text-slate-400 tracking-wider mt-0.5">{dateString}</div>
                    </div>
                </div>
            </header>

            <main className="w-full flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative min-h-0 bg-slate-100">
                
                {/* SIDEBAR */}
                <aside className="w-full lg:w-[380px] bg-slate-50 lg:border-r border-slate-200 flex flex-col z-20 shrink-0 lg:h-full lg:overflow-hidden relative">
                    <div className="flex-1 flex flex-col overflow-y-visible lg:overflow-y-auto overflow-x-hidden custom-scroll lg:pb-6 pb-0">
                        <div className="p-3 lg:p-4 flex flex-col gap-3 lg:gap-4 mb-1">
                            
                            {/* PANEL USER AKTIF */}
                            <div className="flex items-center justify-between p-3 bg-white border border-primary/30 rounded-lg shadow-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primaryDark flex items-center justify-center shrink-0">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Email Aktif</span>
                                        <span className="text-xs font-bold text-slate-700 truncate pr-2">
                                            {showFullEmail ? authEmail : getMaskedEmail(authEmail)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => setShowFullEmail(!showFullEmail)} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded-md transition-colors shadow-sm shrink-0" title={showFullEmail ? "Sembunyikan Email" : "Tampilkan Email"}>
                                        <EyeIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setLogoutConfirm(true)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-md transition-colors shadow-sm shrink-0" title="Logout">
                                        <LogOutIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-lg shadow-sm border border-primary/30 flex flex-col text-left">
                                <div className="mb-3">
                                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Deskripsi Produk/Halaman <span className="text-red-500">*</span></label>
                                    <textarea rows="2" placeholder="Tuliskan deskripsi utama landing page Anda..." value={promptInput} onChange={e => setPromptInput(e.target.value)} className={`${inputClass} h-16 resize-none custom-scroll py-2 px-2.5`} />
                                </div>
                                
                                <div className="mb-4">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Instruksi Khusus (Opsional)</label>
                                    <textarea rows="2" placeholder="Misal: 'Wajib ada form testimoni'..." value={extraInstructions} onChange={e => setExtraInstructions(e.target.value)} className={`${inputClass} h-12 resize-none custom-scroll py-2 px-2.5`} />
                                </div>

                                {/* Font Options */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('fontPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><TypeIcon className="text-slate-400 group-hover:text-primaryDark" /> Pilihan Font</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'fontPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'fontPanel' && (
                                        <div className="border-t border-slate-200 pb-2">
                                            <div className="flex flex-col gap-2 p-2 pb-0">
                                                {['all', 'judul', 'subjudul', 'isi', 'tombol'].map(target => {
                                                    const isLocked = target !== 'all' && currentFonts.all !== 'None';
                                                    return (
                                                        <div key={target} className="flex items-center justify-between gap-2 relative">
                                                            <span className="text-[10px] font-bold text-slate-500 w-16 shrink-0 uppercase">{target}</span>
                                                            <button onClick={() => !isLocked && setOpenFontDropdown(openFontDropdown === target ? null : target)} disabled={isLocked} className={`flex-1 flex justify-between items-center bg-white border border-slate-200 rounded p-1.5 transition shadow-sm text-left outline-none ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
                                                                <span className={isLocked || currentFonts[target] === 'None' ? "text-[11px] truncate text-slate-400 italic" : "text-[11px] truncate font-bold text-slate-800"} style={{fontFamily: currentFonts[target] !== 'None' && !isLocked ? `'${currentFonts[target]}', sans-serif` : 'inherit'}}>
                                                                    {isLocked ? "Terkunci (Ikut All Page)" : currentFonts[target]}
                                                                </span>
                                                                <ChevronDownIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                                            </button>
                                                            {openFontDropdown === target && (
                                                                <div className="absolute top-full right-0 w-[calc(100%-4rem)] max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded shadow-xl z-50 custom-scroll mt-1">
                                                                    <div onClick={() => handleFontSelect(target, 'None')} className="p-2 border-b border-slate-100 hover:bg-red-50 cursor-pointer text-red-500 font-bold text-[10px] uppercase">NONE</div>
                                                                    {FONTS.map(f => (
                                                                        <div key={f.id} onClick={() => handleFontSelect(target, f.id)} className="p-2 border-b border-slate-100 hover:bg-primary/10 cursor-pointer text-slate-800 text-[14px]" style={{fontFamily: `'${f.id}', sans-serif`}}>{f.name}</div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Colors */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('colorPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><PaletteIcon className="text-slate-400 group-hover:text-primaryDark" /> Palet Warna</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'colorPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'colorPanel' && (
                                        <div className="border-t border-slate-200 flex flex-col">
                                            <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scroll p-2 pb-1 bg-slate-50">
                                                {colorRows.map(row => (
                                                    <div key={row.id} className="relative bg-white border border-slate-200 p-2 rounded-sm flex flex-col gap-1.5 shadow-sm">
                                                        <div className="flex gap-2 items-center">
                                                            <input type="color" value={row.hex} onChange={e => handleColorChange(row.id, e.target.value)} className="w-6 h-6 p-0 border-0 rounded-sm cursor-pointer shrink-0" />
                                                            <input type="text" value={row.hex} onChange={e => handleColorChange(row.id, e.target.value)} className="w-20 text-[10px] font-mono font-bold p-1 border border-slate-200 rounded-sm bg-slate-50 outline-none focus:border-primary uppercase text-center" />
                                                        </div>
                                                        <input type="text" value={row.label} onChange={e => handleColorChange(row.id, row.hex, e.target.value)} placeholder="Peran (Kosong = Bebas AI)" className="w-full text-[9px] p-1 border-none bg-slate-50 outline-none text-slate-700 font-medium rounded-sm shadow-inner placeholder:text-slate-400" />
                                                        <button onClick={() => setColorRows(prev => prev.filter(r => r.id !== row.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center shadow-md hover:bg-red-600 hover:scale-110 transition-transform"><XCircleIcon className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-2 bg-slate-50 pt-1 shrink-0 border-t border-slate-100">
                                                <button onClick={() => setColorRows(prev => [...prev, {id: Date.now(), hex: '#FFFFFF', label: ''}])} className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 bg-white hover:bg-slate-100 hover:text-slate-700 text-[9px] font-bold rounded-sm flex items-center justify-center gap-1 transition-colors shadow-sm uppercase"><PlusIcon /> Tambah Warna</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Internal Image */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('imgIntPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><ImageIcon className="text-slate-400 group-hover:text-primaryDark" /> Gambar Internal (Auto AI)</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'imgIntPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'imgIntPanel' && (
                                        <div className="border-t border-slate-200 p-2">
                                            <div className="flex gap-2">
                                                <div className="w-1/3">
                                                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Jumlah</label>
                                                    <input type="number" min="0" max="10" value={imgIntQty} onChange={e => setImgIntQty(e.target.value)} className="w-full text-[10px] p-1.5 border border-gray-300 rounded-sm bg-white outline-none focus:border-primary text-center" />
                                                </div>
                                                <div className="w-2/3">
                                                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Rasio Gambar</label>
                                                    <select value={imgIntRatio} onChange={e => setImgIntRatio(e.target.value)} className="w-full text-[10px] p-1.5 border border-gray-300 rounded-sm bg-white outline-none focus:border-primary">
                                                        <option value="auto">Menyesuaikan AI</option>
                                                        <option value="1:1">Kotak (1:1)</option>
                                                        <option value="3:4">Potret (3:4)</option>
                                                        <option value="4:3">Lanskap (4:3)</option>
                                                        <option value="16:9">Layar Lebar (16:9)</option>
                                                        <option value="9:16">Story/Reels (9:16)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Eksternal Image */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('imgExtPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><MonitorIcon className="text-slate-400 group-hover:text-primaryDark" /> Gambar External</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'imgExtPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'imgExtPanel' && (
                                        <div className="border-t border-slate-200 flex flex-col">
                                            <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scroll p-2 pb-1 bg-slate-50">
                                                {imgExtRows.map(row => (
                                                    <div key={row.id} className="relative bg-white border border-slate-200 p-2 rounded-sm flex flex-col gap-1.5 shadow-sm">
                                                        <input type="text" value={row.url} onChange={e => setImgExtRows(prev => prev.map(r => r.id === row.id ? {...r, url: e.target.value} : r))} className="w-full text-[10px] p-1 border border-gray-300 rounded-sm bg-slate-50 outline-none focus:border-primary pr-6" placeholder="URL: https://..." />
                                                        <input type="text" value={row.desc} onChange={e => setImgExtRows(prev => prev.map(r => r.id === row.id ? {...r, desc: e.target.value} : r))} className="w-full text-[9px] p-1 border-none bg-slate-50 rounded-sm outline-none text-slate-600 placeholder:text-slate-400 shadow-inner" placeholder="Penjelasan Letak (Misal: Foto Utama)" />
                                                        <button onClick={() => setImgExtRows(prev => prev.filter(r => r.id !== row.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center shadow-md hover:bg-red-600 hover:scale-110 transition-transform"><XCircleIcon className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-2 bg-slate-50 pt-1 shrink-0 border-t border-slate-100">
                                                <button onClick={() => setImgExtRows(prev => [...prev, {id: Date.now(), url: '', desc: ''}])} className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 bg-white hover:bg-slate-100 hover:text-slate-700 text-[9px] font-bold rounded-sm flex items-center justify-center gap-1 transition-colors shadow-sm uppercase"><PlusIcon /> Tambah Gambar External</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Medsos Link */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('medsosPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><LinkIcon className="text-slate-400 group-hover:text-primaryDark" /> Tautan Medsos/External</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'medsosPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'medsosPanel' && (
                                        <div className="border-t border-slate-200 flex flex-col">
                                            <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scroll p-2 pb-1 bg-slate-50">
                                                {medsosRows.map(row => (
                                                    <div key={row.id} className="relative bg-white border border-slate-200 p-2 rounded-sm flex flex-col gap-1.5 shadow-sm">
                                                        <div className="flex gap-1.5">
                                                            <select value={row.type} onChange={e => setMedsosRows(prev => prev.map(r => r.id === row.id ? {...r, type: e.target.value} : r))} className="w-1/3 text-[10px] p-1 border border-gray-300 rounded-sm bg-slate-50 outline-none focus:border-primary">
                                                                <option value="Instagram">Instagram</option><option value="TikTok">TikTok</option><option value="WhatsApp">WhatsApp</option>
                                                                <option value="YouTube">YouTube</option><option value="Facebook">Facebook</option><option value="Twitter/X">Twitter/X</option>
                                                                <option value="LinkedIn">LinkedIn</option><option value="Threads">Threads</option><option value="Lainnya">Lainnya</option>
                                                            </select>
                                                            <input type="text" value={row.url} onChange={e => setMedsosRows(prev => prev.map(r => r.id === row.id ? {...r, url: e.target.value} : r))} className="w-2/3 text-[10px] p-1 border border-gray-300 rounded-sm bg-slate-50 outline-none focus:border-primary pr-6" placeholder="URL Target..." />
                                                        </div>
                                                        {row.type === 'Lainnya' && (
                                                            <input type="text" value={row.desc} onChange={e => setMedsosRows(prev => prev.map(r => r.id === row.id ? {...r, desc: e.target.value} : r))} className="w-full text-[9px] p-1 border-none bg-slate-50 rounded-sm outline-none text-slate-600 placeholder:text-slate-400 shadow-inner mt-0.5" placeholder="Penjelasan Link" />
                                                        )}
                                                        <button onClick={() => setMedsosRows(prev => prev.filter(r => r.id !== row.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center shadow-md hover:bg-red-600 hover:scale-110 transition-transform"><XCircleIcon className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-2 bg-slate-50 pt-1 shrink-0 border-t border-slate-100">
                                                <button onClick={() => setMedsosRows(prev => [...prev, {id: Date.now(), type: 'Instagram', url: '', desc: ''}])} className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 bg-white hover:bg-slate-100 hover:text-slate-700 text-[9px] font-bold rounded-sm flex items-center justify-center gap-1 transition-colors shadow-sm uppercase"><PlusIcon /> Tambah Tautan</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Checkout Link */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('checkoutPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><ShoppingCartIcon className="text-slate-400 group-hover:text-primaryDark" /> Link Checkout</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'checkoutPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'checkoutPanel' && (
                                        <div className="border-t border-slate-200 flex flex-col">
                                            <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scroll p-2 pb-1 bg-slate-50">
                                                {checkoutRows.map(row => (
                                                    <div key={row.id} className="relative bg-white border border-slate-200 p-2 rounded-sm flex flex-col gap-1.5 shadow-sm">
                                                        <input type="text" value={row.url} onChange={e => setCheckoutRows(prev => prev.map(r => r.id === row.id ? {...r, url: e.target.value} : r))} className="w-full text-[10px] p-1 border border-gray-300 rounded-sm bg-slate-50 outline-none focus:border-primary pr-6" placeholder="URL Target Checkout..." />
                                                        <input type="text" value={row.text} onChange={e => setCheckoutRows(prev => prev.map(r => r.id === row.id ? {...r, text: e.target.value} : r))} className="w-full text-[9px] p-1 border-none bg-slate-50 rounded-sm outline-none text-slate-600 placeholder:text-slate-400 shadow-inner" placeholder="Teks Tombol (Misal: Pesan Sekarang)" />
                                                        <button onClick={() => setCheckoutRows(prev => prev.filter(r => r.id !== row.id))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center shadow-md hover:bg-red-600 hover:scale-110 transition-transform"><XCircleIcon className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-2 bg-slate-50 pt-1 shrink-0 border-t border-slate-100">
                                                <button onClick={() => setCheckoutRows(prev => [...prev, {id: Date.now(), url: '', text: ''}])} className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 bg-white hover:bg-slate-100 hover:text-slate-700 text-[9px] font-bold rounded-sm flex items-center justify-center gap-1 transition-colors shadow-sm uppercase"><PlusIcon /> Tambah Checkout</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Copyright */}
                                <div className="mb-2 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('copyrightPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><CopyrightIcon className="text-slate-400 group-hover:text-primaryDark" /> Hak Cipta (Footer)</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'copyrightPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'copyrightPanel' && (
                                        <div className="border-t border-slate-200">
                                            <div className="flex flex-col gap-2 p-2 bg-slate-50">
                                                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                                                    <input type="checkbox" checked={hasCopyright} onChange={e => setHasCopyright(e.target.checked)} className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer" />
                                                    <span className="text-[11px] font-bold text-slate-600 group-hover:text-primaryDark transition-colors">Sertakan Hak Cipta di Footer</span>
                                                </label>
                                                {hasCopyright && (
                                                    <div className="mt-1">
                                                        <input type="text" value={copyrightName} onChange={e => setCopyrightName(e.target.value)} placeholder="Nama Entitas (Misal: TOKO KITA)" className="w-full text-[11px] py-1.5 px-2 border border-gray-300 rounded-sm bg-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Other settings */}
                                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-md">
                                    <button onClick={() => toggleAccordion('otherPanel')} className="w-full flex justify-between items-center text-[11px] font-bold text-slate-700 hover:text-primaryDark transition-colors outline-none group p-2">
                                        <span className="flex items-center gap-1.5"><SettingsIcon className="text-slate-400 group-hover:text-primaryDark" /> Pengaturan Lainnya</span>
                                        <ChevronDownIcon className={`transition-transform duration-300 ${openPanel === 'otherPanel' ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openPanel === 'otherPanel' && (
                                        <div className="border-t border-slate-200">
                                            <div className="flex flex-col gap-2 p-2 bg-slate-50">
                                                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                                                    <input type="checkbox" checked={chkBioLink} onChange={e => setChkBioLink(e.target.checked)} className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer" />
                                                    <span className="text-[11px] font-bold text-slate-600 group-hover:text-primaryDark transition-colors">Mode Bio Link / Mini Page</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                                                    <input type="checkbox" checked={chkDarkMode} onChange={e => setChkDarkMode(e.target.checked)} className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer" />
                                                    <span className="text-[11px] font-bold text-slate-600 group-hover:text-primaryDark transition-colors">Responsif Gelap & Terang (Auto Toggle)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                                                    <input type="checkbox" checked={chkResponsive} onChange={e => setChkResponsive(e.target.checked)} className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer" />
                                                    <span className="text-[11px] font-bold text-slate-600 group-hover:text-primaryDark transition-colors">Responsif Mutlak (Layar PC & HP)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Generate Params */}
                                <div className="grid grid-cols-3 gap-2 shrink-0 border-t border-slate-200/60 pt-3 mt-1">
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Quantity</label>
                                        <input type="number" min="1" max="50" value={qty} onChange={e => setQty(e.target.value)} className="w-full text-xs py-1.5 px-2 border border-gray-300 rounded bg-white text-center font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Worker</label>
                                        <input type="number" min="1" max="10" value={workerCount} onChange={e => setWorkerCount(e.target.value)} className="w-full text-xs py-1.5 px-2 border border-gray-300 rounded bg-white text-center font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 text-center">Delay</label>
                                        <input type="number" min="0" max="10" value={delaySec} onChange={e => setDelaySec(e.target.value)} className="w-full text-xs py-1.5 px-2 border border-gray-300 rounded bg-white text-center font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" />
                                    </div>
                                    <div className="col-span-3 mt-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <FileTextIcon className="w-3 h-3" />
                                            <label className="block text-[10px] font-bold text-slate-600 leading-none">Nama Ekspor ZIP (.html)</label>
                                        </div>
                                        <input type="text" placeholder="Dihasilkan AI jika dibiarkan kosong" value={zipName} onChange={e => setZipName(e.target.value)} className="w-full text-[11px] py-1.5 px-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-primary outline-none placeholder:text-slate-400 transition-all shadow-sm" />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Bottom Execution Panel */}
                    <div className="shrink-0 p-3 lg:p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3 lg:gap-4 z-10">
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm transition-all overflow-hidden">
                            <div className="grid grid-cols-3 gap-0 border-b border-gray-100 p-2 bg-gray-50">
                                <div className="flex flex-col items-center justify-center border border-primary/20 rounded-lg bg-primary/5 py-1.5 shadow-sm transition-all">
                                    <div className="flex items-center gap-1 mb-1 text-primaryDark"><ClockIcon className="w-3 h-3" /> <span className="text-xs font-medium uppercase leading-none">Selected</span></div>
                                    <span className="text-xs font-black text-primaryDark tabular-nums">{displaySelected}</span>
                                </div>
                                <div className="mx-1.5 flex flex-col items-center justify-center border border-green-200 rounded-lg bg-green-50 py-1.5 shadow-sm transition-all">
                                    <div className="flex items-center gap-1 mb-1 text-green-600"><CheckCircleIcon className="w-3 h-3" /> <span className="text-xs font-medium uppercase leading-none">Completed</span></div>
                                    <span className="text-xs font-black text-green-700 tabular-nums">{countSuccess}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center border border-red-200 rounded-lg bg-red-50 py-1.5 shadow-sm transition-all">
                                    <div className="flex items-center gap-1 mb-1 text-red-600"><XCircleIcon className="w-3 h-3" /> <span className="text-xs font-medium uppercase leading-none">Failed</span></div>
                                    <span className="text-xs font-black text-red-700 tabular-nums">{countFailed}</span>
                                </div>
                            </div>
                            <div className="p-2 bg-white flex items-center justify-between gap-3">
                                <button onClick={handleClearAll} disabled={cardsState.length === 0 || isGenerating} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold uppercase tracking-wide rounded border transition-colors ${cardsState.length > 0 && !isGenerating ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'}`}>
                                    <TrashIcon className="w-3 h-3" /> CLEAR ALL KARTU
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-1.5 h-10">
                            {isGenerating ? (
                                <div className="flex-1 text-xs font-bold rounded-lg border-none shadow transition-colors flex items-center justify-center gap-2 uppercase tracking-wide truncate bg-primary/10 text-primary border-transparent border-0">
                                    <CustomSpinner /> <span className="uppercase tracking-wide text-primary">Memproses...</span>
                                </div>
                            ) : (
                                <button onClick={() => startGeneration()} disabled={!promptInput.trim() && cardsState.filter(c => c.status === 'pending').length === 0} className={`flex-1 text-xs font-bold rounded-lg border shadow transition-all flex items-center justify-center gap-2 uppercase tracking-wide truncate ${promptInput.trim() || cardsState.filter(c => c.status === 'pending').length > 0 ? 'bg-primary hover:bg-primaryDark border-transparent text-slate-900 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-80'}`}>
                                    <SparklesIcon className="w-3.5 h-3.5" /> GENERATE
                                </button>
                            )}
                            
                            <button onClick={handleTogglePause} disabled={!isGenerating && !isPaused} className={`w-10 flex items-center justify-center rounded-lg border shadow-sm transition-all active:scale-95 shrink-0 ${(!isGenerating && !isPaused) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : isPaused ? 'bg-green-600 text-white border-green-700 hover:bg-green-700 hover:-translate-y-0.5' : 'bg-amber-100 border-amber-300 text-amber-600 hover:bg-amber-200 hover:-translate-y-0.5'}`}>
                                {isPaused ? <PlayIcon /> : <PauseIcon />}
                            </button>
                            
                            <button onClick={handleDownloadZip} disabled={countSuccess === 0 || isGenerating || isZipping} className={`flex-1 text-xs font-bold rounded-lg border shadow transition-colors flex items-center justify-center gap-2 uppercase tracking-wide truncate ${(countSuccess > 0 && !isGenerating) ? 'bg-green-600 text-white border-green-700 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-80'}`}>
                                {isZipping ? <CustomSpinner className="w-3 h-3 text-white" /> : <DownloadIcon className="w-3 h-3" />} EKSPOR ZIP
                            </button>
                        </div>
                    </div>
                </aside>

                {/* MAIN GRID */}
                <section className="flex-1 flex flex-col lg:overflow-hidden relative min-h-0 bg-slate-100">
                    <div className="bg-white border-b border-slate-200 p-3 flex justify-between items-center shrink-0 shadow-sm z-10">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {[50, 100, 150, 200, 250].map(size => (
                                <button key={size} onClick={() => {setItemsPerPage(size); setCurrentPage(1);}} className={`px-2 py-1 rounded border transition ${itemsPerPage === size ? 'bg-primary/10 text-primaryDark border-primary/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200'}`}>{size}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700 tracking-widest">{currentPage} / {totalPages || 1}</span>
                            <div className="flex gap-1">
                                <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 transition"><ChevronDownIcon className="rotate-90" /></button>
                                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 transition"><ChevronDownIcon className="-rotate-90" /></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-4 lg:overflow-y-auto custom-scroll pb-20 lg:pb-4">
                        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                            {cardsState.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center text-center w-full h-full min-h-[50vh]">
                                    <div className="w-20 h-20 bg-primary/5 border border-primary/20 text-primary/60 rounded-full flex items-center justify-center mb-4"><SparklesIcon className="w-8 h-8" /></div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">Belum Ada Antrean</h3>
                                    <p className="text-slate-500 text-sm max-w-md">Masukkan prompt di panel pengaturan, atur kuantitas, dan tekan GENERATE.</p>
                                </div>
                            ) : (
                                paginatedCards.map(card => {
                                    const isDone = card.status === 'done';
                                    const statusColor = card.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : card.status === 'processing' ? 'bg-primary/10 text-primary border-primary/20' : card.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200';
                                    
                                    return (
                                        <div key={card.id} className={`bg-white hover:shadow-md rounded-lg shadow-sm border flex flex-col transition-all duration-300 ${card.status === 'processing' ? 'border-primary ring-2 ring-primary/20' : card.status === 'failed' ? 'border-red-300' : 'border-slate-200'}`}>
                                            <div className="grid grid-cols-4 gap-1.5 p-2 bg-primary/5 border-b border-primary/10 rounded-t-lg shrink-0">
                                                <button onClick={() => { setPreviewCard(card); setPreviewDevice('desktop'); }} disabled={!isDone} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-white border-primary/20 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><EyeIcon className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-tight truncate">PREV</span></button>
                                                <button onClick={() => { copyToClipboard(card.code); setAlertData({title:"Sukses!", desc:"Kode HTML disalin ke Clipboard."}) }} disabled={!isDone} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-white border-primary/20 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><CopyIcon className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-tight truncate">COPY</span></button>
                                                <button onClick={() => handleOpenEdit(card)} disabled={!isDone} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-amber-50 border-amber-200 text-amber-600 hover:brightness-95 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><EditIcon className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-tight truncate">EDIT</span></button>
                                                <button onClick={() => setConfirmData({title:"Hapus Kartu?", desc:"Kartu dan kode ini akan dihapus permanen.", action:()=>setCardsState(prev=>prev.filter(c=>c.id!==card.id))})} disabled={card.status === 'processing'} className="flex flex-row items-center justify-center gap-1.5 py-1.5 rounded border bg-white border-primary/20 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><TrashIcon className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-tight truncate">DEL</span></button>
                                            </div>
                                            <div className="p-2 border-b border-slate-100 flex justify-between items-center gap-2 shrink-0 bg-white">
                                                <p className="text-[11px] font-bold text-slate-800 truncate">{card.title}</p>
                                                <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded border whitespace-nowrap ${statusColor}`}>{card.status.toUpperCase()}</span>
                                            </div>
                                            <div className="p-2 flex gap-2 h-[150px] bg-white rounded-b-lg relative">
                                                <div className="flex-1 rounded-lg overflow-hidden bg-slate-50 relative flex items-center justify-center border border-slate-200 cursor-pointer group" onClick={() => isDone && setPreviewCard(card)}>
                                                    {card.status === 'done' ? (
                                                        <>
                                                            <div className="absolute inset-0 w-full h-full bg-transparent"><iframe srcDoc={card.code} className="absolute inset-0 w-full h-full border-none pointer-events-none scale-[0.35] origin-top-left" style={{width: '285%', height: '285%'}} scrolling="no" /></div>
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-all flex items-center justify-center"><PlayIcon className="text-white w-8 h-8 drop-shadow-lg opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all" /></div>
                                                        </>
                                                    ) : card.status === 'failed' ? (
                                                        <div className="p-2 text-center text-red-500"><AlertTriangleIcon className="mx-auto mb-1 w-6 h-6" /><div className="text-[8px] font-bold break-words px-2 leading-tight">{card.error || 'Gagal'}</div></div>
                                                    ) : card.status === 'processing' ? (
                                                        <div className="flex flex-col items-center text-primary"><CustomSpinner className="w-6 h-6 mb-1" /></div>
                                                    ) : (
                                                        <div className="text-slate-400"><CodeIcon className="w-6 h-6" /></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 flex flex-col overflow-hidden">
                                                    <div className="p-1 border-b border-slate-200 bg-slate-100 sticky top-0 shrink-0"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-center">HTML Code</span></div>
                                                    <div className="p-1.5 overflow-y-auto custom-scroll flex-1 bg-white">
                                                        {card.status === 'processing' || card.status === 'pending' ? (
                                                            <p className="text-[12px] text-slate-500 font-bold tracking-wide text-center h-full flex items-center justify-center">Memproses<span className="dot-anim inline-block w-4 text-left"></span></p>
                                                        ) : (
                                                            <pre className="text-[7px] text-slate-700 font-mono leading-tight whitespace-pre-wrap break-words"><code>{card.code ? card.code.substring(0, 300) + '...' : ''}</code></pre>
                                                        )}
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

            {/* PREVIEW MODAL */}
            {previewCard && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 p-2 sm:p-4 md:p-8 backdrop-blur-sm transition-opacity" onClick={() => setPreviewCard(null)}>
                    <div className="relative flex flex-col w-full h-full max-w-5xl mx-auto transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewCard(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 hover:scale-110 transition-transform z-[110]"><XCircleIcon className="w-5 h-5" /></button>
                        <div className="bg-white shadow-2xl flex flex-col rounded-xl overflow-hidden w-full h-full relative">
                            <div className="bg-white p-3 border-b border-slate-200 shrink-0">
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full h-[40px] border border-slate-200">
                                    <button onClick={() => setPreviewDevice('desktop')} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-white text-primary shadow-sm border border-primary/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}><MonitorIcon className="w-3.5 h-3.5" /> PC</button>
                                    <button onClick={() => setPreviewDevice('mobile')} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-white text-primary shadow-sm border border-primary/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}><SmartphoneIcon className="w-3.5 h-3.5" /> HP</button>
                                    <button onClick={() => {const blob = new Blob([previewCard.code], { type: 'text/html' }); window.open(URL.createObjectURL(blob), '_blank');}} className="flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white"><ExternalLinkIcon className="w-3.5 h-3.5" /> PBLSH</button>
                                </div>
                            </div>
                            <div className="flex-1 w-full bg-slate-200 p-4 flex items-center justify-center overflow-hidden">
                                <iframe srcDoc={previewCard.code} className="bg-white shadow-lg h-full border-none rounded-md transition-all" style={{width: previewDevice === 'mobile' ? '375px' : '100%'}} sandbox="allow-scripts allow-same-origin" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editCardId && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 p-2 sm:p-4 md:p-8 backdrop-blur-sm transition-opacity" onClick={() => setEditCardId(null)}>
                    <div className="relative flex flex-col w-full h-full max-w-4xl mx-auto transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-end mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <button onClick={undoEdit} disabled={editHistoryIndex <= 0} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"><UndoIcon /></button>
                                <button onClick={redoEdit} disabled={editHistoryIndex >= editHistoryStack.length - 1} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"><RedoIcon /></button>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditCardId(null)} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition shadow-md">Batal</button>
                                <button onClick={() => { setCardsState(prev => prev.map(c => c.id === editCardId ? {...c, code: editCodeArea} : c)); setEditCardId(null); }} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-900 bg-primary hover:bg-primaryDark shadow-md transition">Simpan</button>
                            </div>
                        </div>
                        <div className="bg-white shadow-2xl flex flex-col rounded-xl overflow-hidden w-full h-full relative">
                            {isEditingRevising && (
                                <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
                                    <CustomSpinner className="w-10 h-10 text-primary mb-3" />
                                    <p className="text-sm font-bold text-slate-700 tracking-wider">AI sedang merevisi kode...</p>
                                </div>
                            )}
                            <div className="bg-white p-3 border-b border-slate-200 shrink-0">
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full h-[40px] border border-slate-200">
                                    <button onClick={() => setEditTab('code')} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${editTab === 'code' ? 'bg-white text-primary shadow-sm border border-primary/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}><CodeIcon className="w-3.5 h-3.5" /><span>Kode</span></button>
                                    <button onClick={() => setEditTab('preview')} className={`flex-1 flex items-center justify-center gap-2 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${editTab === 'preview' ? 'bg-white text-primary shadow-sm border border-primary/20' : 'text-slate-500 hover:bg-slate-200 border border-transparent'}`}><EyeIcon className="w-3.5 h-3.5" /><span>Preview</span></button>
                                </div>
                            </div>
                            <div className="p-3 w-full bg-white flex-1 flex flex-col min-h-0 relative">
                                {editTab === 'code' ? (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="flex-1 w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg overflow-hidden relative">
                                            <textarea spellCheck="false" value={editCodeArea} onChange={handleEditInput} className="absolute inset-0 w-full h-full bg-transparent text-slate-700 font-mono text-[10px] sm:text-[11px] p-4 outline-none resize-none custom-scroll leading-relaxed" />
                                        </div>
                                        <div className="mt-[12px] h-[44px] w-full bg-white border border-primary rounded-lg px-2 flex items-center gap-2 shrink-0 shadow-sm relative z-10 box-border">
                                            <input type="text" placeholder="Instruksi revisi, misal: 'Ubah warna background jadi merah'..." value={editChatInput} onChange={e => setEditChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRequestRevisi()} className="flex-1 bg-transparent text-xs text-slate-700 outline-none px-2 placeholder:text-slate-400 h-full" />
                                            <button onClick={handleRequestRevisi} className="w-[28px] h-[28px] shrink-0 flex items-center justify-center rounded-md bg-primary text-slate-900 hover:bg-primaryDark transition-colors shadow-sm"><SendIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full bg-slate-200 border border-slate-300 rounded-lg p-2 overflow-y-auto custom-scroll">
                                        <iframe srcDoc={editCodeArea} className="w-full min-h-full bg-white shadow-sm border-none rounded block" sandbox="allow-scripts allow-same-origin" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM MODAL */}
            {confirmData && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm flex flex-col items-center text-center">
                        <div className="bg-red-100 text-red-600 p-3 rounded-full mb-3"><AlertTriangleIcon className="w-8 h-8" /></div>
                        <h3 className="text-lg font-bold text-slate-800">{confirmData.title}</h3>
                        <p className="text-sm text-slate-600 mt-2 mb-6" dangerouslySetInnerHTML={{__html: confirmData.desc}} />
                        <div className="flex w-full gap-3">
                            <button onClick={() => setConfirmData(null)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded hover:bg-slate-300 transition text-xs shadow-sm">Batal</button>
                            <button onClick={() => { confirmData.action(); setConfirmData(null); }} className="flex-1 bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 transition shadow-sm text-xs">Ya</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERT MODAL */}
            {alertData && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm flex flex-col items-center text-center">
                        <div className="bg-amber-100 text-amber-600 p-3 rounded-full mb-3"><AlertTriangleIcon className="w-8 h-8" /></div>
                        <h3 className="text-lg font-bold text-slate-800">{alertData.title}</h3>
                        <p className="text-sm text-slate-600 mt-2 mb-6">{alertData.desc}</p>
                        <button onClick={() => setAlertData(null)} className="w-full bg-primary text-slate-900 font-bold py-2 rounded-lg hover:bg-primaryDark transition shadow-sm">Tutup</button>
                    </div>
                </div>
            )}

            {/* LOGOUT CONFIRM MODAL */}
            {logoutConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm flex flex-col items-center text-center">
                        <div className="bg-red-100 text-red-600 p-3 rounded-full mb-3"><LogOutIcon className="w-8 h-8" /></div>
                        <h3 className="text-lg font-bold text-slate-800">Keluar dari akun?</h3>
                        <p className="text-sm text-slate-600 mt-2 mb-6">Anda akan logout dari device ini. Data yang sudah tersimpan tidak akan hilang.</p>
                        <div className="flex w-full gap-3">
                            <button onClick={() => setLogoutConfirm(false)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded hover:bg-slate-300 transition text-xs shadow-sm">Batal</button>
                            <button onClick={() => { setLogoutConfirm(false); handleLogout(); }} className="flex-1 bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 transition shadow-sm text-xs">Ya, Logout</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
