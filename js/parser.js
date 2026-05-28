/* ============================================================
   parser.js
   Извлечение текста из PDF (через PDF.js) и DOCX (через mammoth.js).
   Соответствует плану тезисов, Глава 2.2: 1-3 секунды на парсинг.
   ============================================================ */

const Parser = {

    // Главная функция: принимает File, возвращает текст
    async parseFile(file) {
        if (!file) throw new Error('No file provided');

        const name = file.name.toLowerCase();

        if (name.endsWith('.pdf')) {
            return await this.parsePdf(file);
        } else if (name.endsWith('.docx')) {
            return await this.parseDocx(file);
        } else if (name.endsWith('.txt')) {
            return await file.text();
        } else {
            throw new Error('Unsupported file format. Please use PDF, DOCX, or TXT.');
        }
    },

    // PDF (PDF.js)
    async parsePdf(file) {
        // Настройка worker для PDF.js
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }

        return this.cleanText(fullText);
    },

    // DOCX (mammoth.js)
    async parseDocx(file) {
        if (typeof mammoth === 'undefined') {
            throw new Error('mammoth.js library not loaded');
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return this.cleanText(result.value);
    },

    // Очистка текста
    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }
};
