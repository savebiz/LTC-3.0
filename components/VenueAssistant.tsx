
import React, { useState } from 'react';
import { askAboutVenue } from '../services/geminiService';

const VenueAssistant: React.FC = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    const result = await askAboutVenue(query);
    setResponse(result.text);
    setSources(result.sources);
    setIsLoading(false);
  };

  return (
    <div className="bg-white/50 backdrop-blur-md border border-indigo-100 rounded-2xl p-6 shadow-lg">
      <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
        Directions Assistant
      </h4>
      
      {response ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{response}</p>
          {sources.length > 0 && (
            <div className="pt-3 border-t border-indigo-50">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-2">Sources</span>
              <div className="flex flex-wrap gap-2">
                {sources.map((src, i) => (
                  src.maps?.uri && (
                    <a key={i} href={src.maps.uri} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      {src.maps.title || 'View on Maps'}
                    </a>
                  )
                ))}
              </div>
            </div>
          )}
          <button 
            onClick={() => setResponse(null)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Ask another question
          </button>
        </div>
      ) : (
        <form onSubmit={handleAsk}>
          <p className="text-xs text-slate-500 mb-4 italic">"How do I get there from Ikeja?" or "Is there parking available?"</p>
          <div className="relative">
            <input 
              type="text"
              placeholder="Ask about directions..."
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default VenueAssistant;
