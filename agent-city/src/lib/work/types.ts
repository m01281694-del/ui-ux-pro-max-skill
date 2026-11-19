import { z } from "zod";

export const ContentStatus = z.enum(["idée", "script", "voix", "visuels", "montage", "brand_check", "approbation", "programmé", "publié", "analysé", "leçon"]);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const TaskSchema = z.object({
  id: z.string(),
  demo: z.boolean(),
  dept: z.enum(["research", "content", "publish", "community", "sales", "loop"]),
  job: z.string(),
  title: z.string(),
  detail: z.string().optional(),
  start: z.number(),
  end: z.number(),
  residentId: z.number(),
  contentId: z.string().optional(),
  stage: ContentStatus.optional(),
  output: z.object({ kind: z.string(), label: z.string(), url: z.string().optional() }).optional(),
  platform: z.enum(["tiktok", "instagram", "youtube", "x", "email"]).optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ContentSchema = z.object({
  id: z.string(),
  demo: z.boolean(),
  kind: z.enum(["video", "carousel", "newsletter"]),
  number: z.number(),
  title: z.string(),
  hook: z.string(),
  trend: z.string(),
  created: z.number(),
  publishAt: z.number(),
  stages: z.array(z.object({ stage: ContentStatus, at: z.number() })),
  stats: z.object({ views: z.number(), likes: z.number(), shares: z.number(), saves: z.number(), retention: z.number() }).optional(),
  brandScore: z.number().optional(),
});
export type Content = z.infer<typeof ContentSchema>;

export interface FeedItem {
  ts: number;
  kind: "start" | "done" | "life";
  text: string;
  dept?: string;
  job?: string;
  residentId?: number;
  platform?: string;
  demo: boolean;
  taskId?: string;
}
