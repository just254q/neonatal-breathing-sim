/*
 * Scenario definitions for the clinician respiratory-rate survey.
 * These are proposed experimental stimuli, not clinical thresholds or advice.
 * Obtain neonatal-clinical and faculty/ethics approval before recruitment.
 */
export const HISTORY_SECONDS = 480;
export const LIVE_SECONDS = 30;
export const SCENARIO_IDS = ["baby-01","baby-02","baby-03","baby-04","baby-05","baby-06","baby-07","baby-08"];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const ramp=(t,t0,t1,a,b)=>a+(b-a)*smooth((t-t0)/(t1-t0));
export const SCENARIOS={
"baby-01":{id:"baby-01",cot:1,baseline:42,seed:11,live:LIVE_SECONDS,appearance:{skin:"#d9a17e",skinDark:"#a96f50",cap:"#e4b6a7",blanket:"#a9cbd5",style:"cap"},pattern:"synchronized; stable around baseline with small natural fluctuations",trajectory:"stable",seesaw:"none",pauses:[],rr:()=>42,off:()=>0},
"baby-02":{id:"baby-02",cot:2,baseline:50,seed:22,live:LIVE_SECONDS,appearance:{skin:"#c78968",skinDark:"#85553e",cap:"#c3d9b2",blanket:"#d2c3e4",style:"tuft"},pattern:"synchronized; gradually increasing respiratory rate",trajectory:"increase-50-to-62-over-3-minutes",seesaw:"none",pauses:[],rr:t=>ramp(t,-300,-120,50,62),off:()=>0},
"baby-03":{id:"baby-03",cot:3,baseline:40,seed:11,live:LIVE_SECONDS,appearance:{skin:"#a96f50",skinDark:"#70442f",cap:"#b9cce4",blanket:"#e6c8a6",style:"cap"},pattern:"rapid synchronized-to-mild-asynchronous movement; mild seesaw",trajectory:"increase-40-to-68",seesaw:"mild",pauses:[],rr:t=>ramp(t,-330,-240,40,68),off:t=>ramp(t,-120,-105,0,.2)},
"baby-04":{id:"baby-04",cot:4,baseline:48,seed:44,live:LIVE_SECONDS,appearance:{skin:"#754a38",skinDark:"#4d3026",cap:"#e8c9a9",blanket:"#b7d7c9",style:"tuft"},pattern:"very rapid breathing; pronounced paradoxical chest-abdominal movement",trajectory:"increase-48-to-82",seesaw:"pronounced",pauses:[],rr:t=>ramp(t,-330,-240,48,82),off:t=>ramp(t,-180,-150,0,.46)},
"baby-05":{id:"baby-05",cot:5,baseline:38,seed:55,live:LIVE_SECONDS,appearance:{skin:"#b87958",skinDark:"#784a35",cap:"#d9c0e2",blanket:"#b9c7df",style:"cap"},pattern:"slow synchronized breathing; gradually decreasing rate",trajectory:"decrease-38-to-24",seesaw:"none",pauses:[],rr:t=>ramp(t,-360,-180,38,24),off:()=>0},
"baby-06":{id:"baby-06",cot:6,baseline:44,seed:66,live:LIVE_SECONDS,appearance:{skin:"#e2b18f",skinDark:"#a8745a",cap:"#e9d69e",blanket:"#e6b8bb",style:"tuft"},pattern:"rate near baseline; chest and abdomen become asynchronous",trajectory:"stable-around-44",seesaw:"moderate",pauses:[],rr:()=>44,off:t=>ramp(t,-150,-115,0,.34)},
"baby-07":{id:"baby-07",cot:7,baseline:46,seed:77,live:LIVE_SECONDS,appearance:{skin:"#8e5c43",skinDark:"#5d3c2e",cap:"#b2d9dc",blanket:"#d3d6a9",style:"cap"},pattern:"rate rises, remains elevated, then gradually returns to baseline",trajectory:"rise-46-to-76-then-return-to-46",seesaw:"none",pauses:[],rr:t=>{if(t<-360)return 46;if(t<-300)return ramp(t,-360,-300,46,76);if(t<-150)return 76;return ramp(t,-150,-30,76,46);},off:()=>0},
"baby-08":{id:"baby-08",cot:8,baseline:40,seed:88,live:LIVE_SECONDS,appearance:{skin:"#cf9474",skinDark:"#8a5d45",cap:"#d8b7aa",blanket:"#b7c8c9",style:"tuft"},pattern:"stable respiratory rate with a 20-second breathing interruption during live observation",trajectory:"stable-around-40-with-20-second-live-pause",seesaw:"none",pauses:[{start:5,dur:20}],rr:()=>40,off:()=>0}
};
export function shuffleScenarioIds(random=Math.random){const ids=[...SCENARIO_IDS];for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;}
export function targetRate(id,t){const s=SCENARIOS[id];if(!s)throw new Error(`Unknown scenario: ${id}`);return s.rr(t);}
export function getScenarioMetadata(id){const s=SCENARIOS[id];if(!s)throw new Error(`Unknown scenario: ${id}`);return{scenario_id:s.id,cot_number:s.cot,baseline_rr:s.baseline,simulated_pattern:s.pattern,trajectory:s.trajectory,seesaw_pattern:s.seesaw,programmed_current_rr:Number(s.rr(0).toFixed(1)),baby_appearance:{...s.appearance},history_seconds:HISTORY_SECONDS,live_seconds:s.live,pauses:s.pauses.map(p=>({start_live_seconds:p.start,duration_seconds:p.dur}))};}