/* 意見箱は既存のkyudo同期から分離。未承認本文は管理者以外読み取れないルールを使う。 */
var feedbackView='menu',feedbackDraft='',feedbackItems=[],feedbackBoard=[],feedbackBusy=false;
var feedbackReplyDrafts={};
var feedbackError='',feedbackLoaded=false,feedbackAdmin=null,feedbackSDK=null,feedbackSubmitId='',feedbackSubmitTime=0,feedbackSession=0;
// 管理者アカウントは認証方式の確定後、database.rules.jsonと合わせて設定する。
var FEEDBACK_ADMIN_EMAIL='shigakyudo@gmail.com';
var FEEDBACK_ROOT=DB.replace(/\/kyudo\/?$/,'');
function feedbackHeading(title){return '<div class="row" style="margin-bottom:16px"><button class="btn bh" data-feedback-view="menu">‹ その他</button><h2 style="font-size:18px;margin:0">'+title+'</h2></div>';}
function feedbackCard(item,actions){return '<article class="card mb10"><div style="font-size:11px;color:var(--sub);margin-bottom:8px">匿名の意見 · '+esc(new Date(item.publishedAt||item.createdAt).toLocaleDateString('ja-JP'))+'</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(item.body)+'</div>'+(item.reply?'<section style="margin-top:16px;padding:12px;background:var(--sec);border-left:3px solid var(--acc);border-radius:6px"><strong style="font-size:12px;color:var(--acc)">管理者からの返信</strong><div style="margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere">'+esc(item.reply)+'</div></section>':'')+actions+'</article>';}
function feedbackReplyValue(item){return Object.prototype.hasOwnProperty.call(feedbackReplyDrafts,item.id)?feedbackReplyDrafts[item.id]:item.reply||'';}
function feedbackReplyEditor(item){return '<label for="feedback-reply-'+esc(item.id)+'">管理者の返信（任意・2,000文字まで）</label><textarea class="feedback-text" style="min-height:120px" id="feedback-reply-'+esc(item.id)+'" data-feedback-reply="'+esc(item.id)+'" maxlength="2000" placeholder="対応方針や回答を記入してください。" '+(feedbackBusy?'disabled':'')+'>'+esc(feedbackReplyValue(item))+'</textarea><p style="font-size:11px;color:var(--sub);margin:4px 0 10px">承認すると返信も一緒に公開されます。掲載済みの場合、保存すると掲示板の返信も更新されます。</p><button class="btn bh" data-feedback-reply-save="'+esc(item.id)+'" '+(feedbackBusy?'disabled':'')+'>返信を保存</button>';}
function tOther(){
  var css='<style>.other-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:24px 12px}.other-app{border:0;background:none;font:inherit;color:var(--ink);cursor:pointer;text-align:center}.other-icon{display:grid;place-items:center;width:82px;height:82px;margin:0 auto 10px;border-radius:23px;box-shadow:0 7px 16px #26241f15;font-size:36px}.other-desc{display:block;font-size:11px;color:var(--sub);margin-top:4px}.feedback-error{background:var(--acc-bg);color:var(--bad);padding:12px;border-radius:9px;margin-bottom:12px}.feedback-text{width:100%;min-height:200px;resize:vertical;border:1px solid var(--ln2);border-radius:10px;padding:12px;font:inherit;background:var(--sf);color:var(--ink);box-sizing:border-box}</style>';
  if(feedbackView==='join')return tLateJoin();
  var error=feedbackError?'<div role="alert" class="feedback-error">'+esc(feedbackError)+'</div>':'';
  if(feedbackView==='menu')return css+'<h2 style="font-size:20px;margin:6px 0">その他</h2><p style="color:var(--sub);margin:0">部活を、もっとよくするために。</p><div class="other-grid"><button class="other-app" data-feedback-view="submit"><span class="other-icon" style="background:linear-gradient(145deg,#f5e0cf,#e8b791)" aria-hidden="true">✉️</span><strong>意見箱</strong><span class="other-desc">改善案・幹部への要望</span></button><button class="other-app" data-feedback-view="board"><span class="other-icon" style="background:linear-gradient(145deg,#dceae1,#a8c7b3)" aria-hidden="true">📋</span><strong>掲示板</strong><span class="other-desc">みんなの声を読む</span></button><button class="other-app" data-late-join-open="1"><span class="other-icon" style="background:linear-gradient(145deg,#dbe4f6,#9fb8df)" aria-hidden="true">🏹</span><strong>途中加入申請</strong><span class="other-desc">進行中の分附に参加</span></button></div>'+(adminMode?'<button class="btn bh" style="width:100%" data-feedback-view="review">意見箱の管理 ›</button>':'');
  if(feedbackView==='submit')return css+feedbackHeading('意見箱')+error+'<div class="card"><p style="margin-top:0">部活の改善案や幹部への要望を、自由にお書きください。</p><p style="font-size:12px;color:var(--sub)">名前・部員番号は送信しません。本文は管理者が確認し、承認するとそのまま掲示板に掲載されます。名前など、公開したくない情報は本文に書かないでください。</p><label for="feedback-body">意見・要望（2,000文字まで）</label><textarea id="feedback-body" class="feedback-text" maxlength="2000" placeholder="こんな部活にしたい、ここを改善してほしい…" '+(feedbackBusy?'disabled':'')+'>'+esc(feedbackDraft)+'</textarea><div id="feedback-count" style="text-align:right;font-size:11px;color:var(--sub)">'+feedbackDraft.length+' / 2,000</div><button id="feedback-send" class="btn prim" '+(feedbackBusy?'disabled':'')+'>'+(feedbackBusy?'送信中…':'匿名で送信する')+'</button></div>';
  if(feedbackView==='sent')return css+feedbackHeading('意見箱')+'<div class="card" role="status"><h3>送信しました</h3><p>ご意見ありがとうございます。管理者が確認し、承認された意見は掲示板に掲載されます。</p><button class="btn bh" data-feedback-view="menu">メニューに戻る</button></div>';
  if(feedbackView==='board')return css+feedbackHeading('掲示板')+'<p style="font-size:12px;color:var(--sub)">管理者が掲載を承認した意見を紹介します。</p>'+error+'<button id="feedback-refresh" class="btn bh" '+(feedbackBusy?'disabled':'')+'>更新</button><div style="margin-top:12px">'+(feedbackBusy?'<div class="emp">読み込み中…</div>':feedbackBoard.length?feedbackBoard.map(function(x){return feedbackCard(x,'');}).join(''):'<div class="emp">'+(feedbackLoaded?'掲載された意見はまだありません。':'更新ボタンで意見を読み込めます。')+'</div>')+'</div>';
  if(!adminMode)return css+feedbackHeading('意見箱の管理')+'<div class="emp">管理者モードで開いてください。</div>';
  return css+feedbackHeading('意見箱の管理')+error+(!feedbackAdmin?'<div class="card"><p>未承認の意見を確認するには、管理者のGoogleアカウントでログインします。</p><button id="feedback-google" class="btn prim" '+(feedbackBusy?'disabled':'')+'>Googleで管理者認証</button></div>':'<div class="row" style="margin-bottom:12px"><button id="feedback-refresh" class="btn bh" '+(feedbackBusy?'disabled':'')+'>更新</button><button id="feedback-signout" class="btn bh">管理者認証を終了</button></div>'+(feedbackBusy?'<div class="emp">処理中…</div>':feedbackItems.length?feedbackItems.map(function(x){return feedbackCard(x,feedbackReplyEditor(x)+(x.status==='published'?'<p style="color:var(--good);font-size:12px">掲載済み</p>':x.status==='held'?'<p style="color:var(--sub);font-size:12px">非掲載</p>':'<div class="row" style="margin-top:14px"><button class="btn bg" data-feedback-approve="'+esc(x.id)+'">掲示板への掲載を確認</button><button class="btn bh" data-feedback-hold="'+esc(x.id)+'">非掲載にする</button></div>'));}).join(''):'<div class="emp">届いた意見はまだありません。</div>'));
}
function feedbackMessage(e){return e&&e.message==='NOT_CONFIGURED'?'意見箱の接続設定は準備中です。':e&&e.message==='DENIED'?'アクセスできませんでした。管理者認証・接続設定を確認してください。':'通信に失敗しました。入力内容は残っています。接続を確認して再度お試しください。';}
async function feedbackRequest(path,method,value,asAdmin){
  var token;
  if(asAdmin){if(!adminMode||!feedbackAdmin)throw new Error('DENIED');token=await feedbackAdmin.getIdToken();}
  else{token=await authToken();if(!token)throw new Error('DENIED');}
  var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},20000),response;
  try{response=await fetch(FEEDBACK_ROOT+'/'+path+'.json?auth='+encodeURIComponent(token),{method:method||'GET',headers:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:controller.signal});}
  finally{clearTimeout(timeout);}
  if(!response.ok)throw new Error(response.status===401||response.status===403?'DENIED':'NETWORK');
  return response.json();
}
function feedbackList(data){return Object.keys(data||{}).map(function(id){return Object.assign({id:id},data[id]);}).sort(function(a,b){return (b.publishedAt||b.createdAt)-(a.publishedAt||a.createdAt);});}
async function feedbackRefresh(){
  if(feedbackBusy)return;feedbackBusy=true;feedbackError='';paint();
  var session=feedbackSession;
  try{if(feedbackView==='review'){var items=feedbackList(await feedbackRequest('clubFeedback','GET',undefined,true));if(session===feedbackSession&&adminMode&&feedbackAdmin)feedbackItems=items;}else{feedbackBoard=feedbackList(await feedbackRequest('clubBoard'));feedbackLoaded=true;}}
  catch(e){feedbackError=feedbackMessage(e);}finally{feedbackBusy=false;if(tab==='other')paint();}
}
async function feedbackSend(){
  if(feedbackBusy)return;
  var body=feedbackDraft.trim();if(!body||body.length>2000){feedbackError='1〜2,000文字で入力してください。';paint();return;}
  // 同じ本文の再送は同じID。応答が途切れても別の投稿を増やさない。
  if(!feedbackSubmitId){feedbackSubmitId=crypto.randomUUID();feedbackSubmitTime=Date.now();}
  feedbackBusy=true;feedbackError='';paint();
  try{await feedbackRequest('clubFeedback/'+feedbackSubmitId,'PUT',{body:body,createdAt:feedbackSubmitTime,status:'pending'});feedbackDraft='';feedbackSubmitId='';feedbackView='sent';}
  catch(e){feedbackError=feedbackMessage(e);}finally{feedbackBusy=false;paint();}
}
async function feedbackLogin(){
  if(!FEEDBACK_ADMIN_EMAIL){feedbackError=feedbackMessage(new Error('NOT_CONFIGURED'));paint();return;}
  if(feedbackBusy)return;feedbackBusy=true;feedbackError='';paint();
  try{
    if(!feedbackSDK){
      var appSDK=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
      var authSDK=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
      var app=appSDK.initializeApp({apiKey:FB_API_KEY,authDomain:'shiga-kyudo-dx.firebaseapp.com',projectId:'shiga-kyudo-dx'},'feedback-admin');
      var auth=authSDK.getAuth(app);await authSDK.setPersistence(auth,authSDK.inMemoryPersistence);
      feedbackSDK={sdk:authSDK,auth:auth};
      // ネットワーク読み込み後はポップアップがブロックされ得るため、次の直接タップで認証する。
      feedbackError='認証の準備ができました。もう一度「Googleで管理者認証」を押してください。';return;
    }
    var provider=new feedbackSDK.sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    var result=await feedbackSDK.sdk.signInWithPopup(feedbackSDK.auth,provider);
    if(!adminMode||result.user.email!==FEEDBACK_ADMIN_EMAIL||!result.user.emailVerified){await feedbackSDK.sdk.signOut(feedbackSDK.auth);throw new Error('DENIED');}
    feedbackAdmin=result.user;
  }catch(e){feedbackError=feedbackMessage(e);}finally{feedbackBusy=false;paint();}
  if(feedbackAdmin)feedbackRefresh();
}
function feedbackLogout(){feedbackSession++;feedbackAdmin=null;feedbackItems=[];feedbackReplyDrafts={};if(feedbackSDK)feedbackSDK.sdk.signOut(feedbackSDK.auth).catch(function(){});}
async function feedbackSaveReply(id){
  if(feedbackBusy||!adminMode||!feedbackAdmin)return;
  var item=feedbackItems.find(function(x){return x.id===id;});if(!item)return;
  var reply=feedbackReplyValue(item).trim(),session=feedbackSession;
  if(reply.length>2000){feedbackError='返信は2,000文字以内で入力してください。';paint();return;}
  feedbackBusy=true;feedbackError='';paint();
  try{
    var updates={};updates['clubFeedback/'+id+'/reply']=reply||null;
    if(item.status==='published')updates['clubBoard/'+id+'/reply']=reply||null;
    await feedbackRequest('','PATCH',updates,true);
    if(session===feedbackSession){item.reply=reply;delete feedbackReplyDrafts[id];if(typeof fl==='function')fl('返信を保存しました');}
  }catch(e){feedbackError=feedbackMessage(e);}finally{feedbackBusy=false;paint();}
}
async function feedbackModerate(id,publish){
  if(feedbackBusy||!adminMode||!feedbackAdmin)return;
  var item=feedbackItems.find(function(x){return x.id===id;});if(!item||item.status!=='pending')return;
  var reply=feedbackReplyValue(item).trim();
  if(reply.length>2000){feedbackError='返信は2,000文字以内で入力してください。';paint();return;}
  if(publish&&!window.confirm('この意見と返信を、掲示板ですべての利用者に公開しますか？\n\n【意見】\n'+item.body+(reply?'\n\n【管理者からの返信】\n'+reply:'')))return;
  feedbackBusy=true;feedbackError='';paint();
  try{
    var updates={};updates['clubFeedback/'+id+'/status']=publish?'published':'held';
    if(publish){
      updates['clubFeedback/'+id+'/reply']=reply||null;
      updates['clubBoard/'+id]={body:item.body,createdAt:item.createdAt,publishedAt:{'.sv':'timestamp'}};
      if(reply)updates['clubBoard/'+id].reply=reply;
    }
    // 一括更新で、掲載と審査状態を同時に確定する。
    await feedbackRequest('','PATCH',updates,true);
    item.status=publish?'published':'held';
    if(publish){item.reply=reply;delete feedbackReplyDrafts[id];}
  }catch(e){feedbackError=feedbackMessage(e);}finally{feedbackBusy=false;paint();}
}
CLICK_ID['feedback-send']=feedbackSend;
CLICK_ID['feedback-refresh']=feedbackRefresh;
CLICK_ID['feedback-google']=feedbackLogin;
CLICK_ID['feedback-signout']=function(){feedbackLogout();paint();};
CLICK_ATTR.push(['data-feedback-view',function(el){if(feedbackBusy)return;feedbackView=el.getAttribute('data-feedback-view');feedbackError='';paint();if(feedbackView==='board'||(feedbackView==='review'&&feedbackAdmin))feedbackRefresh();}]);
CLICK_ATTR.push(['data-feedback-approve',function(el){feedbackModerate(el.getAttribute('data-feedback-approve'),true);}]);
CLICK_ATTR.push(['data-feedback-hold',function(el){feedbackModerate(el.getAttribute('data-feedback-hold'),false);}]);
CLICK_ATTR.push(['data-feedback-reply-save',function(el){feedbackSaveReply(el.getAttribute('data-feedback-reply-save'));}]);
document.addEventListener('input',function(ev){var el=ev.target;if(adminMode&&feedbackAdmin&&el.hasAttribute&&el.hasAttribute('data-feedback-reply'))feedbackReplyDrafts[el.getAttribute('data-feedback-reply')]=el.value;});
INPUT_ID['feedback-body']=function(el){feedbackDraft=el.value;feedbackSubmitId='';var counter=document.getElementById('feedback-count');if(counter)counter.textContent=feedbackDraft.length+' / 2,000';};
var feedbackOriginalLock=lockNow;
lockNow=function(){feedbackLogout();feedbackOriginalLock();};
