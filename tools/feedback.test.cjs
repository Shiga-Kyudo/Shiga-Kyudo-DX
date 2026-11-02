const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','feedback.js'),'utf8');
function setup(){
  const calls=[];
  const c={DB:'https://example.test/kyudo',FB_API_KEY:'test',adminMode:false,tab:'other',CLICK_ID:{},CLICK_ATTR:[],INPUT_ID:{},paint(){},lockNow(){c.adminMode=false;},esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),document:{getElementById:()=>null,addEventListener(){}},authToken:async()=>'anonymous',crypto:require('node:crypto').webcrypto,AbortController,setTimeout,clearTimeout,window:{confirm:()=>true},fetch:async(url,opts)=>{calls.push({url,...opts});return {ok:true,json:async()=>null};}};
  vm.createContext(c);vm.runInContext(code,c);return {c,calls};
}
test('一般画面に管理ボタン・未承認本文を表示せず、本文のHTMLをエスケープ',()=>{
  const {c}=setup();c.feedbackItems=[{id:'a',body:'秘密',createdAt:1,status:'pending'}];
  assert(!c.tOther().includes('意見箱の管理'));c.feedbackView='review';assert(!c.tOther().includes('秘密'));
  c.feedbackView='board';c.feedbackBoard=[{body:'<img onerror=alert(1)>',createdAt:1}];assert(c.tOther().includes('&lt;img'));assert(!c.tOther().includes('<img'));
});
test('匿名投稿に名前や部員識別子を送信しない',async()=>{
  const {c,calls}=setup();c.myMb='投稿者';c.feedbackDraft='練習時間を見直したい';await c.feedbackSend();
  assert.equal(calls.length,1);assert.match(calls[0].url,/clubFeedback\/.+\.json\?auth=anonymous$/);
  assert.deepEqual(Object.keys(JSON.parse(calls[0].body)).sort(),['body','createdAt','status']);
  assert.equal(c.feedbackView,'sent');assert.equal(c.feedbackDraft,'');
});
test('通信失敗時は本文を保持し、同じ内容の再送に同じIDと時刻を使う',async()=>{
  const {c,calls}=setup();c.feedbackDraft='改善案';let attempts=0;
  c.fetch=async(url,opts)=>{calls.push({url,...opts});if(!attempts++)throw Error('offline');return {ok:true,json:async()=>null};};
  await c.feedbackSend();assert.equal(c.feedbackDraft,'改善案');assert(c.feedbackError);await c.feedbackSend();
  assert.equal(calls[0].url,calls[1].url);assert.equal(calls[0].body,calls[1].body);
});
test('管理者PINの表示状態だけでは未承認の取得も承認も送信できない',async()=>{
  const {c,calls}=setup();c.adminMode=true;await assert.rejects(c.feedbackRequest('clubFeedback','GET',undefined,true),/DENIED/);
  await c.feedbackModerate('a',true);assert.equal(calls.length,0);
});
test('掲載は管理トークンによる一括更新、未承認本文を掲示板に混ぜない',async()=>{
  const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin-token'};
  c.feedbackItems=[{id:'a',body:'改善案',createdAt:1,status:'pending'},{id:'b',body:'非公開',createdAt:2,status:'pending'}];
  await c.feedbackModerate('a',true);assert.equal(calls.length,1);assert.equal(calls[0].method,'PATCH');
  assert.match(calls[0].url,/auth=admin-token$/);const update=JSON.parse(calls[0].body);
  assert.equal(update['clubFeedback/a/status'],'published');assert.equal(update['clubBoard/a'].body,'改善案');assert(!calls[0].body.includes('非公開'));
});
test('非掲載処理は掲示板へ書き込まず、ロック時は管理者本文を破棄',async()=>{
  const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackItems=[{id:'a',body:'改善案',createdAt:1,status:'pending'}];
  await c.feedbackModerate('a',false);assert(!calls[0].body.includes('clubBoard'));c.lockNow();assert.equal(c.feedbackItems.length,0);assert.equal(c.feedbackAdmin,null);
});
test('空欄・文字数超過は送信しない',async()=>{
  const {c,calls}=setup();c.feedbackDraft=' ';await c.feedbackSend();c.feedbackDraft='あ'.repeat(2001);await c.feedbackSend();assert.equal(calls.length,0);
});
test('ロック前に開始した取得が遅れて完了しても未承認本文を復元しない',async()=>{
  const {c}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackView='review';let complete;
  c.feedbackRequest=()=>new Promise(r=>{complete=r;});const promise=c.feedbackRefresh();c.lockNow();complete({a:{body:'秘密',createdAt:1,status:'pending'}});await promise;assert.equal(c.feedbackItems.length,0);
});
test('返信保存は管理者だけが行え、承認前は掲示板へ送らない',async()=>{
  const {c,calls}=setup();c.feedbackItems=[{id:'a',body:'意見',createdAt:1,status:'pending'}];c.feedbackReplyDrafts.a='回答';
  await c.feedbackSaveReply('a');assert.equal(calls.length,0);
  c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};await c.feedbackSaveReply('a');
  assert.deepEqual(JSON.parse(calls[0].body),{'clubFeedback/a/reply':'回答'});assert.equal(c.feedbackItems[0].reply,'回答');
});
test('未保存の返信も承認時に意見と一緒に一括で掲載する',async()=>{
  const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};
  c.feedbackItems=[{id:'a',body:'意見',createdAt:1,status:'pending',reply:'旧返信'}];c.feedbackReplyDrafts.a=' 新しい返信\n二行目 ';let confirmation='';c.window.confirm=msg=>{confirmation=msg;return true;};
  await c.feedbackModerate('a',true);const update=JSON.parse(calls[0].body);
  assert.equal(update['clubFeedback/a/reply'],'新しい返信\n二行目');assert.equal(update['clubBoard/a'].reply,'新しい返信\n二行目');assert.match(confirmation,/新しい返信/);
});
test('掲載済みの返信を更新・空欄にすると私用と掲示板を同時に更新する',async()=>{
  const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackItems=[{id:'a',body:'意見',createdAt:1,status:'published',reply:'回答'}];
  c.feedbackReplyDrafts.a='訂正した回答';await c.feedbackSaveReply('a');assert.deepEqual(JSON.parse(calls[0].body),{'clubFeedback/a/reply':'訂正した回答','clubBoard/a/reply':'訂正した回答'});
  c.feedbackReplyDrafts.a='';await c.feedbackSaveReply('a');assert.deepEqual(JSON.parse(calls[1].body),{'clubFeedback/a/reply':null,'clubBoard/a/reply':null});
});
test('返信保存に失敗しても下書きを残し、ロック時は破棄する',async()=>{
  const {c}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackItems=[{id:'a',body:'意見',createdAt:1,status:'pending'}];c.feedbackReplyDrafts.a='残す回答';c.fetch=async()=>{throw Error('offline');};
  await c.feedbackSaveReply('a');assert.equal(c.feedbackReplyDrafts.a,'残す回答');assert(c.feedbackError);c.lockNow();assert.equal(Object.keys(c.feedbackReplyDrafts).length,0);
});
test('返信のHTMLをエスケープし、旧データの返信なしも表示できる',()=>{
  const {c}=setup();assert(c.feedbackCard({body:'意見',createdAt:1,reply:'<script>bad</script>'},'').includes('&lt;script&gt;'));assert(!c.feedbackCard({body:'意見',createdAt:1},'').includes('管理者からの返信'));
});
test('長すぎる返信と承認キャンセルは書き込まない',async()=>{
  const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackItems=[{id:'a',body:'意見',createdAt:1,status:'pending'}];c.feedbackReplyDrafts.a='あ'.repeat(2001);
  await c.feedbackSaveReply('a');await c.feedbackModerate('a',true);assert.equal(calls.length,0);c.feedbackReplyDrafts.a='回答';c.window.confirm=()=>false;await c.feedbackModerate('a',true);assert.equal(calls.length,0);
});
test('管理者認証のある人だけ掲示板削除ボタンを使える',async()=>{
 const {c,calls}=setup();const item={id:'a',body:'意見',createdAt:1,reply:'返信',status:'published'};c.feedbackBoard=[item];c.feedbackItems=[item];c.feedbackView='board';
 assert(!c.tOther().includes('掲示板から削除'));c.adminMode=true;assert(!c.tOther().includes('掲示板から削除'));await c.feedbackDeletePublication('a');assert.equal(calls.length,0);
 c.feedbackAdmin={getIdToken:async()=>'admin'};assert(c.tOther().includes('掲示板から削除'));c.feedbackView='review';assert(c.tOther().includes('掲示板から削除'));
});
test('掲示板の意見と返信だけを一括削除し、原文と返信を意見箱に残す',async()=>{
 const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackBoard=[{id:'a',body:'意見',reply:'返信',createdAt:1}];c.feedbackItems=[{id:'a',body:'意見',reply:'返信',createdAt:1,status:'published'}];
 await c.feedbackDeletePublication('a');assert.deepEqual(JSON.parse(calls[0].body),{'clubBoard/a':null,'clubFeedback/a/status':'held'});assert.match(calls[0].url,/auth=admin$/);assert.equal(c.feedbackBoard.length,0);assert.equal(c.feedbackItems[0].body,'意見');assert.equal(c.feedbackItems[0].reply,'返信');assert.equal(c.feedbackItems[0].status,'held');
});
test('掲示板削除のキャンセル・通信失敗時は掲載データを消さない',async()=>{
 const {c,calls}=setup();c.adminMode=true;c.feedbackAdmin={getIdToken:async()=>'admin'};c.feedbackBoard=[{id:'a',body:'意見',createdAt:1}];c.window.confirm=()=>false;await c.feedbackDeletePublication('a');assert.equal(calls.length,0);assert.equal(c.feedbackBoard.length,1);
 c.window.confirm=()=>true;c.fetch=async()=>{throw Error('offline');};await c.feedbackDeletePublication('a');assert.equal(c.feedbackBoard.length,1);assert(c.feedbackError);
});
test('物出しっぱなしの新規罰則は3点、記録済み5点は保持',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const start=html.indexOf('var PTYPES='),end=html.indexOf('function delPenalty(',start);assert(start>=0);
 const types=html.slice(start,html.indexOf('];',start)+2);const save=html.slice(html.indexOf('function doSavePenalty(){',start),end);
 const c={P:[{id:1,ptype:5,pts:5}],penForm:{mb:'本人',date:'2026-11-02',kind:'add',ptype:5,heavy:false},Date,svP(){},fl(){},paint(){}};vm.createContext(c);vm.runInContext(types+'\n'+save,c);c.doSavePenalty();assert.equal(c.P[0].pts,5);assert.equal(c.P[1].pts,3);
 c.penForm.mb='本人';c.penForm.heavy=true;c.doSavePenalty();assert.equal(c.P[2].pts,8);
});
