import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const expected = new Map([
  ["baby-01",{cot:1,baseline:42,programmed:42}],["baby-02",{cot:2,baseline:50,programmed:62}],
  ["baby-03",{cot:3,baseline:40,programmed:68}],["baby-04",{cot:4,baseline:48,programmed:82}],
  ["baby-05",{cot:5,baseline:38,programmed:24}],["baby-06",{cot:6,baseline:44,programmed:44}],
  ["baby-07",{cot:7,baseline:46,programmed:46}],["baby-08",{cot:8,baseline:40,programmed:40}]
]);
const ratingValues=new Set(["green","yellow","red"]);
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:corsHeaders});}
function validateSubmission(input:any):string|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return"Invalid submission body";
 if(typeof input.participant_id!=="string"||!uuidPattern.test(input.participant_id))return"Invalid anonymous session identifier";
 if(input.consent_given!==true)return"Consent is required";
 if(!Array.isArray(input.presentation_order)||input.presentation_order.length!==8)return"Presentation order must contain eight scenarios";
 if(new Set(input.presentation_order).size!==8||input.presentation_order.some((id:unknown)=>!expected.has(String(id))))return"Invalid presentation order";
 if(!Array.isArray(input.responses)||input.responses.length!==8)return"Exactly eight scenario responses are required";
 const ids=input.responses.map((r:any)=>r?.scenario_id);
 if(new Set(ids).size!==8||ids.some((id:string)=>!expected.has(id)))return"Each of the eight unique scenarios must be answered";
 if(input.presentation_order.some((id:string,index:number)=>ids[index]!==id))return"Response order does not match the presented order";
 for(const response of input.responses){
  const e=expected.get(response.scenario_id)!;
  if(Number(response.cot_number)!==e.cot||Number(response.baseline_rr)!==e.baseline||Number(response.programmed_current_rr)!==e.programmed)return"Scenario metadata did not match the study configuration";
  if(!ratingValues.has(response.first_rating)||!ratingValues.has(response.final_rating))return"Each scenario needs an initial and final rating";
  if(!Number.isInteger(response.confidence)||response.confidence<1||response.confidence>5)return"Confidence must be from 1 to 5";
  if(typeof response.unrealistic_baby!=="boolean")return"The realism response is missing";
  if(!Array.isArray(response.events)||!Array.isArray(response.rating_events)||response.events.length>100||response.rating_events.length>100)return"Rating timing records are missing or exceed the allowed size";
  if(typeof response.simulated_pattern!=="string"||response.simulated_pattern.length>300)return"Invalid simulated pattern metadata";
  if(String(response.comments??"").length>2000||String(response.additional_information_needed??"").length>2000)return"A comment is too long";
 }
 if(String(input.clinical_role??"").length>120||String(input.neonatal_experience??"").length>120)return"Profile field is too long";
 if(JSON.stringify(input.final_questions??{}).length>10000)return"Final questionnaire is too large";
 if(String(input.consent_version??"").length>80)return"Invalid consent version";
 return null;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const raw=await req.text();if(raw.length>250_000)return json({error:"Submission is too large"},413);
 let input:any;try{input=JSON.parse(raw);}catch{return json({error:"Invalid JSON"},400);}
 const problem=validateSubmission(input);if(problem)return json({error:problem},400);
 const url=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!serviceRole)return json({error:"Submission service is not configured"},503);
 // Keep privileged credentials in server-side Edge Function secrets only.
 input.is_test = Deno.env.get("SURVEY_ENVIRONMENT") === "test";
 const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
 const{data,error}=await admin.rpc("submit_complete_survey",{p_submission:input});
 if(error){console.error("submit_complete_survey failed",error.message);return json({error:"The server could not save this completed survey"},500);}
 return json({submission_id:data,saved:true});
});
