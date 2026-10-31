// Chat apps: everyone sends short messages into one live feed (backchannel during a talk, class chat).
// Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function chatRoom(t: { title: string; description: string; block: string; note: string; message: string; view: string }, locale: "vi" | "en"): AppSpecDraft {
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "ocean",
    requireName: true,
    blocks: [
      {
        type: "compose",
        id: "chat",
        title: t.block,
        note: t.note,
        entries: "many",
        inputs: [{ id: "message", kind: "text", label: t.message, required: true, ...noOpts, max: 30 }],
        views: [{ id: "feed", kind: "chat", title: t.view, source: "message", op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const exampleChatRoom: AppSpecDraft = chatRoom(
  {
    title: "Phòng chat",
    description: "Nhắn tin trực tiếp cho cả phòng; tin mới nhất ở dưới cùng.",
    block: "Trò chuyện",
    note: "Nhập tin nhắn rồi bấm Gửi.",
    message: "Tin nhắn",
    view: "Cuộc trò chuyện",
  },
  "vi",
);

export const exampleChatRoomEn: AppSpecDraft = chatRoom(
  {
    title: "Chat room",
    description: "Live chat for the whole room; the newest message is at the bottom.",
    block: "Chat",
    note: "Type a message and press Send.",
    message: "Message",
    view: "Conversation",
  },
  "en",
);
