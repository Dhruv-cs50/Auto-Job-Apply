import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getApplication, listApplicationEvents } from "@/db/applications";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){const user=await getChatGPTUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});try{const {id}=await context.params;const application=await getApplication(user.userId,id);if(!application)return NextResponse.json({error:"Application not found."},{status:404});const events=await listApplicationEvents(user.userId,id);return NextResponse.json({application,events})}catch(error){console.error("Unable to load application",error);return NextResponse.json({error:"The application is temporarily unavailable."},{status:503})}}
