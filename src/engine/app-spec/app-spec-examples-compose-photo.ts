// Photo contest: everyone posts photos, the host approves each one before the room sees it, everyone
// likes their favourites. Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function photoContest(t: { title: string; description: string; block: string; note: string; photo: string; caption: string; view: string }, locale: "vi" | "en"): AppSpecDraft {
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
        id: "photos",
        title: t.block,
        note: t.note,
        entries: "many",
        inputs: [
          { id: "photo", kind: "photo", label: t.photo, required: true, ...noOpts },
          { id: "caption", kind: "text", label: t.caption, required: false, ...noOpts, max: 15 },
        ],
        views: [{ id: "wall", kind: "board", title: t.view, source: "photo", op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const examplePhotoContest: AppSpecDraft = photoContest(
  {
    title: "Thi ảnh chuyến đi",
    description: "Gửi ảnh đẹp nhất của bạn; ảnh hiện cho mọi người sau khi host duyệt, ai cũng thả tim được.",
    block: "Gửi ảnh",
    note: "Mỗi người gửi tối đa 10 ảnh.",
    photo: "Ảnh của bạn",
    caption: "Chú thích",
    view: "Ảnh được yêu thích",
  },
  "vi",
);

export const examplePhotoContestEn: AppSpecDraft = photoContest(
  {
    title: "Trip photo contest",
    description: "Post your best shot; photos show for everyone once the host approves them, and anyone can like.",
    block: "Post a photo",
    note: "Up to 10 photos each.",
    photo: "Your photo",
    caption: "Caption",
    view: "Favourite photos",
  },
  "en",
);
