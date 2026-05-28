(function () {
    'use strict';

    // === Утилиты ===
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    function setStatus(message, type = 'info') {
        const el = $('#status');
        if (!el) return;
        el.className = 'status show ' + type;
        el.textContent = message;
    }

    function hideStatus() {
        const el = $('#status');
        if (!el) return;
        el.className = 'status';
        el.textContent = '';
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ============================================================
    // UPLOAD PAGE
    // ============================================================
    function initUploadPage() {
        const form = $('#tailor-form');
        if (!form) return;

        const savedKey = Storage.getApiKey();
        if (savedKey) $('#api-key').value = savedKey;

        let parsedResumeText = '';

        $('#resume-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setStatus('Parsing file...', 'loading');
            try {
                parsedResumeText = await Parser.parseFile(file);
                $('#resume-text').textContent = parsedResumeText.slice(0, 500) +
                    (parsedResumeText.length > 500 ? '\n\n[... preview truncated ...]' : '');
                $('#resume-preview').classList.remove('hidden');
                setStatus(`Parsed ${parsedResumeText.length} characters from file.`, 'success');
            } catch (err) {
                setStatus('Parsing error: ' + err.message, 'error');
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const apiKey = $('#api-key').value.trim();
            const jd = $('#job-description').value.trim();
            const strategy = $$('input[name="strategy"]:checked')[0]?.value;

            if (!apiKey) return setStatus('Please paste your Grok API key.', 'error');
            if (!parsedResumeText) return setStatus('Please upload your resume.', 'error');
            if (!jd) return setStatus('Please paste a job description.', 'error');
            if (!strategy) return setStatus('Please choose a strategy.', 'error');

            Storage.saveApiKey(apiKey);

            const runBtn = $('#run-btn');
            runBtn.disabled = true;
            runBtn.textContent = 'Running...';

            try {
                if (strategy === 'all') {
                    setStatus('Running all 4 strategies in parallel (may take 15-30 seconds)...', 'loading');
                    const outputs = await GrokAPI.callMultiple(parsedResumeText, jd, apiKey);

                    const results = {};
                    ['baseline', 'naive', 'ats', 'ats_antihall'].forEach(stratId => {
                        const out = outputs[stratId];
                        const tailored = (typeof out === 'string') ? out : null;
                        const metrics = Metrics.computeAll(parsedResumeText, tailored, jd);
                        results[stratId] = {
                            output: tailored,
                            error: (out && out.error) ? out.error : null,
                            metrics
                        };

                        Storage.saveExperiment({
                            strategy_used: stratId,
                            original_resume: parsedResumeText,
                            job_description: jd,
                            output: tailored,
                            metrics
                        });
                    });

                    Storage.setLastCompare({
                        original: parsedResumeText,
                        jobDescription: jd,
                        results
                    });

                    setStatus('Done! Redirecting to comparison page...', 'success');
                    setTimeout(() => window.location.href = 'compare.html', 800);

                } else {
                    setStatus('Calling Grok API (5-15 seconds)...', 'loading');

                    let tailored = null;
                    if (strategy !== 'baseline') {
                        const prompt = Prompts.build(strategy, parsedResumeText, jd);
                        tailored = await GrokAPI.call(prompt, apiKey);
                    }

                    const metrics = Metrics.computeAll(parsedResumeText, tailored, jd);

                    Storage.saveExperiment({
                        strategy_used: strategy,
                        original_resume: parsedResumeText,
                        job_description: jd,
                        output: tailored,
                        metrics
                    });

                    Storage.setLastRun({
                        strategy,
                        original: parsedResumeText,
                        tailored,
                        jobDescription: jd,
                        metrics
                    });

                    setStatus('Done! Redirecting to results...', 'success');
                    setTimeout(() => window.location.href = 'results.html', 600);
                }

            } catch (err) {
                setStatus('Error: ' + err.message, 'error');
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = 'Run AI tailoring →';
            }
        });
    }

    // ============================================================
    // RESULTS PAGE
    // ============================================================
    function initResultsPage() {
        if (!$('#m-ats')) return;

        const data = Storage.getLastRun();
        if (!data) {
            $('#strategy-label').textContent = 'No data — please run tailoring first.';
            return;
        }

        const { strategy, original, tailored, metrics } = data;
        const stratLabel = Prompts.labels[strategy] || strategy;
        $('#strategy-label').textContent = 'Strategy: ' + stratLabel;

        // Тексты
        $('#original-text').textContent = original;
        $('#tailored-text').textContent = tailored || '(Baseline — no AI was used, original resume returned unchanged.)';

        // Метрики
        $('#m-ats').textContent = metrics.ats_score + '%';
        $('#m-ats-bar').style.width = metrics.ats_score + '%';

        $('#m-hall').textContent = metrics.hallucination_score + '%';
        $('#m-hall-bar').style.width = Math.min(metrics.hallucination_score * 3, 100) + '%';

        $('#m-tailor').textContent = metrics.tailoring_score.toFixed(1) + '/5';
        $('#m-flesch').textContent = metrics.flesch_score.toFixed(1);

        // Hallucination list
        const hallContainer = $('#hallucination-list');
        if (metrics.hallucinated_facts.length === 0) {
            hallContainer.innerHTML = '<p class="empty-msg">No hallucinations detected. ✓</p>';
        } else {
            hallContainer.innerHTML = metrics.hallucinated_facts
                .map(f => `<span class="kw-tag hallucinated">⚠ ${escapeHtml(f)}</span>`)
                .join('');
        }

        // ATS keyword list
        const atsContainer = $('#ats-list');
        const foundTags = metrics.ats_found.map(k =>
            `<span class="kw-tag found">✓ ${escapeHtml(k)}</span>`
        );
        const missTags = metrics.ats_missing.map(k =>
            `<span class="kw-tag missing">✗ ${escapeHtml(k)}</span>`
        );
        atsContainer.innerHTML = (foundTags.length + missTags.length > 0)
            ? foundTags.join('') + missTags.join('')
            : '<p class="empty-msg">No keywords extracted.</p>';

        // Copy button
        $('#copy-btn')?.addEventListener('click', () => {
            const text = tailored || original;
            navigator.clipboard.writeText(text).then(() => {
                $('#copy-btn').textContent = 'Copied ✓';
                setTimeout(() => { $('#copy-btn').textContent = 'Copy to clipboard'; }, 1500);
            });
        });
    }

    // ============================================================
    // COMPARE PAGE
    // ============================================================
    function initComparePage() {
        if (!$('#summary-body')) return;

        const data = Storage.getLastCompare();
        if (!data) {
            $('#no-data').classList.remove('hidden');
            $('#summary-section').classList.add('hidden');
            return;
        }

        const order = ['baseline', 'naive', 'ats', 'ats_antihall'];

        // Summary table
        const rows = [
            ['ATS Coverage (%)', 'ats_score', '%'],
            ['Hallucination Rate (%)', 'hallucination_score', '%'],
            ['Tailoring Score (1-5)', 'tailoring_score', ''],
            ['Readability (Flesch)', 'flesch_score', ''],
            ['Combined Score', 'combined_score', '']
        ];

        const tbody = $('#summary-body');
        tbody.innerHTML = rows.map(([label, key, suffix]) => {
            const cells = order.map(s => {
                const v = data.results[s]?.metrics?.[key];
                if (v === undefined || v === null) return '<td>—</td>';
                const num = (typeof v === 'number') ? (Number.isInteger(v) ? v : v.toFixed(1)) : v;
                return `<td>${num}${suffix}</td>`;
            }).join('');
            return `<tr><th>${label}</th>${cells}</tr>`;
        }).join('');

        // Side-by-side outputs
        const fourBox = $('#four-outputs');
        fourBox.innerHTML = order.map(s => {
            const r = data.results[s];
            if (!r) return '';
            const label = Prompts.labels[s];
            const m = r.metrics;
            const text = r.error
                ? `<p style="color:var(--danger)">Error: ${escapeHtml(r.error)}</p>`
                : `<pre class="text-block">${escapeHtml(r.output || '(baseline — original)')}</pre>`;
            return `
                <div class="strategy-output">
                    <h3>${label}</h3>
                    <div class="mini-metrics">
                        <span class="mini-metric">ATS <strong>${m.ats_score}%</strong></span>
                        <span class="mini-metric">Hall <strong>${m.hallucination_score}%</strong></span>
                        <span class="mini-metric">Tailor <strong>${m.tailoring_score.toFixed(1)}</strong></span>
                        <span class="mini-metric">Flesch <strong>${m.flesch_score.toFixed(1)}</strong></span>
                        <span class="mini-metric">Combined <strong>${m.combined_score}</strong></span>
                    </div>
                    ${text}
                </div>`;
        }).join('');
    }

    // ============================================================
    // ADMIN STATS PAGE
    // ============================================================
    function initAdminStatsPage() {
        if (!$('#counts')) return;

        const experiments = Storage.getExperiments();
        const strategies = ['baseline', 'naive', 'ats', 'ats_antihall'];

        // Counts list
        const byStrategy = {};
        strategies.forEach(s => byStrategy[s] = []);
        experiments.forEach(e => {
            if (byStrategy[e.strategy_used]) byStrategy[e.strategy_used].push(e);
        });

        const countsList = $('#counts');
        countsList.innerHTML = `
            <li><strong>${experiments.length}</strong><span>Total experiments</span></li>
            <li><strong>${byStrategy.baseline.length}</strong><span>Baseline</span></li>
            <li><strong>${byStrategy.naive.length}</strong><span>Naive AI</span></li>
            <li><strong>${byStrategy.ats.length}</strong><span>ATS-Optimized</span></li>
            <li><strong>${byStrategy.ats_antihall.length}</strong><span>ATS + Anti-Hall</span></li>
        `;

        // Average metrics
        const avgBody = $('#avg-body');
        avgBody.innerHTML = strategies.map(s => {
            const list = byStrategy[s];
            if (list.length === 0) {
                return `<tr><th>${Prompts.labels[s]}</th><td>0</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
            }
            const avg = (key) => {
                const sum = list.reduce((a, b) => a + (b.metrics?.[key] || 0), 0);
                return (sum / list.length).toFixed(1);
            };
            return `<tr>
                <th>${Prompts.labels[s]}</th>
                <td>${list.length}</td>
                <td>${avg('ats_score')}%</td>
                <td>${avg('hallucination_score')}%</td>
                <td>${avg('tailoring_score')}</td>
                <td>${avg('flesch_score')}</td>
            </tr>`;
        }).join('');

        // Full log
        const logBody = $('#log-body');
        logBody.innerHTML = experiments.slice().reverse().map((e, i) => {
            const d = new Date(e.timestamp).toLocaleString();
            const m = e.metrics || {};
            return `<tr>
                <td>${experiments.length - i}</td>
                <td>${d}</td>
                <td>${Prompts.labels[e.strategy_used] || e.strategy_used}</td>
                <td>${m.ats_score ?? '—'}%</td>
                <td>${m.hallucination_score ?? '—'}%</td>
                <td>${(m.tailoring_score ?? 0).toFixed?.(1) || '—'}</td>
                <td>${(m.flesch_score ?? 0).toFixed?.(1) || '—'}</td>
            </tr>`;
        }).join('');

        // Export JSON
        $('#export-json')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(experiments, null, 2)], { type: 'application/json' });
            downloadBlob(blob, 'experiments.json');
        });

        // Export CSV
        $('#export-csv')?.addEventListener('click', () => {
            const headers = ['id','timestamp','strategy','ats_score','hallucination_score','tailoring_score','flesch_score','combined_score'];
            const lines = [headers.join(',')];
            experiments.forEach(e => {
                const m = e.metrics || {};
                lines.push([
                    e.id,
                    e.timestamp,
                    e.strategy_used,
                    m.ats_score ?? '',
                    m.hallucination_score ?? '',
                    m.tailoring_score ?? '',
                    m.flesch_score ?? '',
                    m.combined_score ?? ''
                ].join(','));
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
            downloadBlob(blob, 'experiments.csv');
        });

        // Cl
