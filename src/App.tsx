import React, { useState, useRef, useEffect } from 'react';
import { Upload, Link as LinkIcon, ArrowRight, Loader2, Image as ImageIcon, LayoutTemplate, Sparkles, AlertCircle, RefreshCw, Undo2, Redo2, Download, Moon, Sun } from 'lucide-react';
import { cn } from './lib/utils';

interface ApiError {
  message: string;
  resolution?: string;
  details?: string;
}

export default function App() {
  const [adCreative, setAdCreative] = useState<string | null>(null);
  const [adMimeType, setAdMimeType] = useState<string>('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [tone, setTone] = useState('professional');
  const [audience, setAudience] = useState('general audience');
  const [isLoading, setIsLoading] = useState(false);
  const [personalizedHtml, setPersonalizedHtml] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState<string | null>(null);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             (localStorage.getItem('theme') === 'dark') || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAdCreative(reader.result as string);
        setAdMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExport = () => {
    if (!personalizedHtml) return;
    const blob = new Blob([personalizedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personalized-landing-page.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const runPersonalization = async () => {
    if (!adCreative || !landingPageUrl) {
      setError({ message: 'Please provide both an ad creative and a landing page URL.' });
      return;
    }

    if (!isValidUrl(landingPageUrl)) {
      setError({ 
        message: 'Invalid landing page URL format.',
        resolution: 'Please enter a valid URL starting with http:// or https:// (e.g., https://example.com)'
      });
      return;
    }

    setIsLoading(true);
    setLoadingStep('Initializing...');
    setError(null);
    setPersonalizedHtml(null);
    setOriginalHtml(null);
    setIsShowingOriginal(false);
    setIframeLoading(true);

    try {
      const response = await fetch('/api/personalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          landingPageUrl,
          adCreativeBase64: adCreative,
          mimeType: adMimeType,
          tone,
          audience
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw data;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');
      
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.step === 'error') {
              throw data;
            } else if (data.step === 'done') {
              setPersonalizedHtml(data.html);
              setOriginalHtml(data.originalHtml);
            } else if (data.message) {
              setLoadingStep(data.message);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.error) {
        setError({
          message: err.error,
          resolution: err.resolution,
          details: err.details,
        });
      } else {
        setError({
          message: err.message || 'Failed to connect to the server.',
          resolution: 'Check your internet connection and try again.',
        });
      }
    } finally {
      setIsLoading(false);
      setLoadingStep(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runPersonalization();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans transition-colors duration-200 dark:bg-gray-950 dark:text-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 transition-colors duration-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
              Troopod Personalizer
            </h1>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus:outline-none"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!personalizedHtml ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl transition-colors">
                Personalize Landing Pages with AI
              </h2>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 transition-colors">
                Upload your ad creative and provide a landing page URL. Our AI will automatically rewrite the page's copy to match your ad's messaging and apply CRO best practices.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors duration-200">
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
                
                {/* Ad Creative Section */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    1. Upload Ad Creative
                  </label>
                  <div 
                    className={cn(
                      "mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors",
                      adCreative ? "border-purple-300 bg-purple-50 dark:border-purple-500/50 dark:bg-purple-500/10" : "border-gray-300 hover:border-purple-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-gray-800"
                    )}
                  >
                    <div className="space-y-2 text-center">
                      {adCreative ? (
                        <div className="relative w-full max-w-xs mx-auto">
                          <img src={adCreative} alt="Ad Creative Preview" className="rounded-lg shadow-sm max-h-48 object-contain mx-auto" />
                          <button
                            type="button"
                            onClick={() => setAdCreative(null)}
                            className="absolute -top-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow-md text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full transition-colors">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                          <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center transition-colors">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white dark:bg-transparent rounded-md font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 focus-within:outline-none"
                            >
                              <span>Upload a file</span>
                              <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Landing Page URL Section */}
                <div className="space-y-4">
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    2. Landing Page URL
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      type="url"
                      name="url"
                      id="url"
                      className="focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-700 rounded-xl py-3 border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white dark:placeholder-gray-500 transition-colors"
                      placeholder="https://example.com/landing-page"
                      value={landingPageUrl}
                      onChange={(e) => setLandingPageUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Personalization Settings Section */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    3. Personalization Settings
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="tone" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Tone of Voice
                      </label>
                      <select
                        id="tone"
                        name="tone"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-lg border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                      >
                        <option value="professional">Professional & Trustworthy</option>
                        <option value="playful">Playful & Fun</option>
                        <option value="urgent">Urgent & Action-Oriented</option>
                        <option value="conversational">Conversational & Friendly</option>
                        <option value="persuasive">Persuasive & Bold</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="audience" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Target Audience
                      </label>
                      <select
                        id="audience"
                        name="audience"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-lg border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                      >
                        <option value="general audience">General Audience</option>
                        <option value="young adults">Young Adults (Gen Z / Millennials)</option>
                        <option value="business professionals">Business Professionals (B2B)</option>
                        <option value="parents">Parents & Families</option>
                        <option value="tech enthusiasts">Tech Enthusiasts</option>
                      </select>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/50 shadow-sm transition-colors">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{error.message}</h3>
                            {error.resolution && (
                              <div className="mt-2 text-sm text-red-700 dark:text-red-400/90">
                                <p className="font-semibold">How to fix:</p>
                                <p>{error.resolution}</p>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={runPersonalization}
                            disabled={isLoading}
                            className="ml-4 inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-800 shadow-sm text-xs font-medium rounded-lg text-red-700 dark:text-red-300 bg-white dark:bg-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
                            Retry
                          </button>
                        </div>
                        {error.details && (
                          <div className="mt-3 text-xs text-red-600 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-950/50 p-2 rounded overflow-x-auto">
                            {error.details}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || !adCreative || !landingPageUrl}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        {loadingStep || 'Processing...'}
                      </>
                    ) : (
                      <>
                        Personalize Landing Page
                        <ArrowRight className="ml-2 -mr-1 h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-8rem)] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-colors">
                <LayoutTemplate className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                {isShowingOriginal ? 'Original Landing Page' : 'Personalized Landing Page'}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export HTML
                </button>
                {originalHtml && (
                  <button
                    onClick={() => {
                      setIframeLoading(true);
                      setIsShowingOriginal(!isShowingOriginal);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors"
                  >
                    {isShowingOriginal ? (
                      <>
                        <Redo2 className="w-4 h-4 mr-2" />
                        Show Personalized
                      </>
                    ) : (
                      <>
                        <Undo2 className="w-4 h-4 mr-2" />
                        Show Original
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setPersonalizedHtml(null);
                    setOriginalHtml(null);
                    setIsShowingOriginal(false);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  Create Another
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col transition-colors duration-200">
              <div className="bg-gray-100 dark:bg-gray-950 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 transition-colors">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <div className="ml-4 bg-white dark:bg-gray-800 px-3 py-1 rounded-md text-xs text-gray-500 dark:text-gray-400 flex-1 truncate max-w-md border border-gray-200 dark:border-gray-700 transition-colors">
                  {landingPageUrl}
                </div>
              </div>
              <div className="relative w-full flex-1 bg-white dark:bg-gray-100">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10 transition-colors">
                    <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                    <span className="ml-3 text-gray-600 dark:text-gray-300 font-medium tracking-wide">Rendering preview...</span>
                  </div>
                )}
                <iframe
                  srcDoc={isShowingOriginal ? originalHtml || '' : personalizedHtml || ''}
                  className="w-full h-full border-none"
                  title="Personalized Landing Page"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
