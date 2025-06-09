'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Chat, CoachRole } from "@/app/types";

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
            <X className="cursor-pointer"/>
          </button>
        </div>
        <Button className="w-full cursor-pointer" onClick={startNewChat}>New Chat</Button>
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
                  <SelectValue placeholder="A quien entrenas..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jovenes">Jovenes</SelectItem>
                  <SelectItem value="adultos">Adultos</SelectItem>
                  <SelectItem value="professionales">Professionales</SelectItem>
                </SelectContent>
              </Select>


              { userType == "jovenes" && (
              <>
              <Select value={coachType} onValueChange={setCoachType}>
                <SelectTrigger>
                  <SelectValue placeholder="Soy un..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">Entrenador</SelectItem>
                  <SelectItem value="parent">Padre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Edad del Jugador" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => 6 + i).map((age) => (
                    <SelectItem key={age} value={`${String(age)} AÑOS`}>{age} años</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </>
              )}

              { userType == "adultos" && (
              <>
              <Select value={coachType} onValueChange={setCoachType}>
                <SelectTrigger>
                  <SelectValue placeholder="Soy un..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">Entrenador</SelectItem>
                  <SelectItem value="player">Jugador</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Nivel del jugador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADULTOS INICIACION">Iniciación</SelectItem>
                  <SelectItem value="ADULTOS PERFECCIONAMIENTO">Perfeccionamiento</SelectItem>
                  <SelectItem value="ADULTOS TECNIFICACIÓN">Tecnificación</SelectItem>
                  <SelectItem value="ADULTOS COMPETICIÓN">Competición</SelectItem>
                </SelectContent>
              </Select>
              </>
              )}

              { userType == "professionales" && (
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de juego" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATP_WTA_Tierra">Pista de Tierra Batida</SelectItem>
                  <SelectItem value="ATP_WTA_Rapida">Pista Dura</SelectItem>
                  <SelectItem value="ATP_WTA_Indoor">Pista Indoor / Hierba</SelectItem>
                </SelectContent>
              </Select>
              )}

              <p className="text-gray-700">
               Prepárate para descubrir ejercicios, consejos técnico-tácticos y planificación según tu etapa de desarrollo.
              </p>
              <p className="text-center font-semibold text-green-800">
               ¡Comencemos!
              </p>

              <Button
                className="w-full"
                disabled={!coachType || !ageGroup }
                onClick={() => {
                  const id = selectedChatId == 0 ? Date.now() : selectedChatId;
                  const _chat: Chat = {
                    id: id,
                    name: ageGroup,
                    messages: [{
                      sender: "ai",
                      text: `¡Gracias! Como puedo ayudarte con tus entrenamientos de tenis.`,
                    }],
                    userInfo: {
                      userType: coachType as CoachRole,
                      ageGroup: ageGroup 
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
                <div className="prose prose-sm sm:prose-base overflow-x-auto max-w-screen-xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-6 mb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-5 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                      table: ({node, ...props}) => (
                        <table className="min-w-full border border-gray-300 shadow-sm my-4 text-sm text-left">
                          {props.children}
                        </table>
                      ),
                      thead: ({node, ...props}) => (
                        <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-300">
                          {props.children}
                        </thead>
                      ),
                      tr: ({node, ...props}) => (
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          {props.children}
                        </tr>
                      ),
                      th: ({node, ...props}) => (
                        <th className="px-4 py-2 border-r last:border-r-0">
                          {props.children}
                        </th>
                      ),
                      td: ({node, ...props}) => (
                        <td className="px-4 py-2 border-r last:border-r-0">
                          {props.children}
                        </td>
                      ),
                      }}
                >
                {msg.text}
                </ReactMarkdown>
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
          <Button className="cursor-pointer" onClick={sendMessage}>Send</Button>
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
