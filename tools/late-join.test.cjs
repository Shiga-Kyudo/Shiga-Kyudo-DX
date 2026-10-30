const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','late-join.js'),'utf8');
function root(){return {M:['先輩','本人','後輩'],A:{week:['先輩']},S:[{hi:1}],bunDraft:{sid:'session1',date:'2026-10-31',d:'2026-10',mode:'normal',order:['先輩'],data:{先輩:[true,false,null,true]}}};}
function setup(){const c={myMb:'本人',tab:'other',paint(){},CLICK_ID:{},CLICK_ATTR:[],wkOf:()=> 'week'};vm.createContext(c);vm.runInContext(code,c);c.lateJoinApply=()=>{};c.lateJoinSnapshot=root();return c;}
test('本人を左端＝最後尾へ追加し、出欠・既存の的中・記録を保持',()=>{
 const c=setup(),r=root(),before=JSON.stringify(r.bunDraft.data);const plan=c.lateJoinPlan(r,'本人');assert.deepEqual([...plan.draft.order],['本人','先輩']);assert.deepEqual([...r.A.week],['先輩','本人']);assert.equal(JSON.stringify(r.bunDraft.data),before);assert.deepEqual(r.S,[{hi:1}]);assert.deepEqual([...plan.draft.lateJoins],['本人']);
});
test('二度押しで重複せず、複数人の加入順も維持',()=>{
 const c=setup(),r=root();c.lateJoinPlan(r,'本人');assert(c.lateJoinPlan(r,'本人').already);c.lateJoinPlan(r,'後輩');assert.deepEqual([...r.bunDraft.order],['後輩','本人','先輩']);assert.equal(r.A.week.filter(x=>x==='本人').length,1);
});
test('進行中なし・個人未ログイン・名簿外・試合・編集中・未準備を拒否',()=>{
 const c=setup();assert.throws(()=>c.lateJoinPlan({},'本人'),/進行中/);for(const value of ['', '名簿外'])assert.throws(()=>c.lateJoinPlan(root(),value),/ログイン/);
 const r=root();delete r.bunDraft;assert.throws(()=>c.lateJoinPlan(r,'本人'),/進行中/);
 for(const mode of ['league_m','league_f','shinjin']){const r=root();r.bunDraft.mode=mode;assert.throws(()=>c.lateJoinPlan(r,'本人'),/試合/);}
 const edit=root();edit.bunDraft.editId=12;assert.throws(()=>c.lateJoinPlan(edit,'本人'),/編集中/);const empty=root();empty.bunDraft.order=[];assert.throws(()=>c.lateJoinPlan(empty,'本人'),/準備/);
});
test('同時入力で412になったら最新のデータを取り直してから追加',async()=>{
 const c=setup();let state=root(),revision=1,writes=0;
 c.lateJoinRequest=async opts=>{if(opts?.method==='PUT'){writes++;if(writes===1){state.bunDraft.data.先輩[2]=true;c.lateJoinPlan(state,'後輩');revision++;return {ok:false,status:412};}assert.equal(opts.headers['if-match'],String(revision));state=JSON.parse(opts.body);return {ok:true,status:200};}return {ok:true,headers:{get:()=>String(revision)},json:async()=>JSON.parse(JSON.stringify(state))};};
 await c.lateJoinSubmit();assert.equal(writes,2);assert.equal(state.bunDraft.data.先輩[2],true);assert.deepEqual(state.bunDraft.order,['本人','後輩','先輩']);assert.match(c.lateJoinMessage,/追加しました/);
});
test('途中で分附が終了・切替されたら、新しい分附へ勝手に追加しない',async()=>{
 for(const change of [r=>delete r.bunDraft,r=>{r.bunDraft.sid='next';}]){const c=setup();let writes=0;const r=root();change(r);c.lateJoinRequest=async opts=>{if(opts?.method==='PUT')writes++;return {ok:true,headers:{get:()=> 'tag'},json:async()=>r};};await c.lateJoinSubmit();assert.equal(writes,0);assert.match(c.lateJoinMessage,/進行中|切り替わり/);}
});
test('ETagなし・通信エラーで書かず、競合の再試行回数を制限',async()=>{
 const c=setup();let writes=0;c.lateJoinRequest=async opts=>{if(opts?.method==='PUT'){writes++;return {ok:false,status:412};}return {ok:true,headers:{get:()=> 'tag'},json:async()=>root()};};await c.lateJoinSubmit();assert.equal(writes,5);assert.match(c.lateJoinMessage,/更新中/);
 c.lateJoinRequest=async()=>({ok:true,headers:{get:()=>null},json:async()=>root()});await c.lateJoinSubmit();assert.match(c.lateJoinMessage,/同期状態/);
});
test('確認中に個人ログインが切り替わったら送信しない',async()=>{
 const c=setup();let writes=0;c.lateJoinRequest=async opts=>{if(opts?.method==='PUT')writes++;c.myMb='後輩';return {ok:true,headers:{get:()=> 'tag'},json:async()=>root()};};await c.lateJoinSubmit();assert.equal(writes,0);assert.match(c.lateJoinMessage,/ログイン情報/);
});
test('Firebaseの添字オブジェクトと、入力済みの欠席者の列を保持',()=>{
 const c=setup(),r=root();r.M={0:'先輩',1:'本人'};r.bunDraft.order={0:'先輩'};r.A.week=[];c.lateJoinPlan(r,'本人');assert.deepEqual([...r.bunDraft.order],['本人','先輩']);
});
test('分附表は出欠ストリームが遅れても途中加入者を表示し、後続の古い順序にも対応',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),start=html.indexOf('function bunLateMembers()'),end=html.indexOf('function bunShotCount()',start);
 const c={_loading:false,bunSid:'s',bunMode:'normal',bunDraftRemote:{sid:'s',lateJoins:['本人']},M:['先輩','本人'],A:{week:['先輩']},bunOrder:['先輩'],bunData:{先輩:[true]},_normList:v=>v||[],attKey:()=> 'week',isLeagueMode:()=>false,membersSorted:()=>['先輩','本人'],scheduleDbPushDraft(){}};
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);assert.deepEqual([...c.getBunMembers()],['本人','先輩']);c.bunDraftRemote.sid='other';c.bunOrder=['先輩'];assert.deepEqual([...c.getBunMembers()],['先輩']);
});
