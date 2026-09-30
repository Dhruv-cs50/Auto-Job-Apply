import { transitionApplication, type ApplicationEvent, type ApplicationSnapshot, type ApplicationStatus, type PauseReason } from "../lib/application/state-machine.ts";

type Result<T = unknown> = { results?: T[]; meta?: { changes?: number } };
type Statement = { bind(...values: unknown[]): Statement; first<T = unknown>(): Promise<T | null>; all<T = unknown>(): Promise<Result<T>>; run(): Promise<Result> };
export type ApplicationDatabase = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<Result[]> };
export type AnswerSet = { answers: Record<string, string | number | boolean>; unansweredFields: string[] };
export type StoredApplication = ApplicationSnapshot & { ownerId: string; answerSet: AnswerSet; idempotencyKey: string | null; lastErrorSummary: string | null; notes: string; createdAt: string; updatedAt: string };
export type StoredApplicationEvent = { id: string; applicationId: string; eventType: string; fromStatus: ApplicationStatus; toStatus: ApplicationStatus; detail: Record<string, unknown>; createdAt: string };
export class ApplicationNotFoundError extends Error {}
export class ApplicationConflictError extends Error {}
export class ApplicationSafetyError extends Error {}

type ApplicationRow = { id:string; owner_id:string; job_id:string; status:ApplicationStatus; answer_set_json:string; answer_revision:number; approved_answer_revision:number|null; approval_id:string|null; idempotency_key:string|null; blocked_reason:PauseReason|null; last_error_summary:string|null; approved_at:string|null; submitted_at:string|null; confirmation_reference:string|null; notes:string; created_at:string; updated_at:string };
type EventRow = { id:string; application_id:string; event_type:string; from_status:ApplicationStatus; to_status:ApplicationStatus; detail_json:string; created_at:string };
const SELECT_APPLICATION = `SELECT id, owner_id, job_id, status, answer_set_json, answer_revision, approved_answer_revision, approval_id, idempotency_key, blocked_reason, last_error_summary, approved_at, submitted_at, confirmation_reference, notes, created_at, updated_at FROM applications`;

function parseAnswerSet(json:string):AnswerSet {
  try { const value=JSON.parse(json) as Partial<AnswerSet>; if(value && typeof value.answers==="object" && Array.isArray(value.unansweredFields)) return { answers:value.answers as AnswerSet["answers"], unansweredFields:value.unansweredFields as string[] }; } catch {}
  return { answers:{}, unansweredFields:["unknown"] };
}
function mapApplication(row:ApplicationRow):StoredApplication { return { id:row.id, ownerId:row.owner_id, jobId:row.job_id, status:row.status, answerSet:parseAnswerSet(row.answer_set_json), answerRevision:row.answer_revision, approvedAnswerRevision:row.approved_answer_revision, approvalId:row.approval_id, idempotencyKey:row.idempotency_key, blockedReason:row.blocked_reason, lastErrorSummary:row.last_error_summary, approvedAt:row.approved_at, submittedAt:row.submitted_at, confirmationReference:row.confirmation_reference, notes:row.notes, createdAt:row.created_at, updatedAt:row.updated_at }; }
function requireComplete(application:StoredApplication) { const empty=Object.entries(application.answerSet.answers).filter(([,v])=>typeof v==="string" && !v.trim()).map(([k])=>k); if(new Set([...application.answerSet.unansweredFields,...empty]).size) throw new ApplicationSafetyError("All application fields must be answered before review, approval, queueing, or submission."); }
function eventDetail(event:ApplicationEvent,requestKey:string):Record<string,unknown> { switch(event.type) { case "answers_updated":return {requestKey,revision:event.revision}; case "approved":return {requestKey,approvalId:event.approvalId,answerRevision:event.answerRevision}; case "worker_paused":return {requestKey,reason:event.reason}; case "submitted":return {requestKey,confirmationReference:event.confirmationReference}; default:return {requestKey}; } }

