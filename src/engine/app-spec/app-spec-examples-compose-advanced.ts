// Compose drafts for the richer atoms: a list per person (expense log), the people picker (leader
// vote), random teams, host-paced steps with a timer, and an RSVP with conditional + date inputs. Used by templates, the keyword mock and tests.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

export const exampleExpenseLog: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Sổ chi tiêu chuyến đi",
  description: "Ai chi khoản nào thì ghi một dòng; app cộng lại và tính ai chuyển cho ai.",
  theme: "forest",
  requireName: true,
  blocks: [
    {
      type: "compose",
      id: "expenses",
      title: "Ghi khoản chi",
      note: "Mỗi khoản một dòng, sửa/xoá được.",
      entries: "many",
      inputs: [
        { id: "amount", kind: "number", label: "Số tiền", required: true, ...noOpts, min: 0, max: 100000000, unit: "đ" },
        { id: "for", kind: "text", label: "Cho việc gì", required: true, ...noOpts },
      ],
      views: [
        { id: "settle", kind: "split", title: "Ai chuyển cho ai", source: "amount", op: null, topN: null, visibleTo: "everyone" },
        { id: "all", kind: "table", title: "Tất cả khoản chi", source: null, op: null, topN: null, visibleTo: "everyone" },
      ],
    },
  ],
};

export const exampleLeaderVote: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Bầu trưởng nhóm",
  description: "Chọn một người trong phòng, kết quả hiện sau khi bầu.",
  theme: "ink",
  requireName: true,
  blocks: [
    {
      type: "compose",
      id: "leader",
      title: "Bạn bầu ai làm trưởng nhóm?",
      note: null,
      inputs: [{ id: "who", kind: "person", label: "Bạn bầu ai làm trưởng nhóm?", required: true, ...noOpts, multi: false }],
      views: [{ id: "votes", kind: "bars", title: null, source: "who", op: null, topN: null, visibleTo: "after_submit" }],
    },
  ],
};

export const exampleRandomTeams: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Chia đội ngẫu nhiên",
  description: "Mọi người vào app, host bấm chia 3 đội.",
  theme: "sunset",
  requireName: true,
  blocks: [
    {
      type: "compose",
      id: "teams",
      title: "Chia đội",
      note: "Mở app là có tên trong danh sách.",
      inputs: [],
      views: [{ id: "draw", kind: "teams", title: "Các đội", source: null, op: null, topN: null, teams: 3, visibleTo: "everyone" }],
    },
  ],
};

export const exampleStepSurvey: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Hỏi nhanh từng câu",
  description: "Host mở từng câu, mỗi câu 20 giây; kết quả hiện khi đóng câu.",
  theme: "ocean",
  requireName: false,
  blocks: [
    {
      type: "compose",
      id: "rounds",
      title: "Hỏi nhanh",
      note: null,
      flow: "steps",
      inputs: [
        {
          id: "q1",
          kind: "choice",
          label: "Bạn thích làm việc lúc nào?",
          required: true,
          ...noOpts,
          multi: false,
          timeLimitSec: 20,
          options: [
            { id: "sang", label: "Buổi sáng", price: null },
            { id: "chieu", label: "Buổi chiều", price: null },
            { id: "dem", label: "Ban đêm", price: null },
          ],
        },
        { id: "q2", kind: "rating", label: "Tuần này bạn thấy thế nào?", required: true, ...noOpts, max: 5, timeLimitSec: 20 },
      ],
      views: [
        { id: "r1", kind: "bars", title: "Giờ làm việc", source: "q1", op: null, topN: null, visibleTo: "after_step" },
        { id: "r2", kind: "stat", title: "Điểm tuần này", source: "q2", op: "avg", topN: null, visibleTo: "after_step" },
      ],
    },
  ],
};

export const exampleRsvp: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Xác nhận tham dự tiệc cuối năm",
  description: "Đi thì chọn ngày tới và số người đi cùng; không đi thì cho biết lý do.",
  theme: "sunset",
  requireName: true,
  blocks: [
    {
      type: "compose",
      id: "rsvp",
      title: "Bạn có tham dự không?",
      note: null,
      inputs: [
        {
          id: "going",
          kind: "choice",
          label: "Bạn có tham dự không?",
          required: true,
          ...noOpts,
          multi: false,
          options: [
            { id: "yes", label: "Có", price: null },
            { id: "no", label: "Không", price: null },
          ],
        },
        { id: "day", kind: "date", label: "Ngày bạn tới", required: true, ...noOpts, showIf: { input: "going", equals: "yes" } },
        { id: "guests", kind: "number", label: "Số người đi cùng", required: false, ...noOpts, min: 0, max: 10, showIf: { input: "going", equals: "yes" } },
        { id: "why", kind: "text", label: "Lý do (không bắt buộc)", required: false, ...noOpts, max: 30, showIf: { input: "going", equals: "no" } },
      ],
      views: [
        { id: "answers", kind: "bars", title: "Tham dự", source: "going", op: null, topN: null, visibleTo: "everyone" },
        { id: "days", kind: "bars", title: "Theo ngày", source: "day", op: null, topN: null, visibleTo: "everyone" },
        { id: "list", kind: "table", title: "Danh sách", source: null, op: null, topN: null, visibleTo: "host" },
      ],
    },
  ],
};
