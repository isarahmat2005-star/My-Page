export const callGeminiApiViaProxy = (endpointPath, payload) => {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(2, 15);
        
        const handleMessage = (event) => {
            const data = event.data;
            if (data && data.type === 'GEMINI_RESPONSE' && data.id === id) {
                window.removeEventListener('message', handleMessage);
                if (data.success) {
                    // Extracting the text specifically for text generation responses
                    let text = data.data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) {
                        reject(new Error("Format respons tidak valid."));
                        return;
                    }
                    
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
        
        window.parent.postMessage({
            type: 'CALL_GEMINI',
            id: id,
            endpointPath: endpointPath,
            payload: payload
        }, '*');
    });
};

export const downloadZipFiles = async (doneCards, zipFilename) => {
    try {
        const JSZip = (await import('https://esm.sh/jszip')).default;
        const zip = new JSZip(); 
        
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
        link.href = zipUrl; 
        link.download = `${zipFilename || 'Hasil-Landing-Page'}.zip`; 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
        URL.revokeObjectURL(zipUrl);
    } catch (err) {
        throw err;
    }
};

export const copyToClipboard = (text) => {
    const ta = document.createElement('textarea'); 
    ta.value = text; 
    document.body.appendChild(ta);
    ta.select(); 
    try {
        document.execCommand('copy'); 
    } catch(e) {}
    document.body.removeChild(ta);
};
