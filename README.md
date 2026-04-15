# Troopod AI Personalizer 🪄

Troopod AI Personalizer is a powerful, full-stack web application designed to automatically rewrite and customize any landing page based on your uploaded ad creatives. Built on top of **Google Gemini**, this application utilizes advanced generative AI to align your landing page's copy, tone, and audience targeting perfectly with your ad messaging to improve Conversion Rate Optimization (CRO).

## ✨ Features

- **Intelligent Page Scraping**: Extracts text from any live web URL using `cheerio` on the backend.
- **Context-Aware AI Rewriting**: Analyzes an uploaded ad creative (image) alongside the scraped landing page text to autonomously generate optimized HTML variants.
- **Personalization Settings**: Adjust the precise *Tone of Voice* (Professional, Playful, Urgent) and define *Target Audiences* (Gen Z, Parents, B2B) directly in the UI.
- **Live Preview**: Instantly renders the modified AI-generated landing page safely alongside the original inside a sandboxed Iframe structure.
- **Export Capabilities**: Seamlessly download the AI-personalized landing page as a localized HTML file.
- **Sleek Aesthetic**: Built using the highly modernized Tailwind CSS v4 featuring responsive design, fluid micro-animations, and a fully polished **Dark/Light Mode**.

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide React (Icons)
- **Backend:** Node.js, Express.js
- **AI Processing:** `@google/genai` (Google Gemini SDK)
- **Data Scraping & Transport:** Cheerio, Axios
- **Deployment:** Vercel (Serverless Functions)

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed along with a valid [Google Gemini API Key](https://aistudio.google.com/app/apikey).

### 1. Installation

Clone this repository and install all dependencies:
```bash
git clone https://github.com/lucifer4330k/Troopod.git
cd Troopod/troopod-ai-personalizer
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory (where your `package.json` is located) and insert your unique Gemini key:

```env
GEMINI_API_KEY="your_api_key_here"
```

### 3. Local Development

Start the development server. This fires up the backend Express API while the Vite middleware serves your React frontend locally on `http://localhost:3000`.

```bash
npm run dev
```

---

## ☁️ Deployment (Vercel)

This application is strictly optimized for immediate production deployment onto Vercel using zero-config or the defined `vercel.json`.

1. Push your code to your GitHub repository.
2. Link the repository to a new project inside the [Vercel Dashboard](https://vercel.com/dashboard).
3. **CRITICAL:** Ensure you go to **Settings > Environment Variables** in your Vercel project and add `GEMINI_API_KEY`.
4. Deploy! Vercel will automatically host the React frontend statically while bundling your `server.ts` into a secure Serverless Function endpoint mapped to `/api/*`.

## 📜 Notice
This project is an advanced demonstration of modern autonomous generative web tooling. If modifying the core `vite` dependencies, remember they dynamically avoid AWS Lambda loads on Vercel deployment inherently coded into `server.ts`.
