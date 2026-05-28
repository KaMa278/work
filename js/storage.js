/* ============================================================
   storage.js
   Управление localStorage для всех данных приложения.
   Структура соответствует плану тезисов, Глава 3.1:
   - experiments
   - base_resumes
   - job_descriptions
   - expert_reviews
   - api_key (хранится только локально)
   ============================================================ */

const Storage = {

    // === API KEY (только в браузере пользователя) ===
    saveApiKey(key) {
        localStorage.setItem('grok_api_key', key);
    },
    getApiKey() {
        return localStorage.getItem('grok_api_key') || '';
    },
    clearApiKey() {
        localStorage.removeItem('grok_api_key');
    },

    // === EXPERIMENTS (главная коллекция) ===
    getExperiments() {
        const raw = localStorage.getItem('experiments');
        return raw ? JSON.parse(raw) : [];
    },
    saveExperiment(experiment) {
        const list = this.getExperiments();
        experiment.id = experiment.id || ('exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
        experiment.timestamp = experiment.timestamp || new Date().toISOString();
        list.push(experiment);
        localStorage.setItem('experiments', JSON.stringify(list));
        return experiment.id;
    },
    clearExperiments() {
        localStorage.removeItem('experiments');
    },

    // === BASE RESUMES (5-7 шаблонов для эксперимента) ===
    getBaseResumes() {
        const raw = localStorage.getItem('base_resumes');
        return raw ? JSON.parse(raw) : [];
    },
    saveBaseResume(resume) {
        const list = this.getBaseResumes();
        resume.id = resume.id || ('res_' + Date.now());
        list.push(resume);
        localStorage.setItem('base_resumes', JSON.stringify(list));
        return resume.id;
    },

    // === JOB DESCRIPTIONS (10-15 вакансий) ===
    getJobDescriptions() {
        const raw = localStorage.getItem('job_descriptions');
        return raw ? JSON.parse(raw) : [];
    },
    saveJobDescription(jd) {
        const list = this.getJobDescriptions();
        jd.id = jd.id || ('jd_' + Date.now());
        list.push(jd);
        localStorage.setItem('job_descriptions', JSON.stringify(list));
        return jd.id;
    },

    // === EXPERT REVIEWS (HR оценки) ===
    getExpertReviews() {
        const raw = localStorage.getItem('expert_reviews');
        return raw ? JSON.parse(raw) : [];
    },
    saveExpertReview(review) {
        const list = this.getExpertReviews();
        review.id = review.id || ('rev_' + Date.now());
        review.timestamp = review.timestamp || new Date().toISOString();
        list.push(review);
        localStorage.setItem('expert_reviews', JSON.stringify(list));
        return review.id;
    },

    // === LAST RUN (для передачи между страницами upload → results) ===
    setLastRun(data) {
        sessionStorage.setItem('last_run', JSON.stringify(data));
    },
    getLastRun() {
        const raw = sessionStorage.getItem('last_run');
        return raw ? JSON.parse(raw) : null;
    },

    // === LAST COMPARE (для compare.html) ===
    setLastCompare(data) {
        sessionStorage.setItem('last_compare', JSON.stringify(data));
    },
    getLastCompare() {
        const raw = sessionStorage.getItem('last_compare');
        return raw ? JSON.parse(raw) : null;
    },

    // === FULL CLEAR (для admin-stats кнопки) ===
    clearAll() {
        localStorage.removeItem('experiments');
        localStorage.removeItem('base_resumes');
        localStorage.removeItem('job_descriptions');
        localStorage.removeItem('expert_reviews');
        sessionStorage.removeItem('last_run');
        sessionStorage.removeItem('last_compare');
    }
};
