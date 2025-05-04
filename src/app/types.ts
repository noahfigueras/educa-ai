export type Message = {
    sender: "user" | "ai";
    text: string;
};

export type Chat = {
    id: number;
    messages: Message[];
    userInfo?: UserInfo;
};

export type UserInfo = {
  age: number;
  userType: CoachRole;
}

export type CoachRole = "parent" | "player" | "coach";
