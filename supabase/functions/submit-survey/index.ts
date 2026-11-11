import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const ALLOWED_ORIGINS = new Set([
  "https://just254q.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
]);
const BASE_HEADERS = {
  "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};
const EXPECTED = new Map([
  ["baby-01",{cot:1,baseline:42,programmed:42}],
  ["baby-02",{cot:2,baseline:50,programmed:62}],
  ["baby-03",{cot:3,baseline:40,programmed:68}],
  ["baby-04",{cot:4,baseline:48,programmed:82}],
  ["baby-05",{cot:5,baseline:38,programmed:24}],
  ["baby-06",{cot:6,baseline:44,programmed:44}],
  ["baby-07",{cot:7,baseline:46,programmed:46}],
  ["baby-08",{cot:8,baseline:40,programmed:40}]
]);
const RATINGS = new Set(["green","yellow","red"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(body:Record<string,unknown>,status=200,origin:string|null=null){
  const headers = new Headers(BASE_HEADERS);
  headers.set("Content-Type","application/json");
  if(origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin",origin);
  return new Response(JSON.stringify(body),{status,headers});
}
function getAllowedPublishableKeys():string[]{
  const raw=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(raw){
    try {
      const parsed=JSON.parse(raw);
      if(parsed && typeof parsed==="object") return Object.values(parsed).filter((key):key is string=>typeof key==="string"&&key.length>0);
    } catch { console.error("Could not parse Supabase publishable keys configuration"); }
  }
  const legacy=Deno.env.get("SUPABASE_ANON_KEY");
  return legacy?[legacy]:[];
}
function validateSubmission(input:any):string|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return"Invalid submission body";
  if(typeof input.participant_id!=="string"||!UUID_PATTERN.test(input.participant_id))return"Invalid anonymous session identifier";
  if(input.consent_given!==true)return"Consent is required";
  if(typeof input.consent_version!=="string"||!input.consent_version.trim()||input.consent_version.length>80)return"Invalid consent version";
  if(!Array.isArray(input.presentation_order)||input.presentation_order.length!==8)return"Presentation order must contain eight scenarios";
  if(new Set(input.presentation_order).size!==8||input.presentation_order.some((id:unknown)=>!EXPECTED.has(String(id))))return"Invalid presentation order";
  if(!Array.isArray(input.responses)||input.responses.length!==8)return"Exactly eight scenario responses are required";
  const ids=input.responses.map((r:any)=>r?.scenario_id);
  if(new Set(ids).size!==8||ids.some((id:string)=>!EXPECTED.has(id)))return"Each of the eight unique scenarios must be answered";
  if(input.presentation_order.some((id:string,index:number)=>ids[index]!==id))return"Response order does not match the presented order";
  for(const r of input.responses){
    const expected=EXPECTED.get(r.scenario_id)!;
    if(Number(r.cot_number)!==expected.cot||Number(r.baseline_rr)!==expected.baseline||Number(r.programmed_current_rr)!==expected.programmed)return"Scenario metadata did not match the study configuration";
    if(!RATINGS.has(r.first_rating)||!RATINGS.has(r.final_rating))return"Each scenario needs an initial and final rating";
    if(!Number.isInteger(r.confidence)||r.confidence<1||r.confidence>5)return"Confidence must be from 1 to 5";
    if(typeof r.unrealistic_baby!=="boolean")return"The realism response is missing";
    if(!Array.isArray(r.events)||!Array.isArray(r.rating_events)||r.events.length>100||r.rating_events.length>100)return"Rating timing records are missing or exceed the allowed size";
    for(const ev of r.rating_events){
      if(!RATINGS.has(ev?.color))return"A rating event has an invalid rating";
      if(!Number.isFinite(Number(ev?.live_seconds))||Number(ev.live_seconds)<0||Number(ev.live_seconds)>30)return"A rating event has an invalid live timestamp";
    }
    if(typeof r.simulated_pattern!=="string"||r.simulated_pattern.length>300)return"Invalid simulated pattern metadata";
    if(String(r.comments??"").length>2000||String(r.additional_information_needed??"").length>2000)return"A comment is too long";
  }
  if(String(input.clinical_role??"").length>120||String(input.neonatal_experience??"").length>120)return"Profile field is too long";
  if(JSON.stringify(input.final_questions??{}).length>10000)return"Final questionnaire is too large";
  return null;
}
Deno.serve(async(req)=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS"){
    if(origin && !ALLOWED_ORIGINS.has(origin))return response({error:"Origin not allowed"},403);
    return new Response("ok",{status:200,headers:{...BASE_HEADERS,"Access-Control-Allow-Origin":origin&&ALLOWED_ORIGINS.has(origin)?origin:"https://just254q.github.io"}});
  }
  if(origin && !ALLOWED_ORIGINS.has(origin))return response({error:"Origin not allowed"},403);
  if(!origin || !ALLOWED_ORIGINS.has(origin))return response({error:"Origin not allowed"},403,origin);
  if(req.method!=="POST")return response({error:"Method not allowed"},405,origin);

  // The server, not the browser, determines whether a record is test or research.
  // With research collection closed, accepted submissions are stored as test records only.
  // Official research submissions require both server-side release settings.
  const researchCollectionEnabled=Deno.env.get("RESEARCH_COLLECTION_ENABLED")==="true";
  const approvedConsentVersion=(Deno.env.get("APPROVED_CONSENT_VERSION")??"").trim();
  if(researchCollectionEnabled && !approvedConsentVersion){
    return response({error:"The approved consent version is not configured on the submission service."},503,origin);
  }

  const suppliedKey=req.headers.get("apikey")??"";
  const allowedKeys=getAllowedPublishableKeys();
  if(!allowedKeys.length||!allowedKeys.includes(suppliedKey))return response({error:"A valid project publishable key is required"},401,origin);
  const raw=await req.text();
  if(raw.length>250_000)return response({error:"Submission is too large"},413,origin);
  let input:any;
  try{input=JSON.parse(raw);}catch{return response({error:"Invalid JSON"},400,origin);}
  const problem=validateSubmission(input);
  if(problem)return response({error:problem},400,origin);
  if(researchCollectionEnabled && input.consent_version!==approvedConsentVersion){
    return response({error:"The submitted consent version does not match the currently approved study information."},409,origin);
  }

  const url=Deno.env.get("SUPABASE_URL");
  let secretKey:string|undefined;
  const secretJson=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(secretJson){
    try{const keys=JSON.parse(secretJson);secretKey=keys?.default;}catch{console.error("Could not parse Supabase secret keys configuration");}
  }
  secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
  if(!url||!secretKey)return response({error:"Submission service is not configured"},503,origin);

  // Never trust input.is_test. While research collection is closed, the server stores
  // submissions exclusively as test records. When research is opened, records are research.
  const isTest=!researchCollectionEnabled;
  const admin=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const row={
    participant_id:input.participant_id,
    clinical_role:input.clinical_role||null,
    neonatal_experience:input.neonatal_experience||null,
    presentation_order:input.presentation_order,
    responses:input.responses,
    final_questions:input.final_questions||{},
    consent_given:true,
    consent_version:input.consent_version,
    client_version:input.client_version||null,
    is_test:isTest
  };
  const {data:inserted,error}=await admin.from("submissions").insert(row).select("id").single();
  if(error?.code==="23505"){
    // Idempotent retry after a lost HTTP response: return the previously stored submission ID.
    const {data:existing,error:lookupError}=await admin.from("submissions").select("id").eq("participant_id",input.participant_id).maybeSingle();
    if(!lookupError&&existing?.id)return response({submission_id:existing.id,saved:true,already_submitted:true,record_type:isTest?"test":"research"},200,origin);
  }
  if(inserted?.id&&!error)return response({submission_id:inserted.id,saved:true,record_type:isTest?"test":"research"},200,origin);
  console.error("Submission insert failed",error?.code||"unknown",error?.message||"");
  return response({error:"The server could not save this completed survey"},500,origin);
});
