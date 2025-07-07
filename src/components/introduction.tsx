'use client';

import { useState, useEffect } from "react";
import type { Chat } from "@/app/types";
import { MarkDown } from "@/components/markdown";

type IntroductionProps = {
  chat: Chat;
  sendMessage: (overrideInput?: string) => Promise<void>;
} 

export const Introduction: React.FC<IntroductionProps> = ({ chat, sendMessage }) => {
  const [text, setText] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const getIntro = async () => {
    try {
      if(!chat.userInfo) return;
      const response = await fetch('api/intro', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ageGroup: chat.userInfo.ageGroup })
      });
      const { pageContent, suggestions } = await response.json();
      setText(pageContent);
      setSuggestions(suggestions);
    } catch(err: any) {
      console.log(err);
    }   
  };

  useEffect(() => {
  }, [text, suggestions]);

  useEffect(() => {
    getIntro(); 
  }, [chat]);

  return(
    <>
      { text && suggestions &&
      <div className="space-y-4 max-w-xl mx-auto py-10">
        <p className="text-gray-700">
          <MarkDown text={text} />
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion:string , i: number) => (
            <button
              key={i}
              onClick={() => {sendMessage(suggestion)}} // your function to send this
              className="bg-muted hover:bg-muted/80 text-sm px-4 py-2 rounded-md border shadow-sm transition cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
      }
    </>
  );
}

