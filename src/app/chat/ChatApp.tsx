'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Chat, CoachRole } from "@/app/types";

export default function ChatApp() {
  const [input, setInput] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [selectedChatId, setSelectedChatId] = useState<number>(0);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chat, setChat] = useState<Map<number, Chat>>(new Map());

  const [userType, setUserType] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const updateChats = (_chat: Chat) => {
    const newMap = new Map(chat);
    newMap.set(_chat.id, _chat);
    setChat(newMap);
    setSelectedChatId(_chat.id);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const currentChat = chat.get(selectedChatId);
    if(!currentChat || !currentChat.userInfo) return;

    setInput("");
    setLoading(true);

    // Call RAG
    try {
      const response = await fetch('api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question: input, userInfo: currentChat.userInfo })
      });
      const data = await response.json();
      
      // Update message_history
      currentChat.messages.push(
          { sender: "user", text: input }, 
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
    const newChat = { id: Date.now(), messages: [] };
    updateChats(newChat);
    setSelectedChatId(newChat.id);
  };

  useEffect(() => {
    const _chat = chat.get(selectedChatId);
    if(_chat) setSelectedChat(_chat);
  }, [selectedChatId, chat]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className={`bg-gray-100 w-64 p-4 space-y-4 border-r ${sidebarOpen ? "block" : "hidden"}`}>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">EducaAi</h1>
          <button onClick={() => setSidebarOpen(false)}>
            <X />
          </button>
        </div>
        <Button className="w-full" onClick={startNewChat}>New Chat</Button>
        <div className="space-y-2">
          {[...chat.entries()].map(([, chat]) => (
            <div
              key={chat.id}
              className={`cursor-pointer p-2 rounded ${chat.id === selectedChatId ? "bg-blue-200" : "bg-white"}`}
              onClick={() => {
                setSelectedChatId(chat.id);
              }}
            >
              Chat {chat.id}
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
                <Menu />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
         { !selectedChat || !selectedChat.userInfo ? (
            <div className="space-y-4 max-w-sm mx-auto mt-10">
              <h2 className="text-xl font-semibold text-center">
                🎾 Bienvenido a EducaAI, tu asistente de entrenamiento de tenis.
              </h2>
              <p className="text-gray-800 text-center">
                Tu asistente de entrenamiento de tenis.
              </p>
              <p className="text-gray-700">
                Estoy aquí para ayudarte a planificar y mejorar tus sesiones de entrenamiento, ya seas <strong>entrenador</strong>, <strong>jugador</strong> o <strong>padre</strong>.
              </p>
              <p className="text-gray-700">
               👉 Antes de comenzar, selecciona tu rol y la edad del jugador. Esto me permitirá darte respuestas personalizadas y adaptadas a tu nivel y necesidades.
              </p>
              <Select value={userType} onValueChange={setUserType}>
                <SelectTrigger>
                  <SelectValue placeholder="I am a..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">Coach</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Plyaer age" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => 5 + i).map((age) => (
                    <SelectItem key={age} value={String(age)}>{age} años</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-gray-700">
               Prepárate para descubrir ejercicios, consejos técnico-tácticos y planificación según tu etapa de desarrollo.
              </p>
              <p className="text-center font-semibold text-green-800">
               ¡Comencemos!
              </p>

              <Button
                className="w-full"
                disabled={!userType || !ageGroup }
                onClick={() => {
                  const id = selectedChatId == 0 ? Date.now() : selectedChatId;
                  const _chat: Chat = {
                    id: id,
                    messages: [{
                      sender: "ai",
                      text: `¡Gracias! Como puedo ayudarte con tus entrenamientos de tenis.`,
                    }],
                    userInfo: {
                      userType: userType as CoachRole,
                      age: Number(ageGroup) 
                    }
                  };
                  updateChats(_chat);
                }}
              >
                Start Chat
              </Button>
            </div>
          ) : (
            <>
            {selectedChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`p-2 rounded max-w-lg ${msg.sender === "user" ? "bg-blue-200 self-end ml-auto" : "bg-gray-200"}`}
              >
                <div className="prose prose-sm sm:prose-base max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && <LoadingBubble />}
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <Input
            className="flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </div>
    </div>
  );
}

const LoadingBubble = () => {
  return (
    <div className="flex space-x-1 items-center p-2 rounded-xl bg-gray-200 w-fit">
      <span className="h-2 w-2 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="h-2 w-2 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="h-2 w-2 bg-gray-600 rounded-full animate-bounce"></span>
    </div>
  );
};