export function createApplicationStore(db:ApplicationDatabase) {
  async function get(ownerId:string,id:string):Promise<StoredApplication|null> { const row=await db.prepare(`${SELECT_APPLICATION} WHERE id = ? AND owner_id = ? LIMIT 1`).bind(id,ownerId).first<ApplicationRow>(); return row?mapApplication(row):null; }
  async function getOrThrow(ownerId:string,id:string) { const app=await get(ownerId,id); if(!app) throw new ApplicationNotFoundError("Application not found."); return app; }
  return {
    get,
    async list(ownerId:string,limit=50) { const r=await db.prepare(`${SELECT_APPLICATION} WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ?`).bind(ownerId,limit).all<ApplicationRow>(); return (r.results??[]).map(mapApplication); },
    async create(input:{ownerId:string;jobId:string;answerSet?:AnswerSet;idempotencyKey:string;notes?:string}) {
      const storedKey=`${input.ownerId}:${input.idempotencyKey}`;
      const existing=await db.prepare(`${SELECT_APPLICATION} WHERE owner_id = ? AND idempotency_key = ? LIMIT 1`).bind(input.ownerId,storedKey).first<ApplicationRow>();
      if(existing) { if(existing.job_id!==input.jobId) throw new ApplicationConflictError("Idempotency key was already used for a different job."); return mapApplication(existing); }
      const id=crypto.randomUUID(), answerSet=input.answerSet??{answers:{},unansweredFields:["application_form_not_loaded"]};
      await db.prepare(`INSERT INTO applications (id, owner_id, job_id, answer_set_json, idempotency_key, notes) VALUES (?, ?, ?, ?, ?, ?)`).bind(id,input.ownerId,input.jobId,JSON.stringify(answerSet),storedKey,input.notes??"").run();
      return getOrThrow(input.ownerId,id);
    },
    async listEvents(ownerId:string,applicationId:string):Promise<StoredApplicationEvent[]> {
      await getOrThrow(ownerId,applicationId);
      const r=await db.prepare(`SELECT id, application_id, event_type, from_status, to_status, detail_json, created_at FROM application_events WHERE owner_id = ? AND application_id = ? ORDER BY created_at ASC, id ASC`).bind(ownerId,applicationId).all<EventRow>();
      return (r.results??[]).map(row=>({id:row.id,applicationId:row.application_id,eventType:row.event_type,fromStatus:row.from_status,toStatus:row.to_status,detail:JSON.parse(row.detail_json),createdAt:row.created_at}));
    },
    async transition(input:{ownerId:string;applicationId:string;event:ApplicationEvent;answerSet?:AnswerSet;idempotencyKey:string;lastErrorSummary?:string}) {
      const eventId=`transition:${input.applicationId}:${input.idempotencyKey}`;
      const replay=await db.prepare("SELECT event_type FROM application_events WHERE id = ? AND owner_id = ? LIMIT 1").bind(eventId,input.ownerId).first<{event_type:string}>();
      if(replay) { if(replay.event_type!==input.event.type) throw new ApplicationConflictError("Idempotency key was already used for a different transition."); return getOrThrow(input.ownerId,input.applicationId); }
      const current=await getOrThrow(input.ownerId,input.applicationId);
      if(["review_requested","approved","queued","worker_started","resumed","submitted"].includes(input.event.type)) requireComplete(current);
      if(input.event.type==="answers_updated" && !input.answerSet) throw new ApplicationSafetyError("Answer updates require an explicit answer set.");
      const next=transitionApplication(current,input.event);
      const answerSet=input.event.type==="answers_updated"?input.answerSet!:current.answerSet;
      const detail=JSON.stringify(eventDetail(input.event,input.idempotencyKey));
      const guard=[input.applicationId,input.ownerId,current.status,current.answerRevision,current.approvedAnswerRevision,current.approvalId] as const;
      const eventStatement=db.prepare(`INSERT INTO application_events (id, owner_id, application_id, event_type, from_status, to_status, detail_json) SELECT ?, ?, ?, ?, ?, ?, ? FROM applications WHERE id = ? AND owner_id = ? AND status = ? AND answer_revision = ? AND approved_answer_revision IS ? AND approval_id IS ?`).bind(eventId,input.ownerId,input.applicationId,input.event.type,current.status,next.status,detail,...guard);
      const updateStatement=db.prepare(`UPDATE applications SET status = ?, answer_set_json = ?, answer_revision = ?, approved_answer_revision = ?, approval_id = ?, blocked_reason = ?, last_error_summary = ?, approved_at = ?, submitted_at = ?, confirmation_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ? AND status = ? AND answer_revision = ? AND approved_answer_revision IS ? AND approval_id IS ?`).bind(next.status,JSON.stringify(answerSet),next.answerRevision,next.approvedAnswerRevision,next.approvalId,next.blockedReason,input.event.type==="failed"?input.lastErrorSummary??"Worker failed":current.lastErrorSummary,next.approvedAt,next.submittedAt,next.confirmationReference,...guard);
      const [eventResult,updateResult]=await db.batch([eventStatement,updateStatement]);
      if(eventResult.meta?.changes!==1 || updateResult.meta?.changes!==1) throw new ApplicationConflictError("Application changed before the transition could be saved.");
      return getOrThrow(input.ownerId,input.applicationId);
    }
  };
}
async function defaultStore() { const {env}=await import("cloudflare:workers"); if(!env.DB) throw new Error("D1 binding DB is unavailable"); return createApplicationStore(env.DB as ApplicationDatabase); }
type Store=ReturnType<typeof createApplicationStore>;
export async function listApplications(ownerId:string,limit?:number){return (await defaultStore()).list(ownerId,limit)}
export async function getApplication(ownerId:string,id:string){return (await defaultStore()).get(ownerId,id)}
export async function createApplication(input:Parameters<Store["create"]>[0]){return (await defaultStore()).create(input)}
export async function listApplicationEvents(ownerId:string,id:string){return (await defaultStore()).listEvents(ownerId,id)}
export async function transitionStoredApplication(input:Parameters<Store["transition"]>[0]){return (await defaultStore()).transition(input)}
