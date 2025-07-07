'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingBubble } from "@/components/ui/LoadingBubble";
import { MarkDown } from "@/components/markdown";
import { Introduction } from "@/components/introduction";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, X } from "lucide-react";
import type { Chat, CoachRole } from "@/app/types";
import { content } from "@/app/chat/content";

export default function ChatApp() {
  const [input, setInput] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [selectedChatId, setSelectedChatId] = useState<number>(0);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chat, setChat] = useState<Map<number, Chat>>(new Map());

  const [userType, setUserType] = useState<string>("");
  const [coachType, setCoachType] = useState<string>("coach");
  const [ageGroup, setAgeGroup] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('es');

  const updateChats = (_chat: Chat) => {
    const newMap = new Map(chat);
    newMap.set(_chat.id, _chat);
    setChat(newMap);
    setSelectedChatId(_chat.id);
  };

  const sendMessage = async (overrideInput?: string) => {
    const message = overrideInput ?? input;
    console.log(input)
    if (!message.trim()) return;
    const currentChat = chat.get(selectedChatId);
    if(!currentChat || !currentChat.userInfo) return;

    setInput("");
    setLoading(true);

    // Call RAG
    try {
      const response = await fetch('api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question: message, userInfo: currentChat.userInfo })
      });
      const data = await response.json();
      
      // Update message_history
      currentChat.messages.push(
          { sender: "user", text: message }, 
          { sender: "ai", text: data.answer}
      );
      updateChats(currentChat);
    } catch(err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const startNewChat = () => {
    const newChat = { id: Date.now(), name: "", messages: [] };
    updateChats(newChat);
    setSelectedChatId(newChat.id);
  };

  const handleLanguageChange = (value: 'es' | 'en') => {
    setLanguage(value);
    localStorage.setItem('lang', value);
  };

  useEffect(() => {
    const _chat = chat.get(selectedChatId);
    if(_chat) setSelectedChat(_chat);
    const savedLang = localStorage.getItem('lang');
    if (savedLang === 'es' || savedLang === 'en') {
      setLanguage(savedLang);
    } else {
      setLanguage('en');
    }
  }, [selectedChatId, chat, language]);

  return (
    <div className="flex h-screen">

      {/* Sidebar */}
      <div className={`bg-gray-100 w-64 p-4 space-y-4 border-r ${sidebarOpen ? "block" : "hidden"}`}>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">EducaAi</h1>
          <button onClick={() => setSidebarOpen(false)}>
            <X className="cursor-pointer"/>
          </button>
        </div>
        <Button className="w-full cursor-pointer" onClick={startNewChat}>{content[language].sidebar}</Button>
        <div className="space-y-2">
          {[...chat.entries()].map(([, chat]) => (
            <div
              key={chat.id}
              className={`cursor-pointer p-2 rounded ${chat.id === selectedChatId ? "bg-blue-200" : "bg-white"}`}
              onClick={() => {
                setSelectedChatId(chat.id);
              }}
            >
              {chat.name}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        <div className="p-2 border-b flex items-center justify-between">

          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)}>
                <Menu className="cursor-pointer"/>
              </button>
            )}
          </div>

          {/* Language selector fixed at top-right */}
          <div className="top-4 right-4">
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">🇪🇸 ES</SelectItem>
                <SelectItem value="en">🇬🇧 EN</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
         { !selectedChat || !selectedChat.userInfo ? (
            <div className="space-y-4 max-w-sm mx-auto mt-10">
              {content[language].welcome}
              <Select value={userType} onValueChange={setUserType}>
                <SelectTrigger>
                  <SelectValue placeholder={content[language].placeholderPlayer} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jovenes">{content[language].optionsPlayer.youth}</SelectItem>
                  <SelectItem value="adultos">{content[language].optionsPlayer.adults}</SelectItem>
                  <SelectItem value="professionales">{content[language].optionsPlayer.professionals}</SelectItem>
                </SelectContent>
              </Select>


              { userType == "jovenes" && (
              <>
              <Select value={coachType} onValueChange={setCoachType}>
                <SelectTrigger>
                  <SelectValue placeholder={content[language].placeholderCoach} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">{content[language].optionsCoach.coach}</SelectItem>
                  <SelectItem value="parent">{content[language].optionsCoach.parent}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder={content[language].placeholderAge} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => 6 + i).map((age) => (
                    <SelectItem key={age} value={`${String(age)} AÑOS`}>{age} {content[language].age}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </>
              )}

              { userType == "adultos" && (
              <>
              <Select value={coachType} onValueChange={setCoachType}>
                <SelectTrigger>
                  <SelectValue placeholder={content[language].placeholderCoach} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">{content[language].optionsCoach.coach}</SelectItem>
                  <SelectItem value="parent">{content[language].optionsCoach.parent}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder={content[language].placeholderAdults} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADULTOS INICIACION">{content[language].optionsAdult.beginner}</SelectItem>
                  <SelectItem value="ADULTOS PERFECCIONAMIENTO">{content[language].optionsAdult.intermediate}</SelectItem>
                  <SelectItem value="ADULTOS TECNIFICACIÓN">{content[language].optionsAdult.advanced}</SelectItem>
                  <SelectItem value="ADULTOS COMPETICIÓN">{content[language].optionsAdult.competition}</SelectItem>
                </SelectContent>
              </Select>
              </>
              )}

              { userType == "professionales" && (
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder={content[language].placeholderATP} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATP_WTA_Tierra">{content[language].optionsATP.clay}</SelectItem>
                  <SelectItem value="ATP_WTA_Rapida">{content[language].optionsATP.hard}</SelectItem>
                  <SelectItem value="ATP_WTA_Indoor">{content[language].optionsATP.indoor}</SelectItem>
                </SelectContent>
              </Select>
              )}

              {content[language].end}

              <Button
                className="w-full cursor-pointer"
                disabled={!coachType || !ageGroup }
                onClick={() => {
                  const id = selectedChatId == 0 ? Date.now() : selectedChatId;
                  const _chat: Chat = {
                    id: id,
                    name: ageGroup,
                    messages: [{
                      sender: "ai",
                      text: content[language].startIntro,
                    }],
                    userInfo: {
                      userType: coachType as CoachRole,
                      ageGroup: ageGroup 
                    }
                  };
                  updateChats(_chat);
                }}
              >
              {content[language].startChat}
              </Button>
            </div>
          ) : (
            <>
            {selectedChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`p-2 rounded  mx-auto ${msg.sender === "user" ? "bg-blue-200 max-w-lg" : "max-w-2xl"}`}
              >
                <div className="prose prose-sm sm:prose-base overflow-x-auto max-w-screen-xl">
                {selectedChat.messages.length === 1 ? 
                  <Introduction chat={selectedChat} sendMessage={sendMessage}/>
                : (
                  <MarkDown text={msg.text} />
                )
                }
                </div>
              </div>
            ))}
            {loading && <LoadingBubble />}
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <div className="flex gap-2 max-w-2xl w-full mx-auto">
          <Input
            className="flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={content[language].typeMessage}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <Button className="cursor-pointer" onClick={() => sendMessage()}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

