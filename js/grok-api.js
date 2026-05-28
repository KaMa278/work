const GrokAPI = {

    ENDPOINT: 'https://api.x.ai/v1/chat/completions',
    MODEL: 'grok-4-latest',

    async call(prompt, apiKey) {
        if (!apiKey) throw new Error('API key is missing. Paste it on the upload page.');
        if (!prompt) throw new Error('Prompt is empty.');

        const body = {
            model: this.MODEL,
            temperature: 0,      
            max_tokens: 2000,
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional resume editor. Return only the resume text, without explanations, markdown headers, or commentary.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };

        let response;
        try {
            response = await fetch(this.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(body)
            });
        } catch (networkErr) {
            throw new Error('Network error: ' + networkErr.message);
        }

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = `Grok API error ${response.status}`;
            try {
                const errJson = JSON.parse(errText);
                errMsg += ': ' + (errJson.error?.message || errJson.error || errText);
            } catch (_) {
                errMsg += ': ' + errText.slice(0, 200);
            }
            throw new Error(errMsg);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response from Grok API.');

        return content.trim();
    },

    async callMultiple(resume, jobDescription, apiKey) {
        const tasks = [
            { id: 'naive',        prompt: Prompts.naive(resume, jobDescription) },
            { id: 'ats',          prompt: Prompts.ats(resume, jobDescription) },
            { id: 'ats_antihall', prompt: Prompts.atsAntiHall(resume, jobDescription) }
        ];

        const results = await Promise.allSettled(
            tasks.map(t => this.call(t.prompt, apiKey))
        );

        const out = { baseline: resume };
        tasks.forEach((t, i) => {
            const r = results[i];
            out[t.id] = r.status === 'fulfilled'
                ? r.value
                : { error: r.reason?.message || 'Unknown error' };
        });

        return out;
    }
};
