/* ============================================================
   metrics.js
   Четыре метрики из плана тезисов, Глава 3.1:
   1. ATS keyword coverage (%)
   2. Hallucination rate (%)
   3. Tailoring score (1-5)
   4. Readability — Flesch Reading Ease
   ============================================================ */

const Metrics = {

    // === ATS KEYWORD COVERAGE ===
    // Извлекаем важные ключевые слова из JD (TF-IDF + curated list)
    // и считаем сколько из них встречается в резюме.
    atsCoverage(resume, jobDescription) {
        const keywords = this.extractKeywords(jobDescription);
        if (keywords.length === 0) return { score: 0, found: [], missing: [], keywords: [] };

        const resumeLower = resume.toLowerCase();
        const found = [];
        const missing = [];

        keywords.forEach(kw => {
            if (resumeLower.includes(kw.toLowerCase())) {
                found.push(kw);
            } else {
                missing.push(kw);
            }
        });

        const score = Math.round((found.length / keywords.length) * 100);
        return { score, found, missing, keywords };
    },

    // Извлечение ключевых слов из JD (упрощённый TF-IDF + tech-stop-words)
    extractKeywords(jobDescription) {
        const stopWords = new Set([
            'the','a','an','and','or','but','for','of','in','on','to','from','with',
            'is','are','was','were','be','been','being','have','has','had','do','does',
            'did','will','would','should','could','can','may','might','must','this',
            'that','these','those','we','you','they','our','your','their','as','at',
            'by','if','it','its','not','no','than','then','so','about','more','most',
            'some','any','all','each','every','other','such','only','own','same','very',
            'work','working','role','candidate','position','company','team','required',
            'experience','years','year','etc','also','please','well','strong','good',
            'great','best','high','low','new','old','able','ability','must','need'
        ]);

        // Берём слова длиной ≥3, считаем частоту
        const words = jobDescription
            .toLowerCase()
            .replace(/[^a-zа-я0-9+#./\- ]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !stopWords.has(w) && !/^\d+$/.test(w));

        const freq = {};
        words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

        // Curated tech-list (повышаем приоритет если есть)
        const techPatterns = [
            'javascript','python','java','typescript','react','angular','vue','node',
            'sql','nosql','mongodb','postgresql','mysql','redis','docker','kubernetes',
            'aws','azure','gcp','git','agile','scrum','rest','graphql','api','ci/cd',
            'html','css','sass','webpack','linux','figma','photoshop','illustrator',
            'seo','sem','google analytics','crm','salesforce','hubspot','b2b','b2c',
            'kpi','roi','machine learning','deep learning','tensorflow','pytorch',
            'data analysis','excel','tableau','power bi','marketing','sales','design',
            'ux','ui','user research','wireframe','prototype','figma','sketch'
        ];

        // Берём топ-15 по частоте + всё что попало из tech-листа
        const ranked = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word);

        const top = ranked.slice(0, 15);
        const techFound = techPatterns.filter(p => jobDescription.toLowerCase().includes(p));

        // Объединяем без дубликатов
        const combined = Array.from(new Set([...techFound, ...top]));
        return combined.slice(0, 20); // максимум 20 ключевых слов
    },

    // === HALLUCINATION RATE ===
    // Алгоритмическая проверка: ищем в output "сущности"
    // (числа, годы, аббревиатуры заглавными, компании, технологии),
    // которых нет в оригинальном резюме.
    hallucinationRate(originalResume, tailoredResume) {
        if (!tailoredResume) return { score: 0, hallucinated: [], totalChecked: 0 };

        const original = originalResume.toLowerCase();

        // Извлекаем "проверяемые факты" из tailored:
        // 1) Годы (4-digit numbers 19xx-20xx)
        // 2) Аббревиатуры (2-5 заглавных букв)
        // 3) CamelCase / PascalCase слова (имена технологий, компаний)
        // 4) Слова с цифрами (Python3, ES6, HTML5)
        const facts = new Set();

        // Годы
        const years = tailoredResume.match(/\b(19|20)\d{2}\b/g) || [];
        years.forEach(y => facts.add(y));

        // Аббревиатуры (2-5 заглавных букв подряд)
        const abbrevs = tailoredResume.match(/\b[A-Z]{2,5}\b/g) || [];
        abbrevs.forEach(a => facts.add(a));

        // CamelCase / PascalCase (имена: JavaScript, PostgreSQL, etc)
        const camels = tailoredResume.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || [];
        camels.forEach(c => facts.add(c));

        // Слова с цифрами в середине/конце (Python3, ES6)
        const techWithDigits = tailoredResume.match(/\b[A-Za-z]+\d+\b/g) || [];
        techWithDigits.forEach(t => facts.add(t));

        if (facts.size === 0) return { score: 0, hallucinated: [], totalChecked: 0 };

        // Проверяем каждый "факт" — есть ли он в оригинале
        const hallucinated = [];
        facts.forEach(fact => {
            if (!original.includes(fact.toLowerCase())) {
                hallucinated.push(fact);
            }
        });

        const score = Math.round((hallucinated.length / facts.size) * 100);
        return {
            score,
            hallucinated,
            totalChecked: facts.size
        };
    },

    // === TAILORING SCORE (1-5) ===
    // Считаем edit distance / original length, нормализуем в шкалу 1-5.
    tailoringScore(originalResume, tailoredResume) {
        if (!tailoredResume || tailoredResume === originalResume) return 1.0;

        // Упрощённая метрика: word-level Jaccard distance
        const wordsOrig = new Set(originalResume.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const wordsTail = new Set(tailoredResume.toLowerCase().split(/\s+/).filter(w => w.length > 2));

        if (wordsOrig.size === 0 || wordsTail.size === 0) return 1.0;

        const intersection = new Set([...wordsOrig].filter(w => wordsTail.has(w)));
        const union = new Set([...wordsOrig, ...wordsTail]);

        const similarity = intersection.size / union.size;
        const distance = 1 - similarity; // 0 = identical, 1 = totally different

        // Маппинг 0..1 → 1..5
        const score = 1 + distance * 4;
        return Math.round(score * 10) / 10;
    },

    // === FLESCH READING EASE ===
    fleschReadingEase(text) {
        if (!text || text.length < 10) return 0;

        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length || 1;

        let syllableCount = 0;
        words.forEach(w => { syllableCount += this.countSyllables(w); });

        const asl = wordCount / sentences; // average sentence length
        const asw = syllableCount / wordCount; // average syllables per word

        const score = 206.835 - 1.015 * asl - 84.6 * asw;
        return Math.round(score * 10) / 10;
    },

    countSyllables(word) {
        word = word.toLowerCase().replace(/[^a-z]/g, '');
        if (word.length <= 3) return 1;
        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');
        const matches = word.match(/[aeiouy]{1,2}/g);
        return matches ? matches.length : 1;
    },

    // === ВСЁ ВМЕСТЕ ===
    computeAll(originalResume, tailoredResume, jobDescription) {
        // Если tailored пустой (baseline), используем original
        const output = tailoredResume || originalResume;

        const ats = this.atsCoverage(output, jobDescription);
        const hall = this.hallucinationRate(originalResume, tailoredResume);
        const tailor = tailoredResume ? this.tailoringScore(originalResume, tailoredResume) : 1.0;
        const flesch = this.fleschReadingEase(output);

        return {
            ats_score: ats.score,
            ats_found: ats.found,
            ats_missing: ats.missing,
            ats_keywords: ats.keywords,
            hallucination_score: hall.score,
            hallucinated_facts: hall.hallucinated,
            hallucination_checked: hall.totalChecked,
            tailoring_score: tailor,
            flesch_score: flesch
        };
    }
};
