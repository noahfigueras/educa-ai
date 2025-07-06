export const content: any = {
  es: {
    sidebar: "Nuevo Chat",
    welcome: (
      <>
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
      </>
    ),
    placeholderPlayer: "A quien entrenas...",
    optionsPlayer: {
      youth: "Jovenes", 
      adults: "Adultos", 
      professionals: "Professionales"
    },
    placeholderCoach: "Soy un...",
    optionsCoach: {
      coach: "Entrenador",
      parent: "Padre"
    },
    placeholderAge: "Edad del Jugador",
    age: "años",
    placeholderAdults: "Nivel del Jugador",
    optionsAdult: {
      beginner: "Iniciación",
      intermediate: "Perfeccionamiento",
      advanced: "Tecnificación",
      competition: "Competición"
    },
    placeholderATP: "Tipo de juego",
    optionsATP: {
      clay: "Pista de Tierra Batida",
      hard: "Pista Dura",
      indoor: "Pista Indoor / Hierba"
    },
    end: (
      <>
      <p className="text-gray-700">
      Prepárate para descubrir ejercicios, consejos técnico-tácticos y planificación según tu etapa de desarrollo.
        </p>
      <p className="text-center font-semibold text-green-800">
      ¡Comencemos!
      </p>
      </>
    ),
    startChat: "Comenzar chat",
    startIntro: "¡Hola! Aquí puedo ayudarte en crear tus sesiones de entreno para tus jugadores. Aquí van algunas sugerencias:",
    suggestions: [
      "¿Cuáles son los objetivos técnico-tácticos de este programa?",
      "Proporcióname los objetivos del primer trimestre.",
      "Quiero ver las 3 primeras sesiones del primer trimestre.",
      "Muéstrame la segunda sesión del segundo trimestre.",
      "¿Qué significa trayectoria parabólica?",
      "Dame ejercicios de coordinación óculo-manual."
    ],
    placeHolderMessageSend: "Escribe tu mensaje..."
  },
  en: {
    sidebar: "New Chat",
    welcome: (
      <>
      <h2 className="text-xl font-semibold text-center">
      🎾 Welcome to EducaAI, your tennis training assistant.
        </h2>
      <p className="text-gray-800 text-center">
      Your assistant for tennis training.
          </p>
        <p className="text-gray-700">
      I'm here to help you plan and improve your training sessions, whether you're a <strong>coach</strong>, <strong>player</strong>, or <strong>parent</strong>.
        </p>
      <p className="text-gray-700">
      👉 Before we begin, select your role and the player's age. This will help me give you personalized responses tailored to your level and needs.
        </p>
      </>
    ),
    placeholderPlayer: "Who are you training...",
    optionsPlayer: {
      youth: "Youth", 
      adults: "Adults", 
      professionals: "Professionals"
    },
    placeholderCoach: "I am...",
    optionsCoach: {
      coach: "Coach",
      parent: "Parent"
    },
    placeholderAge: "Age of player",
    age: "years",
    placeholderAdults: "Level of the player",
    optionsAdult: {
      beginner: "Beginner",
      intermediate: "Improvement",
      advanced: "Technical Training",
      competition: "Competition"
    },
    placeholderATP: "Type of court",
    optionsATP: {
      clay: "Clay",
      hard: "Hard Court",
      indoor: "Indoor / Grass"
    },
    end: (
      <>
      <p className="text-gray-700">
      Get ready to discover exercises, technical-tactical advice, and planning tailored to your stage of development.
        </p>
      <p className="text-center font-semibold text-green-800">
      Let's get started!
      </p>
      </>

    ),
    startChat: "Start Chat",
    placeHolderMessageSend: "Type your message here...",
    startIntro: "Hi! I'm here to help you create training sessions for your players. Below are some suggestions:",
    suggestions: [
     "What are the technical-tactical objectives of this program?",
     "Give me the objectives of the first trimester.",
     "I want to see the first 3 sessions of the first trimester.",
     "Show me the second session of the second trimester.",
     "What does 'parabolic trajectory' mean?",
     "Give me exercises for eye-hand coordination."
    ]
  },
};

