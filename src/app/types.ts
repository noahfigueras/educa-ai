export type Message = {
    sender: "user" | "ai";
    text: any;
};

export type Chat = {
    id: number;
    name: string;
    messages: Message[];
    userInfo?: UserInfo;
};

export type UserInfo = {
  ageGroup: string;
  userType: CoachRole;
}

export type CoachRole = "parent" | "player" | "coach";
