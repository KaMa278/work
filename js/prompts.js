/* ============================================================
   prompts.js
   Четыре промпт-стратегии — ядро научного вклада работы.
   Тексты соответствуют плану тезисов, Глава 3.1
   ("The four prompting strategies — HEART OF THE WORK").
   ============================================================ */

const Prompts = {

    // === STRATEGY 1: BASELINE ===
    // Не использует AI. Возвращается оригинал без изменений.
    // Это контрольная группа.
    baseline(resume, jobDescription) {
        return null; // null = не вызывать API
    },

    // === STRATEGY 2: NAIVE AI ===
    naive(resume, jobDescription) {
        return `Tailor this resume for the following job description.

Resume:
${resume}

Job description:
${jobDescription}

Return the tailored resume.`;
    },

    // === STRATEGY 3: ATS-OPTIMIZED ===
    ats(resume, jobDescription) {
        return `You are a resume optimizer. Your goal is to increase ATS keyword coverage.

INSTRUCTIONS:
1. Identify the most important keywords from the job description.
2. Rewrite the resume to include these keywords where appropriate.
3. Focus on technical skills, tools, and methodologies.
4. Keep the resume length similar to the original.

Resume:
${resume}

Job description:
${jobDescription}

Return the tailored resume.`;
    },

    // === STRATEGY 4: ATS + ANTI-HALLUCINATION (главный вклад работы) ===
    atsAntiHall(resume, jobDescription) {
        return `You are a professional resume editor.

TASK: Tailor the resume below to the job description.

STRICT RULES:
1. Use ONLY information that exists in the original resume.
2. Do NOT invent skills, job titles, dates, or companies.
3. You MAY rephrase, reorder, and emphasize existing content.
4. You MUST keep all key dates and company names unchanged.
5. Use keywords from the job description ONLY where they truly fit the candidate's real experience.
6. If a keyword does not match any real experience, do not add it.

ORIGINAL RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Output the tailored resume in plain text.`;
    },

    // === Маппинг id → функция ===
    build(strategyId, resume, jobDescription) {
        switch (strategyId) {
            case 'baseline':      return this.baseline(resume, jobDescription);
            case 'naive':         return this.naive(resume, jobDescription);
            case 'ats':           return this.ats(resume, jobDescription);
            case 'ats_antihall':  return this.atsAntiHall(resume, jobDescription);
            default: throw new Error('Unknown strategy: ' + strategyId);
        }
    },

    // Человеко-читаемые названия для UI
    labels: {
        baseline:     'Baseline (no AI)',
        naive:        'Naive AI',
        ats:          'ATS-Optimized',
        ats_antihall: 'ATS + Anti-Hallucination'
    }
};
