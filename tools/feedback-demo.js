/* ローカル開発サーバーが ?preview=other のときだけ読み込むデモ。 */
(function(){
  'use strict';
  var key='kyudo_feedback_preview_v1';
  function read(){var value=JSON.parse(localStorage.getItem(key)||'{"clubFeedback":{},"clubBoard":{}}');return value;}
  function copy(value){return JSON.parse(JSON.stringify(value));}
  function save(value){localStorage.setItem(key,JSON.stringify(value));}
  function stamp(value){if(value&&typeof value==='object'&&value['.sv']==='timestamp')return Date.now();if(value&&typeof value==='object'){Object.keys(value).forEach(function(k){value[k]=stamp(value[k]);});}return value;}
  feedbackRequest=async function(route,method,value,asAdmin){
    if(asAdmin&&(!adminMode||!feedbackAdmin))throw new Error('DENIED');
    var data=read(),parts=route.split('/'),result;
    method=method||'GET';
    if(method==='GET'){
      if(route==='clubFeedback'){if(!asAdmin)throw new Error('DENIED');result=data.clubFeedback;}
      else if(route==='clubBoard')result=data.clubBoard;
      else throw new Error('DENIED');
    }else if(method==='PUT'&&parts.length===2&&parts[0]==='clubFeedback'){
      if(!value||typeof value.body!=='string'||!value.body.trim()||value.body.length>2000||value.status!=='pending')throw new Error('DENIED');
      var previous=data.clubFeedback[parts[1]];
      if(previous&&JSON.stringify(previous)!==JSON.stringify(value))throw new Error('DENIED');
      data.clubFeedback[parts[1]]=copy(value);save(data);result=value;
    }else if(method==='PATCH'&&route===''&&asAdmin){
      var next=copy(data);
      Object.keys(value).forEach(function(p){
        var keys=p.split('/'),entry=data.clubFeedback[keys[1]];
        if(!entry)throw new Error('DENIED');
        if(keys[0]==='clubFeedback'&&keys[2]==='status'&&keys.length===3&&entry.status==='pending'&&['published','held'].includes(value[p]))next.clubFeedback[keys[1]].status=value[p];
        else if(keys.length===3&&keys[2]==='reply'&&['clubFeedback','clubBoard'].includes(keys[0])&&(value[p]===null||(typeof value[p]==='string'&&value[p].length<=2000))){
          if(!next[keys[0]][keys[1]])throw new Error('DENIED');
          if(value[p]===null)delete next[keys[0]][keys[1]].reply;else next[keys[0]][keys[1]].reply=value[p];
        }
        else if(keys[0]==='clubBoard'&&keys.length===2&&entry.status==='pending'&&value[p].body===entry.body){next.clubBoard[keys[1]]=stamp(copy(value[p]));}
        else throw new Error('DENIED');
      });
      save(next);result=null;
    }else throw new Error('DENIED');
    return copy(result);
  };
  function role(manager){
    if(feedbackBusy)return;
    feedbackLogout();adminMode=manager;shonaiMode=false;myMb='開発プレビュー';_loading=false;
    if(M.indexOf(myMb)<0)M.push(myMb);
    if(manager)feedbackAdmin={getIdToken:async function(){return 'preview-only';}};
    feedbackView='menu';feedbackError='';tab='other';paint();
    document.getElementById('preview-role').textContent=manager?'管理者として確認中':'部員として確認中';
  }
  CLICK_ID['feedback-google']=function(){role(true);feedbackView='review';feedbackRefresh();};
  var toolbar=document.createElement('div');toolbar.style.cssText='padding:12px 16px;background:#fff0bf;color:#382900;text-align:center;font-size:12px';
  toolbar.innerHTML='<strong>意見箱デモ</strong><div>投稿はこのブラウザー内だけに保存されます。本番には送信されません。</div><div id="preview-role" style="margin:8px 0;font-weight:700"></div><button class="btn bh" id="preview-member">部員として確認</button> <button class="btn bh" id="preview-manager">管理者として確認</button>';
  document.body.insertBefore(toolbar,document.body.firstChild);
  document.getElementById('preview-member').addEventListener('click',function(){role(false);});
  document.getElementById('preview-manager').addEventListener('click',function(){role(true);});
  // 分附も本番と別のローカルデータを使う。ETagの競合判定を再現する。
  var joinKey='kyudo_late_join_preview_v1';
  function readJoin(){return JSON.parse(localStorage.getItem(joinKey)||'{"revision":0,"root":{}}');}
  function writeJoin(state){localStorage.setItem(joinKey,JSON.stringify(state));}
  lateJoinRequest=async function(options){
    options=options||{};var state=readJoin(),tag='"'+state.revision+'"';
    if(options.method==='PUT'){
      if(options.headers['if-match']!==tag)return {ok:false,status:412};
      state={revision:state.revision+1,root:JSON.parse(options.body)};writeJoin(state);
    }
    return {ok:true,status:200,headers:{get:function(){return tag;}},json:async function(){return copy(state.root);}};
  };
  lateJoinApply=function(root){M=lateJoinArray(root.M);A=root.A||{};bunDraftRemote=_normDraft(copy(root.bunDraft));};
  var joinTools=document.createElement('div');joinTools.style.cssText='margin-top:10px';
  joinTools.innerHTML='<button class="btn bh" id="preview-bun-start">分附デモ開始</button> <button class="btn bh" id="preview-bun-end">分附デモ終了</button>';
  toolbar.appendChild(joinTools);
  document.getElementById('preview-bun-start').addEventListener('click',function(){
    if(lateJoinBusy)return;
    var date=todayStr(),attendance={},name=myMb||'開発プレビュー';attendance[wkOf(date)]=['デモ先輩'];
    var state=readJoin();writeJoin({revision:state.revision+1,root:{M:['デモ先輩',name],A:attendance,bunDraft:{sid:'demo-'+Date.now(),d:date.slice(0,7),date:date,mode:'normal',order:['デモ先輩'],data:{'デモ先輩':[true,false,null,true]},tate:1,tateList:[4]}}});
    feedbackView='join';tab='other';lateJoinRefresh();
  });
  document.getElementById('preview-bun-end').addEventListener('click',function(){
    if(lateJoinBusy)return;var state=readJoin();delete state.root.bunDraft;state.revision++;writeJoin(state);
    feedbackView='join';tab='other';lateJoinRefresh();
  });
  role(false);
})();
