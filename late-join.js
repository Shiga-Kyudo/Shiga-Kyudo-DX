/* 個人ログイン中の本人を、進行中の正規練・百射の最後尾へ追加。 */
var lateJoinBusy=false,lateJoinSnapshot=null,lateJoinMessage='',lateJoinChecked=false;
function lateJoinArray(v){if(Array.isArray(v))return v.slice();return v&&typeof v==='object'?Object.keys(v).sort(function(a,b){return +a-+b;}).map(function(k){return v[k];}):[];}
function lateJoinError(message){throw new Error(message);}
function lateJoinPlan(root,name,expected){
  if(!name)lateJoinError('マイページで本人としてログインしてください。');
  var draft=root&&root.bunDraft;
  if(!draft||!draft.sid||!draft.date||!draft.d)lateJoinError('現在、進行中の分附はありません。');
  if(lateJoinArray(root.M).indexOf(name)<0)lateJoinError('マイページで本人としてログインしてください。');
  if(expected&&(draft.sid!==expected.sid||draft.date!==expected.date))lateJoinError('分附が終了または切り替わりました。状況を更新してください。');
  if(['normal','hyakusha'].indexOf(draft.mode)<0||draft.editId)lateJoinError('試合形式・記録の編集中は途中加入できません。');
  var week=wkOf(draft.date);if(!week)lateJoinError('分附の日付を確認できません。');
  var order=lateJoinArray(draft.order),joined=lateJoinArray(draft.lateJoins),data=draft.data||{},attendance=root.A&&root.A[week];
  var members=attendance==null?order.slice():lateJoinArray(attendance);
  var filled=function(n){return lateJoinArray(data[n]).some(function(v){return v!=null;});};
  var active=joined.filter(function(n){return order.indexOf(n)<0;}).reverse().concat(order.filter(function(n){return members.indexOf(n)>=0||filled(n)||joined.indexOf(n)>=0;}));
  if(!order.length)lateJoinError('分附の入力準備が完了していません。');
  if(active.indexOf(name)>=0)return {root:root,already:true,draft:draft,week:week};
  // Firebaseで末尾のnullが省略されても列として残るよう、順序と出席に登録する。
  // 既存の的中データを触らず、元の順序を維持したまま先頭＝左端へ追加。
  draft.order=[name].concat(active.filter(function(n){return n!==name;}));
  draft.lateJoins=joined.indexOf(name)>=0?joined:joined.concat([name]);
  root.A=root.A||{};root.A[week]=members.indexOf(name)>=0?members:members.concat([name]);
  draft.updatedAt=Date.now();draft.by='late-join';
  return {root:root,already:false,draft:draft,week:week};
}
function lateJoinRequest(options){return dbFetch(DB,options);}
function lateJoinApply(root){
  // 本体の三者比較を使い、手元の未送信出欠を消さずに取り込む。
  _mergeSec('M',root.M);_mergeSec('A',root.A||{});_afterApply(['M','A']);
  bunDraftRemote=_normDraft(root.bunDraft);
  if(tab==='input'&&bunStep==='input'&&bunSid===bunDraftRemote.sid){bunOrder=bunDraftRemote.order;_applyDraftData(bunDraftRemote.data||{});_repaintKeepScroll();}
}
function tLateJoin(){
  var name=myMb||'',dr=lateJoinSnapshot&&lateJoinSnapshot.bunDraft;
  var enabled=!!name&&!lateJoinBusy&&lateJoinChecked&&!!dr&&!!dr.sid&&['normal','hyakusha'].indexOf(dr.mode)>=0&&!dr.editId;
  return feedbackHeading('途中加入申請')+'<div class="card" style="text-align:center"><p style="color:var(--sub);font-size:12px">マイページのログイン情報と連動しています。</p><p style="font-size:17px;font-weight:700">'+(name?esc(name)+' さん': 'マイページで個人ログインしてください')+'</p>'
    +'<div role="status" style="font-size:13px;color:var(--sub);min-height:44px">'+esc(lateJoinBusy?'確認・処理中…':lateJoinMessage||'現在の分附を確認しています。')+'</div>'
    +(dr&&dr.order?'<p style="font-size:12px;color:var(--sub);overflow-wrap:anywhere">参加順（先頭 → 最後尾）<br>'+lateJoinArray(dr.order).reverse().map(esc).join(' → ')+'</p>':'')
    +'<button id="late-join-submit" class="btn prim" style="width:min(100%,260px);min-height:180px;margin:24px auto;font-size:36px;border-radius:24px;display:block;'+(enabled?'':'opacity:.45')+'" '+(enabled?'':'disabled')+'>'+(lateJoinBusy?'処理中…':'途中加入')+'</button>'
    +'<p style="font-size:12px;color:var(--sub)">進行中の分附の最後尾（表の左端）へ、自分を追加します。既に参加している場合は重複追加しません。</p><button id="late-join-refresh" class="btn bh" '+(lateJoinBusy?'disabled':'')+'>状況を更新</button>'
    +(!name?'<button class="btn bh" data-tab="self" style="margin-left:8px">マイページへ</button>':'')+'</div>';
}
async function lateJoinRefresh(){
  if(lateJoinBusy)return;lateJoinBusy=true;lateJoinChecked=false;lateJoinMessage='';paint();
  var name=myMb;
  try{var response=await lateJoinRequest();if(!response.ok)throw Error('通信に失敗しました。状況を更新してください。');var root=await response.json();if(myMb!==name)throw Error('ログイン情報が変わりました。状況を更新してください。');
    lateJoinSnapshot=root;var result=lateJoinPlan(JSON.parse(JSON.stringify(root)),name);
    lateJoinMessage=result.already?'既にこの分附に参加しています。':result.draft.date+' の分附が進行中です。';lateJoinChecked=true;
  }catch(e){lateJoinSnapshot=null;lateJoinMessage=e.message||'確認できませんでした。';}finally{lateJoinBusy=false;if(tab==='other')paint();}
}
async function lateJoinSubmit(){
  if(lateJoinBusy)return;var name=myMb,expected=lateJoinSnapshot&&lateJoinSnapshot.bunDraft;
  if(!name||!expected){lateJoinMessage='マイページの個人ログインと、進行中の分附を確認してください。';paint();return;}
  lateJoinBusy=true;lateJoinMessage='';paint();
  try{
    // 出欠と順序を同時に更新。競合時は全体を再取得して再計算し、他端末の入力を保持。
    for(var attempt=0;attempt<5;attempt++){
      var response=await lateJoinRequest({headers:{'X-Firebase-ETag':'true'}});
      if(!response.ok)throw Error('最新の分附を取得できませんでした。状況を更新してください。');
      var root=await response.json(),etag=response.headers.get('ETag');
      if(myMb!==name)throw Error('ログイン情報が変わったため、加入を中止しました。');
      var result=lateJoinPlan(root,name,expected);
      if(result.already){lateJoinSnapshot=root;lateJoinMessage='既にこの分附に参加しています。';lateJoinApply(root);return;}
      if(!etag)throw Error('同期状態を確認できません。状況を更新してください。');
      var saved=await lateJoinRequest({method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(result.root)});
      if(saved.status===412)continue;
      if(!saved.ok)throw Error('加入を確認できませんでした。「状況を更新」で参加状況を確認してください。');
      lateJoinSnapshot=root;lateJoinApply(root);lateJoinMessage=name+' さんを分附の最後尾に追加しました。';return;
    }
    throw Error('他の端末で更新中です。少し待ってからもう一度お試しください。');
  }catch(e){lateJoinMessage=e.message||'加入できませんでした。状況を更新してください。';}finally{lateJoinBusy=false;if(tab==='other')paint();}
}
CLICK_ID['late-join-submit']=lateJoinSubmit;CLICK_ID['late-join-refresh']=lateJoinRefresh;
CLICK_ATTR.push(['data-late-join-open',function(){feedbackView='join';lateJoinSnapshot=null;lateJoinChecked=false;lateJoinMessage='';paint();lateJoinRefresh();}]);
