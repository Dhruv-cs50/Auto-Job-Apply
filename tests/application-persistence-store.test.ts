import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationSafetyError, createApplicationStore, type ApplicationDatabase } from "../db/applications.ts";

type Row=Record<string,unknown>;
class Statement { values:unknown[]=[]; readonly db:MemoryDb; readonly sql:string; constructor(db:MemoryDb,sql:string){this.db=db;this.sql=sql} bind(...values:unknown[]){this.values=values;return this} async first<T>(){return this.db.first(this) as T|null} async all<T>(){return {results:this.db.all(this) as T[]}} async run(){return this.db.run(this)} }
class MemoryDb implements ApplicationDatabase {
 apps:Row[]=[];events:Row[]=[];
 prepare(sql:string){return new Statement(this,sql)}
 first(statement:Statement){const s=statement.sql,v=statement.values;if(s.includes("FROM application_events")){return this.events.find(e=>e.id===v[0]&&e.owner_id===v[1])??null}if(s.includes("idempotency_key = ?"))return this.apps.find(a=>a.owner_id===v[0]&&a.idempotency_key===v[1])??null;if(s.includes("WHERE id = ? AND owner_id = ?"))return this.apps.find(a=>a.id===v[0]&&a.owner_id===v[1])??null;return null}
 all(statement:Statement){const s=statement.sql,v=statement.values;if(s.includes("FROM application_events"))return this.events.filter(e=>e.owner_id===v[0]&&e.application_id===v[1]);return this.apps.filter(a=>a.owner_id===v[0]).slice(0,Number(v[1]))}
 async run(statement:Statement){if(statement.sql.includes("INSERT INTO applications")){const [id,owner_id,job_id,answer_set_json,idempotency_key,notes]=statement.values;const now="2026-09-29 12:00:00";this.apps.push({id,owner_id,job_id,status:"draft",answer_set_json,answer_revision:0,approved_answer_revision:null,approval_id:null,idempotency_key,blocked_reason:null,last_error_summary:null,approved_at:null,submitted_at:null,confirmation_reference:null,notes,created_at:now,updated_at:now});return {meta:{changes:1}}}return {meta:{changes:0}}}
 async batch(statements:Statement[]){const [event,update]=statements;const ev=event.values,up=update.values;const app=this.apps.find(a=>a.id===ev[7]&&a.owner_id===ev[8]&&a.status===ev[9]&&a.answer_revision===ev[10]&&a.approved_answer_revision===ev[11]&&a.approval_id===ev[12]);if(!app)return [{meta:{changes:0}},{meta:{changes:0}}];this.events.push({id:ev[0],owner_id:ev[1],application_id:ev[2],event_type:ev[3],from_status:ev[4],to_status:ev[5],detail_json:ev[6],created_at:"2026-09-29 12:00:01"});Object.assign(app,{status:up[0],answer_set_json:up[1],answer_revision:up[2],approved_answer_revision:up[3],approval_id:up[4],blocked_reason:up[5],last_error_summary:up[6],approved_at:up[7],submitted_at:up[8],confirmation_reference:up[9],updated_at:"2026-09-29 12:00:01"});return [{meta:{changes:1}},{meta:{changes:1}}]}
}

test("applications are owner scoped and creation is idempotent",async()=>{const db=new MemoryDb(),store=createApplicationStore(db);const first=await store.create({ownerId:"owner-a",jobId:"job-1",idempotencyKey:"create-1"});const replay=await store.create({ownerId:"owner-a",jobId:"job-1",idempotencyKey:"create-1"});assert.equal(replay.id,first.id);assert.equal(await store.get("owner-b",first.id),null);assert.equal((await store.list("owner-b")).length,0)});

test("new drafts fail closed until the application form has been captured",async()=>{
 const store=createApplicationStore(new MemoryDb());
 const app=await store.create({ownerId:"owner-a",jobId:"job-1",idempotencyKey:"create-1"});
 assert.deepEqual(app.answerSet.unansweredFields,["application_form_not_loaded"]);
 await assert.rejects(()=>store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"review",event:{type:"review_requested"}}),ApplicationSafetyError);
});


test("unanswered fields block review and sensitive encounters are durably paused",async()=>{
 const db=new MemoryDb(),store=createApplicationStore(db);
 let app=await store.create({ownerId:"owner-a",jobId:"job-1",idempotencyKey:"create-1"});
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"answers-1",event:{type:"answers_updated",revision:1},answerSet:{answers:{name:"Ada"},unansweredFields:["salary"]}});
 await assert.rejects(()=>store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"review-bad",event:{type:"review_requested"}}),ApplicationSafetyError);
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"answers-2",event:{type:"answers_updated",revision:2},answerSet:{answers:{name:"Ada",salary:100000},unansweredFields:[]}});
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"review",event:{type:"review_requested"}});
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"approve",event:{type:"approved",approvalId:"approval-1",approvedAt:"2026-09-29T19:00:00.000Z",answerRevision:2}});
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"queue",event:{type:"queued"}});
 const replay=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"queue",event:{type:"queued"}});
 assert.equal(replay.status,"queued");
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"start",event:{type:"worker_started"}});
 app=await store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"pause",event:{type:"worker_paused",reason:"captcha"}});
 assert.equal(app.status,"paused");assert.equal(app.blockedReason,"captcha");
 const events=await store.listEvents("owner-a",app.id);
 assert.deepEqual(events.map(e=>e.eventType),["answers_updated","answers_updated","review_requested","approved","queued","worker_started","worker_paused"]);
 assert.equal(events.at(-1)?.detail.reason,"captcha");
});


test("submission cannot bypass review and approval",async()=>{
 const store=createApplicationStore(new MemoryDb());
 const app=await store.create({ownerId:"owner-a",jobId:"job-1",idempotencyKey:"create-1",answerSet:{answers:{name:"Ada"},unansweredFields:[]}});
 await assert.rejects(()=>store.transition({ownerId:"owner-a",applicationId:app.id,idempotencyKey:"submit",event:{type:"submitted",submittedAt:"2026-09-29T19:00:00.000Z",confirmationReference:"receipt-1"}}),/not allowed from draft/);
});
