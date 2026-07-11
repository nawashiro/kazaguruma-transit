import { calculateModeratorUpdateTimestamp, calculateNextModeratorPubkeys, derivePendingModeratorApplications } from "../moderator-application-state";
const event=(id:string,pubkey:string,created_at:number,tags:string[][],content="")=>({id,pubkey,created_at,tags,content,kind:1111,sig:"sig"});
const discussion={id:"34550:creator:topic",dTag:"topic",title:"t",description:"d",authorPubkey:"creator",createdAt:10,moderators:[{pubkey:"mod"}],event:{...event("state","creator",10,[["d","topic"]]),kind:34550}};
describe("moderator application state",()=>{
 it("shows only latest non-moderator request at or after state timestamp",()=>{const results=derivePendingModeratorApplications(discussion,[event("old","a",9,[["a",discussion.id],["t","moderator-request"]]),event("same","a",10,[["a",discussion.id],["t","moderator-request"]]),event("new","a",11,[["a",discussion.id],["t","moderator-request"]]),event("mod","mod",12,[["a",discussion.id],["t","moderator-request"]])]);expect(results.map(x=>x.id)).toEqual(["new"])});
 it("calculates a monotonic timestamp and next set",()=>{expect(calculateNextModeratorPubkeys(["a","b"],["c"],["d"],["b"])).toEqual(["a","c","d"]);expect(calculateModeratorUpdateTimestamp(10,[{id:"x",applicantPubkey:"a",createdAt:12,reason:"",event:event("x","a",12,[])}],11)).toBe(13)});
});
