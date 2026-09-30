import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ApplicationConflictError, ApplicationNotFoundError, ApplicationSafetyError, transitionStoredApplication } from "@/db/applications";
import { InvalidApplicationTransition, type ApplicationEvent } from "@/lib/application/state-machine";
const answerSet=z.object({answers:z.record(z.string(),z.union([z.string().max(20_000),z.number(),z.boolean()])),unansweredFields:z.array(z.string().min(1).max(500)).max(500)});
const pause=z.enum(["captcha","mfa","assessment","legal_attestation","demographic_question","salary_ambiguity","missing_answer","linkedin_application","site_changed","user_requested"]);
const schema=z.discriminatedUnion("type",[z.object({type:z.literal("answers_updated"),revision:z.number().int().positive(),answerSet}),z.object({type:z.literal("review_requested")}),z.object({type:z.literal("approved"),approvalId:z.string().min(1).max(200),approvedAt:z.string().datetime(),answerRevision:z.number().int().nonnegative()}),z.object({type:z.literal("queued")}),z.object({type:z.literal("worker_started")}),z.object({type:z.literal("worker_paused"),reason:pause}),z.object({type:z.literal("resumed")}),z.object({type:z.literal("submitted"),submittedAt:z.string().datetime(),confirmationReference:z.string().min(1).max(1000)}),z.object({type:z.literal("failed"),lastErrorSummary:z.string().min(1).max(1000).optional()}),z.object({type:z.literal("withdrawn")})]);
const requestSchema=z.object({idempotencyKey:z.string().min(1).max(200),transition:schema});
export const dynamic="force-dynamic";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 try{
  const parsed=requestSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Invalid transition",issues:parsed.error.issues},{status:400});
  const {id}=await context.params,value=parsed.data.transition;
  const answerSetValue=value.type==="answers_updated"?value.answerSet:undefined;
  const lastErrorSummary=value.type==="failed"?value.lastErrorSummary:undefined;
  const event={...value} as Record<string,unknown>;delete event.answerSet;delete event.lastErrorSummary;
  const application=await transitionStoredApplication({ownerId:user.userId,applicationId:id,idempotencyKey:parsed.data.idempotencyKey,event:event as ApplicationEvent,answerSet:answerSetValue,lastErrorSummary});
  return NextResponse.json({application});
 }catch(error){
  if(error instanceof ApplicationNotFoundError)return NextResponse.json({error:error.message},{status:404});
  if(error instanceof ApplicationConflictError)return NextResponse.json({error:error.message},{status:409});
  if(error instanceof ApplicationSafetyError||error instanceof InvalidApplicationTransition)return NextResponse.json({error:error.message},{status:422});
  console.error("Unable to transition application",error);return NextResponse.json({error:"The transition could not be saved."},{status:503});
 }
}
