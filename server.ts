import 'dotenv/config';
import express from 'express';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, maxRedirects: 15 }));

const app = express();
const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post('/api/personalize', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('API_KEY_INVALID: process.env.GEMINI_API_KEY is not set');
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const { landingPageUrl, adCreativeBase64, mimeType, tone, audience } = req.body;

      if (!landingPageUrl || !adCreativeBase64) {
        sendEvent({ step: 'error', error: 'Missing required fields' });
        return res.end();
      }

      sendEvent({ step: 'fetching', message: 'Fetching landing page...' });
      // 1. Fetch Landing Page HTML
      const response = await client.get(landingPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        },
        responseType: 'text'
      });
      
      const html = response.data;
      const $ = cheerio.load(html);

      sendEvent({ step: 'analyzing', message: 'Analyzing content...' });
      // 2. Inject base tag
      const urlObj = new URL(landingPageUrl);
      $('head').prepend(`<base href="${urlObj.origin}${urlObj.pathname}">`);
      
      // Also disable scripts to prevent them from breaking the srcdoc or redirecting
      $('script').remove();

      // 3. Extract text elements
      const elementsToRewrite: { id: string, text: string }[] = [];
      let idCounter = 0;
      
      $('h1, h2, h3, p, a, button').each((i, el) => {
        const text = $(el).text().trim();
        // Only rewrite meaningful text blocks
        if (text.length > 10 && text.length < 300 && idCounter < 30) {
          const id = `troo-id-${idCounter++}`;
          $(el).attr('data-troo-id', id);
          elementsToRewrite.push({ id, text });
        }
      });

      if (elementsToRewrite.length === 0) {
        sendEvent({ step: 'done', html: $.html(), originalHtml: $.html() });
        return res.end();
      }

      sendEvent({ step: 'generating', message: 'Generating copy with AI...' });
      // 4. Call Gemini
      const prompt = `
You are an expert Conversion Rate Optimization (CRO) copywriter.
I am providing you with an ad creative image and a list of text elements extracted from a landing page.
Your task is to rewrite these text elements to:
1. Match the messaging and offer of the ad creative.
2. Apply CRO principles to increase conversions.
3. Use a ${tone || 'professional'} tone of voice.
4. Target the following audience: ${audience || 'general audience'}.
5. Maintain the original length and intent of the text as much as possible so it doesn't break the UI.

Here are the text elements (ID: Text):
${elementsToRewrite.map(e => `${e.id}: ${e.text}`).join('\n')}

Return a JSON object where the keys are the IDs and the values are the rewritten text. Do not include markdown formatting like \`\`\`json.
`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { data: adCreativeBase64.split(',')[1], mimeType: mimeType || 'image/jpeg' } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      sendEvent({ step: 'applying', message: 'Applying changes...' });
      const responseText = geminiResponse.text;
      const originalHtml = $.html();
      
      if (responseText) {
        const rewrittenData = JSON.parse(responseText);
        
        // 5. Replace text in HTML
        for (const [id, newText] of Object.entries(rewrittenData)) {
          if (typeof newText === 'string') {
            $(`[data-troo-id="${id}"]`).text(newText);
          }
        }
      }

      // 6. Return modified HTML
      sendEvent({ step: 'done', html: $.html(), originalHtml });
      res.end();

    } catch (error: any) {
      let userMessage = 'An unexpected error occurred while personalizing the page.';
      let resolution = 'Please try again later or contact support.';
      let statusCode = 500;

      const errorCode = error.code || error.cause?.code;

      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status || 400;
        if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || error.message.includes('ENOTFOUND')) {
          userMessage = 'Could not reach the landing page URL.';
          resolution = 'Check if the URL is correct and the site is online.';
          statusCode = 400;
        } else if (statusCode === 403 || statusCode === 401 || statusCode === 999) {
          userMessage = 'The landing page blocked our request (Bot Protection / Access Denied).';
          resolution = 'The target website has strict anti-bot protection (like Cloudflare or LinkedIn). Try a different URL that does not have strict bot protection.';
        } else if (statusCode === 404) {
          userMessage = 'The landing page URL could not be found (404).';
          resolution = 'Please check the URL for typos and make sure the page exists.';
        } else if (statusCode === 429) {
          userMessage = 'The landing page is rate-limiting our requests (Too Many Requests).';
          resolution = 'Please wait a while before trying this URL again, or try a different URL.';
        } else if (errorCode === 'ECONNABORTED' || error.message.includes('timeout')) {
          userMessage = 'The request to the landing page timed out.';
          resolution = 'The target website might be down or too slow. Try again later.';
        } else {
          userMessage = `Failed to fetch the landing page (HTTP ${statusCode}).`;
          resolution = 'Ensure the URL is publicly accessible and try again.';
        }
      } else if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED') {
        userMessage = 'Could not reach the landing page URL.';
        resolution = 'Check if the URL is correct and the site is online.';
        statusCode = 400;
      } else if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
        userMessage = 'The Gemini API key is invalid or missing.';
        resolution = 'Please check your environment variables and ensure a valid GEMINI_API_KEY is set.';
        statusCode = 401;
      } else if (error.message?.toLowerCase().includes('gemini') || error.message?.includes('GoogleGenAI') || error.status === 429) {
        userMessage = 'The AI service encountered an error or rate limit.';
        resolution = 'Please wait a moment and try again.';
        statusCode = 503;
      } else if (error instanceof SyntaxError || error.message?.includes('JSON')) {
        userMessage = 'The AI generated an invalid response format.';
        resolution = 'This is a temporary AI glitch. Please try again.';
      }

      // Only log full stack trace for actual 500 server errors
      if (statusCode === 500) {
        console.error('Error personalizing (500):', error);
      } else if (statusCode === 401) {
        console.error(`Error personalizing (401):`, error.message);
      }

      sendEvent({ 
        step: 'error',
        error: userMessage, 
        details: error.message || String(error),
        resolution 
      });
      res.end();
    }
  });

if (!process.env.VERCEL) {
  const startLocalServer = async () => {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  };
  startLocalServer();
}

export default app;
